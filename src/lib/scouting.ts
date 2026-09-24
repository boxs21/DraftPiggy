import "server-only";
import { getDataDragon } from "./ddragon";
import { cuentaPorRiotId, idsRanked, maestriaTop, partidaPorId } from "./riot";
import { PARTIDAS_MAX, normalizarRiotId } from "./riotIds";
import { supabaseServidor } from "./supabase";

const TOP_CHAMPS = 12;

// maestria: los que mas puntos tienen, pero solo si los jugo hace poco (un main de hace 2 años no sirve)
const MAESTRIA_PEDIDA = 15;
const MAESTRIA_MOSTRADA = 8;
const DIAS_MAESTRIA_VIGENTE = 60;
const HORAS_REFRESCO_MAESTRIA = 6;

const ROLES: Record<string, string> = { TOP: "top", JUNGLE: "jungla", MIDDLE: "mid", BOTTOM: "adc", UTILITY: "support" };

export type ChampJugador = { id: string; partidas: number; victorias: number; ultima: string };
export type MaestriaJugador = { id: string; puntos: number; nivel: number; ultima: string };
export type ResumenJugador = {
  riotId: string;
  partidas: number;
  rol: string | null; // el rol que mas jugo
  roles: Record<string, number>;
  champs: ChampJugador[];
  maestria: MaestriaJugador[];
};

type FilaPartida = { champ_id: string; rol: string | null; gano: boolean; fecha: string };

function resumir(riotId: string, filas: FilaPartida[], maestria: MaestriaJugador[] | null): ResumenJugador {
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

  const limite = Date.now() - DIAS_MAESTRIA_VIGENTE * 86_400_000;
  const vigente = (maestria ?? []).filter((m) => new Date(m.ultima).getTime() >= limite).slice(0, MAESTRIA_MOSTRADA);
  return { riotId, partidas: filas.length, rol, roles, champs, maestria: vigente };
}

async function ultimasPartidas(db: ReturnType<typeof supabaseServidor>, puuid: string) {
  const { data, error } = await db
    .from("partidas_jugador")
    .select("champ_id, rol, gano, fecha")
    .eq("puuid", puuid)
    .order("fecha", { ascending: false })
    .limit(PARTIDAS_MAX);
  if (error) throw new Error(error.message);
  return data as FilaPartida[];
}

// Scoutea un jugador: busca su cuenta, trae los ids de sus ultimas ranked y baja solo las partidas que no estan en
// cache. La maestria se pide de nuevo solo si tiene mas de unas horas (es 1 request, pero igual cuenta para el limite)
export async function scoutearJugador(riotId: string, cantidad: number): Promise<ResumenJugador | null> {
  const [nombre, tag] = riotId.split("#");
  const cuenta = await cuentaPorRiotId(nombre, tag);
  if (!cuenta) return null;

  const db = supabaseServidor();
  const riotIdReal = `${cuenta.gameName}#${cuenta.tagLine}`;
  const { data: guardado } = await db.from("jugadores").select("maestria, maestria_actualizada").eq("puuid", cuenta.puuid).maybeSingle();

  const { champs } = await getDataDragon();
  // match-v5 devuelve el id de Data Dragon (a veces con otras mayusculas, ej FiddleSticks); la maestria devuelve el numero
  const idPorMinuscula = new Map(champs.map((c) => [c.id.toLowerCase(), c.id]));
  const idPorKey = new Map(champs.map((c) => [c.key, c.id]));

  let maestria = (guardado?.maestria as MaestriaJugador[] | null) ?? null;
  const vieja =
    !guardado?.maestria_actualizada ||
    Date.now() - new Date(guardado.maestria_actualizada).getTime() > HORAS_REFRESCO_MAESTRIA * 3_600_000;
  if (vieja) {
    maestria = (await maestriaTop(cuenta.puuid, MAESTRIA_PEDIDA)).flatMap((m) => {
      const id = idPorKey.get(String(m.championId));
      return id ? [{ id, puntos: m.championPoints, nivel: m.championLevel, ultima: new Date(m.lastPlayTime).toISOString() }] : [];
    });
  }

  const { error: e1 } = await db.from("jugadores").upsert({
    puuid: cuenta.puuid,
    riot_id: riotIdReal,
    riot_id_norm: normalizarRiotId(riotIdReal),
    actualizado: new Date().toISOString(),
    ...(vieja ? { maestria, maestria_actualizada: new Date().toISOString() } : {}),
  });
  if (e1) throw new Error(e1.message);

  const ids = await idsRanked(cuenta.puuid, cantidad);
  const { data: yaGuardadas } = await db.from("partidas_jugador").select("match_id").eq("puuid", cuenta.puuid).in("match_id", ids);
  const guardadas = new Set((yaGuardadas ?? []).map((p) => p.match_id));
  const faltan = ids.filter((id) => !guardadas.has(id));

  if (faltan.length) {
    const filas = [];
    // de a una: la key deja 20 por segundo y 100 cada 2 minutos, riot.ts espera si nos pasamos
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

  return resumir(riotIdReal, await ultimasPartidas(db, cuenta.puuid), maestria);
}

// Para la recomendacion: lee de la cache sin llamar a Riot (el scouting ya se hizo en la pestaña Scout)
export async function resumenesDesdeCache(riotIds: string[]) {
  if (!riotIds.length) return [];
  const db = supabaseServidor();
  const { data } = await db
    .from("jugadores")
    .select("puuid, riot_id, maestria")
    .in("riot_id_norm", riotIds.map(normalizarRiotId));
  return Promise.all(
    (data ?? []).map(async (j) => resumir(j.riot_id, await ultimasPartidas(db, j.puuid), j.maestria as MaestriaJugador[] | null)),
  );
}
