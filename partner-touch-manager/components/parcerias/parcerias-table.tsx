"use client";

// Tabela de parcerias com busca, filtros (tipo, status, health,
// responsável) e ordenação client-side — os dados chegam do
// servidor já lidos do Sheets (uma leitura por aba).

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { HealthBadge, StatusBadge } from "@/components/badges";
import { displayDate, parseSheetDate } from "@/lib/dates";
import {
  HEALTH_PARCERIA,
  STATUS_PARCERIA,
  TIPOS_PARCERIA,
  type Parceria,
} from "@/lib/types";

export interface LinhaParceria extends Parceria {
  followupAtrasado: boolean;
  emRisco: boolean;
}

type ColunaOrdenavel = "nome" | "ultima_interacao" | "proximo_followup" | "responsavel";

export function ParceriasTable({ linhas }: { linhas: LinhaParceria[] }) {
  const router = useRouter();
  const [busca, setBusca] = React.useState("");
  const [tipo, setTipo] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [health, setHealth] = React.useState("");
  const [responsavel, setResponsavel] = React.useState("");
  const [ordem, setOrdem] = React.useState<{ col: ColunaOrdenavel; asc: boolean }>({
    col: "nome",
    asc: true,
  });

  const responsaveis = React.useMemo(
    () =>
      Array.from(new Set(linhas.map((l) => l.responsavel).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "pt-BR")
      ),
    [linhas]
  );

  const filtradas = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    let resultado = linhas.filter((l) => {
      if (q && !l.nome.toLowerCase().includes(q) && !l.responsavel.toLowerCase().includes(q))
        return false;
      if (tipo && l.tipo !== tipo) return false;
      if (status && l.status !== status) return false;
      if (health && l.health !== health) return false;
      if (responsavel && l.responsavel !== responsavel) return false;
      return true;
    });

    resultado = [...resultado].sort((a, b) => {
      let cmp = 0;
      if (ordem.col === "nome" || ordem.col === "responsavel") {
        cmp = a[ordem.col].localeCompare(b[ordem.col], "pt-BR");
      } else {
        const da = parseSheetDate(a[ordem.col])?.getTime() ?? 0;
        const db = parseSheetDate(b[ordem.col])?.getTime() ?? 0;
        cmp = da - db;
      }
      return ordem.asc ? cmp : -cmp;
    });
    return resultado;
  }, [linhas, busca, tipo, status, health, responsavel, ordem]);

  function ordenar(col: ColunaOrdenavel) {
    setOrdem((o) => ({ col, asc: o.col === col ? !o.asc : true }));
  }

  const ThOrdenavel = ({ col, children }: { col: ColunaOrdenavel; children: React.ReactNode }) => (
    <TableHead>
      <button
        type="button"
        onClick={() => ordenar(col)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {children}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou responsável…"
            className="pl-8"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-40">
          <option value="">Todos os tipos</option>
          {TIPOS_PARCERIA.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
          <option value="">Todos os status</option>
          {STATUS_PARCERIA.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Select value={health} onChange={(e) => setHealth(e.target.value)} className="w-40">
          <option value="">Todo health</option>
          {HEALTH_PARCERIA.map((h) => (
            <option key={h}>{h}</option>
          ))}
        </Select>
        <Select
          value={responsavel}
          onChange={(e) => setResponsavel(e.target.value)}
          className="w-44"
        >
          <option value="">Todos os responsáveis</option>
          {responsaveis.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Select>
      </div>

      {filtradas.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {linhas.length === 0
            ? "Nenhuma parceria cadastrada ainda. Clique em “Nova parceria” para começar."
            : "Nenhuma parceria encontrada com esses filtros."}
        </p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <ThOrdenavel col="nome">Parceria</ThOrdenavel>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Health</TableHead>
                <ThOrdenavel col="responsavel">Responsável</ThOrdenavel>
                <ThOrdenavel col="ultima_interacao">Último touch</ThOrdenavel>
                <ThOrdenavel col="proximo_followup">Próx. follow-up</ThOrdenavel>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/parcerias/${p.id}`)}
                >
                  <TableCell className="font-medium">
                    {p.nome}
                    {p.emRisco && (
                      <Badge variant="danger" className="ml-2">
                        Em risco
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{p.tipo || "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                  <TableCell>
                    <HealthBadge health={p.health} />
                  </TableCell>
                  <TableCell>{p.responsavel || "—"}</TableCell>
                  <TableCell>{displayDate(p.ultima_interacao)}</TableCell>
                  <TableCell
                    className={p.followupAtrasado ? "font-semibold text-red-600 dark:text-red-400" : ""}
                  >
                    {displayDate(p.proximo_followup)}
                    {p.followupAtrasado && " ⚠"}
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
