import { parcheDesdeVersion } from "@/lib/champs";
import { getDataDragon } from "@/lib/ddragon";
import { TOTAL_ACCIONES } from "@/lib/draft";
import {
  SCHEMA_AGENTE,
  SCHEMA_PRO,
  SYSTEM_CONSENSO,
  SYSTEM_PRO,
  SYSTEM_SCOUT,
  contextoConsenso,
  origenDe,
  revisarOpciones,
  type RespuestaAgente,
  type RespuestaPro,
} from "@/lib/kuai/agentes";
import { ROLES, armarContextos, type Body, type Scouting } from "@/lib/kuai/contexto";
import type { AgenteVista, EventoKuai, Final, OpcionVista, Origen } from "@/lib/kuai/tipos";
import { getMetaPro, type MetaPro } from "@/lib/metaPro";
import { MODELO_DEFAULT, PRECIOS_MISTRAL, llamarMistral } from "@/lib/mistral";
import { esRiotIdValido, MAX_JUGADORES, normalizarRiotId, type JugadorDraft } from "@/lib/riotIds";
import { resumenesDesdeCache } from "@/lib/scouting";
import { requestConSesion } from "@/lib/sesion";

// 3 llamadas a Mistral (2 en paralelo + el consenso), le doy margen
export const maxDuration = 60;

const MAX_LARGO_POOL = 1500;
const OPCIONES_FINALES = 3;

// valido todo lo que viene del cliente: cada llamada gasta creditos de Mistral y el texto termina en el prompt
function validarBody(crudo: unknown): Body | null {
  const b = crudo as Partial<Body> | null;
  if (!b || !Array.isArray(b.slots) || b.slots.length !== TOTAL_ACCIONES) return null;
  if (!b.slots.every((s) => s === null || (typeof s === "string" && /^[A-Za-z]{1,30}$/.test(s)))) return null;
  if (!Number.isInteger(b.turnoActual) || b.turnoActual! < 0 || b.turnoActual! >= TOTAL_ACCIONES) return null;
  if (b.sideElegido !== "blue" && b.sideElegido !== "red") return null;
  if (b.pool !== undefined && (typeof b.pool !== "string" || b.pool.length > MAX_LARGO_POOL)) return null;
  if (b.modelo !== undefined && typeof b.modelo !== "string") return null;
  if (b.jugadores !== undefined) {
    const listaOk = (l: unknown) =>
      Array.isArray(l) &&
      l.length <= MAX_JUGADORES &&
      l.every(
        (j: JugadorDraft) =>
          typeof j?.riotId === "string" && esRiotIdValido(j.riotId) && (j.rol === undefined || ROLES.includes(j.rol)),
      );
    if (!listaOk(b.jugadores?.nosotros) || !listaOk(b.jugadores?.rival)) return null;
  }
  return b as Body;
}

