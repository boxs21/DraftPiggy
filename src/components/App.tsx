"use client";

import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { Marca } from "./Logo";
import Scout from "./Scout";
import Tablero from "./Tablero";
import { usePlanteles } from "./usePlanteles";
import { parcheDesdeVersion, type Champ } from "@/lib/champs";
import { DRAFT_VACIO, type EstadoDraft, type Side } from "@/lib/draft";

type Props = { champs: Champ[]; version: string };
type Pestaña = "scout" | "draft";

// iconos de linea chiquitos para las pestañas: lupa para scout, rayo para el live
const PESTAÑAS: { id: Pestaña; titulo: string; icono: ReactNode }[] = [
  { id: "scout", titulo: "Scout", icono: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></> },
  { id: "draft", titulo: "Live draft", icono: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /> },
];

const sinSuscripcion = () => () => {};

export default function App({ champs, version }: Props) {
  // el scouting sale de localStorage, asi que no renderizo nada en el server para no tener lio de hidratacion
  const montado = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const [pestaña, setPestaña] = useState<Pestaña>("scout");
  const plantel = usePlanteles();
  // el draft vive aca y no en el Tablero, asi no se pierde al ir y volver de Scout
  const [sideElegido, setSideElegido] = useState<Side | null>(null);
  const [draft, setDraft] = useState<EstadoDraft>(DRAFT_VACIO);
  const champsPorId = useMemo(() => new Map(champs.map((c) => [c.id, c])), [champs]);

  if (!montado) return null;

  return (
    <div className="flex h-dvh flex-col">
      <nav className="border-b border-white/[0.06] bg-black/20 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] items-center gap-8 px-10 py-3.5">
          <Link href="/" title="Volver al inicio">
            <Marca />
          </Link>

          <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
            {PESTAÑAS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPestaña(p.id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm transition ${
                  pestaña === p.id
                    ? "bg-cyan-400/10 text-cyan-200 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.35)]"
                    : "text-neutral-500 hover:text-neutral-200"
                }`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {p.icono}
                </svg>
                {p.titulo}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-4">
            <span className="flex items-center gap-2 rounded-full border border-white/[0.08] px-3 py-1 text-[11px] text-neutral-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              Parche {parcheDesdeVersion(version)}
            </span>
            <form action="/api/salir" method="post">
              <button type="submit" title="Cerrar sesión" className="text-xs text-neutral-600 transition hover:text-neutral-300">
                Salir
              </button>
            </form>
          </div>
        </div>
      </nav>

      {pestaña === "scout" ? (
        <Scout champsPorId={champsPorId} version={version} plantel={plantel} onIrAlDraft={() => setPestaña("draft")} />
      ) : (
        <Tablero
          champs={champs}
          champsPorId={champsPorId}
          version={version}
          sideElegido={sideElegido}
          setSideElegido={setSideElegido}
          draft={draft}
          setDraft={setDraft}
          jugadores={{ nosotros: plantel.listos("nosotros"), rival: plantel.listos("rival") }}
        />
      )}
    </div>
  );
}
