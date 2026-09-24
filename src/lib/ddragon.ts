import "server-only";
import { normalizar, type Champ } from "./champs";

const DDRAGON = "https://ddragon.leagueoflegends.com";

type ChampCrudo = { id: string; key: string; name: string; tags: string[] };

const traerJson = async <T>(url: string, revalidate: number): Promise<T> => {
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) throw new Error(`Data Dragon respondio ${res.status} en ${url}`);
  return res.json();
};

// la version se chequea cada hora para agarrar el parche nuevo rapido,
// el json de champs de una version no cambia nunca asi que ese puede quedar cacheado un dia
export async function getDataDragon() {
  const versiones = await traerJson<string[]>(`${DDRAGON}/api/versions.json`, 3600);
  const version = versiones[0];

  const { data } = await traerJson<{ data: Record<string, ChampCrudo> }>(
    `${DDRAGON}/cdn/${version}/data/es_MX/champion.json`,
    86400,
  );

  const champs: Champ[] = Object.values(data)
    .map((c) => ({ id: c.id, key: c.key, nombre: c.name, tags: c.tags }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return { version, champs };
}

// Leaguepedia usa los nombres en ingles ("Nunu & Willump"), asi que armo el mapa nombre en ingles -> id
export async function getMapaNombresEn(version: string) {
  const { data } = await traerJson<{ data: Record<string, ChampCrudo> }>(
    `${DDRAGON}/cdn/${version}/data/en_US/champion.json`,
    86400,
  );
  return new Map(Object.values(data).flatMap((c) => [[normalizar(c.name), c.id], [normalizar(c.id), c.id]]));
}
