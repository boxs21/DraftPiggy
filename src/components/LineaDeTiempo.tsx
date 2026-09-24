import IconoChamp from "./IconoChamp";
import type { Champ } from "@/lib/champs";
import { ORDEN_DRAFT, etiquetaAccion } from "@/lib/draft";

type Props = {
  version: string;
  champsPorId: Map<string, Champ>;
  slots: (string | null)[];
  turnoActual: number;
  hastaDonde: number; // hasta que turno se puede saltar (lo jugado + lo que se puede rehacer)
  onIr: (turno: number) => void;
};

// los 4 bloques del orden de torneo, asi se ve de un vistazo en que parte del draft estamos
const BLOQUES = [
  { titulo: "Bans 1", desde: 0, hasta: 6 },
  { titulo: "Picks 1", desde: 6, hasta: 12 },
  { titulo: "Bans 2", desde: 12, hasta: 16 },
  { titulo: "Picks 2", desde: 16, hasta: 20 },
];

export default function LineaDeTiempo({ version, champsPorId, slots, turnoActual, hastaDonde, onIr }: Props) {
  return (
    <nav className="flex items-end justify-center gap-6">
      {BLOQUES.map((b) => (
        <div key={b.titulo} className="flex flex-col gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.25em] text-neutral-600">{b.titulo}</span>
          <div className="flex gap-1">
            {ORDEN_DRAFT.slice(b.desde, b.hasta).map((accion, n) => {
              const i = b.desde + n;
              const hecho = i < turnoActual;
              // lo deshecho se sigue viendo apagado, asi sabes que Avanzar lo recupera
              const champ = i < hastaDonde && slots[i] ? champsPorId.get(slots[i]) : undefined;
              const activo = i === turnoActual;
              const alcanzable = i <= hastaDonde && i !== turnoActual;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!alcanzable}
                  onClick={() => onIr(i)}
                  title={`${accion.tipo === "ban" ? "Ban" : "Pick"} ${etiquetaAccion(accion)}${champ ? ` · ${champ.nombre}` : ""}`}
                  className={`relative flex h-8 w-8 items-center justify-center overflow-hidden rounded border-b-2 text-[9px] transition ${
                    accion.side === "blue" ? "border-b-sky-500/70" : "border-b-rose-500/70"
                  } ${activo ? "bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-400" : "bg-white/[0.03] text-neutral-600"} ${
                    alcanzable ? "cursor-pointer hover:ring-1 hover:ring-white/30" : ""
                  } ${champ && !hecho ? "opacity-35" : ""}`}
                >
                  {champ ? (
                    <IconoChamp
                      version={version}
                      id={champ.id}
                      nombre={champ.nombre}
                      size={32}
                      className={accion.tipo === "ban" ? "opacity-50 grayscale" : ""}
                    />
                  ) : (
                    etiquetaAccion(accion)
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
