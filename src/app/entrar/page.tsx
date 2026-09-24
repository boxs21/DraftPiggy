import { LogoPiggy } from "@/components/Logo";

export default async function Entrar({ searchParams }: PageProps<"/entrar">) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-10 px-6">
      <div className="flex flex-col items-center gap-5">
        <LogoPiggy size={72} className="animate-flotar text-cyan-300 drop-shadow-[0_0_24px_rgba(34,211,238,0.5)]" />
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-2xl font-semibold uppercase tracking-[0.4em]">
            <span className="text-neutral-100">Draft</span> <span className="text-cyan-300">Piggy</span>
          </h1>
          <p className="text-sm text-neutral-500">Scouting y live draft con cabeza de pro play</p>
        </div>
      </div>

      <form action="/api/entrar" method="post" className="flex w-full max-w-xs flex-col gap-3">
        <input
          type="password"
          name="clave"
          autoFocus
          required
          placeholder="Contraseña"
          className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-neutral-100 outline-none backdrop-blur placeholder:text-neutral-600 focus:border-cyan-400/70 focus:shadow-[0_0_0_4px_rgba(34,211,238,0.08)]"
        />
        <button
          type="submit"
          className="rounded-xl bg-cyan-400/90 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-cyan-300 hover:shadow-[0_0_20px_rgba(34,211,238,0.35)]"
        >
          Entrar
        </button>
        {error && <p className="text-center text-xs text-rose-400">Contraseña incorrecta</p>}
      </form>
    </main>
  );
}
