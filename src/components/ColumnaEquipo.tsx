import Image from "next/image";
import IconoChamp from "./IconoChamp";
import { urlSplash, type Champ } from "@/lib/champs";
import { ORDEN_DRAFT, etiquetaAccion, indicesDe, type Side } from "@/lib/draft";

type Props = {
  side: Side;
  esMio: boolean;
  version: string;
  champsPorId: Map<string, Champ>;
  slots: (string | null)[];
  turnoActual: number;
};

export const COLOR_SIDE = {
  blue: { texto: "text-sky-400", borde: "border-sky-500/25", fondo: "bg-sky-500" },
  red: { texto: "text-rose-400", borde: "border-rose-500/25", fondo: "bg-rose-500" },
};

export default function ColumnaEquipo({ side, esMio, version, champsPorId, slots, turnoActual }: Props) {
  // lo que todavia no se jugo (o se deshizo) no se muestra aunque siga en el array
  const champEn = (i: number) => (i < turnoActual && slots[i] ? champsPorId.get(slots[i]) : undefined);
  const esRed = side === "red";

  return (
    <section className="flex w-72 shrink-0 flex-col gap-5">
      <header className={`flex items-center gap-3 ${esRed ? "flex-row-reverse" : ""}`}>
        <span className={`h-2 w-2 rounded-full ${COLOR_SIDE[side].fondo}`} />
        <h2 className={`text-xs font-semibold uppercase tracking-[0.25em] ${COLOR_SIDE[side].texto}`}>
          {esRed ? "Red side" : "Blue side"}
        </h2>
        {esMio && (
          <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-cyan-300">
            vos
          </span>
        )}
      </header>

      <ol className="flex flex-col gap-2">
        {indicesDe(side, "pick").map((i) => (
          <CartaPick key={i} champ={champEn(i)} activo={i === turnoActual} etiqueta={etiquetaAccion(ORDEN_DRAFT[i])} side={side} />
        ))}
      </ol>

      <div className={`flex flex-col gap-2 ${esRed ? "items-end" : ""}`}>
        <span className="text-[10px] uppercase tracking-[0.25em] text-neutral-600">Bans</span>
        {/* 3 bans de fase 1, un espacio y los 2 de fase 2, como en el cliente */}
        <div className={`flex gap-1.5 ${esRed ? "flex-row-reverse" : ""}`}>
          {indicesDe(side, "ban").map((i, n) => (
            <div key={i} className={n === 3 ? (esRed ? "mr-3" : "ml-3") : ""}>
              <SlotBan champ={champEn(i)} version={version} activo={i === turnoActual} etiqueta={etiquetaAccion(ORDEN_DRAFT[i])} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CartaPick({ champ, activo, etiqueta, side }: { champ?: Champ; activo: boolean; etiqueta: string; side: Side }) {
  const esRed = side === "red";
  return (
    <li
      className={`relative h-[76px] overflow-hidden rounded-lg border transition-colors ${
        activo
          ? "border-cyan-400/80 shadow-[0_0_18px_rgba(34,211,238,0.2)]"
          : champ
            ? COLOR_SIDE[side].borde
            : "border-dashed border-white/10"
      }`}
    >
      {champ && (
        <>
          <Image src={urlSplash(champ.id)} alt={champ.nombre} fill sizes="288px" unoptimized className="object-cover object-[center_25%]" />
          {/* degradado para que el nombre se lea sobre cualquier splash */}
          <div className={`absolute inset-0 from-black/90 via-black/55 to-transparent ${esRed ? "bg-linear-to-l" : "bg-linear-to-r"}`} />
        </>
      )}
      {activo && <div className="absolute inset-0 animate-pulse bg-cyan-400/[0.04]" />}
      <div className={`relative flex h-full flex-col justify-center px-4 ${esRed ? "items-end text-right" : ""}`}>
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-500">{etiqueta}</span>
        <span className={`text-base font-medium ${champ ? "text-neutral-50" : "text-cyan-300/80"}`}>
          {champ?.nombre ?? (activo ? "Eligiendo…" : "")}
        </span>
      </div>
    </li>
  );
}

function SlotBan({ champ, version, activo, etiqueta }: { champ?: Champ; version: string; activo: boolean; etiqueta: string }) {
  return (
    <div
      title={champ ? `${etiqueta} · ${champ.nombre}` : etiqueta}
      className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-md border text-[9px] text-neutral-600 ${
        activo ? "border-cyan-400/80 shadow-[0_0_10px_rgba(34,211,238,0.3)]" : "border-white/10 bg-white/[0.02]"
      }`}
    >
      {champ ? (
        <>
          <IconoChamp version={version} id={champ.id} nombre={champ.nombre} size={36} className="opacity-50 grayscale" />
          {/* la raya diagonal es lo que hace que se lea como ban de un vistazo */}
          <span className="absolute h-px w-12 rotate-45 bg-rose-500/80" />
        </>
      ) : (
        etiqueta
      )}
    </div>
  );
}
