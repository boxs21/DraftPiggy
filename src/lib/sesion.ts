import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// La app es de una sola persona: una contraseña (APP_PASSWORD) y una cookie firmada.
// La cookie no guarda la contraseña, guarda un HMAC de ella, asi si alguien la ve no sabe la clave
export const COOKIE_SESION = "draft_sesion";
export const DURACION_SESION_S = 60 * 60 * 24 * 30;

const firmar = (clave: string) => createHmac("sha256", clave).update("draftapp-sesion-v1").digest("hex");

const igualesSeguro = (a: string, b: string) => {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
};

// en local sin APP_PASSWORD dejo pasar para no molestar, en produccion sin contraseña no entra nadie
export const loginDesactivado = () => !process.env.APP_PASSWORD && process.env.NODE_ENV !== "production";

export const tokenSesion = () => (process.env.APP_PASSWORD ? firmar(process.env.APP_PASSWORD) : null);

export function sesionValida(valorCookie: string | undefined) {
  if (loginDesactivado()) return true;
  const esperado = tokenSesion();
  return !!esperado && !!valorCookie && igualesSeguro(valorCookie, esperado);
}

// para los route handlers que gastan plata: vuelven a chequear la sesion aunque el proxy ya lo haya hecho
export function requestConSesion(request: Request) {
  const cookie = request.headers.get("cookie")?.match(new RegExp(`${COOKIE_SESION}=([^;]+)`))?.[1];
  return sesionValida(cookie);
}

export function claveCorrecta(intento: string) {
  const clave = process.env.APP_PASSWORD;
  return !!clave && igualesSeguro(firmar(intento), firmar(clave));
}

// para el cron: el secreto tiene que existir, sino "Bearer undefined" entraria
export function cronAutorizado(header: string | null) {
  const secreto = process.env.CRON_SECRET;
  return !!secreto && !!header && igualesSeguro(header, `Bearer ${secreto}`);
}
