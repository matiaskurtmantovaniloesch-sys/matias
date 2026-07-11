// Detalhe da parceria (item 4.3) — header editável, timeline de
// touches, contatos da parceria e próximas ações pendentes.
// Três leituras (uma por aba) por request, com revalidate curto.

import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { getParceria } from "@/lib/data/parcerias";
import { getContatosDaParceria } from "@/lib/data/contatos";
import { getTouchesDaParceria } from "@/lib/data/touches";
import { getParcerias } from "@/lib/data/parcerias";
import { ParceriaHeader } from "@/components/parcerias/parceria-header";
import { Timeline } from "@/components/parcerias/timeline";
import { ContatoFormModal } from "@/components/contatos/contato-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DecisorBadge } from "@/components/badges";
import { displayDate, hojeSP, parseSheetDate } from "@/lib/dates";
import { SheetsError } from "@/lib/sheets";
import { SheetsErrorPanel } from "@/components/sheets-error-panel";
import type { Contato, Parceria, Touch } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ParceriaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // getParcerias/getContatos/getTouches são cacheadas por request (React cache),
  // então estas chamadas resultam em exatamente 1 leitura por aba.
  let parceria: Parceria | null;
  let touches: Touch[], contatos: Contato[], todasParcerias: Parceria[];
  try {
    [parceria, touches, contatos, todasParcerias] = await Promise.all([
      getParceria(id),
      getTouchesDaParceria(id),
      getContatosDaParceria(id),
      getParcerias(),
    ]);
  } catch (err) {
    if (err instanceof SheetsError) return <SheetsErrorPanel message={err.message} />;
    throw err;
  }

  if (!parceria) notFound();

  // Próximas ações pendentes: touches com proxima_acao e prazo >= hoje
  // (ou sem prazo), mais o follow-up da parceria se atrasado.
  const hoje = hojeSP();
  const acoesPendentes = touches
    .filter((t) => t.proxima_acao)
    .map((t) => ({
      acao: t.proxima_acao,
      prazo: t.data_proxima_acao,
      atrasada: (() => {
        const d = parseSheetDate(t.data_proxima_acao);
        return d ? d < hoje : false;
      })(),
      responsavel: t.responsavel,
    }))
    // uma ação por texto (touches antigos repetem próximas ações já feitas)
    .filter((a, i, arr) => arr.findIndex((x) => x.acao === a.acao) === i)
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <ParceriaHeader parceria={parceria} />

      {parceria.notas && (
        <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          {parceria.notas}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <h2 className="text-lg font-semibold">Timeline de touches ({touches.length})</h2>
          <Timeline touches={touches} contatos={contatos} />
        </div>

        <div className="space-y-6">
          {/* Próximas ações pendentes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Próximas ações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {parceria.proximo_followup && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                  <p className="font-medium">Follow-up da parceria</p>
                  <p
                    className={
                      parseSheetDate(parceria.proximo_followup) &&
                      parseSheetDate(parceria.proximo_followup)! < hoje
                        ? "font-semibold text-red-600 dark:text-red-400"
                        : "text-muted-foreground"
                    }
                  >
                    {displayDate(parceria.proximo_followup)}
                    {parseSheetDate(parceria.proximo_followup) &&
                    parseSheetDate(parceria.proximo_followup)! < hoje
                      ? " — atrasado"
                      : ""}
                  </p>
                </div>
              )}
              {acoesPendentes.length === 0 && !parceria.proximo_followup ? (
                <p className="text-sm text-muted-foreground">Nenhuma ação pendente.</p>
              ) : (
                acoesPendentes.map((a, i) => (
                  <div key={i} className="border-l-2 pl-3 text-sm">
                    <p>{a.acao}</p>
                    <p
                      className={
                        a.atrasada
                          ? "text-xs font-semibold text-red-600 dark:text-red-400"
                          : "text-xs text-muted-foreground"
                      }
                    >
                      {a.prazo ? `até ${displayDate(a.prazo)}` : "sem prazo"}
                      {a.atrasada ? " — atrasada" : ""} · {a.responsavel}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Contatos da parceria */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Contatos ({contatos.length})</CardTitle>
              <ContatoFormModal
                parcerias={todasParcerias.map((p) => ({ id: p.id, nome: p.nome }))}
                defaultParceriaId={parceria.id}
                trigger={
                  <Button variant="outline" size="sm">
                    Adicionar
                  </Button>
                }
              />
            </CardHeader>
            <CardContent className="space-y-3">
              {contatos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum contato captado nesta parceria ainda.
                </p>
              ) : (
                contatos.map((c) => (
                  <div key={c.id} className="flex items-start justify-between gap-2 border-b pb-2 text-sm last:border-0 last:pb-0">
                    <div>
                      <p className="font-medium">
                        {c.nome} <DecisorBadge decisor={c.decisor} />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[c.cargo, c.email, c.telefone].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <ContatoFormModal
                      parcerias={todasParcerias.map((p) => ({ id: p.id, nome: p.nome }))}
                      contato={c}
                      trigger={
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar contato">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
