"use client";

// Boundary global de erro — mostra mensagens amigáveis da integração
// com o Sheets (planilha não compartilhada, GOOGLE_SHEET_ID errado etc.).

import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto mt-16 max-w-lg">
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Não foi possível carregar os dados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {error.message ||
              "Erro inesperado ao acessar o Google Sheets. Confira as credenciais no .env.local (ver README)."}
          </p>
          <Button onClick={reset} variant="outline">
            <RotateCw /> Tentar de novo
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
