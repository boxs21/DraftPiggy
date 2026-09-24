"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Scout from "./Scout";
import Tablero from "./Tablero";
import { usePlanteles } from "./usePlanteles";
import { parcheDesdeVersion, type Champ } from "@/lib/champs";
import { DRAFT_VACIO, type EstadoDraft, type Side } from "@/lib/draft";

type Props = { champs: Champ[]; version: string };
type Pestaña = "scout" | "draft";

const PESTAÑAS: { id: Pestaña; titulo: string }[] = [
  { id: "scout", titulo: "Scout" },
  { id: "draft", titulo: "Live draft" },
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
      <nav className="mx-auto flex w-full max-w-[1400px] items-center gap-10 px-10 pt-6">
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-semibold uppercase tracking-[0.3em] text-neutral-200">Draft</span>
          <span className="text-[11px] text-neutral-600">Parche {parcheDesdeVersion(version)}</span>
        </div>
        <div className="flex gap-6">
          {PESTAÑAS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPestaña(p.id)}
              className={`border-b-2 pb-1 text-sm transition ${
                pestaña === p.id ? "border-cyan-400 text-neutral-100" : "border-transparent text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {p.titulo}
            </button>
          ))}
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
