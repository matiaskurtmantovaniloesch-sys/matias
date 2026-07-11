"use client";

// Modal de criar/editar contato — grava na aba Contatos do Sheets.
// Usado no diretório geral (/contatos) e no cadastro rápido dentro
// do detalhe da parceria.

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
import { contatoInputSchema } from "@/lib/schemas";
import type { Contato, Parceria } from "@/lib/types";

interface Props {
  parcerias: Pick<Parceria, "id" | "nome">[];
  contato?: Contato;
  /** Pré-seleciona a parceria (cadastro rápido no detalhe). */
  defaultParceriaId?: string;
  trigger?: React.ReactNode;
}

export function ContatoFormModal({ parcerias, contato, defaultParceriaId, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [erros, setErros] = React.useState<Record<string, string>>({});

  const inicial = React.useCallback(
    () => ({
      parceria_id: contato?.parceria_id ?? defaultParceriaId ?? "",
      nome: contato?.nome ?? "",
      cargo: contato?.cargo ?? "",
      email: contato?.email ?? "",
      telefone: contato?.telefone ?? "",
      linkedin: contato?.linkedin ?? "",
      origem: contato?.origem ?? "",
      decisor: contato?.decisor === "Sim" ? "Sim" : "Não",
      notas: contato?.notas ?? "",
    }),
    [contato, defaultParceriaId]
  );

  const [form, setForm] = React.useState(inicial);
  const set = (campo: string, valor: string) => setForm((f) => ({ ...f, [campo]: valor }));

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

    const parsed = contatoInputSchema.safeParse(form);
    if (!parsed.success) {
      const map: Record<string, string> = {};
      for (const issue of parsed.error.issues) map[issue.path.join(".")] = issue.message;
      setErros(map);
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch(contato ? `/api/contatos/${contato.id}` : "/api/contatos", {
        method: contato ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Erro ao salvar o contato");
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar o contato");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={aoAbrir}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> Novo contato
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{contato ? "Editar contato" : "Novo contato"}</DialogTitle>
          <DialogDescription>
            Contatos captados ficam na aba Contatos da planilha, vinculados à parceria.
          </DialogDescription>
        </DialogHeader>

        {erro && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
        )}

        <form onSubmit={salvar} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="c-nome">Nome *</Label>
              <Input
                id="c-nome"
                placeholder="Nome do contato"
                value={form.nome}
                onChange={(e) => set("nome", e.target.value)}
              />
              {erros.nome && <p className="text-xs text-destructive">{erros.nome}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-parceria">Parceria *</Label>
              <Select
                id="c-parceria"
                value={form.parceria_id}
                onChange={(e) => set("parceria_id", e.target.value)}
              >
                <option value="">— Selecione —</option>
                {parcerias.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Select>
              {erros.parceria_id && (
                <p className="text-xs text-destructive">{erros.parceria_id}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="c-cargo">Cargo</Label>
              <Input
                id="c-cargo"
                placeholder="Cargo/função"
                value={form.cargo}
                onChange={(e) => set("cargo", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-origem">Origem da captação</Label>
              <Input
                id="c-origem"
                placeholder="Evento, indicação, inbound…"
                value={form.origem}
                onChange={(e) => set("origem", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="c-email">E-mail</Label>
              <Input
                id="c-email"
                type="email"
                placeholder="email@empresa.com"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
              {erros.email && <p className="text-xs text-destructive">{erros.email}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-telefone">Telefone/WhatsApp</Label>
              <Input
                id="c-telefone"
                placeholder="(11) 99999-9999"
                value={form.telefone}
                onChange={(e) => set("telefone", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="c-linkedin">LinkedIn</Label>
              <Input
                id="c-linkedin"
                placeholder="https://linkedin.com/in/…"
                value={form.linkedin}
                onChange={(e) => set("linkedin", e.target.value)}
              />
              {erros.linkedin && <p className="text-xs text-destructive">{erros.linkedin}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-decisor">É tomador de decisão?</Label>
              <Select
                id="c-decisor"
                value={form.decisor}
                onChange={(e) => set("decisor", e.target.value)}
              >
                <option>Não</option>
                <option>Sim</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="c-notas">Notas</Label>
            <Textarea
              id="c-notas"
              rows={2}
              placeholder="Contexto do contato…"
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
              {salvando ? "Gravando na planilha…" : contato ? "Salvar alterações" : "Criar contato"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
