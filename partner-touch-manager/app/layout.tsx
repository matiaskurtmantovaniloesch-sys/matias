import type { Metadata } from "next";
import { FlaskConical } from "lucide-react";
import "./globals.css";
import { isDemoMode } from "@/lib/sheets";
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
            <main className="min-w-0 flex-1 p-4 md:p-8">
              {isDemoMode() && (
                <p className="mb-6 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                  <FlaskConical className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>Modo demonstração</strong> — dados de exemplo em memória
                    (somem ao reiniciar). Para conectar sua planilha do Google Sheets,
                    preencha o <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">.env.local</code>{" "}
                    seguindo o README.
                  </span>
                </p>
              )}
              {children}
            </main>
          </div>
        </TouchModalProvider>
      </body>
    </html>
  );
}
