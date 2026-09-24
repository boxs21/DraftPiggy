import { crearIndice, normalizar, parcheDesdeVersion, type Champ } from "@/lib/champs";
import { getDataDragon } from "@/lib/ddragon";
import { ORDEN_DRAFT, TOTAL_ACCIONES, etiquetaAccion, type Side } from "@/lib/draft";
import { getMetaPro, type MetaPro, type StatChamp } from "@/lib/metaPro";
import { MODELO_DEFAULT, PRECIOS_MISTRAL, llamarMistral } from "@/lib/mistral";
import { resumenesDesdeCache, type ResumenJugador } from "@/lib/scouting";
import { requestConSesion } from "@/lib/sesion";
import { esRiotIdValido, MAX_JUGADORES } from "@/lib/riotIds";

type Body = {
  slots: (string | null)[];
  turnoActual: number;
  sideElegido: Side;
  pool?: string;
  modelo?: string;
  // Riot IDs cargados en la pestaña Scout; los datos se leen de la cache, no se confia en lo que mande el cliente
  jugadores?: { nosotros: string[]; rival: string[] };
};

type Scouting = { nosotros: ResumenJugador[]; rival: ResumenJugador[] };

type ChampConRol = { champ: string; rol: string };

type RespuestaIA = {
  rolesNuestros: ChampConRol[];
  rolesRival: ChampConRol[];
  lectura: string;
  opciones: (ChampConRol & { razon: string })[];
};

const ROLES = ["top", "jungla", "mid", "adc", "support"];
const MAX_CANDIDATOS = 25;
const MAX_LARGO_POOL = 1500;

const LISTA_ROLES = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["champ", "rol"],
    properties: { champ: { type: "string" }, rol: { type: "string", enum: ROLES } },
  },
};

// el orden importa: primero lo obligo a fijar el rol de cada pick hecho y despues recomienda,
// sino se olvida que el jungla ya esta y te tira otro jungla
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["rolesNuestros", "rolesRival", "lectura", "opciones"],
  properties: {
    rolesNuestros: LISTA_ROLES,
    rolesRival: LISTA_ROLES,
    lectura: { type: "string" },
    opciones: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["champ", "rol", "razon"],
        properties: {
          champ: { type: "string" },
          rol: { type: "string", enum: ROLES },
          razon: { type: "string" },
        },
      },
    },
  },
};

const SYSTEM = `Sos analista de draft de League of Legends con criterio de pro play (LCK, LEC, LPL). Ayudas al que draftea en un equipo amateur de scrims (servidor LAS). El draft es en orden de torneo (20 acciones).

Como pensar el draft (usalo, no lo repitas):
- Prioridad: en picks tempranos van champs blind-safe, de alta presencia pro, o flex que esconden el rol. Los champs que se counterean facil se guardan para fase 2.
- Flex: un champ que en pro se juega en 2 roles vale mas temprano porque el rival no sabe donde va.
- Counterpick: en R5/B4-B5 aprovecha que el rival ya mostro su comp. Pensa matchup de linea y lo que le falta a la comp rival.
- Comp: identifica la win condition (engage/teamfight, pick, poke, split push, scaling, early/snowball), la fuente de engage, el frontline, el peel y el balance de daño AP/AD. Nombra los power spikes cuando importen.
- Bans: en fase 1, lo mas presente del meta o lo que mas le sirve al rival. En fase 2, bans dirigidos: lo que completa la comp rival o counterea directo nuestros picks.
- Side: blue tiene el primer pick, red tiene el ultimo counter (R5).

Reglas:
- Primero completa "rolesNuestros" y "rolesRival" con el rol de cada pick ya hecho de cada lado (solo picks). Usa los roles pro de los datos como guia.
- Devolve exactamente 3 opciones, de mejor a peor, solo con campeones que existan y que NO esten usados.
- Si es un pick nuestro: prioriza el pool del jugador del rol abierto (sus champs de ranked) y un rol que no tengamos cubierto. Si varios roles estan abiertos, no pongas los 3 en el mismo rol salvo que sea claramente lo mejor.
- Si es un ban nuestro: pensa que le sirve al rival. Si hay scouting del rival, prioriza sus comfort picks (muchas partidas y buen WR) que ademas esten fuertes en pro, sobre todo de los roles que todavia no pickeo.
- Si el turno es del rival: devolve las 3 cosas mas probables que haga el rival. Si hay scouting, usa el pool del jugador rival del rol que le falta: lo que juega en ranked pesa mas que el meta promedio. Las razones van desde el punto de vista del RIVAL: sinergia con SUS picks y lo que le sirve contra NOSOTROS, nunca "complementa a" un champ nuestro.
- Cuando uses datos de ranked de un jugador, decilo ("el jungla rival lo jugo 7 veces con 71%").
- El patron del turno ("En pro, en R2 se pickea: ...") es la señal mas fuerte de que rol viene. Respetalo salvo que ese rol ya este cubierto.
- "lectura": 1 o 2 oraciones tecnicas sobre como vienen las dos comps (win condition, que le falta a cada una).
- "razon": maximo 2 oraciones, tecnicas y concretas. Cuando sirva, cita los numeros de los datos pro (presencia, WR, en que parte del draft se pickea). NUNCA uses numeros que no esten en los datos, ni inventes nombres de habilidades. Si no hay datos pro de un champ, decilo.
- Todo en español.`;

