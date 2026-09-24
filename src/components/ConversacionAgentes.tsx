import type { ReactNode } from "react";
import IconoChamp from "./IconoChamp";
import type { AgenteVista, NombreAgente, Origen } from "@/lib/kuai/tipos";

export type EstadoAgente = { estado: "analizando" } | { estado: "listo"; vista: AgenteVista } | { estado: "omitido"; motivo: string };

// cada agente con su color y su icono, asi en la conversacion se ve de un vistazo quien dijo que
export const AGENTES: Record<NombreAgente, { titulo: string; subtitulo: string; texto: string; borde: string; icono: ReactNode }> = {
  scout: {
    titulo: "Scout",
    subtitulo: "jugadores",
    texto: "text-amber-300",
    borde: "border-amber-400/25",
    icono: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  },
  pro: {
    titulo: "Pro",
    subtitulo: "meta pro",
    texto: "text-sky-300",
    borde: "border-sky-400/25",
    icono: (
      <>
        <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
        <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
      </>
    ),
  },
};

export function IconoAgente({ agente, size = 13 }: { agente: NombreAgente; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {AGENTES[agente].icono}
    </svg>
  );
}

// etiqueta de donde salio cada opcion del consenso
export function EtiquetaOrigen({ origen }: { origen?: Origen }) {
  if (!origen) return null;
  if (origen === "ambos") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-200">
        <IconoAgente agente="scout" size={10} />
        <IconoAgente agente="pro" size={10} />
        coinciden
      </span>
    );
  }
  if (origen === "kuai") return <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-neutral-400">KuAi</span>;
  return (
    <span className={`flex items-center gap-1 rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] ${AGENTES[origen].texto}`}>
      <IconoAgente agente={origen} size={10} />
      {AGENTES[origen].titulo}
    </span>
  );
}

export default function ConversacionAgentes({ agentes, version }: { agentes: Record<NombreAgente, EstadoAgente>; version: string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(["scout", "pro"] as const).map((nombre) => (
        <TarjetaAgente key={nombre} nombre={nombre} estado={agentes[nombre]} version={version} />
      ))}
    </div>
  );
}

function TarjetaAgente({ nombre, estado, version }: { nombre: NombreAgente; estado: EstadoAgente; version: string }) {
  const a = AGENTES[nombre];
  return (
    <div className={`flex min-w-0 animate-aparecer flex-col gap-1.5 rounded-xl border bg-black/20 p-2.5 ${a.borde}`}>
      <div className={`flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold ${a.texto}`} title={`Agente ${a.titulo}: ${a.subtitulo}`}>
        <IconoAgente agente={nombre} />
        {a.titulo}
        <span className="ml-auto font-normal text-neutral-600 tabular-nums">
          {estado.estado === "listo" ? `${(estado.vista.ms / 1000).toFixed(1)}s` : estado.estado === "analizando" ? "" : "—"}
        </span>
      </div>

      {estado.estado === "analizando" && <p className="animate-pulse text-[11px] text-neutral-500">Analizando…</p>}
      {estado.estado === "omitido" && <p className="text-[11px] text-neutral-600">{estado.motivo}</p>}
      {estado.estado === "listo" && (
        <>
          <p className="line-clamp-3 text-[11px] leading-snug text-neutral-400" title={estado.vista.lectura}>
            {estado.vista.lectura}
          </p>
          <div className="flex gap-1.5">
            {estado.vista.opciones.slice(0, 3).map((o, i) =>
              o.id ? (
                <span key={i} title={`${o.nombre} (${o.rol}): ${o.razon}`} className="flex flex-col items-center gap-0.5">
                  <IconoChamp version={version} id={o.id} nombre={o.nombre} size={28} className={`rounded-md ${o.problema ? "opacity-30 grayscale" : ""}`} />
                  <span className="text-[9px] text-neutral-500">{o.rol}</span>
                </span>
              ) : null,
            )}
          </div>
        </>
      )}
    </div>
  );
}
