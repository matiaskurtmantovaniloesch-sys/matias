// Painel de erro amigável da integração com o Sheets — renderizado
// pelas páginas quando a leitura falha (planilha não compartilhada,
// GOOGLE_SHEET_ID errado, cota estourada etc.).

import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SheetsErrorPanel({ message }: { message: string }) {
  return (
    <div className="mx-auto mt-16 max-w-lg">
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Não foi possível acessar a planilha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">{message}</p>
          <p className="text-xs text-muted-foreground">
            O passo a passo de configuração completo está no README do projeto.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
