"use client";

import { useEffect, useMemo, type Dispatch, type ReactNode, type SetStateAction } from "react";
import Buscador from "./Buscador";
import ColumnaEquipo, { COLOR_SIDE } from "./ColumnaEquipo";
import ElegirSide from "./ElegirSide";
import LineaDeTiempo from "./LineaDeTiempo";
import PanelIA from "./PanelIA";
import type { Champ } from "@/lib/champs";
import { DRAFT_VACIO, ORDEN_DRAFT, TOTAL_ACCIONES, etiquetaAccion, type EstadoDraft, type Side } from "@/lib/draft";

// el estado vive en App para que el draft no se pierda al pasar por la pestaña Scout
type Props = {
  champs: Champ[];
  champsPorId: Map<string, Champ>;
  version: string;
  sideElegido: Side | null; // null = todavia no eligio, se muestra "¿de que lado estas?"
  setSideElegido: (side: Side | null) => void;
  draft: EstadoDraft;
  setDraft: Dispatch<SetStateAction<EstadoDraft>>;
  jugadores: { nosotros: string[]; rival: string[] };
};

// hasta que turno se puede avanzar: lo jugado mas lo deshecho que sigue guardado en el array
const calcularHastaDonde = (slots: (string | null)[]) => {
  const primerVacio = slots.indexOf(null);
  return primerVacio === -1 ? TOTAL_ACCIONES : primerVacio;
};