const pct = (x: number) => `${Math.round(x * 100)}%`;

// una linea compacta por champ con lo que dicen los pros, para que el modelo razone con numeros y no de memoria
function lineaStat(nombre: string, s: StatChamp | undefined) {
  if (!s) return `${nombre}: sin partidas pro en la muestra`;
  const roles = Object.entries(s.roles)
    .filter(([, v]) => v >= 0.1)
    .sort((a, b) => b[1] - a[1])
    .map(([r, v]) => `${r} ${pct(v)}`)
    .join(", ");
  const wr = s.winrate === null ? "WR s/d" : `WR ${pct(s.winrate)} (${s.picks} picks)`;
  return `${nombre}: ${roles || "rol s/d"} | presencia ${pct(s.presencia)} (pick ${pct(s.pickRate)}, ban ${pct(s.banRate)}) | ${wr} | pick temprano ${pct(s.temprano)}, fase 2 ${pct(s.fase2)}`;
}

const rolPrincipal = (s?: StatChamp) => (s ? Object.entries(s.roles).sort((a, b) => b[1] - a[1])[0]?.[0] : undefined);

// una linea por jugador scouteado, sin el nombre (no le aporta nada al modelo): rol y sus champs de ranked
function lineaJugador(j: ResumenJugador, nombre: (id: string) => string, usados: Set<string>) {
  const champs = j.champs
    .map((c) => `${nombre(c.id)} ${c.partidas}p ${pct(c.victorias / c.partidas)}${usados.has(c.id) ? " (ya usado)" : ""}`)
    .join(", ");
  return `- ${j.rol ?? "rol s/d"} (${j.partidas} ranked): ${champs || "sin partidas"}`;
}

