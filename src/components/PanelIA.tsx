"use client";

import { useEffect, useRef, useState } from "react";
import IconoChamp from "./IconoChamp";
import { LogoPiggy } from "./Logo";
import type { Side } from "@/lib/draft";
import type { JugadoresDraft } from "@/lib/riotIds";

type Opcion = { champ: string; rol: string; razon: string; id: string | null; nombre: string; problema: string | null };

type Reco = {
  turno: number;
  esNuestro: boolean;
  tipo: "ban" | "pick";
  rolesNuestros: { champ: string; rol: string }[];
  rolesRival: { champ: string; rol: string }[];
  lectura: string;
  opciones: Opcion[];
  meta: { parchesPorLiga: Record<string, string[]>; partidasPorLiga: Record<string, number>; muestraChica: boolean } | null;
  avisoMeta: string | null;
  amenazas: { id: string; partidas: number; winrate: number; jugadores: number }[];
  uso: { modelo: string; ms: number; tokensEntrada: number; tokensSalida: number; costoUsd: number };
};

type Props = {
  slots: (string | null)[];
  turnoActual: number;
  sideElegido: Side;
  version: string;
  terminado: boolean;
  jugadores: JugadoresDraft;
  onElegir: (id: string) => void;
};

const MODELOS = [
  { id: "mistral-medium-2604", label: "Medium 3.5" },
  { id: "mistral-small-2603", label: "Small 4" },
];

const KEY_POOL = "draft.poolRapido";

