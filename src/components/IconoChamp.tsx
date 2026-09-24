import Image from "next/image";
import { urlIcono } from "@/lib/champs";

type Props = {
  version: string;
  id: string;
  nombre: string;
  size: number;
  className?: string;
};

// unoptimized porque los iconos ya vienen chiquitos de Data Dragon,
// pasarlos por el optimizador de Vercel es gastar cuota por nada
export default function IconoChamp({ version, id, nombre, size, className = "" }: Props) {
  return (
    <Image
      src={urlIcono(version, id)}
      alt={nombre}
      width={size}
      height={size}
      unoptimized
      draggable={false}
      className={className}
    />
  );
}
