import "server-only";
import { crearIndice, normalizar, type Champ } from "../champs";
import { ORDEN_DRAFT, etiquetaAccion, type Side } from "../draft";
import type { MetaPro, StatChamp } from "../metaPro";
import type { JugadoresDraft } from "../riotIds";
import type { ResumenJugador } from "../scouting";

export const ROLES = ["top", "jungla", "mid", "adc", "support"];
const MAX_CANDIDATOS = 25;

export type Body = {
  slots: (string | null)[];
  turnoActual: number;
  sideElegido: Side;
  pool?: string;
  modelo?: string;
  // Riot IDs cargados en la pestaña Scout; los datos se leen de la cache, no se confia en lo que mande el cliente
  jugadores?: JugadoresDraft;
};

export type Scouting = { nosotros: ResumenJugador[]; rival: ResumenJugador[] };

export const pct = (x: number) => `${Math.round(x * 100)}%`;

// roles donde el champ se jugo en pro en el año (min 2 partidas), de mas a menos
const rolesPro = (meta: MetaPro | null, id: string) =>
  Object.entries(meta?.rolesValidos.get(id) ?? {}).sort((a, b) => b[1] - a[1]);

// una linea compacta por champ con lo que dicen los pros, para que el agente Pro razone con numeros y no de memoria
function lineaStat(nombre: string, s: StatChamp | undefined, meta: MetaPro, id: string) {
  // los roles salen de todo el año (minimo 2 partidas), no solo del parche: es lo que decide donde se puede recomendar
  const roles = rolesPro(meta, id).map(([r, n]) => `${r} ${n}p`).join(", ");
  if (!s) return `${nombre}: roles pro ${roles || "NINGUNO (no recomendar)"} | sin partidas en el parche`;
  const wr = s.winrate === null ? "WR s/d" : `WR ${pct(s.winrate)} (${s.picks} picks)`;
  return `${nombre}: roles pro ${roles || "NINGUNO (no recomendar)"} | presencia ${pct(s.presencia)} (pick ${pct(s.pickRate)}, ban ${pct(s.banRate)}) | ${wr} | pick temprano ${pct(s.temprano)}, fase 2 ${pct(s.fase2)}`;
}

const rolPrincipal = (s?: StatChamp) => (s ? Object.entries(s.roles).sort((a, b) => b[1] - a[1])[0]?.[0] : undefined);

// una linea por jugador scouteado, sin el nombre (no le aporta nada al modelo): rol y sus champs de ranked.
// Scout no ve el meta, pero si los roles pro validos de cada champ para no recomendarlos en un rol inventado
function lineaJugador(j: ResumenJugador, nombre: (id: string) => string, usados: Set<string>, meta: MetaPro | null) {
  const champs = j.champs
    .map((c) => {
      const roles = meta ? ` [roles pro: ${rolesPro(meta, c.id).map(([r]) => r).join("/") || "ninguno"}]` : "";
      return `${nombre(c.id)} ${c.partidas}p ${pct(c.victorias / c.partidas)}${roles}${usados.has(c.id) ? " (ya usado)" : ""}`;
    })
    .join(", ");
  return `- ${j.rol ?? "rol s/d"} (${j.partidas} ranked): ${champs || "sin partidas"}`;
}

