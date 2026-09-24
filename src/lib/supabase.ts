import "server-only";
import { createClient } from "@supabase/supabase-js";

// solo servidor: la secret key saltea RLS, nunca importar esto desde un componente cliente
export function supabaseServidor() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Faltan SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local");
  return createClient(url, key, { auth: { persistSession: false } });
}
