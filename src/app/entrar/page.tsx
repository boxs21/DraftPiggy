export default async function Entrar({ searchParams }: PageProps<"/entrar">) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6">
      <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-neutral-200">Draft</h1>
      <form action="/api/entrar" method="post" className="flex w-full max-w-xs flex-col gap-3">
        <input
          type="password"
          name="clave"
          autoFocus
          required
          placeholder="Contraseña"
          className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-cyan-400/70"
        />
        <button
          type="submit"
          className="rounded-lg border border-cyan-400/50 py-2.5 text-sm text-cyan-300 transition hover:bg-cyan-400/10"
        >
          Entrar
        </button>
        {error && <p className="text-center text-xs text-rose-400">Contraseña incorrecta</p>}
      </form>
    </main>
  );
}
