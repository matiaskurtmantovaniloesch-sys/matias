// ============================================================
// CRUD de Contatos — toda leitura/escrita passa por lib/sheets.ts.
// ============================================================

import { cache } from "react";
import { randomUUID } from "crypto";
import { appendRow, deleteRowById, updateRowById } from "../sheets";
import { readSheetCached } from "./cached-reads";
import type { Contato } from "../types";
import type { ContatoInput } from "../schemas";

function rowToContato(row: Record<string, string>): Contato {
  return {
    id: row.id ?? "",
    parceria_id: row.parceria_id ?? "",
    nome: row.nome ?? "",
    cargo: row.cargo ?? "",
    email: row.email ?? "",
    telefone: row.telefone ?? "",
    linkedin: row.linkedin ?? "",
    origem: row.origem ?? "",
    decisor: row.decisor ?? "Não",
    notas: row.notas ?? "",
  };
}

export const getContatos = cache(async (): Promise<Contato[]> => {
  const { rows } = await readSheetCached("Contatos");
  return rows.filter((r) => r.id).map(rowToContato);
});

export async function getContatosDaParceria(
  parceriaId: string
): Promise<Contato[]> {
  const contatos = await getContatos();
  return contatos.filter((c) => c.parceria_id === parceriaId);
}

export async function createContato(input: ContatoInput): Promise<Contato> {
  const contato: Contato = {
    id: randomUUID(),
    parceria_id: input.parceria_id,
    nome: input.nome,
    cargo: input.cargo,
    email: input.email,
    telefone: input.telefone,
    linkedin: input.linkedin,
    origem: input.origem,
    decisor: input.decisor,
    notas: input.notas,
  };
  await appendRow("Contatos", { ...contato });
  return contato;
}

export async function updateContato(
  id: string,
  patch: Partial<ContatoInput>
): Promise<Contato | null> {
  const sheetPatch: Record<string, string> = {};
  for (const key of [
    "parceria_id",
    "nome",
    "cargo",
    "email",
    "telefone",
    "linkedin",
    "origem",
    "decisor",
    "notas",
  ] as const) {
    if (patch[key] !== undefined) sheetPatch[key] = patch[key]!;
  }
  const updated = await updateRowById("Contatos", id, sheetPatch);
  return updated ? rowToContato(updated) : null;
}

export async function deleteContato(id: string): Promise<boolean> {
  return deleteRowById("Contatos", id);
}
