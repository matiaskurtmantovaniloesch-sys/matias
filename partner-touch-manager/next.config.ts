import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // googleapis usa módulos nativos do Node — mantê-lo fora do bundle do servidor
  serverExternalPackages: ["googleapis", "google-auth-library"],
};

export default nextConfig;
