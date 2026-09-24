import "server-only";
import { normalizar, type crearIndice } from "../champs";
import type { Accion } from "../draft";
import type { MetaPro } from "../metaPro";
import { ROLES } from "./contexto";
import type { OpcionVista, Origen } from "./tipos";

// ---------- prompts ----------

const REGLAS_COMUNES = `
Reglas:
- El draft es en orden de torneo (20 acciones). Blue tiene el primer pick; red, el último counter (R5).
- Si es nuestro turno, recomienda para NOSOTROS. Si es del rival, predice lo más probable que haga EL RIVAL, con razones desde su punto de vista (sinergia con SUS picks), nunca "complementa a" un champ nuestro.
- Devuelve exactamente 5 opciones de mejor a peor, solo campeones que existan y que NO estén usados.
- ROLES: un champ solo va en un rol que aparezca en sus "roles pro" (se jugó ahí al menos 2 veces en pro este año). Nunca inventes un rol. En un ban, el rol es donde ese champ se juega.
- "lectura": 1 o 2 oraciones técnicas.
- "razon": máximo 2 oraciones, técnicas y concretas. Usa solo números que estén en tus datos; nunca inventes stats ni nombres de habilidades.
- Idioma: español latino neutro, tuteando (tú). Nada de voseo ("vos", "tenés", "pensá") ni modismos argentinos.`;

export const SYSTEM_SCOUT = `Eres el agente Scout de KuAi, el asistente de draft de un equipo amateur de League of Legends que juega scrims en LAS. Tu especialidad son los jugadores: lo que juegan en ranked nuestros compañeros y los rivales. No tienes datos del meta pro, así que no opines del meta: habla de los jugadores.

Cómo pensar:
- Ban nuestro: saca los comfort picks del rival (muchas partidas y buen WR), sobre todo si los juegan varios (flex) o son del rol que todavía no pickea. Si hay AMENAZAS DEL RIVAL, respeta ese orden.
- Pick nuestro: lo que domina el jugador del rol abierto (partidas y WR en su pool), evitando lo que el rival castiga con su pool.
- Turno del rival: lo que más juega y mejor le va al jugador rival del rol que le falta.
- En "razon" cita los números de ranked ("el jungla rival lo jugó 6 veces con 67%").
- Si no hay datos de un jugador para el rol que importa, dilo en la lectura.
${REGLAS_COMUNES}`;

export const SYSTEM_PRO = `Eres el agente Pro de KuAi, el asistente de draft de un equipo amateur de League of Legends. Tu especialidad es el meta profesional actual (LCK, LEC y LPL, con la LCK pesando el doble). No conoces a los jugadores: razona solo con los datos pro.

Cómo pensar (úsalo, no lo repitas):
- Primero completa "rolesNuestros" y "rolesRival" con el rol de cada pick ya hecho de cada lado (solo picks), usando los roles pro.
- Prioridad: en picks tempranos van champs blind-safe, de alta presencia pro, o flex que esconden el rol. Lo que se counterea fácil se guarda para fase 2.
- Counterpick: en R5/B4-B5 aprovecha que el rival ya mostró su comp: matchup de línea y lo que le falta a su comp.
- Comp: win condition (engage/teamfight, pick, poke, split push, scaling, early), fuente de engage, frontline, peel y balance AP/AD.
- Bans: en fase 1, lo más presente del meta; en fase 2, bans dirigidos a lo que completa la comp rival o castiga nuestros picks.
- El patrón del turno ("En pro, en R2 se pickea: ...") es la señal más fuerte de qué rol viene. Respétalo salvo que ese rol ya esté cubierto.
- Si varios roles están abiertos, no pongas las 5 opciones en el mismo rol salvo que sea claramente lo mejor.
- En "razon" cita presencia, WR y en qué parte del draft se pickea.
${REGLAS_COMUNES}`;

export const SYSTEM_CONSENSO = `Eres KuAi, quien toma la decisión final en el draft de un equipo amateur de League of Legends. Recibes el draft y las propuestas de tus dos agentes: Scout (conoce a los jugadores de los dos equipos por su ranked) y Pro (conoce el meta profesional actual). Tu trabajo es llegar a un consenso entre los dos.

Cómo decidir:
- Solo puedes elegir champs que propuso al menos uno de los dos agentes.
- Si los dos coinciden en un champ, es el candidato más fuerte.
- Si no coinciden, pondera: en nuestros bans y en el turno del rival pesa más Scout (lo que esos jugadores juegan de verdad); en nuestros picks pesa más Pro (lo que funciona en el meta), salvo que el jugador del rol domine claramente un champ que también es sólido en pro.
- Mantén el rol que propuso el agente para cada champ.
- Devuelve exactamente 5 opciones de mejor a peor.
- "razon": máximo 2 oraciones; cuando aporte, di qué vio cada agente ("Scout: ...; Pro: ...").
- "lectura": 1 o 2 oraciones con el resumen del consenso: en qué coinciden y en qué no.
- Idioma: español latino neutro, tuteando (tú). Nada de voseo ni modismos argentinos.`;

