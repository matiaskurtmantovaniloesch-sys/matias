"use client";

// Modal de criar/editar parceria. Ao salvar, grava na aba
// Parcerias do Sheets via /api/parcerias e revalida a tela.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { parceriaInputSchema } from "@/lib/schemas";
import {
  HEALTH_PARCERIA,
  STATUS_PARCERIA,
  TIPOS_PARCERIA,
  type Parceria,
} from "@/lib/types";
import { parseSheetDate, toInputDate } from "@/lib/dates";

interface Props {
  /** Se presente, o modal edita em vez de criar. */
  parceria?: Parceria;
  trigger?: React.ReactNode;
}

export function ParceriaFormModal({ parceria, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [erros, setErros] = React.useState<Record<string, string>>({});

  const inicial = React.useCallback(
    () => ({
      nome: parceria?.nome ?? "",
      tipo: parceria?.tipo || "Estratégica",
      status: parceria?.status || "Ativa",
      responsavel: parceria?.responsavel ?? "",
      data_inicio: parceria?.data_inicio
        ? (() => {
            const d = parseSheetDate(parceria.data_inicio);
            return d ? toInputDate(d) : "";
          })()
        : "",
      health: parceria?.health || "Saudável",
      proximo_followup: parceria?.proximo_followup
        ? (() => {
            const d = parseSheetDate(parceria.proximo_followup);
            return d ? toInputDate(d) : "";
          })()
        : "",
      notas: parceria?.notas ?? "",
    }),
    [parceria]
  );

  const [form, setForm] = React.useState(inicial);
  const set = (campo: string, valor: string) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  function aoAbrir(aberto: boolean) {
    setOpen(aberto);
    if (aberto) {
      setForm(inicial());
      setErro(null);
      setErros({});
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setErros({});

    const parsed = parceriaInputSchema.safeParse(form);
    if (!parsed.success) {
      const map: Record<string, string> = {};
      for (const issue of parsed.error.issues) map[issue.path.join(".")] = issue.message;
      setErros(map);
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch(
        parceria ? `/api/parcerias/${parceria.id}` : "/api/parcerias",
        {
          method: parceria ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Erro ao salvar a parceria");
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar a parceria");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={aoAbrir}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> Nova parceria
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{parceria ? "Editar parceria" : "Nova parceria"}</DialogTitle>
          <DialogDescription>
            {parceria
              ? "As alterações são gravadas direto na planilha."
              : "A parceria é criada na aba Parcerias da planilha."}
          </DialogDescription>
        </DialogHeader>

        {erro && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {erro}
          </p>
        )}

        <form onSubmit={salvar} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="p-nome">Nome *</Label>
            <Input
              id="p-nome"
              placeholder="Nome da parceria/empresa"
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
            />
            {erros.nome && <p className="text-xs text-destructive">{erros.nome}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="p-tipo">Tipo *</Label>
              <Select id="p-tipo" value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
                {TIPOS_PARCERIA.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-status">Status *</Label>
              <Select
                id="p-status"
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
              >
                {STATUS_PARCERIA.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-health">Health *</Label>
              <Select
                id="p-health"
                value={form.health}
                onChange={(e) => set("health", e.target.value)}
              >
                {HEALTH_PARCERIA.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="p-resp">Responsável *</Label>
              <Input
                id="p-resp"
                placeholder="Dono do relacionamento"
                value={form.responsavel}
                onChange={(e) => set("responsavel", e.target.value)}
              />
              {erros.responsavel && (
                <p className="text-xs text-destructive">{erros.responsavel}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-inicio">Início da parceria</Label>
              <Input
                id="p-inicio"
                type="date"
                value={form.data_inicio}
                onChange={(e) => set("data_inicio", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-followup">Próximo follow-up</Label>
              <Input
                id="p-followup"
                type="date"
                value={form.proximo_followup}
                onChange={(e) => set("proximo_followup", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="p-notas">Notas</Label>
            <Textarea
              id="p-notas"
              rows={3}
              placeholder="Contexto, acordos, histórico…"
              value={form.notas}
              onChange={(e) => set("notas", e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando && <Loader2 className="animate-spin" />}
              {salvando ? "Gravando na planilha…" : parceria ? "Salvar alterações" : "Criar parceria"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
