import "server-only";
import { getDataDragon } from "./ddragon";
import { cuentaPorRiotId, idsRanked, partidaPorId } from "./riot";
import { normalizarRiotId } from "./riotIds";
import { supabaseServidor } from "./supabase";

// cuantas ranked miro por jugador: con 20 alcanza para ver el pool y entra en el rate limit de la dev key
export const PARTIDAS_POR_JUGADOR = 20;
const TOP_CHAMPS = 8;

const ROLES: Record<string, string> = { TOP: "top", JUNGLE: "jungla", MIDDLE: "mid", BOTTOM: "adc", UTILITY: "support" };

export type ChampJugador = { id: string; partidas: number; victorias: number; ultima: string };
export type ResumenJugador = {
  riotId: string;
  partidas: number;
  rol: string | null; // el rol que mas jugo
  roles: Record<string, number>;
  champs: ChampJugador[];
};

type FilaPartida = { champ_id: string; rol: string | null; gano: boolean; fecha: string };

function resumir(riotId: string, filas: FilaPartida[]): ResumenJugador {
  const roles: Record<string, number> = {};
  const porChamp = new Map<string, ChampJugador>();
  for (const f of filas) {
    if (f.rol) roles[f.rol] = (roles[f.rol] ?? 0) + 1;
    const c = porChamp.get(f.champ_id) ?? { id: f.champ_id, partidas: 0, victorias: 0, ultima: f.fecha };
    c.partidas++;
    if (f.gano) c.victorias++;
    if (f.fecha > c.ultima) c.ultima = f.fecha;
    porChamp.set(f.champ_id, c);
  }
  const rol = Object.entries(roles).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const champs = [...porChamp.values()].sort((a, b) => b.partidas - a.partidas || b.victorias - a.victorias).slice(0, TOP_CHAMPS);
  return { riotId, partidas: filas.length, rol, roles, champs };
}

async function ultimasPartidas(db: ReturnType<typeof supabaseServidor>, puuid: string) {
  const { data, error } = await db
    .from("partidas_jugador")
    .select("champ_id, rol, gano, fecha")
    .eq("puuid", puuid)
    .order("fecha", { ascending: false })
    .limit(PARTIDAS_POR_JUGADOR);
  if (error) throw new Error(error.message);
  return data as FilaPartida[];
}

// Scoutea un jugador: busca su cuenta, trae los ids de sus ultimas ranked y baja solo las partidas que no estan en cache
export async function scoutearJugador(riotId: string): Promise<ResumenJugador | null> {
  const [nombre, tag] = riotId.split("#");
  const cuenta = await cuentaPorRiotId(nombre, tag);
  if (!cuenta) return null;

  const db = supabaseServidor();
  const riotIdReal = `${cuenta.gameName}#${cuenta.tagLine}`;
  const { error: e1 } = await db
    .from("jugadores")
    .upsert({ puuid: cuenta.puuid, riot_id: riotIdReal, riot_id_norm: normalizarRiotId(riotIdReal), actualizado: new Date().toISOString() });
  if (e1) throw new Error(e1.message);

  const ids = await idsRanked(cuenta.puuid, PARTIDAS_POR_JUGADOR);
  const { data: yaGuardadas } = await db.from("partidas_jugador").select("match_id").eq("puuid", cuenta.puuid).in("match_id", ids);
  const guardadas = new Set((yaGuardadas ?? []).map((p) => p.match_id));
  const faltan = ids.filter((id) => !guardadas.has(id));

  if (faltan.length) {
    // match-v5 devuelve championName con el id de Data Dragon, pero con mayusculas distintas a veces (FiddleSticks)
    const { champs } = await getDataDragon();
    const idPorMinuscula = new Map(champs.map((c) => [c.id.toLowerCase(), c.id]));

    const filas = [];
    // de a una: la dev key deja 20 por segundo y 100 cada 2 minutos, riot.ts espera si nos pasamos
    for (const id of faltan) {
      const partida = await partidaPorId(id);
      const p = partida?.info.participants.find((x) => x.puuid === cuenta.puuid);
      if (!partida || !p) continue;
      filas.push({
        match_id: id,
        puuid: cuenta.puuid,
        champ_id: idPorMinuscula.get(p.championName.toLowerCase()) ?? p.championName,
        rol: ROLES[p.teamPosition || p.individualPosition] ?? null,
        gano: p.win,
        cola: partida.info.queueId,
        fecha: new Date(partida.info.gameCreation).toISOString(),
      });
    }
    if (filas.length) {
      const { error } = await db.from("partidas_jugador").upsert(filas);
      if (error) throw new Error(error.message);
    }
  }

  return resumir(riotIdReal, await ultimasPartidas(db, cuenta.puuid));
}

// Para la recomendacion: lee de la cache sin llamar a Riot (el scouting ya se hizo en la pestaña Scout)
export async function resumenesDesdeCache(riotIds: string[]) {
  if (!riotIds.length) return [];
  const db = supabaseServidor();
  const { data } = await db
    .from("jugadores")
    .select("puuid, riot_id")
    .in("riot_id_norm", riotIds.map(normalizarRiotId));
  return Promise.all((data ?? []).map(async (j) => resumir(j.riot_id, await ultimasPartidas(db, j.puuid))));
}
