// corre el sync del meta pro contra el dev server local (npm run dev tiene que estar andando)
// uso: npm run sync-meta        -> solo lo nuevo desde la ultima partida guardada
//      npm run sync-meta todo   -> re-sube el año entero
const todo = process.argv[2] === "todo";
const url = new URL("http://localhost:3000/api/cron/sync-meta");
if (todo) url.searchParams.set("todo", "1");

console.log(`Bajando Oracle's Elixir y sincronizando${todo ? " el año entero" : ""}...`);
const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
console.log(res.status, await res.json());
