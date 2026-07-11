"use client";

// Header do detalhe da parceria — health, status e responsável
// editáveis inline (PATCH direto na linha da planilha).

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ParceriaFormModal } from "@/components/parcerias/parceria-form";
import { RegistrarTouchButton } from "@/components/parcerias/registrar-touch-btn";
import { displayDate } from "@/lib/dates";
import { HEALTH_PARCERIA, STATUS_PARCERIA, type Parceria } from "@/lib/types";

export function ParceriaHeader({ parceria }: { parceria: Parceria }) {
  const router = useRouter();
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  async function patch(campo: "health" | "status", valor: string) {
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/parcerias/${parceria.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [campo]: valor }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Erro ao salvar");
      }
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (
      !window.confirm(
        `Excluir a parceria "${parceria.nome}"? A linha será removida da planilha (touches e contatos permanecem).`
      )
    )
      return;
    setSalvando(true);
    try {
      const res = await fetch(`/api/parcerias/${parceria.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Erro ao excluir");
      }
      router.push("/parcerias");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao excluir");
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{parceria.nome}</h1>
            <Badge variant="secondary">{parceria.tipo || "Sem tipo"}</Badge>
            {salvando && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Responsável: <span className="font-medium text-foreground">{parceria.responsavel || "—"}</span>
            {" · "}Início: {displayDate(parceria.data_inicio)}
            {" · "}Último touch: {displayDate(parceria.ultima_interacao)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <RegistrarTouchButton parceriaId={parceria.id} />
          <ParceriaFormModal
            parceria={parceria}
            trigger={
              <Button variant="outline" size="icon" title="Editar parceria">
                <Pencil />
              </Button>
            }
          />
          <Button
            variant="outline"
            size="icon"
            title="Excluir parceria"
            onClick={excluir}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Status
          <Select
            value={parceria.status}
            onChange={(e) => patch("status", e.target.value)}
            className="h-8 w-40"
            disabled={salvando}
          >
            {STATUS_PARCERIA.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Health
          <Select
            value={parceria.health}
            onChange={(e) => patch("health", e.target.value)}
            className="h-8 w-36"
            disabled={salvando}
          >
            {HEALTH_PARCERIA.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </Select>
        </label>
      </div>

      {erro && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
      )}
    </div>
  );
}
