"use client";

import { useState, type ClipboardEvent, type KeyboardEvent } from "react";
import IconoChamp from "./IconoChamp";
import { LogoPiggy } from "./Logo";
import { rolDe, type Equipo, type Jugador, type usePlanteles } from "./usePlanteles";
import type { Champ } from "@/lib/champs";

type Props = {
  champsPorId: Map<string, Champ>;
  version: string;
  plantel: ReturnType<typeof usePlanteles>;
  onIrAlDraft: () => void;
};

const ORDEN_ROL = ["top", "jungla", "mid", "adc", "support"];
const ETIQUETA_ROL: Record<string, string> = { top: "TOP", jungla: "JG", mid: "MID", adc: "ADC", support: "SUP" };

export default function Scout({ champsPorId, version, plantel, onIrAlDraft }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-8 overflow-y-auto px-10 py-8">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-4xl font-extralight text-neutral-100">Scout</p>
          <p className="mt-2 max-w-xl text-sm text-neutral-500">
            Pegá el link de op.gg o u.gg (multisearch o perfil) o los Riot IDs de cada equipo. Se miran sus últimas ranked
            en LAS. La primera vez tarda un par de minutos por el límite de Riot; después se actualiza al toque.
          </p>
        </div>
        <button
          type="button"
          onClick={onIrAlDraft}
          className="whitespace-nowrap rounded-xl bg-cyan-400/90 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-cyan-300 hover:shadow-[0_0_24px_rgba(34,211,238,0.35)]"
        >
          Ir al live draft →
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <TarjetaEquipo equipo="nosotros" titulo="Mi equipo" {...{ champsPorId, version, plantel }} />
        <TarjetaEquipo equipo="rival" titulo="Rival" {...{ champsPorId, version, plantel }} />
      </div>
    </div>
  );
}

function TarjetaEquipo({ equipo, titulo, champsPorId, version, plantel }: Omit<Props, "onIrAlDraft"> & { equipo: Equipo; titulo: string }) {
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const jugadores = plantel.planteles[equipo];
  const cargando = jugadores.filter((j) => j.estado === "cargando" || j.estado === "esperando").length;
  const ordenados = [...jugadores].sort((a, b) => posRol(a) - posRol(b));

  const cargar = (valor: string) => {
    const n = plantel.agregar(equipo, valor);
    setAviso(n ? `${n} jugador${n > 1 ? "es" : ""} encontrado${n > 1 ? "s" : ""}` : "No encontré Riot IDs nuevos ahí");
    if (n) setTexto("");
  };

  // al pegar un link lo proceso directo, sin tener que apretar Enter
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pegado = e.clipboardData.getData("text");
    if (!pegado.trim()) return;
    e.preventDefault();
    cargar(pegado);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && texto.trim()) cargar(texto);
  };

  const esNuestro = equipo === "nosotros";

  return (
    <section className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 backdrop-blur-sm">
      {/* linea de color arriba: cian para nosotros, rosa para el rival */}
      <span
        className={`absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent to-transparent ${esNuestro ? "via-cyan-400/70" : "via-rose-400/70"}`}
      />
      <span
        className={`pointer-events-none absolute -top-24 left-1/2 h-40 w-2/3 -translate-x-1/2 rounded-full blur-3xl ${esNuestro ? "bg-cyan-400/[0.07]" : "bg-rose-500/[0.07]"}`}
      />
      <header className="relative flex items-center justify-between">
        <h2 className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] ${esNuestro ? "text-cyan-300" : "text-rose-300"}`}>
          <span className={`h-2 w-2 rounded-full ${esNuestro ? "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]" : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)]"}`} />
          {titulo}
          {jugadores.length > 0 && <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] tracking-normal text-neutral-400">{jugadores.length}</span>}
        </h2>
        {jugadores.length > 0 && (
          <div className="flex gap-2 text-xs">
            <button type="button" onClick={() => plantel.refrescar(equipo)} disabled={cargando > 0} className="text-neutral-500 transition hover:text-cyan-300 disabled:opacity-40">
              Actualizar
            </button>
            <span className="text-neutral-700">·</span>
            <button type="button" onClick={() => plantel.vaciar(equipo)} className="text-neutral-500 transition hover:text-rose-300">
              Vaciar
            </button>
          </div>
        )}
      </header>

      <div className="relative flex flex-col gap-1.5">
        <input
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setAviso(null);
          }}
          onPaste={onPaste}
          onKeyDown={onKeyDown}
          placeholder="Pegá op.gg / u.gg o Nombre#TAG"
          spellCheck={false}
          className="rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-cyan-400/70 focus:shadow-[0_0_0_4px_rgba(34,211,238,0.08)]"
        />
        <p className="h-4 text-xs text-neutral-500">
          {cargando > 0 ? `Buscando partidas… faltan ${cargando}` : aviso}
        </p>
      </div>

      {jugadores.length === 0 ? (
        <div className="relative flex h-44 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10 text-sm text-neutral-600">
          <LogoPiggy size={32} className="text-neutral-700" />
          Pegá un link para empezar
        </div>
      ) : (
        <ol className="relative flex flex-col gap-2">
          {ordenados.map((j) => (
            <FilaJugador key={j.riotId} jugador={j} equipo={equipo} {...{ champsPorId, version, plantel }} />
          ))}
        </ol>
      )}
    </section>
  );
}

