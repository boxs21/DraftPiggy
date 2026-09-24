// tipos que comparten el servidor (route de recomendar) y el panel de KuAi en el cliente

export type NombreAgente = "scout" | "pro";

// de donde salio cada opcion del consenso: lo calcula el codigo, no el modelo
export type Origen = "ambos" | "scout" | "pro" | "kuai";

export type OpcionVista = {
  champ: string;
  rol: string;
  razon: string;
  id: string | null;
  nombre: string;
  problema: string | null;
  origen?: Origen;
};

export type AgenteVista = {
  lectura: string;
  opciones: OpcionVista[];
  ms: number;
};

export type Uso = { modelo: string; ms: number; tokensEntrada: number; tokensSalida: number; costoUsd: number; llamadas: number };

export type Final = {
  turno: number;
  esNuestro: boolean;
  tipo: "ban" | "pick";
  rolesNuestros: { champ: string; rol: string }[];
  rolesRival: { champ: string; rol: string }[];
  lectura: string;
  opciones: OpcionVista[];
  meta: { parchesPorLiga: Record<string, string[]>; partidasPorLiga: Record<string, number>; muestraChica: boolean } | null;
  avisoMeta: string | null;
  scouting: { nosotros: number; rival: number };
  amenazas: { id: string; partidas: number; winrate: number; jugadores: number }[];
  uso: Uso;
};

// lo que manda el servidor linea por linea (NDJSON) mientras los agentes trabajan
export type EventoKuai =
  | { tipo: "agente"; agente: NombreAgente; resultado: AgenteVista }
  | { tipo: "agente"; agente: NombreAgente; omitido: string }
  | { tipo: "final"; final: Final }
  | { tipo: "error"; error: string };
