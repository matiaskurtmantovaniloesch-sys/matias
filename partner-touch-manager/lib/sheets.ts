// ============================================================
// lib/sheets.ts — ÚNICO ponto de contato com o Google Sheets.
//
// O Google Sheets é o banco de dados vivo (single source of truth):
// toda leitura vem daqui e toda escrita grava direto na planilha.
// Nenhum componente ou rota fala com a API do Google fora deste módulo
// (a camada lib/data/* usa apenas as funções genéricas daqui).
//
// Autenticação: Service Account via google.auth.JWT com o escopo
// https://www.googleapis.com/auth/spreadsheets. A planilha precisa
// estar compartilhada com o e-mail da service account como Editor.
// ============================================================

import { google, sheets_v4 } from "googleapis";
import { JWT } from "google-auth-library";

// ------------------------------------------------------------
// Definição das abas e seus cabeçalhos (linha 1 de cada aba).
// A ordem aqui é a ordem canônica usada pelo bootstrap; na leitura
// usamos o cabeçalho REAL da planilha como chave, então reordenar
// colunas na planilha não quebra a ferramenta.
// ------------------------------------------------------------

export const SHEET_TABS = {
  Parcerias: [
    "id",
    "nome",
    "tipo",
    "status",
    "responsavel",
    "data_inicio",
    "health",
    "ultima_interacao",
    "proximo_followup",
    "notas",
  ],
  Contatos: [
    "id",
    "parceria_id",
    "nome",
    "cargo",
    "email",
    "telefone",
    "linkedin",
    "origem",
    "decisor",
    "notas",
  ],
  Touches: [
    "id",
    "parceria_id",
    "contato_id",
    "data",
    "canal",
    "tipo",
    "resumo",
    "sentimento",
    "proxima_acao",
    "data_proxima_acao",
    "responsavel",
  ],
} as const;

export type TabName = keyof typeof SHEET_TABS;

// ------------------------------------------------------------
// Erros amigáveis — mostrados diretamente na UI.
// ------------------------------------------------------------

export class SheetsError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "SheetsError";
  }
}

function toFriendlyError(err: unknown): SheetsError {
  const anyErr = err as { code?: number; response?: { status?: number }; message?: string };
  const status = anyErr?.code ?? anyErr?.response?.status;
  const saEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "(não configurado)";

  if (status === 403) {
    return new SheetsError(
      `A planilha não está compartilhada com a conta de serviço. ` +
        `Abra a planilha no Google Sheets, clique em "Compartilhar" e adicione ${saEmail} como Editor.`,
      err
    );
  }
  if (status === 404) {
    return new SheetsError(
      `Planilha não encontrada. Confira o GOOGLE_SHEET_ID no .env.local ` +
        `(é o trecho entre /d/ e /edit na URL da planilha).`,
      err
    );
  }
  if (status === 429) {
    return new SheetsError(
      `Limite de requisições da API do Google Sheets atingido (60/min). ` +
        `Aguarde alguns segundos e recarregue a página.`,
      err
    );
  }
  return new SheetsError(
    `Erro ao acessar o Google Sheets: ${anyErr?.message ?? "erro desconhecido"}`,
    err
  );
}

// ------------------------------------------------------------
// Cliente autenticado (singleton por processo).
// ------------------------------------------------------------

let sheetsClient: sheets_v4.Sheets | null = null;

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new SheetsError(
      `Variável de ambiente ${name} não configurada. ` +
        `Copie .env.example para .env.local e preencha as credenciais (ver README).`
    );
  }
  return value;
}

export function getSheetId(): string {
  return getEnv("GOOGLE_SHEET_ID");
}

