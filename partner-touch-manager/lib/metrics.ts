// ============================================================
// Métricas e lógica de risco — usadas pelo dashboard, pela
// tabela de parcerias e pelo widget "Precisa de atenção".
// Tudo é calculado em memória a partir de UMA leitura por aba.
// ============================================================

import { diffDias, hojeSP, parseSheetDate } from "./dates";
import type { Contato, Parceria, Touch } from "./types";

/** N dias sem touch para considerar risco (configurável via env). */
export function getRiskDays(): number {
  const n = Number(process.env.RISK_DAYS_THRESHOLD);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

export interface AvaliacaoParceria {
  /** proximo_followup < hoje */
  followupAtrasado: boolean;
  /** dias desde a ultima_interacao (null = nunca teve touch) */
  diasSemTouch: number | null;
  /** health = "Em risco" OU sem touch há mais de N dias */
  emRisco: boolean;
  /** dias de atraso do follow-up (0 se não atrasado) */
  diasAtraso: number;
  motivos: string[];
}

export function avaliarParceria(
  p: Parceria,
  riskDays: number,
  hoje: Date = hojeSP()
): AvaliacaoParceria {
  const followup = parseSheetDate(p.proximo_followup);
  const ultima = parseSheetDate(p.ultima_interacao);

  const diasAtraso = followup ? Math.max(0, diffDias(followup, hoje)) : 0;
  const followupAtrasado = diasAtraso > 0;
  const diasSemTouch = ultima ? diffDias(ultima, hoje) : null;

  const semTouchRecente = diasSemTouch === null || diasSemTouch > riskDays;
  const emRisco = p.health === "Em risco" || semTouchRecente;

  const motivos: string[] = [];
  if (followupAtrasado) motivos.push(`Follow-up atrasado há ${diasAtraso} dia(s)`);
  if (p.health === "Em risco") motivos.push("Health marcado como Em risco");
  if (diasSemTouch === null) motivos.push("Nunca teve um touch registrado");
  else if (diasSemTouch > riskDays) motivos.push(`Sem touch há ${diasSemTouch} dias`);

  return { followupAtrasado, diasSemTouch, emRisco, diasAtraso, motivos };
}

// ------------------------------------------------------------
// Filtro de período do dashboard
// ------------------------------------------------------------

export type Periodo = "7d" | "30d" | "90d" | "custom";

export interface FiltroDashboard {
  periodo: Periodo;
  de: Date;
  ate: Date;
  responsavel: string; // "" = todos
}

export function resolverFiltro(searchParams: {
  periodo?: string;
  de?: string;
  ate?: string;
  responsavel?: string;
}): FiltroDashboard {
  const hoje = hojeSP();
  const periodo = (["7d", "30d", "90d", "custom"].includes(searchParams.periodo ?? "")
    ? searchParams.periodo
    : "30d") as Periodo;

  let de: Date;
  let ate: Date = hoje;

  if (periodo === "custom") {
    de = parseSheetDate(searchParams.de ?? "") ?? new Date(hoje.getTime() - 29 * 86400000);
    ate = parseSheetDate(searchParams.ate ?? "") ?? hoje;
  } else {
    const dias = periodo === "7d" ? 7 : periodo === "90d" ? 90 : 30;
    de = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - (dias - 1));
  }

  return { periodo, de, ate, responsavel: searchParams.responsavel ?? "" };
}

function dentroDoPeriodo(dataStr: string, filtro: FiltroDashboard): boolean {
  const d = parseSheetDate(dataStr);
  if (!d) return false;
  const dia = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return dia >= filtro.de && dia <= filtro.ate;
}

// ------------------------------------------------------------
// Agregações do dashboard
// ------------------------------------------------------------

export interface DashboardData {
  kpis: {
    totalTouches: number;
    parceriasAtivas: number;
    followupsAtrasados: number;
    parceriasEmRisco: number;
    novosContatos: number;
  };
  touchesPorSemana: { semana: string; touches: number }[];
  touchesPorCanal: { canal: string; touches: number }[];
  touchesPorResponsavel: { responsavel: string; touches: number }[];
  healthDistribuicao: { health: string; parcerias: number }[];
  rankingParcerias: { id: string; nome: string; touches: number }[];
  precisaAtencao: {
    id: string;
    nome: string;
    responsavel: string;
    health: string;
    urgencia: number;
    motivos: string[];
  }[];
  responsaveis: string[];
  riskDays: number;
}

