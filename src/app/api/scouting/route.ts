import { PARTIDAS_MAX, PARTIDAS_RAPIDAS, esRiotIdValido } from "@/lib/riotIds";
import { scoutearJugador } from "@/lib/scouting";
import { requestConSesion } from "@/lib/sesion";

// si Riot nos frena por rate limit la llamada espera, asi que le doy margen
export const maxDuration = 300;

// scoutea UN jugador por llamada; el cliente va de a uno para mostrar el avance.
// partidas: 20 para la carga rapida, 50 para profundizar (solo baja las que faltan)
export async function POST(request: Request) {
  if (!requestConSesion(request)) return Response.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const riotId = typeof body?.riotId === "string" ? body.riotId.trim() : "";
  if (!esRiotIdValido(riotId)) return Response.json({ error: "Riot ID inválido" }, { status: 400 });
  const partidas = body?.partidas === PARTIDAS_MAX ? PARTIDAS_MAX : PARTIDAS_RAPIDAS;

  try {
    const resumen = await scoutearJugador(riotId, partidas);
    if (!resumen) return Response.json({ error: "No existe en LAS" }, { status: 404 });
    return Response.json(resumen);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error desconocido" }, { status: 502 });
  }
}
