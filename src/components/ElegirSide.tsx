"use client";

import { useEffect } from "react";
import { LogoPiggy } from "./Logo";
import type { Side } from "@/lib/draft";

// pantalla de entrada al live draft: antes de ver el tablero hay que decir de que lado estamos. B o R con el teclado tambien
export default function ElegirSide({ onElegir }: { onElegir: (side: Side) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tecla = e.key.toLowerCase();
      if (tecla !== "b" && tecla !== "r") return;
      // sin esto la letra termina escrita en el buscador, que se monta y toma el foco en el mismo tecleo
      e.preventDefault();
      onElegir(tecla === "b" ? "blue" : "red");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onElegir]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-12 px-6">
      <div className="flex flex-col items-center gap-4">
        <LogoPiggy size={44} className="animate-flotar text-cyan-300/80" />
        <p className="text-3xl font-extralight text-neutral-100">¿De qué lado estás?</p>
        <p className="text-sm text-neutral-500">Elegí tu side para arrancar el draft</p>
      </div>

      <div className="flex gap-5">
        {(["blue", "red"] as const).map((side) => {
          const esBlue = side === "blue";
          return (
            <button
              key={side}
              type="button"
              onClick={() => onElegir(side)}
              className={`group relative flex h-48 w-60 flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border bg-white/[0.02] transition duration-300 hover:-translate-y-1 ${
                esBlue
                  ? "border-sky-500/25 hover:border-sky-400/70 hover:shadow-[0_10px_40px_-10px_rgba(14,165,233,0.5)]"
                  : "border-rose-500/25 hover:border-rose-400/70 hover:shadow-[0_10px_40px_-10px_rgba(244,63,94,0.5)]"
              }`}
            >
              {/* brillo del color del side que se prende al pasar el mouse */}
              <span
                className={`absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100 ${
                  esBlue
                    ? "bg-[radial-gradient(circle_at_50%_0%,rgba(14,165,233,0.22),transparent_70%)]"
                    : "bg-[radial-gradient(circle_at_50%_0%,rgba(244,63,94,0.22),transparent_70%)]"
                }`}
              />
              <span
                className={`relative h-4 w-4 rounded-full ${
                  esBlue ? "bg-sky-500 shadow-[0_0_16px_rgba(14,165,233,0.9)]" : "bg-rose-500 shadow-[0_0_16px_rgba(244,63,94,0.9)]"
                }`}
              />
              <span className={`relative text-sm font-semibold uppercase tracking-[0.3em] ${esBlue ? "text-sky-300" : "text-rose-300"}`}>
                {esBlue ? "Blue side" : "Red side"}
              </span>
              <kbd className="relative rounded border border-white/10 px-2 py-0.5 text-[10px] text-neutral-500 group-hover:text-neutral-300">
                {esBlue ? "B" : "R"}
              </kbd>
            </button>
          );
        })}
      </div>
    </div>
  );
}