// comfort picks del rival calculados, no adivinados por el modelo: partidas sumadas de todos sus jugadores,
// pesadas por winrate, con bonus si lo juega mas de uno (flex) y si ademas esta fuerte en pro
function amenazasRival(rival: ResumenJugador[], meta: MetaPro | null, usados: Set<string>) {
  const porChamp = new Map<string, { id: string; partidas: number; victorias: number; jugadores: string[] }>();
  for (const j of rival) {
    for (const c of j.champs) {
      if (usados.has(c.id)) continue;
      const a = porChamp.get(c.id) ?? { id: c.id, partidas: 0, victorias: 0, jugadores: [] };
      a.partidas += c.partidas;
      a.victorias += c.victorias;
      a.jugadores.push(`${j.rol ?? "?"} ${c.partidas}p ${pct(c.victorias / c.partidas)}`);
      porChamp.set(c.id, a);
    }
  }
  return [...porChamp.values()]
    .map((a) => {
      const wr = a.victorias / a.partidas;
      const presencia = meta?.champs.get(a.id)?.presencia ?? 0;
      const puntaje = a.partidas * (0.5 + wr) * (a.jugadores.length > 1 ? 1.3 : 1) * (1 + presencia);
      return { ...a, puntaje, presencia };
    })
    .filter((a) => a.partidas >= 2)
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, 6);
}

