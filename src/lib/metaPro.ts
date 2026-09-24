import "server-only";
import { supabaseServidor } from "./supabase";

// LCK pesa el doble porque es el estilo que queremos copiar. MSI y Worlds suman como una liga mas
// cuando caen en el parche. Los pesos se normalizan sobre las ligas que tienen partidas
export const PESOS_LIGA: Record<string, number> = { LCK: 0.5, LEC: 0.25, LPL: 0.25, MSI: 0.25, WORLDS: 0.25 };

// cada liga va en su parche (LCK suele ir uno atras), asi que elijo parches por liga.
// Con menos partidas que esto en una liga los porcentajes son ruido, asi que le sumo el parche anterior
const MIN_PARTIDAS_LIGA = 25;
const LIGAS_REGULARES = ["LCK", "LEC", "LPL"];

// picks tempranos = B1, R1, R2 (orden 6-8). Fase 2 = orden 16-19, donde van los counters
const ORDEN_TEMPRANO = [6, 7, 8];
const ORDEN_FASE2 = [16, 17, 18, 19];

export type StatChamp = {
  id: string;
  presencia: number; // (picks + bans) / partidas, ponderado por liga
  pickRate: number;
  banRate: number;
  winrate: number | null; // null si casi no se pickeo
  picks: number; // sin ponderar, para saber cuanta muestra hay
  roles: Record<string, number>; // % de sus picks en cada rol
  temprano: number; // % de sus picks que fueron B1/R1/R2
  fase2: number; // % de sus picks en fase 2
};

// un champ solo se recomienda en un rol donde los pros lo jugaron al menos esta cantidad de veces en el año
export const MIN_PARTIDAS_ROL = 2;

export type MetaPro = {
  // roles donde cada champ se jugo en pro en todo el año (>= MIN_PARTIDAS_ROL), con cuantas partidas
  rolesValidos: Map<string, Record<string, number>>;
  parchesPorLiga: Record<string, string[]>;
  partidasPorLiga: Record<string, number>;
  muestraChica: boolean;
  champs: Map<string, StatChamp>;
  turnos: Map<number, Record<string, number>>; // orden -> % por rol
};

const compararParches = (a: string, b: string) => {
  const [a1, a2] = a.split(".").map(Number);
  const [b1, b2] = b.split(".").map(Number);
  return a1 - b1 || a2 - b2;
};

// por cada liga regular: su ultimo parche que no sea mas nuevo que el live, y va sumando anteriores hasta tener muestra.
// MSI y Worlds entran solo si juegan en alguno de esos parches (un MSI de hace 5 parches no dice nada del meta de hoy)
function elegirParches(filas: { parche: string; liga: string; n: number }[], parcheActual: string) {
  const parchesPorLiga: Record<string, string[]> = {};
  const partidasPorLiga: Record<string, number> = {};
  let muestraChica = false;

  for (const liga of LIGAS_REGULARES) {
    const candidatos = filas
      .filter((f) => f.liga === liga && compararParches(f.parche, parcheActual) <= 0)
      .sort((a, b) => compararParches(b.parche, a.parche));
    let total = 0;
    for (const f of candidatos) {
      (parchesPorLiga[liga] ??= []).push(f.parche);
      total += f.n;
      if (total >= MIN_PARTIDAS_LIGA) break;
    }
    if (total) partidasPorLiga[liga] = total;
    if (total < MIN_PARTIDAS_LIGA) muestraChica = true;
  }

  const parchesUsados = new Set(Object.values(parchesPorLiga).flat());
  for (const f of filas) {
    if (LIGAS_REGULARES.includes(f.liga) || !parchesUsados.has(f.parche)) continue;
    (parchesPorLiga[f.liga] ??= []).push(f.parche);
    partidasPorLiga[f.liga] = (partidasPorLiga[f.liga] ?? 0) + f.n;
  }

  const claves = Object.entries(parchesPorLiga).flatMap(([liga, ps]) => ps.map((p) => `${liga}|${p}`));
  return { claves, parchesPorLiga, partidasPorLiga, muestraChica };
}

type FilaChamp = { champ_id: string; liga: string; picks: number; bans: number; victorias: number; roles: Record<string, number>; picks_por_orden: Record<string, number> };