const posRol = (j: Jugador) => {
  const i = ORDEN_ROL.indexOf(rolDe(j) ?? "");
  return i === -1 ? ORDEN_ROL.length : i;
};

function FilaJugador({ jugador: j, equipo, champsPorId, version, plantel }: Omit<Props, "onIrAlDraft"> & { jugador: Jugador; equipo: Equipo }) {
  return (
    <li className="group flex animate-aparecer flex-col gap-2 rounded-xl border border-white/[0.05] bg-black/25 p-3 transition hover:border-white/10 hover:bg-white/[0.03]">
      <div className="flex items-center gap-3">
        {/* el rol de ranked no siempre es el del equipo: click y lo cambias */}
        <select
          value={rolDe(j) ?? ""}
          onChange={(e) => plantel.asignarRol(equipo, j.riotId, e.target.value)}
          title={j.rol ? `En ranked juega más ${ETIQUETA_ROL[j.rol]}. Cambialo si en el equipo juega otro rol` : "Elegí el rol que juega en el equipo"}
          className={`w-14 cursor-pointer appearance-none rounded py-0.5 text-center text-[10px] font-semibold tracking-wider outline-none transition hover:bg-white/10 ${
            j.rolAsignado ? "bg-cyan-400/15 text-cyan-300" : "bg-white/[0.06] text-neutral-400"
          }`}
        >
          {!rolDe(j) && <option value="">—</option>}
          {ORDEN_ROL.map((r) => (
            <option key={r} value={r} className="bg-neutral-900">
              {ETIQUETA_ROL[r]}
            </option>
          ))}
        </select>
        <span className="min-w-0 flex-1 truncate text-sm text-neutral-100">{j.riotId}</span>
        {j.estado === "listo" && <span className="text-xs text-neutral-600 tabular-nums">{j.partidas} ranked</span>}
        <button
          type="button"
          onClick={() => plantel.quitar(equipo, j.riotId)}
          title="Sacar jugador"
          className="text-neutral-700 opacity-0 transition group-hover:opacity-100 hover:text-rose-300"
        >
          ✕
        </button>
      </div>

      {j.estado === "listo" && (
        <div className="flex flex-wrap gap-2">
          {j.champs?.length ? (
            j.champs.map((c) => {
              const champ = champsPorId.get(c.id);
              const wr = c.victorias / c.partidas;
              return (
                <div key={c.id} title={`${champ?.nombre ?? c.id} · ${c.partidas} partidas · ${Math.round(wr * 100)}% WR`} className="flex flex-col items-center gap-0.5">
                  <IconoChamp
                    version={version}
                    id={c.id}
                    nombre={champ?.nombre ?? c.id}
                    size={36}
                    className="rounded-md ring-1 ring-white/10 transition hover:scale-110 hover:ring-cyan-400/60"
                  />
                  <span className="text-[10px] text-neutral-400 tabular-nums">
                    {c.partidas}·<span className={wr >= 0.6 ? "text-cyan-300" : wr < 0.45 ? "text-rose-400" : ""}>{Math.round(wr * 100)}%</span>
                  </span>
                </div>
              );
            })
          ) : (
            <span className="text-xs text-neutral-600">Sin ranked recientes</span>
          )}
        </div>
      )}
      {(j.estado === "cargando" || j.estado === "esperando") && (
        <p className="animate-pulse text-xs text-neutral-500">{j.estado === "cargando" ? "Buscando partidas…" : "En cola…"}</p>
      )}
      {j.estado === "error" && (
        <p className="text-xs text-rose-400">
          {j.error}{" "}
          <button type="button" onClick={() => plantel.reintentar(equipo, j.riotId)} className="text-neutral-400 underline hover:text-cyan-300">
            Reintentar
          </button>
        </p>
      )}
    </li>
  );
}
