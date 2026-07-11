// ============================================================
// CRUD de Parcerias — toda leitura/escrita passa por lib/sheets.ts.
// `getParcerias` usa React cache() para deduplicar leituras dentro
// de um mesmo request (evita N+1 contra a cota da API do Google).
// ============================================================

import { cache } from "react";
import { randomUUID } from "crypto";
import { appendRow, deleteRowById, updateRowById } from "../sheets";
import { readSheetCached } from "./cached-reads";
import type { Parceria } from "../types";
import type { ParceriaInput } from "../schemas";
import { inputDateToSheet } from "../dates";

function rowToParceria(row: Record<string, string>): Parceria {
  return {
    id: row.id ?? "",
    nome: row.nome ?? "",
    tipo: row.tipo ?? "",
    status: row.status ?? "",
    responsavel: row.responsavel ?? "",
    data_inicio: row.data_inicio ?? "",
    health: row.health ?? "",
    ultima_interacao: row.ultima_interacao ?? "",
    proximo_followup: row.proximo_followup ?? "",
    notas: row.notas ?? "",
  };
}

export const getParcerias = cache(async (): Promise<Parceria[]> => {
  const { rows } = await readSheetCached("Parcerias");
  return rows.filter((r) => r.id).map(rowToParceria);
});

export async function getParceria(id: string): Promise<Parceria | null> {
  const parcerias = await getParcerias();
  return parcerias.find((p) => p.id === id) ?? null;
}

export async function createParceria(input: ParceriaInput): Promise<Parceria> {
  const parceria: Parceria = {
    id: randomUUID(),
    nome: input.nome,
    tipo: input.tipo,
    status: input.status,
    responsavel: input.responsavel,
    data_inicio: inputDateToSheet(input.data_inicio),
    health: input.health,
    ultima_interacao: "",
    proximo_followup: inputDateToSheet(input.proximo_followup),
    notas: input.notas,
  };
  await appendRow("Parcerias", { ...parceria });
  return parceria;
}

export async function updateParceria(
  id: string,
  patch: Partial<ParceriaInput>
): Promise<Parceria | null> {
  const sheetPatch: Record<string, string> = {};
  if (patch.nome !== undefined) sheetPatch.nome = patch.nome;
  if (patch.tipo !== undefined) sheetPatch.tipo = patch.tipo;
  if (patch.status !== undefined) sheetPatch.status = patch.status;
  if (patch.responsavel !== undefined) sheetPatch.responsavel = patch.responsavel;
  if (patch.data_inicio !== undefined)
    sheetPatch.data_inicio = inputDateToSheet(patch.data_inicio);
  if (patch.health !== undefined) sheetPatch.health = patch.health;
  if (patch.proximo_followup !== undefined)
    sheetPatch.proximo_followup = inputDateToSheet(patch.proximo_followup);
  if (patch.notas !== undefined) sheetPatch.notas = patch.notas;

  const updated = await updateRowById("Parcerias", id, sheetPatch);
  return updated ? rowToParceria(updated) : null;
}

/** Usado internamente ao registrar um touch (datas já no formato da planilha). */
export async function touchParceria(
  id: string,
  campos: { ultima_interacao?: string; proximo_followup?: string }
): Promise<void> {
  const patch: Record<string, string> = {};
  if (campos.ultima_interacao !== undefined)
    patch.ultima_interacao = campos.ultima_interacao;
  if (campos.proximo_followup !== undefined)
    patch.proximo_followup = campos.proximo_followup;
  if (Object.keys(patch).length > 0) {
    await updateRowById("Parcerias", id, patch);
  }
}

export async function deleteParceria(id: string): Promise<boolean> {
  return deleteRowById("Parcerias", id);
}
