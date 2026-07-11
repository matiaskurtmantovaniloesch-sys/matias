// Widget "Precisa de atenção" — parcerias com follow-up atrasado ou
// sem contato recente, ordenadas por urgência. Cada item leva ao detalhe.

import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HealthBadge } from "@/components/badges";
import type { DashboardData } from "@/lib/metrics";

export function AtencaoWidget({
  itens,
  riskDays,
}: {
  itens: DashboardData["precisaAtencao"];
  riskDays: number;
}) {
  return (
    <Card className="border-red-200 dark:border-red-900/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
          Precisa de atenção
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {itens.length} parceria(s)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {itens.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Tudo em dia — nenhuma parceria com follow-up atrasado ou sem touch há mais de{" "}
            {riskDays} dias. 🎉
          </p>
        ) : (
          itens.slice(0, 8).map((item) => (
            <Link
              key={item.id}
              href={`/parcerias/${item.id}`}
              className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.nome}</p>
                <p className="truncate text-xs text-red-600 dark:text-red-400">
                  {item.motivos.join(" · ")}
                </p>
              </div>
              <span className="hidden text-xs text-muted-foreground sm:block">
                {item.responsavel}
              </span>
              <HealthBadge health={item.health} />
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
