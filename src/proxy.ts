import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, sesionValida } from "@/lib/sesion";

// Todo pide sesion salvo la landing (/), la pantalla de login y el cron (que tiene su propio secreto).
// Es un chequeo optimista: los endpoints que gastan plata lo vuelven a chequear por su cuenta
export function proxy(request: NextRequest) {
  if (sesionValida(request.cookies.get(COOKIE_SESION)?.value)) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/entrar", request.url));
}

export const config = {
  // el "$" deja afuera la raiz exacta (la landing es publica); el icono va sin login para que se vea en todos lados
  matcher: ["/((?!$|entrar|api/entrar|api/cron|_next/static|_next/image|icon.svg).*)"],
};
