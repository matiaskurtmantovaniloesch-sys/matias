"use client";

// Filtro global do dashboard: período (7d/30d/90d/custom) e
// responsável — tudo via searchParams, então a página (server)
// recalcula as métricas a cada mudança.

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const PERIODOS = [
  { valor: "7d", rotulo: "7 dias" },
  { valor: "30d", rotulo: "30 dias" },
  { valor: "90d", rotulo: "90 dias" },
  { valor: "custom", rotulo: "Personalizado" },
] as const;

export function FiltrosDashboard({ responsaveis }: { responsaveis: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const periodo = searchParams.get("periodo") ?? "30d";
  const responsavel = searchParams.get("responsavel") ?? "";
  const de = searchParams.get("de") ?? "";
  const ate = searchParams.get("ate") ?? "";

  function atualizar(mudancas: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(mudancas)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-md border p-0.5">
        {PERIODOS.map((p) => (
          <Button
            key={p.valor}
            variant={periodo === p.valor ? "secondary" : "ghost"}
            size="sm"
            onClick={() => atualizar({ periodo: p.valor })}
          >
            {p.rotulo}
          </Button>
        ))}
      </div>

      {periodo === "custom" && (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Input
            type="date"
            className="h-8 w-36"
            value={de}
            onChange={(e) => atualizar({ de: e.target.value })}
          />
          até
          <Input
            type="date"
            className="h-8 w-36"
            value={ate}
            onChange={(e) => atualizar({ ate: e.target.value })}
          />
        </div>
      )}

      <Select
        value={responsavel}
        onChange={(e) => atualizar({ responsavel: e.target.value })}
        className="h-8 w-48"
      >
        <option value="">Todos os responsáveis</option>
        {responsaveis.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </Select>
    </div>
  );
}
