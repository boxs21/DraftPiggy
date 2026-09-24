import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // iconos de champs desde Data Dragon
    remotePatterns: [new URL("https://ddragon.leagueoflegends.com/cdn/**")],
  },
};

export default nextConfig;
