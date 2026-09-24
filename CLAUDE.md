# Draft Piggy

@AGENTS.md

Herramienta personal para draftear en scrims de LoL (no es para pro play, los rivales son amateur de LAS). La usa una sola persona (el que draftea) en su pantalla. El draft se carga en el tablero (a mano por ahora, más adelante leyendo pantalla o screenshots) y una IA recomienda qué pickear/banear con razonamiento técnico basado en cómo draftean los pros (LCK, LEC, LPL) y en el pool de cada jugador.

La idea es que mejore con el uso: cada draft que se juega queda guardado y sirve para mejorar las recomendaciones y el modelo.

## Stack
- Next.js 16 (App Router) + TypeScript + Tailwind v4. Next 16 cambió APIs: antes de escribir código de Next, leer `node_modules/next/dist/docs/` (ver AGENTS.md)
- Supabase: drafts guardados, pools, cache de scouting y del meta pro
- Deploy en Vercel (Hobby)
- IA: Mistral API (hay $150 de créditos). Llamadas con `fetch` desde el servidor, JSON con `response_format` tipo `json_schema` strict
- Claves SOLO en el servidor (route handlers / server actions), en `.env.local`: `MISTRAL_API_KEY`, `MISTRAL_MODEL`, `RIOT_API_KEY`. Nunca en el cliente, nunca con prefijo `NEXT_PUBLIC_*`

## Costo
Todo tiene que ser gratis salvo Mistral. Vercel, Supabase (free tier), Riot API, Leaguepedia y Data Dragon son gratis. No sumar servicios pagos sin preguntar.

## Modelos Mistral
| Uso | Modelo | Precio (USD por millón, entrada/salida) |
|---|---|---|
| Recomendar y explicar (default) | `mistral-medium-2604` (Medium 3.5) | 1.5 / 7.5 |
| Leer screenshots (a futuro, tiene visión) | `mistral-small-2603` (Small 4) | 0.15 / 0.6 |

- Una recomendación con Medium cuesta ~$0.0026 y tarda ~2s.
- Small 4 NO sirve para razonar el draft: en la prueba leyó mal el estado (puso un champ baneado como pick del rival).
- Los precios están en `PRECIOS_MISTRAL` (`src/lib/mistral.ts`). Si se agrega un modelo, sumarlo ahí.

## Fuentes de datos
- **Data Dragon**: campeones e íconos
  - versiones: `https://ddragon.leagueoflegends.com/api/versions.json` (la [0] es el parche actual)
  - champs: `https://ddragon.leagueoflegends.com/cdn/{version}/data/es_MX/champion.json`
  - íconos: `https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{id}.png`
- **Oracle's Elixir** (fuente del meta pro): CSV del año en la carpeta pública de Google Drive (link en oracleselixir.com/tools/downloads). Se actualiza 1 vez por día y piden no bajarlo más seguido. ~70 MB, ~1650 partidas de LCK/LEC/LPL/MSI/Worlds.
  - 12 filas por partida: 10 de jugador (`champion`, `position` top/jng/mid/bot/sup) y 2 de equipo (`position = team`) con `ban1..5` y `pick1..5` en orden de draft, `side`, `firstPick`, `result`, `patch`, `league` (`LCK`, `LEC`, `LPL`, `MSI`, `WLDs`).
  - Trae también LAS, LCS, CBLOL, LCK Challengers, etc. por si se quieren sumar.
  - Los champs vienen en inglés ("Nunu & Willump") y se mapean con `champion.json` en `en_US`.
- **Leaguepedia**: NO usar sin login. Anónimo te bloquea como una hora después de 2-3 queries. Si algún día hace falta, con bot password de Fandom.
- **Parches**: Riot nombra los parches por año (`26.17`) pero Data Dragon y Oracle's Elixir usan la numeración vieja (`16.17`). Se guarda y se muestra en formato Riot: convertir siempre con `parcheDesdeVersion` (`src/lib/champs.ts`). Los pros van 1-3 parches atrás del live, y cada liga en uno distinto (LCK suele ir uno atrás).
- **First pick en 2026**: ya no va atado al side. En `acciones_pro`, `side` es la posición en el orden de draft (blue = el que pickeó primero) y `partidas_pro.primer_pick` dice de qué side del mapa era.
- **Riot API** (scouting): servidor LAS = plataforma `la2`, cluster regional `americas` para `account-v1` y `match-v5`. Límites de la key: 20 req/s y 100 cada 2 min (`riot.ts` respeta `Retry-After`). La dev key vence cada 24 h; para producción, la personal key.
- op.gg / u.gg: no tienen API pública, NO scrapear. El usuario pega el link (multisearch o perfil) y `riotIds.ts` solo lee los Riot IDs de la URL; los datos salen de la Riot API.
- gol.gg: NO usar, no tiene API.

## Meta pro
- Ligas: LCK 50%, LEC 25%, LPL 25% (MSI y Worlds suman si caen en el parche). Los pesos van en una constante.
- Parche: por cada liga, su último parche que no sea más nuevo que el live. Si la liga tiene menos de 25 partidas, se suma el anterior; si igual no llega, se avisa "muestra chica".
- Sync: `/api/cron/sync-meta` baja el CSV y sube lo nuevo (cron de Vercel diario, o `npm run sync-meta` / `npm run sync-meta todo` con el dev server andando).
- Qué se saca: presencia (pick + ban), winrate, rol, y qué rol/champ va en cada turno del draft (blind temprano vs counter al final).

