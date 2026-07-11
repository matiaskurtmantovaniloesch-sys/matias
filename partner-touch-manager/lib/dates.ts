// ============================================================
// Datas em pt-BR, fuso America/Sao_Paulo.
// Na planilha as datas ficam legíveis para o time: dd/MM/yyyy
// (touches podem ter hora: dd/MM/yyyy HH:mm). O parser também
// aceita ISO (yyyy-MM-dd) para quem editar direto na planilha
// ou colar de outra ferramenta.
// ============================================================

const TZ = "America/Sao_Paulo";

/** Data/hora "agora" no fuso de São Paulo, como partes numéricas. */
function nowInSaoPaulo(): {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
} {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    ano: get("year"),
    mes: get("month"),
    dia: get("day"),
    hora: get("hour") % 24,
    minuto: get("minute"),
  };
}

/**
 * Converte uma string de data da planilha em Date (meia-noite local do runtime,
 * usada só para comparação/ordenação — nunca é exibida diretamente).
 * Aceita: dd/MM/yyyy, dd/MM/yyyy HH:mm, yyyy-MM-dd, yyyy-MM-ddTHH:mm...
 * Retorna null para vazio/inválido.
 */
export function parseSheetDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const s = value.trim();
  if (!s) return null;

  // dd/MM/yyyy [HH:mm]
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) {
    const d = new Date(
      Number(m[3]),
      Number(m[2]) - 1,
      Number(m[1]),
      Number(m[4] ?? 0),
      Number(m[5] ?? 0)
    );
    return isNaN(d.getTime()) ? null : d;
  }

  // yyyy-MM-dd [THH:mm]
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) {
    const d = new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4] ?? 0),
      Number(m[5] ?? 0)
    );
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/** Hoje (00:00) no fuso de São Paulo. */
export function hojeSP(): Date {
  const { ano, mes, dia } = nowInSaoPaulo();
  return new Date(ano, mes - 1, dia);
}

/** Agora no fuso de São Paulo (precisão de minuto). */
export function agoraSP(): Date {
  const { ano, mes, dia, hora, minuto } = nowInSaoPaulo();
  return new Date(ano, mes - 1, dia, hora, minuto);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Formata Date → "dd/MM/yyyy". */
export function formatDateBR(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Formata Date → "dd/MM/yyyy HH:mm". */
export function formatDateTimeBR(d: Date): string {
  return `${formatDateBR(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** String da planilha → "dd/MM/yyyy" para exibição ("—" se vazia/inválida). */
export function displayDate(value: string | undefined | null): string {
  const d = parseSheetDate(value);
  return d ? formatDateBR(d) : "—";
}

/** String da planilha → "dd/MM/yyyy HH:mm" (omite hora se for 00:00). */
export function displayDateTime(value: string | undefined | null): string {
  const d = parseSheetDate(value);
  if (!d) return "—";
  return d.getHours() === 0 && d.getMinutes() === 0
    ? formatDateBR(d)
    : formatDateTimeBR(d);
}

/** Date → "yyyy-MM-dd" (valor de <input type="date">). */
export function toInputDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "yyyy-MM-dd" (input) → "dd/MM/yyyy" (planilha). Vazio permanece vazio. */
export function inputDateToSheet(value: string): string {
  const d = parseSheetDate(value);
  return d ? formatDateBR(d) : "";
}

/** "yyyy-MM-ddTHH:mm" (input datetime-local) → "dd/MM/yyyy HH:mm". */
export function inputDateTimeToSheet(value: string): string {
  const d = parseSheetDate(value);
  if (!d) return "";
  return formatDateTimeBR(d);
}

/** Diferença em dias inteiros entre duas datas (b - a). */
export function diffDias(a: Date, b: Date): number {
  const MS = 24 * 60 * 60 * 1000;
  const a0 = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const b0 = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((b0 - a0) / MS);
}
