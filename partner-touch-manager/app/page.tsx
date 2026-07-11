// Dashboard (item 4.1) — KPIs, gráficos e widget "Precisa de atenção".
// Server component: 3 leituras (uma por aba do Sheets), todas as
// agregações calculadas em memória em lib/metrics.ts.

import {
  AlertCircle,
  CalendarX,
  Handshake,
  MessageSquare,
  UserPlus,
} from "lucide-react";
import { getParcerias } from "@/lib/data/parcerias";
import { getContatos } from "@/lib/data/contatos";
import { getTouches } from "@/lib/data/touches";
import { calcularDashboard, resolverFiltro } from "@/lib/metrics";
import { formatDateBR } from "@/lib/dates";
import { SheetsError } from "@/lib/sheets";
import { SheetsErrorPanel } from "@/components/sheets-error-panel";
import type { Contato, Parceria, Touch } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FiltrosDashboard } from "@/components/dashboard/filtros";
import { AtencaoWidget } from "@/components/dashboard/atencao-widget";
import {
  HealthDonutChart,
  RankingParceriasChart,
  TouchesPorCanalChart,
  TouchesPorResponsavelChart,
  TouchesPorSemanaChart,
} from "@/components/dashboard/charts";

// Página dinâmica: as leituras do Sheets têm cache de 10s com tags
// (lib/data/cached-reads.ts) — "ao vivo" sem estourar a cota da API.
export const dynamic = "force-dynamic";

function KpiCard({
  titulo,
  valor,
  icone,
  destaque,
}: {
  titulo: string;
  valor: number;
  icone: React.ReactNode;
  destaque?: boolean;
}) {
  return (
    <Card className={destaque && valor > 0 ? "border-red-300 dark:border-red-800" : ""}>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg " +
            (destaque && valor > 0
              ? "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400"
              : "bg-primary/10 text-primary")
          }
        >
          {icone}
        </div>
        <div>
          <p
            className={
              "text-2xl font-bold leading-tight " +
              (destaque && valor > 0 ? "text-red-600 dark:text-red-400" : "")
            }
          >
            {valor}
          </p>
          <p className="text-xs text-muted-foreground">{titulo}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string; responsavel?: string }>;
}) {
  const params = await searchParams;
  const filtro = resolverFiltro(params);

  // Uma leitura por aba — deduplicada pelo React cache dentro do request.
  let parcerias: Parceria[], touches: Touch[], contatos: Contato[];
  try {
    [parcerias, touches, contatos] = await Promise.all([
      getParcerias(),
      getTouches(),
      getContatos(),
    ]);
  } catch (err) {
    if (err instanceof SheetsError) return <SheetsErrorPanel message={err.message} />;
    throw err;
  }

  const dados = calcularDashboard(parcerias, touches, contatos, filtro);
  const top = dados.rankingParcerias.slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {formatDateBR(filtro.de)} até {formatDateBR(filtro.ate)} — dados vivos da planilha
          </p>
        </div>
        <FiltrosDashboard responsaveis={dados.responsaveis} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          titulo="Touches no período"
          valor={dados.kpis.totalTouches}
          icone={<MessageSquare className="h-5 w-5" />}
        />
        <KpiCard
          titulo="Parcerias ativas"
          valor={dados.kpis.parceriasAtivas}
          icone={<Handshake className="h-5 w-5" />}
        />
        <KpiCard
          titulo="Follow-ups atrasados"
          valor={dados.kpis.followupsAtrasados}
          icone={<CalendarX className="h-5 w-5" />}
          destaque
        />
        <KpiCard
          titulo={`Em risco (health ou +${dados.riskDays}d sem touch)`}
          valor={dados.kpis.parceriasEmRisco}
          icone={<AlertCircle className="h-5 w-5" />}
          destaque
        />
        <KpiCard
          titulo="Novos contatos captados"
          valor={dados.kpis.novosContatos}
          icone={<UserPlus className="h-5 w-5" />}
        />
      </div>

      {/* Widget Precisa de atenção */}
      <AtencaoWidget itens={dados.precisaAtencao} riskDays={dados.riskDays} />

      {/* Gráficos */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Touches ao longo do tempo (por semana)</CardTitle>
          </CardHeader>
          <CardContent>
            <TouchesPorSemanaChart data={dados.touchesPorSemana} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Touches por canal</CardTitle>
          </CardHeader>
          <CardContent>
            {dados.touchesPorCanal.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Sem touches no período.
              </p>
            ) : (
              <TouchesPorCanalChart data={dados.touchesPorCanal} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cadência do time (touches por responsável)</CardTitle>
          </CardHeader>
          <CardContent>
            {dados.touchesPorResponsavel.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Sem touches no período.
              </p>
            ) : (
              <TouchesPorResponsavelChart data={dados.touchesPorResponsavel} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Health das parcerias</CardTitle>
          </CardHeader>
          <CardContent>
            {dados.healthDistribuicao.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Nenhuma parceria cadastrada.
              </p>
            ) : (
              <HealthDonutChart data={dados.healthDistribuicao} />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Parcerias mais tocadas no período (top {top.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {top.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Nenhuma parceria cadastrada.
              </p>
            ) : (
              <RankingParceriasChart data={top} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
