import { getDataDragon, getMapaNombresEn } from "@/lib/ddragon";
import { URL_CSV, convertirCsv } from "@/lib/oracleElixir";
import { cronAutorizado } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase";

// bajar ~70MB y subir miles de filas tarda, le doy margen
export const maxDuration = 300;

const FILAS_POR_UPSERT = 1000;
const DIAS_SOLAPE = 3; // Oracle's Elixir a veces completa partidas de dias anteriores

// Baja el CSV del año de Oracle's Elixir y guarda LCK/LEC/LPL/MSI/Worlds. Lo llama el cron de Vercel una vez por dia
// y `npm run sync-meta` a mano. Por defecto solo sube lo nuevo; ?todo=1 re-sube el año entero
export async function GET(request: Request) {
  if (!cronAutorizado(request.headers.get("authorization"))) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const db = supabaseServidor();
  const { data: registro } = await db.from("sync_meta").insert({}).select("id").single();
  const cerrar = (campos: Record<string, unknown>) =>
    db.from("sync_meta").update({ termino: new Date().toISOString(), ...campos }).eq("id", registro?.id);

  try {
    const todo = new URL(request.url).searchParams.get("todo") === "1";
    const desde = todo ? undefined : await calcularDesde(db);

    const res = await fetch(URL_CSV, { cache: "no-store" });
    if (!res.ok) throw new Error(`Oracle's Elixir respondio ${res.status}`);
    const texto = await res.text();

    const { version } = await getDataDragon();
    const { partidas, acciones, sinMapear } = convertirCsv(texto, await getMapaNombresEn(version), desde);

    // primero las partidas (las acciones tienen foreign key), en tandas para no mandar un request gigante
    for (let i = 0; i < partidas.length; i += FILAS_POR_UPSERT) {
      const { error } = await db.from("partidas_pro").upsert(partidas.slice(i, i + FILAS_POR_UPSERT));
      if (error) throw new Error(error.message);
    }
    for (let i = 0; i < acciones.length; i += FILAS_POR_UPSERT) {
      const { error } = await db.from("acciones_pro").upsert(acciones.slice(i, i + FILAS_POR_UPSERT));
      if (error) throw new Error(error.message);
    }

    await cerrar({ partidas_nuevas: partidas.length, error: sinMapear.length ? `Sin mapear: ${sinMapear.join(", ")}` : null });
    return Response.json({ desde: desde ?? "todo el año", partidas: partidas.length, sinMapear });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    await cerrar({ error: msg });
    return Response.json({ error: msg }, { status: 502 });
  }
}

// desde la ultima partida guardada menos unos dias; si la base esta vacia, todo el año
async function calcularDesde(db: ReturnType<typeof supabaseServidor>) {
  const { data } = await db.from("partidas_pro").select("fecha").order("fecha", { ascending: false }).limit(1);
  if (!data?.[0]?.fecha) return undefined;
  const base = new Date(data[0].fecha);
  base.setUTCDate(base.getUTCDate() - DIAS_SOLAPE);
  // mismo formato que la columna date del CSV para poder comparar como texto
  return base.toISOString().slice(0, 10);
}
