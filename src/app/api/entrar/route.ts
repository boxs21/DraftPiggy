import { COOKIE_SESION, DURACION_SESION_S, claveCorrecta, tokenSesion } from "@/lib/sesion";

export async function POST(request: Request) {
  const form = await request.formData();
  const intento = String(form.get("clave") ?? "");

  if (!claveCorrecta(intento)) {
    // un poco de demora para que probar claves a lo bruto sea lento
    await new Promise((r) => setTimeout(r, 800));
    return Response.redirect(new URL("/entrar?error=1", request.url), 303);
  }

  const headers = new Headers({ Location: new URL("/app", request.url).toString() });
  headers.append(
    "Set-Cookie",
    `${COOKIE_SESION}=${tokenSesion()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DURACION_SESION_S}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
  return new Response(null, { status: 303, headers });
}