export default function Tablero({ champs, champsPorId, version, sideElegido, setSideElegido, draft, setDraft, jugadores }: Props) {
  const { slots, turnoActual } = draft;

  const accionActual = ORDEN_DRAFT[turnoActual]; // undefined cuando ya se jugaron las 20
  const terminado = turnoActual >= TOTAL_ACCIONES;
  const esMiTurno = accionActual?.side === sideElegido;
  const hastaDonde = calcularHastaDonde(slots);
  const puedeVolver = turnoActual > 0;
  const puedeAvanzar = turnoActual < hastaDonde;

  const champsUsados = useMemo(
    () => new Set(slots.slice(0, turnoActual).filter((id): id is string => id !== null)),
    [slots, turnoActual],
  );

  const confirmar = (id: string) =>
    setDraft((d) => {
      // chequeo contra d y no contra lo de afuera por si llegan dos Enter seguidos
      if (d.turnoActual >= TOTAL_ACCIONES || d.slots.slice(0, d.turnoActual).includes(id)) return d;
      // si elijo lo mismo que habia deshecho es como avanzar, si elijo otro champ lo que venia despues ya no vale
      const nuevosSlots =
        d.slots[d.turnoActual] === id
          ? [...d.slots]
          : [...d.slots.slice(0, d.turnoActual), id, ...Array(TOTAL_ACCIONES - d.turnoActual - 1).fill(null)];
      return { slots: nuevosSlots, turnoActual: d.turnoActual + 1 };
    });

  const irA = (turno: number) =>
    setDraft((d) => ({ ...d, turnoActual: Math.max(0, Math.min(turno, calcularHastaDonde(d.slots))) }));
  const volver = () => setDraft((d) => ({ ...d, turnoActual: Math.max(0, d.turnoActual - 1) }));
  const avanzar = () =>
    setDraft((d) => ({ ...d, turnoActual: Math.min(d.turnoActual + 1, calcularHastaDonde(d.slots)) }));

  const reiniciar = () => {
    if (turnoActual > 0 && !window.confirm("¿Reiniciar el draft?")) return;
    setDraft(DRAFT_VACIO);
    // draft nuevo = partida nueva, y el side puede cambiar
    setSideElegido(null);
  };

  // Ctrl+Z vuelve y Ctrl+Y (o Ctrl+Shift+Z) avanza, incluso con el foco en el buscador.
  // El texto del input no importa tanto como el draft, asi que le gano al undo nativo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const tecla = e.key.toLowerCase();
      if (tecla === "z" && !e.shiftKey) {
        e.preventDefault();
        setDraft((d) => ({ ...d, turnoActual: Math.max(0, d.turnoActual - 1) }));
      } else if (tecla === "y" || (tecla === "z" && e.shiftKey)) {
        e.preventDefault();
        setDraft((d) => ({ ...d, turnoActual: Math.min(d.turnoActual + 1, calcularHastaDonde(d.slots)) }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setDraft]);

  if (!sideElegido) return <ElegirSide onElegir={setSideElegido} />;

  // aviso de cuanto scouting tiene la IA, asi sabes si te falto cargar algo en Scout
  const nScout = jugadores.nosotros.length + jugadores.rival.length;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col gap-7 px-10 py-6">
      <header className="flex items-center justify-between">
        <p className={`text-xs ${nScout ? "text-neutral-500" : "text-amber-400/80"}`}>
          {nScout
            ? `Scout: ${jugadores.nosotros.length} de mi equipo · ${jugadores.rival.length} rivales`
            : "Sin scouting: cargá los equipos en la pestaña Scout"}
        </p>

        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-white/10 p-0.5 text-xs">
            {(["blue", "red"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSideElegido(s)}
                className={`rounded-md px-3 py-1.5 capitalize transition ${
                  sideElegido === s ? `${COLOR_SIDE[s].texto} bg-white/[0.06]` : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex items-center rounded-lg border border-white/10 p-0.5">
            <BotonIcono onClick={volver} disabled={!puedeVolver} titulo="Volver (Ctrl+Z)">
              <path d="M15 18l-6-6 6-6" />
            </BotonIcono>
            <BotonIcono onClick={avanzar} disabled={!puedeAvanzar} titulo="Avanzar (Ctrl+Y)">
              <path d="M9 18l6-6-6-6" />
            </BotonIcono>
          </div>

          <button
            type="button"
            onClick={reiniciar}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-neutral-400 transition hover:border-rose-400/40 hover:text-rose-300"
          >
            Reiniciar
          </button>
        </div>
      </header>

      <LineaDeTiempo
        version={version}
        champsPorId={champsPorId}
        slots={slots}
        turnoActual={turnoActual}
        hastaDonde={hastaDonde}
        onIr={irA}
      />

      <main className="flex min-h-0 flex-1 gap-10">
        <ColumnaEquipo side="blue" esMio={sideElegido === "blue"} version={version} champsPorId={champsPorId} slots={slots} turnoActual={turnoActual} />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.25em] text-neutral-500">
                {accionActual ? `Fase ${accionActual.fase} · ${accionActual.tipo === "ban" ? "Ban" : "Pick"} ` : "Fin"}
                {accionActual && <span className={COLOR_SIDE[accionActual.side].texto}>{etiquetaAccion(accionActual)}</span>}
              </p>
              <p className={`mt-1 text-4xl font-extralight ${terminado ? "text-neutral-300" : esMiTurno ? "text-cyan-300" : "text-neutral-400"}`}>
                {terminado ? "Draft terminado" : esMiTurno ? "Tu turno" : "Turno rival"}
              </p>
            </div>
            <span className="text-sm text-neutral-600 tabular-nums">
              {Math.min(turnoActual, TOTAL_ACCIONES)}/{TOTAL_ACCIONES}
            </span>
          </div>

          <PanelIA
            slots={slots}
            turnoActual={turnoActual}
            sideElegido={sideElegido}
            version={version}
            terminado={terminado}
            jugadores={jugadores}
            onElegir={confirmar}
          />

          <Buscador champs={champs} version={version} bloqueados={champsUsados} deshabilitado={terminado} onConfirmar={confirmar} />
        </div>

        <ColumnaEquipo side="red" esMio={sideElegido === "red"} version={version} champsPorId={champsPorId} slots={slots} turnoActual={turnoActual} />
      </main>
    </div>
  );
}

function BotonIcono({ onClick, disabled, titulo, children }: { onClick: () => void; disabled: boolean; titulo: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={titulo}
      aria-label={titulo}
      className="rounded-md p-1.5 text-neutral-300 transition hover:bg-white/[0.06] hover:text-cyan-300 disabled:text-neutral-700 disabled:hover:bg-transparent"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}