## Orden de draft (torneo)
```
Bans fase 1:  B1 R1 B2 R2 B3 R3
Picks fase 1: B1 | R1 R2 | B2 B3 | R3
Bans fase 2:  R4 B4 R5 B5
Picks fase 2: R4 | B4 B5 | R5
```
20 acciones en total. El estado del draft se modela como un array de 20 slots con un índice de turno actual. Deshacer = volver el índice atrás.

## Cómo razona la IA (en la UI se llama **KuAi**)
- El código calcula los números (meta, pools, scouting) y arma los candidatos. La IA elige y explica. Nunca inventa stats, winrates ni nombres de habilidades.
- Todo lo que devuelve se valida contra Data Dragon: champ que no existe, ya usado o que repite un rol cubierto se marca y no se puede elegir.
- Antes de recomendar tiene que fijar el rol de cada pick ya hecho de los dos lados (si no, recomienda dos junglas).
- El razonamiento tiene que ser técnico y de pro play: seguridad para pick blind, flex picks, guardar counterpicks para el final, prioridad según el side, win condition y power spikes de la comp, y bans de fase 2 apuntados a lo que le falta al rival.
- En turno del rival predice qué va a hacer.

## Mejora continua
- Guardar cada draft: estado final, recomendaciones que dio la IA en cada turno, qué se eligió de verdad y el resultado del scrim.
- Con eso: feedback de qué recomendación sirvió, ejemplos buenos para el prompt, un set de drafts para medir si un cambio de prompt o de modelo mejora o empeora, y el patrón de draft de cada rival.

## Piezas (en orden)
- [x] Tablero: side, orden de torneo, buscador, picks/bans, Ctrl+Z, reiniciar
- [x] Prueba de IA: botón "Recomendar con IA" con Mistral + pool rápido (texto)
- [x] Meta pro (LCK/LEC/LPL/Worlds) desde Oracle's Elixir en Supabase, y la IA razonando con esos datos
- [x] Login con contraseña, pantalla de side, deploy en Vercel (repo `boxs21/DraftPiggy`)
- [x] Pestañas **Scout** y **Live draft**. Scout: pegar op.gg/u.gg de mi equipo y del rival → últimas 20 ranked de cada uno (cache en Supabase). La IA usa esos pools y el código calcula las "amenazas del rival" (comfort picks sumados entre jugadores, bonus flex y presencia pro); en nuestros bans la opción 1 es la amenaza #1
1. Pulir la recomendación con pools: nuestros picks desde el pool del jugador del rol abierto, predicción del rival por jugador ← ACTUAL
2. Recomendación v2: candidatos calculados con meta + pools + scouting, la IA elige y explica
3. Historial de drafts + mejora continua (feedback, resultados, patrón por rival)
4. Lectura de pantalla o screenshot con Small 4 (visión) que llena el tablero
5. Modo fearless (Bo3/Bo5)

## Mapa del código
- `src/lib/draft.ts`: orden de torneo, estado del draft
- `src/lib/champs.ts`: tipo `Champ`, búsqueda (normaliza tildes/apóstrofes, iniciales, alias tipo j4)
- `src/lib/ddragon.ts`: fetch a Data Dragon desde el servidor (revalidate)
- `src/lib/mistral.ts`: llamada a Mistral, precios, costo por llamada
- `src/lib/supabase.ts`: cliente de servidor con la secret key
- `src/lib/oracleElixir.ts`: CSV de Oracle's Elixir -> filas de `partidas_pro` / `acciones_pro`
- `src/lib/metaPro.ts`: elige parches por liga, pondera LCK/LEC/LPL y calcula stats por champ y por turno
- `src/app/api/cron/sync-meta/route.ts`: sync diario del meta pro (protegido con `CRON_SECRET`)
- `src/app/api/recomendar/route.ts`: prompt, schema y validación de la recomendación
- `src/lib/riot.ts`, `src/lib/scouting.ts`: Riot API (account-v1, match-v5) y resumen por jugador con cache en `jugadores` / `partidas_jugador`
- `src/lib/riotIds.ts`: saca Riot IDs de links de op.gg/u.gg o texto del lobby (sin abrir la página)
- `src/lib/sesion.ts` + `src/proxy.ts`: login (`APP_PASSWORD`, cookie HMAC), cron con `CRON_SECRET`
- `src/app/api/scouting/route.ts`: scoutea un jugador por llamada
- `src/components/`: `App` (pestañas y estado del draft), `Scout`, `usePlanteles` (planteles en localStorage + cola de scouting), `Tablero`, `ElegirSide`, `LineaDeTiempo`, `ColumnaEquipo`, `Buscador`, `PanelIA`, `IconoChamp`

## Estilo de código
- Variables y funciones en camelCase. Nombres del dominio en español cuando suene natural (`turnoActual`, `sideElegido`, `champsBaneados`); lo técnico genérico en inglés.
- Constantes de config/colores en SCREAMING_CASE.
- Comentarios en español, casuales, que expliquen el porqué y no el qué. Nada de JSDoc formal.
- Textos de la UI en español.
- Estética: dark minimalista, acentos cyan, mucho espacio negativo. Marca **Draft Piggy**: logo de chanchito de línea (`components/Logo.tsx`, favicon en `app/icon.svg`). Fondo con brillo cian arriba y los colores de cada side abajo, grilla finita, animaciones suaves (`animate-aparecer`, `animate-revelar`, `animate-flotar` en `globals.css`). Botón principal = cian lleno; blue = sky, red = rose.
- Componentes chicos y directos, sin sobre-abstraer.