function getClient(): sheets_v4.Sheets {
  if (sheetsClient) return sheetsClient;

  const email = getEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  // A private key vem do .env com "\n" literais — convertemos para quebras reais.
  const key = getEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");

  const auth = new JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

// ------------------------------------------------------------
// Leitura genérica: uma chamada values.get por aba.
// A primeira linha é tratada como cabeçalho e vira as chaves
// dos objetos retornados — exatamente como está na planilha.
// ------------------------------------------------------------

export interface SheetData {
  header: string[];
  /** Objetos { coluna: valor } — 1 por linha de dados (linha 2 em diante). */
  rows: Record<string, string>[];
  /** Número da linha na planilha (1-based) de cada objeto em `rows`. */
  rowNumbers: number[];
}

export async function readSheet(tab: TabName): Promise<SheetData> {
  try {
    const res = await getClient().spreadsheets.values.get({
      spreadsheetId: getSheetId(),
      range: tab,
    });
    const values = (res.data.values ?? []) as string[][];
    if (values.length === 0) {
      // Aba existe mas está vazia (sem cabeçalho) — rode `npm run init-sheet`.
      return { header: [...SHEET_TABS[tab]], rows: [], rowNumbers: [] };
    }
    const header = values[0].map((h) => String(h).trim());
    const rows: Record<string, string>[] = [];
    const rowNumbers: number[] = [];
    for (let i = 1; i < values.length; i++) {
      const raw = values[i];
      // Ignora linhas totalmente vazias (sobras de deleções manuais).
      if (!raw || raw.every((c) => String(c ?? "").trim() === "")) continue;
      const obj: Record<string, string> = {};
      header.forEach((col, j) => {
        obj[col] = String(raw[j] ?? "").trim();
      });
      rows.push(obj);
      rowNumbers.push(i + 1); // 1-based na planilha
    }
    return { header, rows, rowNumbers };
  } catch (err) {
    if (err instanceof SheetsError) throw err;
    throw toFriendlyError(err);
  }
}

// ------------------------------------------------------------
// Escrita
// ------------------------------------------------------------

/** Converte índice de coluna (0-based) em letra: 0 → A, 25 → Z, 26 → AA. */
function colLetter(index: number): string {
  let s = "";
  let n = index;
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/**
 * Acrescenta uma linha no fim da aba. `record` é um objeto cujo shape
 * segue os cabeçalhos canônicos da aba (SHEET_TABS).
 */
export async function appendRow(
  tab: TabName,
  record: Record<string, string>
): Promise<void> {
  try {
    // Lê só o cabeçalho para respeitar a ordem real das colunas na planilha.
    const headerRes = await getClient().spreadsheets.values.get({
      spreadsheetId: getSheetId(),
      range: `${tab}!1:1`,
    });
    const header =
      (headerRes.data.values?.[0] as string[] | undefined)?.map((h) =>
        String(h).trim()
      ) ?? [...SHEET_TABS[tab]];

    const values = header.map((col) => record[col] ?? "");

    await getClient().spreadsheets.values.append({
      spreadsheetId: getSheetId(),
      range: tab,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [values] },
    });
  } catch (err) {
    if (err instanceof SheetsError) throw err;
    throw toFriendlyError(err);
  }
}

/**
 * Atualiza a linha cujo `id` (coluna id) bate — NUNCA por posição.
 * Apenas os campos presentes em `patch` são alterados; o resto é preservado.
 * Retorna o registro atualizado, ou null se o id não existir.
 */
export async function updateRowById(
  tab: TabName,
  id: string,
  patch: Record<string, string>
): Promise<Record<string, string> | null> {
  const { header, rows, rowNumbers } = await readSheet(tab);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return null;

  const merged: Record<string, string> = { ...rows[idx] };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) merged[k] = v;
  }

  const rowNumber = rowNumbers[idx];
  const values = header.map((col) => merged[col] ?? "");
  const range = `${tab}!A${rowNumber}:${colLetter(header.length - 1)}${rowNumber}`;

  try {
    await getClient().spreadsheets.values.update({
      spreadsheetId: getSheetId(),
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [values] },
    });
  } catch (err) {
    if (err instanceof SheetsError) throw err;
    throw toFriendlyError(err);
  }
  return merged;
}

// Cache do gid (sheetId numérico) de cada aba — necessário para deleteDimension.
let tabIdCache: Record<string, number> | null = null;

async function getTabGid(tab: TabName): Promise<number> {
  if (!tabIdCache) {
    const res = await getClient().spreadsheets.get({
      spreadsheetId: getSheetId(),
      fields: "sheets(properties(sheetId,title))",
    });
    tabIdCache = {};
    for (const s of res.data.sheets ?? []) {
      if (s.properties?.title != null && s.properties.sheetId != null) {
        tabIdCache[s.properties.title] = s.properties.sheetId;
      }
    }
  }
  const gid = tabIdCache[tab];
  if (gid === undefined) {
    throw new SheetsError(
      `A aba "${tab}" não existe na planilha. Rode \`npm run init-sheet\` para criá-la.`
    );
  }
  return gid;
}

/**
 * Exclui a linha cujo `id` bate, usando batchUpdate/deleteDimension
 * (remove a linha de verdade, sem deixar buracos na planilha).
 */
export async function deleteRowById(tab: TabName, id: string): Promise<boolean> {
  const { rows, rowNumbers } = await readSheet(tab);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return false;

  const rowNumber = rowNumbers[idx]; // 1-based
  try {
    const gid = await getTabGid(tab);
    await getClient().spreadsheets.batchUpdate({
      spreadsheetId: getSheetId(),
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: gid,
                dimension: "ROWS",
                startIndex: rowNumber - 1, // 0-based, inclusivo
                endIndex: rowNumber, // exclusivo
              },
            },
          },
        ],
      },
    });
    return true;
  } catch (err) {
    if (err instanceof SheetsError) throw err;
    throw toFriendlyError(err);
  }
}

// ------------------------------------------------------------
// Bootstrap: cria abas e cabeçalhos que ainda não existem.
// Usado pelo script `npm run init-sheet` e seguro de rodar 2x.
// ------------------------------------------------------------

export async function ensureSheetStructure(): Promise<string[]> {
  const actions: string[] = [];
  try {
    const client = getClient();
    const spreadsheetId = getSheetId();

    const meta = await client.spreadsheets.get({
      spreadsheetId,
      fields: "sheets(properties(sheetId,title))",
    });
    const existing = new Set(
      (meta.data.sheets ?? []).map((s) => s.properties?.title ?? "")
    );

    // 1) Cria as abas que faltam
    const missing = (Object.keys(SHEET_TABS) as TabName[]).filter(
      (t) => !existing.has(t)
    );
    if (missing.length > 0) {
      await client.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: missing.map((title) => ({ addSheet: { properties: { title } } })),
        },
      });
      tabIdCache = null; // invalida o cache de gids
      actions.push(...missing.map((t) => `Aba "${t}" criada`));
    }

    // 2) Escreve o cabeçalho nas abas sem linha 1
    for (const tab of Object.keys(SHEET_TABS) as TabName[]) {
      const res = await client.spreadsheets.values.get({
        spreadsheetId,
        range: `${tab}!1:1`,
      });
      const firstRow = res.data.values?.[0] ?? [];
      if (firstRow.length === 0) {
        await client.spreadsheets.values.update({
          spreadsheetId,
          range: `${tab}!A1`,
          valueInputOption: "RAW",
          requestBody: { values: [[...SHEET_TABS[tab]]] },
        });
        actions.push(`Cabeçalho da aba "${tab}" criado`);
      }
    }
    return actions;
  } catch (err) {
    if (err instanceof SheetsError) throw err;
    throw toFriendlyError(err);
  }
}
