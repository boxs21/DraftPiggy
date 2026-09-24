import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, sesionValida } from "@/lib/sesion";

// Todo pide sesion salvo la pantalla de login y el cron (que tiene su propio secreto).
// Es un chequeo optimista: /api/recomendar lo vuelve a chequear por su cuenta
export function proxy(request: NextRequest) {
  if (sesionValida(request.cookies.get(COOKIE_SESION)?.value)) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/entrar", request.url));
}

export const config = {
  // el icono va sin login, sino la pantalla de entrar se queda sin favicon
  matcher: ["/((?!entrar|api/entrar|api/cron|_next/static|_next/image|icon.svg).*)"],
};
