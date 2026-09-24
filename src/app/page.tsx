import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { IconoAgente } from "@/components/ConversacionAgentes";
import { LogoPiggy, Marca } from "@/components/Logo";
import { parcheDesdeVersion } from "@/lib/champs";
import { getDataDragon } from "@/lib/ddragon";
import { ORDEN_DRAFT, etiquetaAccion } from "@/lib/draft";
import { getResumenPublico } from "@/lib/resumenPublico";

// la landing es publica y casi estatica: los numeros se refrescan una vez por hora
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Draft Piggy · Draft con datos de pro play",
  description: "Scouting de ranked en LAS, meta de LCK, LEC y LPL y dos agentes de IA que discuten tu próximo pick o ban.",
};

const BLOQUES_DRAFT = [
  { titulo: "Bans 1", desde: 0, hasta: 6 },
  { titulo: "Picks 1", desde: 6, hasta: 12 },
  { titulo: "Bans 2", desde: 12, hasta: 16 },
  { titulo: "Picks 2", desde: 16, hasta: 20 },
];

export default async function Landing() {
  const [{ version }, resumen] = await Promise.all([getDataDragon(), getResumenPublico()]);
  const miles = (n: number) => n.toLocaleString("es-CL");

  return (
    <div className="flex min-h-dvh flex-col">
      {/* barra */}
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-black/30 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-3.5">
          <Marca />
          <nav className="hidden gap-6 text-sm text-neutral-500 md:flex">
            <a href="#como-funciona" className="transition hover:text-neutral-200">Cómo funciona</a>
            <a href="#kuai" className="transition hover:text-neutral-200">KuAi</a>
            <a href="#datos" className="transition hover:text-neutral-200">Datos</a>
            <a href="#fuentes" className="transition hover:text-neutral-200">Fuentes</a>
          </nav>
          <Link
            href="/app"
            className="ml-auto rounded-xl bg-cyan-400/90 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-cyan-300 hover:shadow-[0_0_20px_rgba(34,211,238,0.35)]"
          >
            Entrar
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-32 px-6 pb-24">
        {/* hero */}
        <section className="flex flex-col items-center gap-8 pt-24 text-center">
          <LogoPiggy size={84} className="animate-flotar text-cyan-300 drop-shadow-[0_0_30px_rgba(34,211,238,0.5)]" />
          <h1 className="max-w-3xl text-5xl font-extralight leading-tight text-neutral-50 md:text-6xl">
            Draftea con datos de <span className="text-cyan-300">pro play</span> y el scouting de tu rival
          </h1>
          <p className="max-w-2xl text-lg text-neutral-400">
            Pega el op.gg del rival, sigue el draft turno a turno y deja que dos agentes discutan tu próximo pick o ban: uno mira a
            los jugadores, el otro el meta de LCK, LEC y LPL.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/app"
              className="rounded-xl bg-cyan-400/90 px-6 py-3 font-semibold text-neutral-950 transition hover:bg-cyan-300 hover:shadow-[0_0_28px_rgba(34,211,238,0.4)]"
            >
              Abrir Draft Piggy
            </Link>
            <a href="#como-funciona" className="rounded-xl border border-white/10 px-6 py-3 text-neutral-300 transition hover:border-white/25">
              Cómo funciona ↓
            </a>
          </div>

          {/* numeros en vivo de la base */}
          <div className="mt-4 flex flex-wrap justify-center gap-3 text-sm">
            <Dato valor={resumen ? miles(resumen.total) : "—"} texto="partidas pro cargadas" />
            <Dato valor={parcheDesdeVersion(version)} texto="parche live" />
            {resumen &&
              ["LCK", "LEC", "LPL"].map(
                (l) => resumen.porLiga[l] && <Dato key={l} valor={l} texto={`${miles(resumen.porLiga[l].partidas)} partidas · va en ${resumen.porLiga[l].parche}`} />,
              )}
          </div>
        </section>

        {/* orden de draft */}
        <section className="flex flex-col items-center gap-6">
          <Etiqueta>Orden de torneo · 20 acciones</Etiqueta>
          <div className="flex flex-wrap items-end justify-center gap-5">
            {BLOQUES_DRAFT.map((b) => (
              <div key={b.titulo} className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase tracking-[0.25em] text-neutral-600">{b.titulo}</span>
                <div className="flex gap-1">
                  {ORDEN_DRAFT.slice(b.desde, b.hasta).map((a, i) => (
                    <span
                      key={i}
                      className={`flex h-9 w-9 items-center justify-center rounded border-b-2 bg-white/[0.03] text-[10px] ${
                        a.side === "blue" ? "border-b-sky-500/80 text-sky-300/80" : "border-b-rose-500/80 text-rose-300/80"
                      } ${a.tipo === "pick" ? "font-semibold" : "opacity-70"}`}
                    >
                      {etiquetaAccion(a)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="max-w-xl text-center text-sm text-neutral-500">
            Desde 2026 el first pick va aparte del side: Draft Piggy cuenta los turnos desde el equipo que pickea primero, igual que
            en las partidas pro que usa de base.
          </p>
        </section>

        {/* como funciona */}
        <section id="como-funciona" className="flex scroll-mt-24 flex-col gap-10">
          <Titulo etiqueta="Cómo funciona" titulo="Tres pasos, el mismo flujo de un scrim" />
          <div className="grid gap-4 md:grid-cols-3">
            <Paso numero="1" titulo="Scout" icono={<IconoAgente agente="scout" size={18} />}>
              Pega el multisearch de op.gg o u.gg de tu equipo y del rival (o el texto del lobby). Se miran las últimas 20 ranked
              de cada uno en LAS: rol, champs, partidas y winrate. Si alguien juega otro rol en el equipo, lo cambias con un clic.
            </Paso>
            <Paso numero="2" titulo="Live draft" icono={<Rayo />}>
              Eliges tu side y vas cargando cada pick y ban mientras pasa: escribes, Enter, listo. Ctrl+Z para deshacer, Ctrl+Y para
              rehacer, y los champs usados quedan bloqueados.
            </Paso>
            <Paso numero="3" titulo="KuAi" icono={<LogoPiggy size={18} />}>
              En tu turno le preguntas a KuAi. Dos agentes analizan en paralelo, discuten y te devuelven un top 3 con la razón de
              cada uno. En el turno rival, predice lo que va a hacer.
            </Paso>
          </div>
        </section>

        {/* kuai */}
        <section id="kuai" className="grid scroll-mt-24 items-center gap-10 md:grid-cols-2">
          <div className="flex flex-col gap-5">
            <Titulo etiqueta="KuAi" titulo="Dos agentes que no ven lo mismo y llegan a un consenso" izquierda />
            <p className="text-neutral-400">
              <span className="font-semibold text-amber-300">Scout</span> solo conoce a los jugadores: qué juega cada uno en ranked y
              cuáles son los comfort picks del rival. <span className="font-semibold text-sky-300">Pro</span> solo conoce el meta
              profesional: presencia, winrate y qué rol se pickea en cada turno.
            </p>
            <p className="text-neutral-400">
              Los dos proponen en paralelo y <span className="font-semibold text-cyan-300">KuAi</span> decide eligiendo solo entre lo
              que propusieron. En tus bans y en el turno rival pesa más Scout, porque lo que importa es qué juegan esos jugadores de
              verdad. En tus picks pesa más Pro, porque lo que importa es qué funciona. Cuando los dos coinciden, lo ves marcado.
            </p>
          </div>
          <EjemploConversacion />
        </section>

        {/* datos */}
        <section id="datos" className="flex scroll-mt-24 flex-col gap-10">
          <Titulo etiqueta="Qué mira" titulo="Los números detrás de cada recomendación" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TarjetaDato titulo="Presencia">(picks + bans) sobre partidas jugadas, por liga. Lo que los pros no dejan pasar.</TarjetaDato>
            <TarjetaDato titulo="Ponderación">LCK 50 %, LEC 25 %, LPL 25 %. MSI y Worlds suman cuando caen en el parche.</TarjetaDato>
            <TarjetaDato titulo="Patrón por turno">Qué rol se pickea en B1, R1-R2, R5… Es la señal más fuerte de qué rol viene.</TarjetaDato>
            <TarjetaDato titulo="Blind vs counter">% de picks en B1/R1/R2 contra % en fase 2: qué es blind-safe y qué se guarda para counter.</TarjetaDato>
            <TarjetaDato titulo="Roles válidos">Un champ solo se recomienda en un rol donde tiene al menos 2 partidas pro. K&apos;Sante es top, punto.</TarjetaDato>
            <TarjetaDato titulo="Amenazas del rival">Comfort picks sumados entre sus jugadores, con bonus si es flex y si además está fuerte en pro.</TarjetaDato>
            <TarjetaDato titulo="Parche por liga">Cada liga con su último parche jugado. Si hay menos de 25 partidas, suma el anterior y avisa.</TarjetaDato>
            <TarjetaDato titulo="Winrate">Ponderado por liga y con la muestra a la vista: con menos de 3 picks no se muestra.</TarjetaDato>
          </div>
        </section>

        {/* fuentes */}
        <section id="fuentes" className="flex scroll-mt-24 flex-col gap-10">
          <Titulo etiqueta="Fuentes" titulo="De dónde sale cada dato" />
          <div className="grid gap-4 md:grid-cols-2">
            <Fuente nombre="Oracle's Elixir" tipo="CSV · meta pro" color="text-cyan-300">
              El CSV público de 2026 (~70 MB) con todas las partidas de LCK, LEC, LPL, MSI y Worlds: picks y bans en orden de
              draft, rol de cada pick, side, first pick, resultado y parche. Se sincroniza una vez al día, que es cuando se actualiza.
            </Fuente>
            <Fuente nombre="Riot API" tipo="account-v1 · match-v5 · LAS" color="text-rose-300">
              <code className="text-neutral-300">account-v1</code> transforma el Riot ID en PUUID y{" "}
              <code className="text-neutral-300">match-v5</code> trae las últimas 20 ranked (solo/duo y flex) de cada jugador en LAS.
              Del link de op.gg o u.gg solo se leen los Riot IDs: no se abre ni se scrapea ninguna página.
            </Fuente>
            <Fuente nombre="Data Dragon" tipo="CDN de Riot" color="text-sky-300">
              La lista de campeones, íconos y splash arts, y el parche live. Todo lo que dice KuAi se valida contra esta lista: si un
              champ no existe o ya se usó, no se puede elegir.
            </Fuente>
            <Fuente nombre="Mistral" tipo="Medium 3.5 · JSON estricto" color="text-amber-300">
              El modelo detrás de Scout, Pro y KuAi. Responde con un esquema JSON fijo y tiene prohibido usar números que no estén
              en los datos: el código calcula, la IA elige y explica.
            </Fuente>
          </div>
        </section>

        {/* reglas */}
        <section className="grid gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 md:grid-cols-3">
          <Regla titulo="El código calcula">Presencia, winrates, amenazas y roles salen de los datos. La IA no inventa stats ni habilidades.</Regla>
          <Regla titulo="Nada fuera del meta">Sin roles inventados ni picks de soloQ raros: es draft serio, cuenta lo que se juega en pro.</Regla>
          <Regla titulo="Lo ves todo">Cada recomendación muestra qué agente la propuso, de qué parche y liga salen los datos y cuánto costó.</Regla>
        </section>

        {/* cierre */}
        <section className="flex flex-col items-center gap-6 text-center">
          <LogoPiggy size={48} className="text-cyan-300/80" />
          <p className="text-3xl font-extralight text-neutral-100">¿Listo para el próximo scrim?</p>
          <Link
            href="/app"
            className="rounded-xl bg-cyan-400/90 px-6 py-3 font-semibold text-neutral-950 transition hover:bg-cyan-300 hover:shadow-[0_0_28px_rgba(34,211,238,0.4)]"
          >
            Abrir Draft Piggy
          </Link>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] px-6 py-8 text-center text-xs text-neutral-600">
        <p>Hecho para scrims en LAS · Datos pro de Oracle&apos;s Elixir (Tim Sevenhuysen) · Datos de jugadores de la Riot Games API</p>
        <p className="mt-2">
          Draft Piggy no está respaldado por Riot Games y no refleja las opiniones de Riot Games ni de nadie involucrado oficialmente
          en League of Legends. League of Legends y Riot Games son marcas registradas de Riot Games, Inc.
        </p>
        {resumen && <p className="mt-2">Última partida pro cargada: {new Date(resumen.ultima).toLocaleDateString("es-CL")}</p>}
      </footer>
    </div>
  );
}

function Etiqueta({ children }: { children: ReactNode }) {
  return <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-300/80">{children}</span>;
}

function Titulo({ etiqueta, titulo, izquierda = false }: { etiqueta: string; titulo: string; izquierda?: boolean }) {
  return (
    <div className={`flex flex-col gap-3 ${izquierda ? "" : "items-center text-center"}`}>
      <Etiqueta>{etiqueta}</Etiqueta>
      <h2 className="max-w-2xl text-3xl font-extralight text-neutral-50 md:text-4xl">{titulo}</h2>
    </div>
  );
}

function Dato({ valor, texto }: { valor: string; texto: string }) {
  return (
    <span className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5">
      <span className="font-semibold text-neutral-100 tabular-nums">{valor}</span>
      <span className="text-neutral-500">{texto}</span>
    </span>
  );
}

function Paso({ numero, titulo, icono, children }: { numero: string; titulo: string; icono: ReactNode; children: ReactNode }) {
  return (
    <div className="relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 transition hover:-translate-y-1 hover:border-cyan-400/30">
      <span className="absolute -top-4 -right-2 text-8xl font-extralight text-white/[0.03]">{numero}</span>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">{icono}</span>
      <h3 className="text-lg text-neutral-100">{titulo}</h3>
      <p className="text-sm leading-relaxed text-neutral-400">{children}</p>
    </div>
  );
}

function TarjetaDato({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <h3 className="text-sm font-semibold text-cyan-200">{titulo}</h3>
      <p className="text-sm leading-relaxed text-neutral-400">{children}</p>
    </div>
  );
}

function Fuente({ nombre, tipo, color, children }: { nombre: string; tipo: string; color: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className={`text-lg font-semibold ${color}`}>{nombre}</h3>
        <span className="rounded-full bg-white/[0.05] px-3 py-0.5 text-[11px] text-neutral-400">{tipo}</span>
      </div>
      <p className="text-sm leading-relaxed text-neutral-400">{children}</p>
    </div>
  );
}

function Regla({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
        {titulo}
      </h3>
      <p className="text-sm text-neutral-400">{children}</p>
    </div>
  );
}

function Rayo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  );
}

// ejemplo real (primer ban contra dos challengers de LAS), en el mismo formato que se ve en la app
function EjemploConversacion() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-black/30 p-5 shadow-[0_20px_60px_-20px_rgba(34,211,238,0.25)]">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.25em] text-neutral-500">
        <span>Fase 1 · Ban B1</span>
        <span className="text-cyan-300">Tu turno</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Burbuja agente="scout" titulo="Scout" color="border-amber-400/25 text-amber-300">
          Sylas: lo juegan su jungla (6 partidas, 67 %) y su mid (2, 100 %). Flex y comfort.
        </Burbuja>
        <Burbuja agente="pro" titulo="Pro" color="border-sky-400/25 text-sky-300">
          Cassiopeia: 94 % de presencia en pro, 90 % baneada. Lo más prioritario del meta.
        </Burbuja>
      </div>
      <div className="flex flex-col gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.04] p-3">
        <span className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
          <LogoPiggy size={14} /> KuAi · consenso
        </span>
        <ol className="flex flex-col gap-1.5 text-sm">
          <li className="flex items-center gap-2 text-neutral-100">
            <span className="w-3 text-[10px] text-neutral-600">1</span> Sylas
            <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] text-amber-300">Scout</span>
            <span className="text-xs text-neutral-500">en bans pesa lo que juega el rival</span>
          </li>
          <li className="flex items-center gap-2 text-neutral-100">
            <span className="w-3 text-[10px] text-neutral-600">2</span> Cassiopeia
            <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] text-sky-300">Pro</span>
          </li>
          <li className="flex items-center gap-2 text-neutral-100">
            <span className="w-3 text-[10px] text-neutral-600">3</span> Nocturne
            <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] text-sky-300">Pro</span>
          </li>
        </ol>
      </div>
    </div>
  );
}

function Burbuja({ agente, titulo, color, children }: { agente: "scout" | "pro"; titulo: string; color: string; children: ReactNode }) {
  return (
    <div className={`flex flex-col gap-1.5 rounded-xl border bg-black/20 p-3 ${color}`}>
      <span className="flex items-center gap-1.5 text-[11px] font-semibold">
        <IconoAgente agente={agente} /> {titulo}
      </span>
      <p className="text-xs leading-snug text-neutral-400">{children}</p>
    </div>
  );
}
