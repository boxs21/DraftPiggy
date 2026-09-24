// Saca Riot IDs (Nombre#TAG) de lo que pegue el usuario, sin abrir ninguna pagina:
// - multisearch de op.gg o u.gg (?summoners=Nombre-TAG,Otro-TAG o con %23)
// - perfil de op.gg (/summoners/las/Nombre-TAG) o u.gg (/profile/la2/nombre-tag)
// - texto del lobby ("Nombre #TAG se unió a la sala") o una lista "Nombre#TAG, Otro#TAG"

export const MAX_JUGADORES = 7; // 5 titulares y algun suplente

const RIOT_ID = /^[^#,]{3,16}#[A-Za-z0-9]{2,5}$/;

// "Nombre-TAG" -> "Nombre#TAG": el tag nunca tiene guiones, asi que corto en el ultimo
const desdeGuion = (s: string) => {
  const i = s.lastIndexOf("-");
  return i > 0 ? `${s.slice(0, i)}#${s.slice(i + 1)}` : s;
};

const limpiar = (s: string) => s.replace(/\s*#\s*/, "#").trim();

export function extraerRiotIds(texto: string): string[] {
  const encontrados: string[] = [];

  // links: los separo ANTES de decodificar, sino un %20 se vuelve espacio y corta el link a la mitad
  const links = texto.match(/https?:\/\/\S+/g) ?? [];
  for (const link of links) {
    let url: URL;
    try {
      url = new URL(link);
    } catch {
      continue;
    }
    // searchParams ya decodifica %23 (#), %2C (,) y %20 o + (espacio)
    const summoners = url.searchParams.get("summoners");
    if (summoners) {
      encontrados.push(...summoners.split(",").map((s) => (s.includes("#") ? s : desdeGuion(s.trim()))));
      continue;
    }
    let ruta = url.pathname;
    try {
      ruta = decodeURIComponent(ruta);
    } catch {}
    const perfil = ruta.match(/\/(?:summoners|profile)\/[a-z0-9]+\/([^/]+)/i)?.[1];
    if (perfil) encontrados.push(desdeGuion(perfil));
  }

  // texto suelto: cualquier "algo#TAG", separado por comas o lineas
  const sinLinks = links.reduce((t, l) => t.replace(l, ""), texto);
  for (const m of sinLinks.matchAll(/([^\n,#]{3,16}?)\s*#\s*([A-Za-z0-9]{2,5})\b/g)) {
    encontrados.push(`${m[1]}#${m[2]}`);
  }

  // valido formato y saco repetidos (el mismo jugador puede venir en el link y en el texto)
  const vistos = new Set<string>();
  return encontrados
    .map(limpiar)
    .filter((id) => RIOT_ID.test(id))
    .filter((id) => {
      const clave = normalizarRiotId(id);
      if (vistos.has(clave)) return false;
      vistos.add(clave);
      return true;
    })
    .slice(0, MAX_JUGADORES);
}

// Riot no distingue mayusculas ni espacios en el nombre, asi que comparo asi
export const normalizarRiotId = (id: string) => id.toLowerCase().replace(/\s+/g, "");

export const esRiotIdValido = (id: string) => RIOT_ID.test(id);
