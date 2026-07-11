// ============================================================
// CRUD de Touches — toda leitura/escrita passa por lib/sheets.ts.
//
// Regra de integridade central: ao criar um touch, a parceria
// correspondente tem `ultima_interacao` e `proximo_followup`
// atualizados automaticamente.
// ============================================================

import { cache } from "react";
import { randomUUID } from "crypto";
import { appendRow, deleteRowById, updateRowById } from "../sheets";
import { readSheetCached } from "./cached-reads";
import type { Touch } from "../types";
import type { TouchInput } from "../schemas";
import {
  formatDateBR,
  inputDateTimeToSheet,
  inputDateToSheet,
  parseSheetDate,
} from "../dates";
import { getParceria, touchParceria } from "./parcerias";

function rowToTouch(row: Record<string, string>): Touch {
  return {
    id: row.id ?? "",
    parceria_id: row.parceria_id ?? "",
    contato_id: row.contato_id ?? "",
    data: row.data ?? "",
    canal: row.canal ?? "",
    tipo: row.tipo ?? "",
    resumo: row.resumo ?? "",
    sentimento: row.sentimento ?? "",
    proxima_acao: row.proxima_acao ?? "",
    data_proxima_acao: row.data_proxima_acao ?? "",
    responsavel: row.responsavel ?? "",
  };
}

/** Todos os touches, mais recentes primeiro. */
export const getTouches = cache(async (): Promise<Touch[]> => {
  const { rows } = await readSheetCached("Touches");
  const touches = rows.filter((r) => r.id).map(rowToTouch);
  touches.sort((a, b) => {
    const da = parseSheetDate(a.data)?.getTime() ?? 0;
    const db = parseSheetDate(b.data)?.getTime() ?? 0;
    return db - da;
  });
  return touches;
});

export async function getTouchesDaParceria(parceriaId: string): Promise<Touch[]> {
  const touches = await getTouches();
  return touches.filter((t) => t.parceria_id === parceriaId);
}

export async function createTouch(input: TouchInput): Promise<Touch> {
  const touch: Touch = {
    id: randomUUID(),
    parceria_id: input.parceria_id,
    contato_id: input.contato_id,
    data: inputDateTimeToSheet(input.data),
    canal: input.canal,
    tipo: input.tipo,
    resumo: input.resumo,
    sentimento: input.sentimento,
    proxima_acao: input.proxima_acao,
    data_proxima_acao: inputDateToSheet(input.data_proxima_acao),
    responsavel: input.responsavel,
  };

  await appendRow("Touches", { ...touch });

  // --- Regra de integridade: atualiza a parceria ---
  // ultima_interacao: só avança (um touch retroativo não "volta" a data).
  const parceria = await getParceria(input.parceria_id);
  const dataTouch = parseSheetDate(touch.data);
  const campos: { ultima_interacao?: string; proximo_followup?: string } = {};

  if (dataTouch) {
    const atual = parseSheetDate(parceria?.ultima_interacao ?? "");
    if (!atual || dataTouch.getTime() >= atual.getTime()) {
      campos.ultima_interacao = formatDateBR(dataTouch);
    }
  }
  // proximo_followup: se o touch definiu prazo da próxima ação, vira o novo follow-up.
  if (touch.data_proxima_acao) {
    campos.proximo_followup = touch.data_proxima_acao;
  }
  if (parceria && Object.keys(campos).length > 0) {
    await touchParceria(parceria.id, campos);
  }

  return touch;
}

export async function updateTouch(
  id: string,
  patch: Partial<TouchInput>
): Promise<Touch | null> {
  const sheetPatch: Record<string, string> = {};
  for (const key of [
    "parceria_id",
    "contato_id",
    "canal",
    "tipo",
    "resumo",
    "sentimento",
    "proxima_acao",
    "responsavel",
  ] as const) {
    if (patch[key] !== undefined) sheetPatch[key] = patch[key]!;
  }
  if (patch.data !== undefined) sheetPatch.data = inputDateTimeToSheet(patch.data);
  if (patch.data_proxima_acao !== undefined)
    sheetPatch.data_proxima_acao = inputDateToSheet(patch.data_proxima_acao);

  const updated = await updateRowById("Touches", id, sheetPatch);
  return updated ? rowToTouch(updated) : null;
}

export async function deleteTouch(id: string): Promise<boolean> {
  return deleteRowById("Touches", id);
}
