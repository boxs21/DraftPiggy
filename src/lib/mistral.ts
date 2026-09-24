import "server-only";
// solo servidor: usa la key de .env.local, nunca importar esto desde un componente cliente

const URL_MISTRAL = "https://api.mistral.ai/v1/chat/completions";

// USD por millon de tokens [entrada, salida], sacado de mistral.ai/pricing/api en 09/2026
export const PRECIOS_MISTRAL: Record<string, [number, number]> = {
  "mistral-medium-2604": [1.5, 7.5],
  "mistral-small-2603": [0.15, 0.6],
  "mistral-large-2512": [0.5, 1.5],
};

export const MODELO_DEFAULT = process.env.MISTRAL_MODEL ?? "mistral-medium-2604";

type Mensaje = { role: "system" | "user" | "assistant"; content: string };

type Opciones = {
  modelo: string;
  mensajes: Mensaje[];
  schema: Record<string, unknown>;
  nombreSchema: string;
};

export async function llamarMistral<T>({ modelo, mensajes, schema, nombreSchema }: Opciones) {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) throw new Error("Falta MISTRAL_API_KEY en .env.local");

  const inicio = Date.now();
  const res = await fetch(URL_MISTRAL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelo,
      messages: mensajes,
      // con strict el json siempre respeta el schema, asi no hay que andar parseando texto libre
      response_format: { type: "json_schema", json_schema: { name: nombreSchema, strict: true, schema } },
      temperature: 0.3,
      max_tokens: 1200,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const detalle = await res.text();
    throw new Error(`Mistral respondio ${res.status}: ${detalle.slice(0, 300)}`);
  }

  const data = await res.json();
  const ms = Date.now() - inicio;
  const tokensEntrada: number = data.usage?.prompt_tokens ?? 0;
  const tokensSalida: number = data.usage?.completion_tokens ?? 0;
  const [precioIn, precioOut] = PRECIOS_MISTRAL[modelo] ?? [0, 0];
  const costoUsd = (tokensEntrada * precioIn + tokensSalida * precioOut) / 1_000_000;

  return {
    resultado: JSON.parse(data.choices[0].message.content) as T,
    uso: { modelo, ms, tokensEntrada, tokensSalida, costoUsd },
  };
}
