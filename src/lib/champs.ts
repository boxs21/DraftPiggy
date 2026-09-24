export type Champ = {
  id: string; // el de Data Dragon, ej "MonkeyKing"
  nombre: string; // el que se ve, ej "Wukong"
  tags: string[];
};

export const urlIcono = (version: string, id: string) =>
  `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${id}.png`;

// desde 2025 Riot nombra los parches por año (26.17) pero Data Dragon sigue con la numeracion vieja (16.17),
// y Leaguepedia usa la nueva. Paso la version de Data Dragon al nombre que usa todo el mundo
export const parcheDesdeVersion = (version: string) => {
  const [mayor, menor] = version.split(".").map(Number);
  return `${mayor >= 15 ? mayor + 10 : mayor}.${menor}`;
};

// el splash centrado no depende de la version, es 1280x720 y queda bien recortado en las cartas de pick
export const urlSplash = (id: string) =>
  `https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${id}_0.jpg`;

// sin tildes, espacios ni apostrofes, asi "kaisa" encuentra a Kai'Sa y "drmundo" a Dr. Mundo
export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

// atajos que se dicen en la call y que no salen solos de las iniciales
const ALIAS: Record<string, string[]> = {
  JarvanIV: ["j4"],
  Gangplank: ["gp"],
  Warwick: ["ww"],
  Leblanc: ["lb"],
  AurelionSol: ["asol"],
  KSante: ["ks"],
};

type EntradaIndice = {
  champ: Champ;
  nombreNorm: string;
  idNorm: string;
  palabras: string[];
  atajos: string[];
};

export const crearIndice = (champs: Champ[]): EntradaIndice[] =>
  champs.map((champ) => {
    const palabras = champ.nombre.split(/[\s.]+/).map(normalizar).filter(Boolean);
    // iniciales solo si tiene varias palabras: Miss Fortune -> mf, Twisted Fate -> tf
    const iniciales = palabras.length > 1 ? [palabras.map((p) => p[0]).join("")] : [];
    return {
      champ,
      nombreNorm: normalizar(champ.nombre),
      idNorm: normalizar(champ.id),
      palabras,
      atajos: [...iniciales, ...(ALIAS[champ.id] ?? [])],
    };
  });

// mientras mas chico el rango mas arriba sale, -1 es que no matchea
const rango = (e: EntradaIndice, q: string) => {
  if (e.atajos.includes(q)) return 0;
  if (e.nombreNorm.startsWith(q) || e.idNorm.startsWith(q)) return 1;
  if (e.palabras.some((p) => p.startsWith(q))) return 2;
  if (e.nombreNorm.includes(q) || e.idNorm.includes(q)) return 3;
  return -1;
};

export const buscarChamps = (indice: EntradaIndice[], query: string) => {
  const q = normalizar(query);
  if (!q) return indice.map((e) => e.champ);

  return indice
    .map((e) => ({ champ: e.champ, r: rango(e, q) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.champ.nombre.localeCompare(b.champ.nombre, "es"))
    .map((x) => x.champ);
};
