import App from "@/components/App";
import { getDataDragon } from "@/lib/ddragon";

export default async function Page() {
  const { version, champs } = await getDataDragon();
  return <App champs={champs} version={version} />;
}
