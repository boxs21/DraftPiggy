"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import IconoChamp from "./IconoChamp";
import { buscarChamps, crearIndice, type Champ } from "@/lib/champs";

type Props = {
  champs: Champ[];
  version: string;
  bloqueados: Set<string>;
  deshabilitado: boolean;
  onConfirmar: (id: string) => void;
};

export default function Buscador({ champs, version, bloqueados, deshabilitado, onConfirmar }: Props) {
  const [query, setQuery] = useState("");
  const [seleccionado, setSeleccionado] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const indice = useMemo(() => crearIndice(champs), [champs]);
  const resultados = useMemo(() => buscarChamps(indice, query), [indice, query]);
  // los bloqueados se siguen viendo en la grilla pero con Enter y flechas se saltan
  const disponibles = resultados.filter((c) => !bloqueados.has(c.id));
  const elegido = disponibles[Math.min(seleccionado, disponibles.length - 1)];

  // cuando se reinicia el draft el input vuelve a estar activo, le devuelvo el foco
  useEffect(() => {
    if (!deshabilitado) inputRef.current?.focus();
  }, [deshabilitado]);

  // si toque otro boton y el foco se fue, igual quiero poder tipear directo sin clickear el input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      // si estoy escribiendo en otro campo (ej el pool) no le robo el foco
      const activo = document.activeElement;
      if (activo === inputRef.current || activo?.matches("input, textarea, select")) return;
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const confirmar = (id: string) => {
    onConfirmar(id);
    setQuery("");
    setSeleccionado(0);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // si tipeas y das Enter muy rapido el render todavia no llego y elegido es el de la busqueda vieja,
      // asi que en ese caso busco de nuevo con lo que realmente hay en el input
      const texto = e.currentTarget.value;
      const champ =
        texto === query ? elegido : buscarChamps(indice, texto).find((c) => !bloqueados.has(c.id));
      if (champ) confirmar(champ.id);
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setSeleccionado((s) => Math.min(s + 1, disponibles.length - 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setSeleccionado((s) => Math.max(s - 1, 0));
    } else if (e.key === "Escape") {
      setQuery("");
      setSeleccionado(0);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <input
        ref={inputRef}
        autoFocus
        value={query}
        disabled={deshabilitado}
        onChange={(e) => {
          setQuery(e.target.value);
          setSeleccionado(0);
        }}
        onKeyDown={onKeyDown}
        placeholder={deshabilitado ? "Draft terminado" : "Buscar champ y Enter..."}
        spellCheck={false}
        autoComplete="off"
        className="w-full rounded-md border border-white/10 bg-white/[0.03] px-4 py-3 text-lg text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-cyan-400/70 disabled:opacity-40"
      />

      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2 overflow-y-auto pr-1">
        {resultados.map((c) => {
          const bloqueado = bloqueados.has(c.id);
          const esElegido = c.id === elegido?.id;
          return (
            <button
              key={c.id}
              type="button"
              disabled={bloqueado || deshabilitado}
              onClick={() => confirmar(c.id)}
              title={c.nombre}
              className={`group flex flex-col items-center gap-1 rounded-md p-1 transition ${
                esElegido ? "bg-cyan-400/10 ring-1 ring-cyan-400" : "hover:bg-white/5"
              } ${bloqueado ? "cursor-not-allowed opacity-20 grayscale" : ""}`}
            >
              <IconoChamp version={version} id={c.id} nombre={c.nombre} size={48} className="rounded" />
              <span className="w-full truncate text-center text-[10px] text-neutral-400 group-hover:text-neutral-200">
                {c.nombre}
              </span>
            </button>
          );
        })}
        {resultados.length === 0 && <p className="col-span-full text-sm text-neutral-600">Nada con &quot;{query}&quot;</p>}
      </div>
    </div>
  );
}