export async function getMetaPro(parcheActual: string): Promise<MetaPro | null> {
  const db = supabaseServidor();
  const { data: porParche, error } = await db.rpc("partidas_por_parche");
  if (error) throw new Error(error.message);
  if (!porParche?.length) return null;

  const { claves, parchesPorLiga, partidasPorLiga, muestraChica } = elegirParches(porParche, parcheActual);
  if (!claves.length) return null;

  const ligas = Object.keys(partidasPorLiga);
  const sumaPesos = ligas.reduce((s, l) => s + (PESOS_LIGA[l] ?? 0), 0);
  const peso = (liga: string) => (PESOS_LIGA[liga] ?? 0) / sumaPesos;

  const [{ data: filasChamps, error: e1 }, { data: filasTurnos, error: e2 }, { data: filasRoles, error: e3 }] = await Promise.all([
    db.rpc("stats_champs_pro", { p_claves: claves }),
    db.rpc("stats_turnos_pro", { p_claves: claves }),
    db.rpc("roles_pro", { p_min: MIN_PARTIDAS_ROL }),
  ]);
  if (e1 || e2 || e3) throw new Error((e1 ?? e2 ?? e3)!.message);

  const rolesValidos = new Map<string, Record<string, number>>();
  for (const f of filasRoles as { champ_id: string; rol: string; n: number }[]) {
    rolesValidos.set(f.champ_id, { ...rolesValidos.get(f.champ_id), [f.rol]: f.n });
  }

  // junto las filas por champ (vienen una por liga) y pondero cada tasa por el peso de su liga
  const porChamp = new Map<string, FilaChamp[]>();
  for (const f of filasChamps as FilaChamp[]) porChamp.set(f.champ_id, [...(porChamp.get(f.champ_id) ?? []), f]);

  const champs = new Map<string, StatChamp>();
  for (const [id, filas] of porChamp) {
    let pickRate = 0;
    let banRate = 0;
    let victoriasPond = 0;
    let picksPond = 0;
    let picks = 0;
    const roles: Record<string, number> = {};
    let temprano = 0;
    let fase2 = 0;

    for (const f of filas) {
      const w = peso(f.liga);
      const n = partidasPorLiga[f.liga];
      pickRate += (w * f.picks) / n;
      banRate += (w * f.bans) / n;
      victoriasPond += w * f.victorias;
      picksPond += w * f.picks;
      picks += f.picks;
      for (const [rol, c] of Object.entries(f.roles)) roles[rol] = (roles[rol] ?? 0) + w * c;
      for (const [orden, c] of Object.entries(f.picks_por_orden)) {
        if (ORDEN_TEMPRANO.includes(Number(orden))) temprano += w * c;
        if (ORDEN_FASE2.includes(Number(orden))) fase2 += w * c;
      }
    }

    const sumaRoles = Object.values(roles).reduce((a, b) => a + b, 0);
    for (const rol in roles) roles[rol] = sumaRoles ? roles[rol] / sumaRoles : 0;
    champs.set(id, {
      id,
      presencia: pickRate + banRate,
      pickRate,
      banRate,
      winrate: picks >= 3 && picksPond ? victoriasPond / picksPond : null,
      picks,
      roles,
      temprano: picksPond ? temprano / picksPond : 0,
      fase2: picksPond ? fase2 / picksPond : 0,
    });
  }

  // lo mismo para los turnos: por cada orden, que % de las veces se pickeo cada rol
  const turnosPond = new Map<number, Record<string, number>>();
  for (const f of filasTurnos as { orden: number; liga: string; rol: string; n: number }[]) {
    const t = turnosPond.get(f.orden) ?? {};
    t[f.rol] = (t[f.rol] ?? 0) + (peso(f.liga) * f.n) / partidasPorLiga[f.liga];
    turnosPond.set(f.orden, t);
  }
  const turnos = new Map<number, Record<string, number>>();
  for (const [orden, t] of turnosPond) {
    const suma = Object.values(t).reduce((a, b) => a + b, 0);
    turnos.set(orden, Object.fromEntries(Object.entries(t).map(([r, v]) => [r, v / suma])));
  }

  return { rolesValidos, parchesPorLiga, partidasPorLiga, muestraChica, champs, turnos };
}