function armarContexto(body: Body, champs: Champ[], meta: MetaPro | null, scouting: Scouting) {
  const { slots, turnoActual, sideElegido } = body;
  const champsPorId = new Map(champs.map((c) => [c.id, c]));
  const indice = crearIndice(champs);
  const nombre = (id: string | null) => champsPorId.get(id ?? "")?.nombre ?? "?";
  const usados = new Set(slots.slice(0, turnoActual).filter((id): id is string => !!id));

  const lista = (side: Side, tipo: "ban" | "pick") => {
    const hechos = ORDEN_DRAFT.flatMap((a, i) =>
      i < turnoActual && a.side === side && a.tipo === tipo ? [`${etiquetaAccion(a)} ${nombre(slots[i])}`] : [],
    );
    return hechos.length ? hechos.join(", ") : "ninguno";
  };

  const accion = ORDEN_DRAFT[turnoActual];
  const esNuestro = accion.side === sideElegido;
  const rival: Side = sideElegido === "blue" ? "red" : "blue";
  const idsPicks = (side: Side) => ORDEN_DRAFT.flatMap((a, i) => (i < turnoActual && a.side === side && a.tipo === "pick" && slots[i] ? [slots[i]!] : []));

  // champs del pool: busco nombres sueltos en el texto libre ("top: Aatrox, Jax")
  const idsPool = new Set<string>();
  for (const pedazo of (body.pool ?? "").split(/[,:;\n]/)) {
    const q = normalizar(pedazo);
    const e = q && indice.find((x) => x.nombreNorm === q || x.idNorm === q || x.atajos.includes(q));
    if (e) idsPool.add(e.champ.id);
  }

  const partes = [
    `Nuestro side: ${sideElegido}. Rival: ${rival}.`,
    `Accion actual: ${accion.tipo === "ban" ? "BAN" : "PICK"} ${etiquetaAccion(accion)} (fase ${accion.fase}). Le toca a ${esNuestro ? "NOSOTROS" : "EL RIVAL"}.`,
    // marco de quien es cada lado en cada linea, sino el modelo mezcla perspectivas en el turno del rival
    `Bans blue (${sideElegido === "blue" ? "NOSOTROS" : "RIVAL"}): ${lista("blue", "ban")}`,
    `Bans red (${sideElegido === "red" ? "NOSOTROS" : "RIVAL"}): ${lista("red", "ban")}`,
    `Picks blue (${sideElegido === "blue" ? "NOSOTROS" : "RIVAL"}): ${lista("blue", "pick")}`,
    `Picks red (${sideElegido === "red" ? "NOSOTROS" : "RIVAL"}): ${lista("red", "pick")}`,
    `Pool extra anotado a mano: ${body.pool?.trim() || "ninguno"}`,
  ];

  // lo que juega cada jugador en ranked de LAS (pestaña Scout). Va antes del meta porque sirve aunque no haya datos pro
  for (const [clave, titulo] of [["nosotros", "NUESTROS jugadores"], ["rival", "Jugadores del RIVAL"]] as const) {
    if (scouting[clave].length) {
      partes.push("", `${titulo} (ultimas ranked en LAS):`, ...scouting[clave].map((j) => lineaJugador(j, nombre, usados)));
    }
  }

  const amenazas = amenazasRival(scouting.rival, meta, usados);
  if (amenazas.length) {
    partes.push(
      "",
      "AMENAZAS DEL RIVAL (comfort picks calculados de su ranked, de mayor a menor):",
      ...amenazas.map(
        (a) =>
          `- ${nombre(a.id)}: ${a.jugadores.join(" / ")}${a.jugadores.length > 1 ? " · lo juegan varios, flex" : ""}${meta ? ` · presencia pro ${pct(a.presencia)}` : ""}`,
      ),
    );
    if (accion.tipo === "ban" && esNuestro) {
      partes.push(
        `En este ban, la opcion 1 TIENE que ser ${nombre(amenazas[0].id)} (la amenaza #1 del rival). Las otras 2 elegilas entre el resto de AMENAZAS y lo mas fuerte del meta pro.`,
      );
    }
  }

  if (!meta) {
    partes.push("", "Datos pro: no disponibles todavia. Razona con criterio general y aclara que no hay datos.");
    return partes.join("\n");
  }

  const ligas = Object.entries(meta.partidasPorLiga)
    .map(([l, n]) => `${l} ${n} partidas (parche ${meta.parchesPorLiga[l].join("+")})`)
    .join(", ");
  partes.push(
    "",
    `Datos pro de Oracle's Elixir: ${ligas}. Ponderado LCK 50%, LEC 25%, LPL 25%${meta.muestraChica ? " · MUESTRA CHICA, tomalo con pinzas" : ""}.`,
    "Estos datos son la base de la recomendacion: priorizá lo que dicen sobre lo que recuerdes del meta.",
  );

  if (accion.tipo === "pick") {
    const turno = meta.turnos.get(turnoActual);
    if (turno) {
      const roles = Object.entries(turno).sort((a, b) => b[1] - a[1]).map(([r, v]) => `${r} ${pct(v)}`).join(", ");
      partes.push(`En pro, en ${etiquetaAccion(accion)} se pickea: ${roles}.`);
    }
  }

  const picksHechos = [...idsPicks("blue"), ...idsPicks("red")];
  if (picksHechos.length) {
    partes.push("", "Picks ya hechos (datos pro):", ...picksHechos.map((id) => `- ${lineaStat(nombre(id), meta.champs.get(id))}`));
  }

  // en un pick, filtro candidatos a los roles que el lado que pickea todavia no cubrio (segun el rol pro principal)
  const sidePickea = accion.side;
  const rolesCubiertos = new Set(idsPicks(sidePickea).map((id) => rolPrincipal(meta.champs.get(id))).filter(Boolean));
  const sirveParaRolAbierto = (s: StatChamp) =>
    accion.tipo === "ban" || Object.entries(s.roles).some(([r, v]) => !rolesCubiertos.has(r) && v >= 0.25);

  const candidatos = [...meta.champs.values()]
    .filter((s) => !usados.has(s.id) && sirveParaRolAbierto(s))
    .sort((a, b) => b.presencia - a.presencia)
    .slice(0, MAX_CANDIDATOS);
  partes.push(
    "",
    `Candidatos disponibles con mas presencia pro${accion.tipo === "pick" ? " para los roles abiertos" : ""}:`,
    ...candidatos.map((s) => `- ${lineaStat(nombre(s.id), s)}`),
  );

  // datos pro de los champs de los pools (anotado + ranked de los dos equipos) que no esten ya en los candidatos
  const yaListados = new Set(candidatos.map((s) => s.id));
  const idsPools = new Set([
    ...idsPool,
    ...[...scouting.nosotros, ...scouting.rival].flatMap((j) => j.champs.slice(0, 5).map((c) => c.id)),
  ]);
  const poolsDisponibles = [...idsPools].filter((id) => !usados.has(id) && !yaListados.has(id));
  if (poolsDisponibles.length) {
    partes.push("", "Datos pro de otros champs de los pools:", ...poolsDisponibles.map((id) => `- ${lineaStat(nombre(id), meta.champs.get(id))}`));
  }

  return partes.join("\n");
}

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
      Array.isArray(l) && l.length <= MAX_JUGADORES && l.every((id) => typeof id === "string" && esRiotIdValido(id));
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
  const indice = crearIndice(champs);
  const usados = new Set(body.slots.slice(0, body.turnoActual));
  const usadosIds = new Set(body.slots.slice(0, body.turnoActual).filter((id): id is string => !!id));

  // si Supabase no esta configurado o esta vacio, igual recomienda pero avisando que no hay datos pro
  let meta: MetaPro | null = null;
  let avisoMeta: string | null = null;
  try {
    meta = await getMetaPro(parcheDesdeVersion(version));
    if (!meta) avisoMeta = "Todavía no hay partidas pro sincronizadas";
  } catch (e) {
    avisoMeta = e instanceof Error ? e.message : "No se pudo leer el meta pro";
  }

  // el scouting ya se hizo en la pestaña Scout: aca solo leo la cache, sin gastar requests de Riot
  const scouting: Scouting = { nosotros: [], rival: [] };
  try {
    [scouting.nosotros, scouting.rival] = await Promise.all([
      resumenesDesdeCache(body.jugadores?.nosotros ?? []),
      resumenesDesdeCache(body.jugadores?.rival ?? []),
    ]);
  } catch {
    // si falla la cache recomiendo igual, sin scouting
  }

  try {
    const { resultado, uso } = await llamarMistral<RespuestaIA>({
      modelo,
      mensajes: [
        { role: "system", content: SYSTEM },
        { role: "user", content: armarContexto(body, champs, meta, scouting) },
      ],
      schema: SCHEMA,
      nombreSchema: "recomendacion_draft",
    });

    const accion = ORDEN_DRAFT[body.turnoActual];
    const esNuestro = accion.side === body.sideElegido;
    // en un pick, el rol no puede repetir uno ya cubierto por el lado que pickea
    const rolesCubiertos = new Set(
      accion.tipo === "pick" ? (esNuestro ? resultado.rolesNuestros : resultado.rolesRival).map((r) => r.rol) : [],
    );

    // el modelo devuelve nombres, los paso a ids de Data Dragon y marco lo que no existe o ya se uso
    const opciones = resultado.opciones.slice(0, 3).map((o) => {
      const q = normalizar(o.champ);
      const champ = indice.find((e) => e.nombreNorm === q || e.idNorm === q)?.champ;
      const problema = !champ
        ? "no existe"
        : usados.has(champ.id)
          ? "ya usado"
          : rolesCubiertos.has(o.rol)
            ? "rol ya cubierto"
            : null;
      return { ...o, id: champ?.id ?? null, nombre: champ?.nombre ?? o.champ, problema };
    });

    return Response.json({
      turno: body.turnoActual,
      esNuestro,
      tipo: accion.tipo,
      rolesNuestros: resultado.rolesNuestros,
      rolesRival: resultado.rolesRival,
      lectura: resultado.lectura,
      opciones,
      meta: meta
        ? { parchesPorLiga: meta.parchesPorLiga, partidasPorLiga: meta.partidasPorLiga, muestraChica: meta.muestraChica }
        : null,
      avisoMeta,
      scouting: { nosotros: scouting.nosotros.length, rival: scouting.rival.length },
      // la lista calculada va tambien al panel: se ve de donde sale cada ban sin depender de lo que diga la IA
      amenazas: amenazasRival(scouting.rival, meta, usadosIds).map((a) => ({
        id: a.id,
        partidas: a.partidas,
        winrate: a.victorias / a.partidas,
        jugadores: a.jugadores.length,
      })),
      uso,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return Response.json({ error: msg }, { status: 502 });
  }
}
