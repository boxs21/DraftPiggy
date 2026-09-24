import { COOKIE_SESION } from "@/lib/sesion";

// cerrar sesion: piso la cookie con una vencida y mando al login
export async function POST(request: Request) {
  const headers = new Headers({ Location: new URL("/entrar", request.url).toString() });
  headers.append("Set-Cookie", `${COOKIE_SESION}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return new Response(null, { status: 303, headers });
}
