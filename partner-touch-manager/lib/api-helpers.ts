// Helpers compartilhados pelos Route Handlers (app/api/*).

import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { ZodError } from "zod";
import { SheetsError, SHEET_TABS, type TabName } from "./sheets";
import { sheetTag } from "./data/cached-reads";

/**
 * Revalidação sob demanda após uma escrita: derruba o cache de 10s
 * das abas para a próxima leitura vir fresca da planilha.
 */
export function revalidateAll() {
  for (const tab of Object.keys(SHEET_TABS) as TabName[]) {
    revalidateTag(sheetTag(tab));
  }
  revalidatePath("/", "layout");
}

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Dados inválidos",
        issues: err.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }
  if (err instanceof SheetsError) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
  console.error("Erro inesperado na API:", err);
  return NextResponse.json(
    { error: "Erro inesperado no servidor" },
    { status: 500 }
  );
}
