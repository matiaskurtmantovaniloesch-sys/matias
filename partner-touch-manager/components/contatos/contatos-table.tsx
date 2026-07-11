"use client";

// Diretório de contatos (item 4.4): busca por nome/empresa/e-mail,
// filtro por parceria e por decisor, edição e export CSV (bônus).

import * as React from "react";
import Link from "next/link";
import { Download, Linkedin, Pencil, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DecisorBadge } from "@/components/badges";
import { ContatoFormModal } from "@/components/contatos/contato-form";
import type { Contato, Parceria } from "@/lib/types";

interface Props {
  contatos: Contato[];
  parcerias: Pick<Parceria, "id" | "nome">[];
}

export function ContatosTable({ contatos, parcerias }: Props) {
  const router = useRouter();
  const [busca, setBusca] = React.useState("");
  const [parceriaId, setParceriaId] = React.useState("");
  const [somenteDecisores, setSomenteDecisores] = React.useState(false);
  const [excluindo, setExcluindo] = React.useState<string | null>(null);

  const nomeParceria = React.useMemo(
    () => new Map(parcerias.map((p) => [p.id, p.nome])),
    [parcerias]
  );

  const filtrados = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    return contatos.filter((c) => {
      if (parceriaId && c.parceria_id !== parceriaId) return false;
      if (somenteDecisores && c.decisor !== "Sim") return false;
      if (!q) return true;
      const empresa = nomeParceria.get(c.parceria_id) ?? "";
      return (
        c.nome.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        empresa.toLowerCase().includes(q)
      );
    });
  }, [contatos, busca, parceriaId, somenteDecisores, nomeParceria]);

  function exportarCSV() {
    const header = [
      "nome",
      "cargo",
      "parceria",
      "email",
      "telefone",
      "linkedin",
      "origem",
      "decisor",
      "notas",
    ];
    const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const linhas = filtrados.map((c) =>
      [
        c.nome,
        c.cargo,
        nomeParceria.get(c.parceria_id) ?? "",
        c.email,
        c.telefone,
        c.linkedin,
        c.origem,
        c.decisor,
        c.notas,
      ]
        .map(esc)
        .join(";")
    );
    // BOM para o Excel abrir acentos corretamente
    const csv = "﻿" + [header.join(";"), ...linhas].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contatos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function excluir(c: Contato) {
    if (!window.confirm(`Excluir o contato "${c.nome}" da planilha?`)) return;
    setExcluindo(c.id);
    try {
      const res = await fetch(`/api/contatos/${c.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        window.alert(body?.error ?? "Erro ao excluir o contato");
        return;
      }
      router.refresh();
    } finally {
      setExcluindo(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, empresa ou e-mail…"
            className="pl-8"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select
          value={parceriaId}
          onChange={(e) => setParceriaId(e.target.value)}
          className="w-52"
        >
          <option value="">Todas as parcerias</option>
          {parcerias.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Select>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={somenteDecisores}
            onChange={(e) => setSomenteDecisores(e.target.checked)}
          />
          Só decisores
        </label>
        <Button variant="outline" onClick={exportarCSV} disabled={filtrados.length === 0}>
          <Download /> Exportar CSV
        </Button>
      </div>

      {filtrados.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {contatos.length === 0
            ? "Nenhum contato captado ainda. Clique em “Novo contato” para começar."
            : "Nenhum contato encontrado com esses filtros."}
        </p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Parceria</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <span className="mr-2">{c.nome}</span>
                    <DecisorBadge decisor={c.decisor} />
                    {c.linkedin && (
                      <a
                        href={c.linkedin}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-1 inline-block align-middle text-muted-foreground hover:text-primary"
                        title="LinkedIn"
                      >
                        <Linkedin className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </TableCell>
                  <TableCell>{c.cargo || "—"}</TableCell>
                  <TableCell>
                    {c.parceria_id && nomeParceria.has(c.parceria_id) ? (
                      <Link
                        href={`/parcerias/${c.parceria_id}`}
                        className="text-primary hover:underline"
                      >
                        {nomeParceria.get(c.parceria_id)}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {c.email ? (
                      <a href={`mailto:${c.email}`} className="hover:underline">
                        {c.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{c.telefone || "—"}</TableCell>
                  <TableCell>{c.origem || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <ContatoFormModal
                        parcerias={parcerias}
                        contato={c}
                        trigger={
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        title="Excluir"
                        disabled={excluindo === c.id}
                        onClick={() => excluir(c)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