export function calcularDashboard(
  parcerias: Parceria[],
  touches: Touch[],
  contatos: Contato[],
  filtro: FiltroDashboard
): DashboardData {
  const riskDays = getRiskDays();
  const hoje = hojeSP();

  // Lista de responsáveis (para o filtro global) — vem de parcerias e touches.
  const responsaveis = Array.from(
    new Set(
      [...parcerias.map((p) => p.responsavel), ...touches.map((t) => t.responsavel)]
        .map((r) => r.trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  // Aplica o filtro de responsável.
  const parceriasFiltradas = filtro.responsavel
    ? parcerias.filter((p) => p.responsavel === filtro.responsavel)
    : parcerias;
  const idsParceriasFiltradas = new Set(parceriasFiltradas.map((p) => p.id));
  const touchesFiltrados = touches.filter((t) => {
    if (!filtro.responsavel) return true;
    // touch conta se foi conduzido pelo responsável OU é de parceria dele
    return (
      t.responsavel === filtro.responsavel || idsParceriasFiltradas.has(t.parceria_id)
    );
  });

  // Touches dentro do período.
  const touchesNoPeriodo = touchesFiltrados.filter((t) => dentroDoPeriodo(t.data, filtro));

  // Contatos: não têm data própria — usamos o período apenas quando o
  // primeiro touch vinculado ao contato cai no período; senão, contamos todos
  // os contatos de parcerias filtradas como "captados" (planilha não guarda
  // created_at). Para simplicidade e previsibilidade: contatos de parcerias
  // filtradas cujo primeiro touch (se houver) está no período, ou sem touch.
  const contatosFiltrados = filtro.responsavel
    ? contatos.filter((c) => idsParceriasFiltradas.has(c.parceria_id))
    : contatos;
  const primeiroTouchDoContato = new Map<string, Date>();
  for (const t of touchesFiltrados) {
    if (!t.contato_id) continue;
    const d = parseSheetDate(t.data);
    if (!d) continue;
    const atual = primeiroTouchDoContato.get(t.contato_id);
    if (!atual || d < atual) primeiroTouchDoContato.set(t.contato_id, d);
  }
  const novosContatos = contatosFiltrados.filter((c) => {
    const primeiro = primeiroTouchDoContato.get(c.id);
    if (!primeiro) return true; // sem touch ainda → considerado recém-captado
    const dia = new Date(primeiro.getFullYear(), primeiro.getMonth(), primeiro.getDate());
    return dia >= filtro.de && dia <= filtro.ate;
  }).length;

  // Avaliação de risco por parceria.
  const avaliacoes = parceriasFiltradas.map((p) => ({
    parceria: p,
    avaliacao: avaliarParceria(p, riskDays, hoje),
  }));

  // KPIs
  const kpis = {
    totalTouches: touchesNoPeriodo.length,
    parceriasAtivas: parceriasFiltradas.filter((p) => p.status === "Ativa").length,
    followupsAtrasados: avaliacoes.filter((a) => a.avaliacao.followupAtrasado).length,
    parceriasEmRisco: avaliacoes.filter((a) => a.avaliacao.emRisco).length,
    novosContatos,
  };

  // Touches por semana (linha do tempo).
  const porSemana = new Map<string, number>();
  const inicioSemana = (d: Date) => {
    const dia = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = (dia.getDay() + 6) % 7; // segunda-feira como início
    dia.setDate(dia.getDate() - diff);
    return dia;
  };
  // Preenche todas as semanas do período com 0 para a linha não "pular".
  for (
    let d = inicioSemana(filtro.de);
    d <= filtro.ate;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)
  ) {
    const chave = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    porSemana.set(chave, 0);
  }
  for (const t of touchesNoPeriodo) {
    const d = parseSheetDate(t.data);
    if (!d) continue;
    const ini = inicioSemana(d);
    const chave = `${String(ini.getDate()).padStart(2, "0")}/${String(ini.getMonth() + 1).padStart(2, "0")}`;
    porSemana.set(chave, (porSemana.get(chave) ?? 0) + 1);
  }
  const touchesPorSemana = Array.from(porSemana.entries()).map(([semana, n]) => ({
    semana,
    touches: n,
  }));

  // Touches por canal.
  const porCanal = new Map<string, number>();
  for (const t of touchesNoPeriodo) {
    const canal = t.canal || "Outro";
    porCanal.set(canal, (porCanal.get(canal) ?? 0) + 1);
  }
  const touchesPorCanal = Array.from(porCanal.entries())
    .map(([canal, n]) => ({ canal, touches: n }))
    .sort((a, b) => b.touches - a.touches);

  // Touches por responsável (cadência do time).
  const porResp = new Map<string, number>();
  for (const t of touchesNoPeriodo) {
    const r = t.responsavel || "Sem responsável";
    porResp.set(r, (porResp.get(r) ?? 0) + 1);
  }
  const touchesPorResponsavel = Array.from(porResp.entries())
    .map(([responsavel, n]) => ({ responsavel, touches: n }))
    .sort((a, b) => b.touches - a.touches);

  // Distribuição de health.
  const porHealth = new Map<string, number>();
  for (const p of parceriasFiltradas) {
    const h = p.health || "Sem health";
    porHealth.set(h, (porHealth.get(h) ?? 0) + 1);
  }
  const healthDistribuicao = Array.from(porHealth.entries()).map(([health, n]) => ({
    health,
    parcerias: n,
  }));

  // Ranking de parcerias mais/menos tocadas (no período).
  const touchesPorParceria = new Map<string, number>();
  for (const t of touchesNoPeriodo) {
    touchesPorParceria.set(t.parceria_id, (touchesPorParceria.get(t.parceria_id) ?? 0) + 1);
  }
  const rankingParcerias = parceriasFiltradas
    .map((p) => ({ id: p.id, nome: p.nome, touches: touchesPorParceria.get(p.id) ?? 0 }))
    .sort((a, b) => b.touches - a.touches);

  // Widget "Precisa de atenção" — ordenado por urgência.
  const precisaAtencao = avaliacoes
    .filter((a) => a.avaliacao.followupAtrasado || a.avaliacao.emRisco)
    .map(({ parceria, avaliacao }) => ({
      id: parceria.id,
      nome: parceria.nome,
      responsavel: parceria.responsavel,
      health: parceria.health,
      // urgência: dias de atraso pesam mais; dias sem touch complementam
      urgencia:
        avaliacao.diasAtraso * 3 +
        (avaliacao.diasSemTouch ?? riskDays * 2) +
        (parceria.health === "Em risco" ? 50 : 0),
      motivos: avaliacao.motivos,
    }))
    .sort((a, b) => b.urgencia - a.urgencia);

  return {
    kpis,
    touchesPorSemana,
    touchesPorCanal,
    touchesPorResponsavel,
    healthDistribuicao,
    rankingParcerias,
    precisaAtencao,
    responsaveis,
    riskDays,
  };
}
