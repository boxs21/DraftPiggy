import "server-only";

// LAS: account-v1 y match-v5 van por el cluster regional americas
const REGIONAL = "https://americas.api.riotgames.com";
const MAX_REINTENTOS = 3;

export class ErrorRiot extends Error {}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

// fetch con la key y respetando el rate limit: si Riot devuelve 429 espero lo que dice Retry-After y reintento
async function pedir<T>(ruta: string): Promise<T | null> {
  const key = process.env.RIOT_API_KEY;
  if (!key) throw new ErrorRiot("Falta RIOT_API_KEY en .env.local");

  for (let intento = 0; ; intento++) {
    const res = await fetch(`${REGIONAL}${ruta}`, { headers: { "X-Riot-Token": key }, cache: "no-store" });
    if (res.ok) return res.json();
    if (res.status === 404) return null;
    if (res.status === 401 || res.status === 403) {
      throw new ErrorRiot("La key de Riot venció o es inválida (las development keys duran 24 h)");
    }
    if (res.status === 429 && intento < MAX_REINTENTOS) {
      await esperar((Number(res.headers.get("retry-after")) || 10) * 1000);
      continue;
    }
    throw new ErrorRiot(`Riot respondió ${res.status}`);
  }
}

export type Cuenta = { puuid: string; gameName: string; tagLine: string };

export const cuentaPorRiotId = (nombre: string, tag: string) =>
  pedir<Cuenta>(`/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(nombre)}/${encodeURIComponent(tag)}`);

// type=ranked trae solo/duo y flex, que es lo que importa para ver el pool real
export const idsRanked = async (puuid: string, cantidad: number) =>
  (await pedir<string[]>(`/lol/match/v5/matches/by-puuid/${puuid}/ids?type=ranked&count=${cantidad}`)) ?? [];

type Participante = { puuid: string; championName: string; teamPosition: string; individualPosition: string; win: boolean };
export type Partida = { metadata: { matchId: string }; info: { gameCreation: number; queueId: number; participants: Participante[] } };

export const partidaPorId = (id: string) => pedir<Partida>(`/lol/match/v5/matches/${id}`);
