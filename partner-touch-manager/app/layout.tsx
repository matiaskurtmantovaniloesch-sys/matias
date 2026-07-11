import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { TouchModalProvider } from "@/components/touch-modal";

export const metadata: Metadata = {
  title: "Partner Touch Manager",
  description:
    "CRM do Time de Relacionamentos — touches, métricas e contatos com o Google Sheets como banco de dados vivo",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">
        <TouchModalProvider>
          <div className="flex min-h-screen flex-col md:flex-row">
            <Sidebar />
            <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
          </div>
        </TouchModalProvider>
      </body>
    </html>
  );
}