// comfort picks del rival calculados, no adivinados por el modelo: partidas sumadas de todos sus jugadores,
// pesadas por winrate, con bonus si lo juega mas de uno (flex) y si ademas esta fuerte en pro
export function amenazasRival(rival: ResumenJugador[], meta: MetaPro | null, usados: Set<string>) {
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

// Arma lo que ve cada agente. Los dos comparten la base (el draft); Scout suma los jugadores y Pro suma el meta
export function armarContextos(body: Body, champs: Champ[], meta: MetaPro | null, scouting: Scouting) {
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
  const idsPicks = (side: Side) =>
    ORDEN_DRAFT.flatMap((a, i) => (i < turnoActual && a.side === side && a.tipo === "pick" && slots[i] ? [slots[i]!] : []));

  // champs del pool anotado a mano: busco nombres sueltos en el texto libre ("top: Aatrox, Jax")
  const idsPool = new Set<string>();
  for (const pedazo of (body.pool ?? "").split(/[,:;\n]/)) {
    const q = normalizar(pedazo);
    const e = q && indice.find((x) => x.nombreNorm === q || x.idNorm === q || x.atajos.includes(q));
    if (e) idsPool.add(e.champ.id);
  }

  const base = [
    `Nuestro side: ${sideElegido}. Rival: ${rival}.`,
    `Accion actual: ${accion.tipo === "ban" ? "BAN" : "PICK"} ${etiquetaAccion(accion)} (fase ${accion.fase}). Le toca a ${esNuestro ? "NOSOTROS" : "EL RIVAL"}.`,
    // marco de quien es cada lado en cada linea, sino el modelo mezcla perspectivas en el turno del rival
    `Bans blue (${sideElegido === "blue" ? "NOSOTROS" : "RIVAL"}): ${lista("blue", "ban")}`,
    `Bans red (${sideElegido === "red" ? "NOSOTROS" : "RIVAL"}): ${lista("red", "ban")}`,
    `Picks blue (${sideElegido === "blue" ? "NOSOTROS" : "RIVAL"}): ${lista("blue", "pick")}`,
    `Picks red (${sideElegido === "red" ? "NOSOTROS" : "RIVAL"}): ${lista("red", "pick")}`,
    `Pool extra anotado a mano: ${body.pool?.trim() || "ninguno"}`,
  ];

  // --- Scout: lo que juega cada jugador en ranked de LAS ---
  const scout = [...base];
  for (const [clave, titulo] of [["nosotros", "NUESTROS jugadores"], ["rival", "Jugadores del RIVAL"]] as const) {
    if (scouting[clave].length) {
      scout.push("", `${titulo} (ultimas ranked en LAS):`, ...scouting[clave].map((j) => lineaJugador(j, nombre, usados, meta)));
    }
  }
  const amenazas = amenazasRival(scouting.rival, meta, usados);
  if (amenazas.length) {
    scout.push(
      "",
      "AMENAZAS DEL RIVAL (comfort picks calculados de su ranked, de mayor a menor):",
      ...amenazas.map((a) => `- ${nombre(a.id)}: ${a.jugadores.join(" / ")}${a.jugadores.length > 1 ? " · lo juegan varios, flex" : ""}`),
    );
    if (accion.tipo === "ban" && esNuestro) {
      scout.push(`En este ban, la opcion 1 TIENE que ser ${nombre(amenazas[0].id)} (la amenaza #1 del rival).`);
    }
  }

  // --- Pro: el meta de LCK/LEC/LPL ---
  const pro = [...base];
  if (!meta) {
    pro.push("", "Datos pro: no disponibles todavia. Razona con criterio general y aclara que no hay datos.");
  } else {
    const ligas = Object.entries(meta.partidasPorLiga)
      .map(([l, n]) => `${l} ${n} partidas (parche ${meta.parchesPorLiga[l].join("+")})`)
      .join(", ");
    pro.push(
      "",
      `Datos pro de Oracle's Elixir: ${ligas}. Ponderado LCK 50%, LEC 25%, LPL 25%${meta.muestraChica ? " · MUESTRA CHICA, tómalo con pinzas" : ""}.`,
      "Estos datos son la base de tu recomendación: prioriza lo que dicen por sobre lo que recuerdes del meta.",
    );

    if (accion.tipo === "pick") {
      const turno = meta.turnos.get(turnoActual);
      if (turno) {
        const roles = Object.entries(turno).sort((a, b) => b[1] - a[1]).map(([r, v]) => `${r} ${pct(v)}`).join(", ");
        pro.push(`En pro, en ${etiquetaAccion(accion)} se pickea: ${roles}.`);
      }
    }

    const picksHechos = [...idsPicks("blue"), ...idsPicks("red")];
    if (picksHechos.length) {
      pro.push("", "Picks ya hechos (datos pro):", ...picksHechos.map((id) => `- ${lineaStat(nombre(id), meta.champs.get(id), meta, id)}`));
    }

    // en un pick, filtro candidatos a los roles que el lado que pickea todavia no cubrio (segun el rol pro principal)
    const rolesCubiertos = new Set(idsPicks(accion.side).map((id) => rolPrincipal(meta.champs.get(id))).filter(Boolean));
    const sirveParaRolAbierto = (s: StatChamp) =>
      accion.tipo === "ban" || Object.keys(meta.rolesValidos.get(s.id) ?? {}).some((r) => !rolesCubiertos.has(r));

    const candidatos = [...meta.champs.values()]
      .filter((s) => !usados.has(s.id) && sirveParaRolAbierto(s))
      .sort((a, b) => b.presencia - a.presencia)
      .slice(0, MAX_CANDIDATOS);
    pro.push(
      "",
      `Candidatos disponibles con mas presencia pro${accion.tipo === "pick" ? " para los roles abiertos" : ""}:`,
      ...candidatos.map((s) => `- ${lineaStat(nombre(s.id), s, meta, s.id)}`),
    );

    // el pool anotado a mano si lo ve Pro (es info del equipo, no scouting)
    const yaListados = new Set(candidatos.map((s) => s.id));
    const poolDisponible = [...idsPool].filter((id) => !usados.has(id) && !yaListados.has(id));
    if (poolDisponible.length) {
      pro.push("", "Datos pro del pool anotado:", ...poolDisponible.map((id) => `- ${lineaStat(nombre(id), meta.champs.get(id), meta, id)}`));
    }
  }

  return {
    base: base.join("\n"),
    scout: scout.join("\n"),
    pro: pro.join("\n"),
    hayScouting: scouting.nosotros.length + scouting.rival.length > 0,
    amenazas,
    accion,
    esNuestro,
    usados,
    indice,
  };
}