export default function PanelIA({ slots, turnoActual, sideElegido, version, terminado, jugadores, onElegir }: Props) {
  const [modelo, setModelo] = useState(MODELOS[0].id);
  const [reco, setReco] = useState<Reco | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gastoSesion, setGastoSesion] = useState(0);
  const poolRef = useRef<HTMLTextAreaElement>(null);

  // el pool lo dejo en localStorage y el textarea sin controlar, asi no hay lio de hidratacion
  useEffect(() => {
    try {
      if (poolRef.current) poolRef.current.value = localStorage.getItem(KEY_POOL) ?? "";
    } catch {}
  }, []);

  const pedir = async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/recomendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots, turnoActual, sideElegido, pool: poolRef.current?.value, modelo, jugadores }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setReco(data);
      setGastoSesion((g) => g + data.uso.costoUsd);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo fallo");
    } finally {
      setCargando(false);
    }
  };

  // si el draft avanzo o se deshizo, la reco vieja ya no aplica
  const recoVigente = reco && reco.turno === turnoActual ? reco : null;

  return (
    <div className="relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 backdrop-blur-sm">
      <span className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-400/50 to-transparent" />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={pedir}
          disabled={cargando || terminado}
          className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-cyan-400/90 px-3.5 py-1.5 text-sm font-semibold text-neutral-950 transition hover:bg-cyan-300 hover:shadow-[0_0_20px_rgba(34,211,238,0.35)] disabled:opacity-40 disabled:hover:shadow-none"
        >
          {cargando ? (
            <>
              <LogoPiggy size={16} className="animate-flotar" /> KuAi pensando…
            </>
          ) : (
            <>
              {/* destellito de "IA" */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2l2.2 6.3L20.5 10.5 14.2 12.7 12 19l-2.2-6.3L3.5 10.5l6.3-2.2L12 2Z" />
              </svg>
              Preguntar a KuAi
            </>
          )}
        </button>
        <select
          value={modelo}
          onChange={(e) => setModelo(e.target.value)}
          className="rounded-md border border-white/10 bg-transparent px-2 py-1.5 text-xs text-neutral-400"
        >
          {MODELOS.map((m) => (
            <option key={m.id} value={m.id} className="bg-neutral-900">
              {m.label}
            </option>
          ))}
        </select>
        <details className="relative ml-auto text-xs text-neutral-500">
          <summary className="cursor-pointer select-none whitespace-nowrap hover:text-neutral-300">Pool rápido</summary>
          <textarea
            ref={poolRef}
            rows={5}
            onChange={(e) => {
              try {
                localStorage.setItem(KEY_POOL, e.target.value);
              } catch {}
            }}
            placeholder={"top: Aatrox, Jax\njungla: Vi, Sejuani\nmid: ...\nadc: ...\nsupport: ..."}
            className="absolute right-0 z-10 mt-2 w-72 rounded-md border border-white/10 bg-neutral-950 p-2 text-xs text-neutral-200 outline-none focus:border-cyan-400/60"
          />
        </details>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      {recoVigente && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-neutral-400">
            <span className="font-semibold text-cyan-300">KuAi</span>
            <span className="text-neutral-500"> · {recoVigente.esNuestro ? "para vos" : "probable del rival"} · </span>
            {recoVigente.lectura}
          </p>
          {/* lo muestro para ver si la IA entendio bien quien juega que, si esto esta mal todo lo demas tambien */}
          <p className="text-[10px] text-neutral-600">
            Roles nosotros: {recoVigente.rolesNuestros.map((r) => `${r.champ} ${r.rol}`).join(", ") || "-"} · rival:{" "}
            {recoVigente.rolesRival.map((r) => `${r.champ} ${r.rol}`).join(", ") || "-"}
          </p>
          <ol className="flex flex-col gap-1.5">
            {recoVigente.opciones.map((o, n) => (
              // entran de a una, escalonadas
              <li key={`${recoVigente.turno}-${n}`} className="animate-aparecer" style={{ animationDelay: `${n * 90}ms` }}>
                <button
                  type="button"
                  disabled={!o.id || !!o.problema}
                  onClick={() => o.id && onElegir(o.id)}
                  title={o.problema ? `No se puede elegir: ${o.problema}` : "Click para confirmarlo en el draft"}
                  className="flex w-full items-start gap-3 rounded-xl p-2 text-left transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="mt-2.5 w-3 text-[10px] font-semibold text-neutral-600 tabular-nums">{n + 1}</span>
                  {o.id ? (
                    <IconoChamp version={version} id={o.id} nombre={o.nombre} size={40} className={`rounded-lg ring-1 ${n === 0 ? "ring-cyan-400/60" : "ring-white/10"}`} />
                  ) : (
                    <div className="h-9 w-9 rounded bg-white/5" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm text-neutral-100">
                      {o.nombre} <span className="text-xs text-neutral-500">{o.rol}</span>
                      {o.problema && <span className="ml-2 text-xs text-rose-400">{o.problema}</span>}
                    </span>
                    <span className="text-xs text-neutral-400">{o.razon}</span>
                  </div>
                </button>
              </li>
            ))}
          </ol>
          {/* comfort picks del rival calculados del scouting: sirven de un vistazo para banear */}
          {recoVigente.amenazas.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-neutral-500">
              <span className="uppercase tracking-widest">Amenazas rival</span>
              {recoVigente.amenazas.map((a) => (
                <span
                  key={a.id}
                  title={`${a.partidas} partidas en ranked · ${Math.round(a.winrate * 100)}% WR${a.jugadores > 1 ? ` · lo juegan ${a.jugadores} rivales` : ""}`}
                  className="flex items-center gap-1 rounded bg-white/[0.04] py-0.5 pr-1.5 pl-0.5"
                >
                  <IconoChamp version={version} id={a.id} nombre={a.id} size={18} className="rounded-sm" />
                  <span className="tabular-nums">
                    {a.partidas}p {Math.round(a.winrate * 100)}%{a.jugadores > 1 ? " ×" + a.jugadores : ""}
                  </span>
                </span>
              ))}
            </div>
          )}
          {/* de donde salen los numeros: si no hay datos pro la reco es de memoria y conviene saberlo */}
          {recoVigente.meta ? (
            <p className={`text-[10px] ${recoVigente.meta.muestraChica ? "text-amber-400/80" : "text-neutral-600"}`}>
              Datos pro ·{" "}
              {Object.entries(recoVigente.meta.partidasPorLiga)
                .map(([l, n]) => `${l} ${n} (${recoVigente.meta!.parchesPorLiga[l].join("+")})`)
                .join(" · ")}
              {recoVigente.meta.muestraChica && " · muestra chica"}
            </p>
          ) : (
            <p className="text-[10px] text-amber-400/80">Sin datos pro: {recoVigente.avisoMeta}</p>
          )}
          <p className="text-[10px] text-neutral-600 tabular-nums">
            {recoVigente.uso.modelo} · {(recoVigente.uso.ms / 1000).toFixed(1)}s · {recoVigente.uso.tokensEntrada}+
            {recoVigente.uso.tokensSalida} tokens · ${recoVigente.uso.costoUsd.toFixed(4)} · sesión ${gastoSesion.toFixed(4)}
          </p>
        </div>
      )}
    </div>
  );
}
