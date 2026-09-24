export type Side = "blue" | "red";
export type TipoAccion = "ban" | "pick";
export type Fase = 1 | 2;

export type Accion = {
  side: Side;
  tipo: TipoAccion;
  fase: Fase;
  numero: number; // el n° de ban o pick de ese side (B1, R3, etc)
};

// orden de torneo tal cual, cada fila es un turno
const SECUENCIA: [Side, TipoAccion, Fase][] = [
  // bans fase 1: B1 R1 B2 R2 B3 R3
  ["blue", "ban", 1], ["red", "ban", 1],
  ["blue", "ban", 1], ["red", "ban", 1],
  ["blue", "ban", 1], ["red", "ban", 1],
  // picks fase 1: B1 | R1 R2 | B2 B3 | R3
  ["blue", "pick", 1],
  ["red", "pick", 1], ["red", "pick", 1],
  ["blue", "pick", 1], ["blue", "pick", 1],
  ["red", "pick", 1],
  // bans fase 2, aca arranca red: R4 B4 R5 B5
  ["red", "ban", 2], ["blue", "ban", 2],
  ["red", "ban", 2], ["blue", "ban", 2],
  // picks fase 2: R4 | B4 B5 | R5
  ["red", "pick", 2],
  ["blue", "pick", 2], ["blue", "pick", 2],
  ["red", "pick", 2],
];

// el numero lo calculo contando para no tipearlo a mano y equivocarme
export const ORDEN_DRAFT: Accion[] = SECUENCIA.map(([side, tipo, fase], i) => ({
  side,
  tipo,
  fase,
  numero: SECUENCIA.slice(0, i + 1).filter(([s, t]) => s === side && t === tipo).length,
}));

export const TOTAL_ACCIONES = ORDEN_DRAFT.length;

export type EstadoDraft = {
  slots: (string | null)[]; // id del champ en cada turno
  turnoActual: number;
};

export const DRAFT_VACIO: EstadoDraft = {
  slots: Array(TOTAL_ACCIONES).fill(null),
  turnoActual: 0,
};

export const etiquetaAccion = (accion: Accion) =>
  `${accion.side === "blue" ? "B" : "R"}${accion.numero}`;

// indices del array de 20 que le tocan a un side, en orden
export const indicesDe = (side: Side, tipo: TipoAccion) =>
  ORDEN_DRAFT.flatMap((a, i) => (a.side === side && a.tipo === tipo ? [i] : []));
