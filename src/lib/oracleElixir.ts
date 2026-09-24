import "server-only";
import { normalizar, parcheDesdeVersion } from "./champs";
import { indicesDe, type Side } from "./draft";

// CSV publico de Oracle's Elixir (carpeta de Google Drive linkeada en oracleselixir.com/tools/downloads).
// Se actualiza una vez por dia y piden no bajarlo mas seguido que eso
const ID_ARCHIVO_2026 = "1hnpbrUpBMS1TZI7IovfpKeZfWJH1Aptm";
export const URL_CSV = `https://drive.usercontent.google.com/download?id=${ID_ARCHIVO_2026}&export=download&confirm=t`;

// codigo de liga en el CSV -> el mio. Todo lo que no este aca se ignora
const LIGAS: Record<string, string> = { LCK: "LCK", LEC: "LEC", LPL: "LPL", MSI: "MSI", WLDs: "WORLDS" };
const ROLES: Record<string, string> = { top: "top", jng: "jungla", mid: "mid", bot: "adc", sup: "support" };

export type PartidaPro = {
  game_id: string;
  liga: string;
  torneo: string;
  parche: string;
  fecha: string;
  equipo_blue: string;
  equipo_red: string;
  ganador: Side | null;
  primer_pick: Side | null;
  champs_sin_mapear: string[];
};

export type AccionPro = { game_id: string; orden: number; side: Side; tipo: "ban" | "pick"; champ_id: string | null; rol: string | null };

// parser chico de una linea CSV con comillas, el archivo es simple y no vale la pena sumar una dependencia
function parsearLinea(linea: string) {
  const campos: string[] = [];
  let actual = "";
  let entreComillas = false;
  for (const ch of linea) {
    if (ch === '"') entreComillas = !entreComillas;
    else if (ch === "," && !entreComillas) {
      campos.push(actual);
      actual = "";
    } else actual += ch;
  }
  campos.push(actual);
  return campos;
}

type Fila = Record<string, string>;

// Cada partida viene en 12 filas: 10 de jugadores (champ + posicion) y 2 de equipo (bans y picks en orden).
// Devuelvo solo las ligas que me interesan y, si viene `desde`, solo partidas de esa fecha en adelante
export function convertirCsv(texto: string, mapaNombres: Map<string, string>, desde?: string) {
  const lineas = texto.split(/\r?\n/);
  const cabecera = parsearLinea(lineas[0]);
  const iLiga = cabecera.indexOf("league");
  const iFecha = cabecera.indexOf("date");
  const porPartida = new Map<string, Fila[]>();

  for (let i = 1; i < lineas.length; i++) {
    if (!lineas[i]) continue;
    const valores = parsearLinea(lineas[i]);
    // son ~100k filas y me quedo con una parte, asi que filtro antes de armar el objeto
    if (!LIGAS[valores[iLiga]] || (desde && valores[iFecha] < desde)) continue;
    const fila: Fila = {};
    cabecera.forEach((c, j) => (fila[c] = valores[j] ?? ""));
    porPartida.set(fila.gameid, [...(porPartida.get(fila.gameid) ?? []), fila]);
  }

  const partidas: PartidaPro[] = [];
  const acciones: AccionPro[] = [];
  const sinMapear = new Set<string>();

  for (const [gameId, filas] of porPartida) {
    const equipos = filas.filter((f) => f.position === "team");
    const blue = equipos.find((f) => f.side === "Blue");
    const red = equipos.find((f) => f.side === "Red");
    if (!blue || !red || !blue.pick1) continue; // partida incompleta, sin draft

    const noMapeados: string[] = [];
    const aId = (nombre: string) => {
      if (!nombre) return null; // ban perdido
      const id = mapaNombres.get(normalizar(nombre));
      if (!id) noMapeados.push(nombre);
      return id ?? null;
    };

    // el rol de cada champ sale de las filas de jugadores de ese equipo
    const rolDe = (equipo: Fila, champ: string) =>
      ROLES[filas.find((f) => f.position !== "team" && f.side === equipo.side && f.champion === champ)?.position ?? ""] ?? null;

    // desde 2026 el first pick va aparte del side: el que pickea primero ocupa los turnos "blue" del orden de draft
    const primerPick: Side = red.firstPick === "1" ? "red" : "blue";
    const [primero, segundo] = primerPick === "red" ? [red, blue] : [blue, red];

    (["blue", "red"] as const).forEach((posicion) => {
      const equipo = posicion === "blue" ? primero : segundo;
      indicesDe(posicion, "ban").forEach((orden, i) =>
        acciones.push({ game_id: gameId, orden, side: posicion, tipo: "ban", champ_id: aId(equipo[`ban${i + 1}`]), rol: null }),
      );
      indicesDe(posicion, "pick").forEach((orden, i) => {
        const champ = equipo[`pick${i + 1}`];
        acciones.push({ game_id: gameId, orden, side: posicion, tipo: "pick", champ_id: aId(champ), rol: rolDe(equipo, champ) });
      });
    });

    noMapeados.forEach((n) => sinMapear.add(n));
    partidas.push({
      game_id: gameId,
      liga: LIGAS[blue.league],
      torneo: `${blue.league} ${blue.year} ${blue.split}${blue.playoffs === "1" ? " Playoffs" : ""}`.trim(),
      // el CSV usa la numeracion de Data Dragon (16.17), yo guardo la de Riot (26.17)
      parche: parcheDesdeVersion(blue.patch),
      fecha: `${blue.date.replace(" ", "T")}Z`,
      equipo_blue: blue.teamname,
      equipo_red: red.teamname,
      ganador: blue.result === "1" ? "blue" : red.result === "1" ? "red" : null,
      primer_pick: primerPick,
      champs_sin_mapear: noMapeados,
    });
  }

  return { partidas, acciones, sinMapear: [...sinMapear] };
}