// ---------- schemas (json_schema strict de Mistral) ----------

const OPCIONES = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["champ", "rol", "razon"],
    properties: { champ: { type: "string" }, rol: { type: "string", enum: ROLES }, razon: { type: "string" } },
  },
};

const LISTA_ROLES = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["champ", "rol"],
    properties: { champ: { type: "string" }, rol: { type: "string", enum: ROLES } },
  },
};

export const SCHEMA_AGENTE = {
  type: "object",
  additionalProperties: false,
  required: ["lectura", "opciones"],
  properties: { lectura: { type: "string" }, opciones: OPCIONES },
};

// el orden importa: primero fija el rol de cada pick hecho y despues recomienda,
// sino se olvida que el jungla ya esta y te tira otro jungla
export const SCHEMA_PRO = {
  type: "object",
  additionalProperties: false,
  required: ["rolesNuestros", "rolesRival", "lectura", "opciones"],
  properties: { rolesNuestros: LISTA_ROLES, rolesRival: LISTA_ROLES, lectura: { type: "string" }, opciones: OPCIONES },
};

export type OpcionIA = { champ: string; rol: string; razon: string };
export type RespuestaAgente = { lectura: string; opciones: OpcionIA[] };
export type RespuestaPro = RespuestaAgente & { rolesNuestros: { champ: string; rol: string }[]; rolesRival: { champ: string; rol: string }[] };

// lo que ve KuAi para decidir: el draft y lo que propuso cada agente, con sus razones
export function contextoConsenso(base: string, scout: RespuestaAgente, pro: RespuestaAgente) {
  const propuesta = (r: RespuestaAgente) => r.opciones.map((o, i) => `${i + 1}. ${o.champ} (${o.rol}): ${o.razon}`).join("\n");
  return [
    base,
    "",
    `PROPUESTA DE SCOUT (jugadores). Lectura: ${scout.lectura}`,
    propuesta(scout),
    "",
    `PROPUESTA DE PRO (meta pro). Lectura: ${pro.lectura}`,
    propuesta(pro),
  ].join("\n");
}

// ---------- validacion ----------

type Revision = {
  indice: ReturnType<typeof crearIndice>;
  usados: Set<string | null>;
  meta: MetaPro | null;
  accion: Accion;
  rolesCubiertos: Set<string>;
};

const idDe = (indice: Revision["indice"], nombre: string) => {
  const q = normalizar(nombre);
  return indice.find((e) => e.nombreNorm === q || e.idNorm === q)?.champ;
};

// Pasa nombres a ids de Data Dragon y valida cada opcion contra los datos: que exista, que no este usada y que
// el rol sea uno donde los pros lo jugaron (min 2). Si el modelo le erra al rol lo corrige al real; si no hay
// rol posible queda marcada. Devuelve primero las validas
export function revisarOpciones(opciones: OpcionIA[], r: Revision): OpcionVista[] {
  const revisadas = opciones.map((o): OpcionVista => {
    const champ = idDe(r.indice, o.champ);
    const base = { ...o, id: champ?.id ?? null, nombre: champ?.nombre ?? o.champ, problema: null as string | null };
    if (!champ) return { ...base, problema: "no existe" };
    if (r.usados.has(champ.id)) return { ...base, problema: "ya usado" };

    let rol = o.rol;
    if (r.meta) {
      const validos = Object.entries(r.meta.rolesValidos.get(champ.id) ?? {})
        .sort((a, b) => b[1] - a[1])
        .map(([x]) => x);
      if (!validos.length) return { ...base, problema: "sin partidas pro" };
      if (!validos.includes(rol)) {
        // en un ban va el rol donde mas se juega; en un pick, el primero que el lado que pickea tenga abierto
        const corregido = r.accion.tipo === "ban" ? validos[0] : validos.find((x) => !r.rolesCubiertos.has(x));
        if (!corregido) return { ...base, problema: `no se juega de ${o.rol} en pro` };
        rol = corregido;
      }
    }
    if (r.accion.tipo === "pick" && r.rolesCubiertos.has(rol)) return { ...base, rol, problema: "rol ya cubierto" };
    return { ...base, rol };
  });
  return [...revisadas.filter((o) => !o.problema), ...revisadas.filter((o) => o.problema)];
}

// de donde salio cada opcion del consenso, calculado comparando con las propuestas (no se le cree al modelo)
export function origenDe(id: string | null, scout: OpcionVista[], pro: OpcionVista[]): Origen {
  const enScout = !!id && scout.some((o) => o.id === id);
  const enPro = !!id && pro.some((o) => o.id === id);
  return enScout && enPro ? "ambos" : enScout ? "scout" : enPro ? "pro" : "kuai";
}