export async function POST(request: Request) {
  if (!requestConSesion(request)) return Response.json({ error: "No autorizado" }, { status: 401 });

  const body = validarBody(await request.json().catch(() => null));
  if (!body) return Response.json({ error: "Pedido invalido" }, { status: 400 });
  // solo dejo elegir modelos que tengo en la tabla de precios, asi el costo siempre se puede calcular
  const modelo = body.modelo && PRECIOS_MISTRAL[body.modelo] ? body.modelo : MODELO_DEFAULT;

  const { version, champs } = await getDataDragon();

  // si Supabase no esta configurado o esta vacio, igual recomienda pero avisando que no hay datos pro
  let meta: MetaPro | null = null;
  let avisoMeta: string | null = null;
  try {
    meta = await getMetaPro(parcheDesdeVersion(version));
    if (!meta) avisoMeta = "Todavía no hay partidas pro sincronizadas";
  } catch (e) {
    avisoMeta = e instanceof Error ? e.message : "No se pudo leer el meta pro";
  }

  // el scouting ya se hizo en la pestaña Scout: aca solo leo la cache, sin gastar requests de Riot.
  // El rol que puso el usuario en Scout (el del equipo) le gana al que mas juega en ranked
  const conRolDelEquipo = async (lista: JugadorDraft[]) => {
    const rolPorId = new Map(lista.map((j) => [normalizarRiotId(j.riotId), j.rol]));
    const resumenes = await resumenesDesdeCache(lista.map((j) => j.riotId));
    return resumenes.map((r) => ({ ...r, rol: rolPorId.get(normalizarRiotId(r.riotId)) ?? r.rol }));
  };
  const scouting: Scouting = { nosotros: [], rival: [] };
  try {
    [scouting.nosotros, scouting.rival] = await Promise.all([
      conRolDelEquipo(body.jugadores?.nosotros ?? []),
      conRolDelEquipo(body.jugadores?.rival ?? []),
    ]);
  } catch {
    // si falla la cache recomiendo igual, sin scouting
  }

  const ctx = armarContextos(body, champs, meta, scouting);

  // Respondo en streaming (una linea JSON por evento) para que la pantalla muestre a cada agente apenas termina
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const enviar = (e: EventoKuai) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      const inicio = Date.now();
      const usos: { tokensEntrada: number; tokensSalida: number; costoUsd: number }[] = [];

      const correr = async <T,>(system: string, contenido: string, schema: Record<string, unknown>, nombre: string) => {
        const { resultado, uso } = await llamarMistral<T>({
          modelo,
          mensajes: [
            { role: "system", content: system },
            { role: "user", content: contenido },
          ],
          schema,
          nombreSchema: nombre,
        });
        usos.push(uso);
        return { resultado, ms: uso.ms };
      };

      // vista previa de un agente: ids, usados y roles pro; los roles cubiertos se chequean recien en el final
      const previa = (r: RespuestaAgente, ms: number): AgenteVista => ({
        lectura: r.lectura,
        opciones: revisarOpciones(r.opciones, { ...ctx, meta, rolesCubiertos: new Set() }),
        ms,
      });

      try {
        // Pro corre siempre (ademas fija los roles de los picks hechos). Scout solo si hay jugadores cargados
        const pPro = correr<RespuestaPro>(SYSTEM_PRO, ctx.pro, SCHEMA_PRO, "agente_pro").then(({ resultado, ms }) => {
          const vista = previa(resultado, ms);
          enviar({ tipo: "agente", agente: "pro", resultado: vista });
          return { resultado, vista };
        });
        const pScout = ctx.hayScouting
          ? correr<RespuestaAgente>(SYSTEM_SCOUT, ctx.scout, SCHEMA_AGENTE, "agente_scout").then(({ resultado, ms }) => {
              const vista = previa(resultado, ms);
              enviar({ tipo: "agente", agente: "scout", resultado: vista });
              return { resultado, vista };
            })
          : null;
        if (!pScout) enviar({ tipo: "agente", agente: "scout", omitido: "No hay jugadores cargados en Scout" });

        const [rPro, rScout] = await Promise.allSettled([pPro, pScout ?? Promise.resolve(null)]);
        const pro = rPro.status === "fulfilled" ? rPro.value : null;
        const scout = rScout.status === "fulfilled" ? rScout.value : null;
        if (rScout.status === "rejected") enviar({ tipo: "agente", agente: "scout", omitido: "Scout falló, sigo solo con Pro" });
        if (rPro.status === "rejected") enviar({ tipo: "agente", agente: "pro", omitido: "Pro falló, sigo solo con Scout" });
        if (!pro && !scout) throw rPro.status === "rejected" ? rPro.reason : new Error("Los agentes no respondieron");

        // en un pick, el rol no puede repetir uno ya cubierto por el lado que pickea (segun los roles que fijo Pro)
        const rolesCubiertos = new Set(
          ctx.accion.tipo === "pick" && pro
            ? (ctx.esNuestro ? pro.resultado.rolesNuestros : pro.resultado.rolesRival).map((r) => r.rol)
            : [],
        );
        const revisar = (opciones: RespuestaAgente["opciones"]) => revisarOpciones(opciones, { ...ctx, meta, rolesCubiertos });

        let lectura: string;
        let opciones: OpcionVista[];
        if (pro && scout) {
          // los dos respondieron: KuAi arma el consenso
          const { resultado: consenso } = await correr<RespuestaAgente>(
            SYSTEM_CONSENSO,
            contextoConsenso(ctx.base, scout.resultado, pro.resultado),
            SCHEMA_AGENTE,
            "consenso",
          );
          lectura = consenso.lectura;
          opciones = revisar(consenso.opciones).map((o) => ({ ...o, origen: origenDe(o.id, scout.vista.opciones, pro.vista.opciones) }));
        } else {
          // uno solo respondio: su propuesta es la final
          const solo = (pro ?? scout)!;
          const origen: Origen = pro ? "pro" : "scout";
          lectura = solo.resultado.lectura;
          opciones = revisar(solo.resultado.opciones).map((o) => ({ ...o, origen }));
        }

        const final: Final = {
          turno: body.turnoActual,
          esNuestro: ctx.esNuestro,
          tipo: ctx.accion.tipo,
          rolesNuestros: pro?.resultado.rolesNuestros ?? [],
          rolesRival: pro?.resultado.rolesRival ?? [],
          lectura,
          opciones: opciones.slice(0, OPCIONES_FINALES),
          meta: meta ? { parchesPorLiga: meta.parchesPorLiga, partidasPorLiga: meta.partidasPorLiga, muestraChica: meta.muestraChica } : null,
          avisoMeta,
          scouting: { nosotros: scouting.nosotros.length, rival: scouting.rival.length },
          // la lista calculada va tambien al panel: se ve de donde sale cada ban sin depender de lo que diga la IA
          amenazas: ctx.amenazas.map((a) => ({ id: a.id, partidas: a.partidas, winrate: a.partidas ? a.victorias / a.partidas : null, jugadores: a.jugadores.length })),
          uso: {
            modelo,
            ms: Date.now() - inicio,
            tokensEntrada: usos.reduce((s, u) => s + u.tokensEntrada, 0),
            tokensSalida: usos.reduce((s, u) => s + u.tokensSalida, 0),
            costoUsd: usos.reduce((s, u) => s + u.costoUsd, 0),
            llamadas: usos.length,
          },
        };
        enviar({ tipo: "final", final });
      } catch (e) {
        enviar({ tipo: "error", error: e instanceof Error ? e.message : "Error desconocido" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
