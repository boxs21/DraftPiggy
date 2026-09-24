// chanchito de linea, usa currentColor asi toma el color del texto donde lo pongas
export function LogoPiggy({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      {/* orejas */}
      <path d="M8.2 9.6 6.6 3.4l6.1 3.5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M23.8 9.6 25.4 3.4l-6.1 3.5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {/* cabeza */}
      <circle cx="16" cy="17" r="11" stroke="currentColor" strokeWidth="2" />
      {/* ojos */}
      <circle cx="11.6" cy="14.4" r="1.4" fill="currentColor" />
      <circle cx="20.4" cy="14.4" r="1.4" fill="currentColor" />
      {/* hocico */}
      <ellipse cx="16" cy="20.6" rx="5" ry="3.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="14.3" cy="20.6" r="0.95" fill="currentColor" />
      <circle cx="17.7" cy="20.6" r="0.95" fill="currentColor" />
    </svg>
  );
}

// logo + nombre. "grande" es para el login y la pantalla de side
export function Marca({ grande = false }: { grande?: boolean }) {
  return (
    <div className={`flex items-center ${grande ? "gap-3" : "gap-2.5"}`}>
      <LogoPiggy size={grande ? 40 : 26} className="text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.45)]" />
      <span className={`font-semibold uppercase ${grande ? "text-xl tracking-[0.35em]" : "text-sm tracking-[0.3em]"}`}>
        <span className="text-neutral-100">Draft</span> <span className="text-cyan-300">Piggy</span>
      </span>
    </div>
  );
}
