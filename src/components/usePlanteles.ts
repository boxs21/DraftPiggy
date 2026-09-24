"use client";

import { useRef, useState } from "react";
import { extraerRiotIds, normalizarRiotId } from "@/lib/riotIds";

export type Equipo = "nosotros" | "rival";

export type ChampJugador = { id: string; partidas: number; victorias: number; ultima: string };

export type Jugador = {
  riotId: string;
  estado: "esperando" | "cargando" | "listo" | "error";
  error?: string;
  partidas?: number;
  rol?: string | null; // el que mas juega en ranked
  rolAsignado?: string; // el que juega en el equipo, si lo cambiaste a mano
  champs?: ChampJugador[];
};

// el rol que vale para el draft: el que pusiste a mano o, si no, el de ranked
export const rolDe = (j: Jugador) => j.rolAsignado ?? j.rol ?? null;

type Planteles = Record<Equipo, Jugador[]>;

const KEY_STORAGE = "draft.planteles";
const VACIO: Planteles = { nosotros: [], rival: [] };

// lo guardo en el navegador para no tener que volver a pegar los links cada vez que entro
function leerGuardado(): Planteles {
  try {
    const crudo = typeof window !== "undefined" ? localStorage.getItem(KEY_STORAGE) : null;
    if (!crudo) return VACIO;
    const p = JSON.parse(crudo) as Planteles;
    // si quedo algo a medio cargar de la vez anterior lo marco para reintentar
    const arreglar = (l: Jugador[]) => (l ?? []).map((j) => (j.estado === "listo" || j.estado === "error" ? j : { ...j, estado: "error" as const, error: "Sin terminar, actualizá" }));
    return { nosotros: arreglar(p.nosotros), rival: arreglar(p.rival) };
  } catch {
    return VACIO;
  }
}

export function usePlanteles() {
  const [planteles, setPlanteles] = useState<Planteles>(leerGuardado);
  // cola para scoutear de a un jugador por vez (la key de Riot tiene rate limit) aunque cargues los dos equipos seguido
  const cola = useRef<Promise<void>>(Promise.resolve());

  const actualizar = (fn: (p: Planteles) => Planteles) =>
    setPlanteles((p) => {
      const nuevo = fn(p);
      try {
        localStorage.setItem(KEY_STORAGE, JSON.stringify(nuevo));
      } catch {}
      return nuevo;
    });

  const cambiarJugador = (equipo: Equipo, riotId: string, cambios: Partial<Jugador>) =>
    actualizar((p) => ({
      ...p,
      [equipo]: p[equipo].map((j) => (normalizarRiotId(j.riotId) === normalizarRiotId(riotId) ? { ...j, ...cambios } : j)),
    }));

  const scoutear = (equipo: Equipo, riotIds: string[]) => {
    for (const riotId of riotIds) {
      cola.current = cola.current.then(async () => {
        cambiarJugador(equipo, riotId, { estado: "cargando", error: undefined });
        try {
          const res = await fetch("/api/scouting", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ riotId }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
          // Riot devuelve el nombre con las mayusculas reales, me quedo con ese
          cambiarJugador(equipo, riotId, { ...data, estado: "listo" });
        } catch (e) {
          cambiarJugador(equipo, riotId, { estado: "error", error: e instanceof Error ? e.message : "Falló" });
        }
      });
    }
  };

  // pegar un link o una lista: agrega los que no estan y arranca el scouting. Devuelve cuantos encontro
  const agregar = (equipo: Equipo, texto: string) => {
    const nuevos = extraerRiotIds(texto).filter(
      (id) => !planteles[equipo].some((j) => normalizarRiotId(j.riotId) === normalizarRiotId(id)),
    );
    if (!nuevos.length) return 0;
    actualizar((p) => ({ ...p, [equipo]: [...p[equipo], ...nuevos.map((riotId) => ({ riotId, estado: "esperando" as const }))] }));
    scoutear(equipo, nuevos);
    return nuevos.length;
  };

  const quitar = (equipo: Equipo, riotId: string) =>
    actualizar((p) => ({ ...p, [equipo]: p[equipo].filter((j) => j.riotId !== riotId) }));

  const vaciar = (equipo: Equipo) => actualizar((p) => ({ ...p, [equipo]: [] }));

  // vuelve a pedir todo: solo baja de Riot las partidas nuevas, lo demas sale de la cache
  const refrescar = (equipo: Equipo) => {
    const ids = planteles[equipo].map((j) => j.riotId);
    actualizar((p) => ({ ...p, [equipo]: p[equipo].map((j) => ({ ...j, estado: "esperando" as const })) }));
    scoutear(equipo, ids);
  };

  const reintentar = (equipo: Equipo, riotId: string) => {
    cambiarJugador(equipo, riotId, { estado: "esperando", error: undefined });
    scoutear(equipo, [riotId]);
  };

  const asignarRol = (equipo: Equipo, riotId: string, rol: string) => cambiarJugador(equipo, riotId, { rolAsignado: rol });

  // lo que usa la recomendacion: solo los que terminaron bien, con el rol que juegan en el equipo
  const listos = (equipo: Equipo) =>
    planteles[equipo].filter((j) => j.estado === "listo").map((j) => ({ riotId: j.riotId, rol: rolDe(j) ?? undefined }));

  return { planteles, agregar, quitar, vaciar, refrescar, reintentar, asignarRol, listos };
}
