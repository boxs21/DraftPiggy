import Tablero from "@/components/Tablero";
import { getDataDragon } from "@/lib/ddragon";

export default async function Page() {
  const { version, champs } = await getDataDragon();
  return <Tablero champs={champs} version={version} />;
}
