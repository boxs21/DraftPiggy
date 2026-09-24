"use client";

import { useEffect } from "react";
import type { Side } from "@/lib/draft";

// pantalla de entrada: antes de ver el tablero hay que decir de que lado estamos. B o R con el teclado tambien
export default function ElegirSide({ onElegir }: { onElegir: (side: Side) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.toLowerCase() === "b") onElegir("blue");
      if (e.key.toLowerCase() === "r") onElegir("red");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onElegir]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-12 px-6">
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-neutral-500">Draft</h1>
        <p className="text-3xl font-extralight text-neutral-100">¿De qué lado estás?</p>
      </div>

      <div className="flex gap-4">
        {(["blue", "red"] as const).map((side) => (
          <button
            key={side}
            type="button"
            onClick={() => onElegir(side)}
            className={`group flex h-40 w-56 flex-col items-center justify-center gap-3 rounded-xl border transition ${
              side === "blue"
                ? "border-sky-500/30 hover:border-sky-400 hover:bg-sky-500/10"
                : "border-rose-500/30 hover:border-rose-400 hover:bg-rose-500/10"
            }`}
          >
            <span className={`h-3 w-3 rounded-full ${side === "blue" ? "bg-sky-500" : "bg-rose-500"}`} />
            <span
              className={`text-sm font-semibold uppercase tracking-[0.3em] ${side === "blue" ? "text-sky-300" : "text-rose-300"}`}
            >
              {side === "blue" ? "Blue side" : "Red side"}
            </span>
            <kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-neutral-500 group-hover:text-neutral-300">
              {side === "blue" ? "B" : "R"}
            </kbd>
          </button>
        ))}
      </div>
    </div>
  );
}
