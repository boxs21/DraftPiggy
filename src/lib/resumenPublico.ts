import "server-only";
import { supabaseServidor } from "./supabase";

// numeros para la landing: cuantas partidas pro hay cargadas, de que ligas y en que parche va cada una.
// Solo agregados, nada de jugadores ni drafts
export async function getResumenPublico() {
  try {
    const { data, error } = await supabaseServidor().rpc("partidas_por_parche");
    if (error || !data?.length) return null;

    const filas = data as { parche: string; liga: string; n: number; ultima: string }[];
    const porLiga: Record<string, { partidas: number; parche: string }> = {};
    const numero = (p: string) => p.split(".").map(Number).reduce((a, b) => a * 100 + b, 0);
    for (const f of filas) {
      const l = (porLiga[f.liga] ??= { partidas: 0, parche: f.parche });
      l.partidas += f.n;
      if (numero(f.parche) > numero(l.parche)) l.parche = f.parche;
    }
    return {
      total: filas.reduce((s, f) => s + f.n, 0),
      porLiga,
      ultima: filas.reduce((m, f) => (f.ultima > m ? f.ultima : m), filas[0].ultima),
    };
  } catch {
    return null;
  }
}
