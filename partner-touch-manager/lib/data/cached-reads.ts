// ============================================================
// Cache curto das leituras do Sheets (cota: 60 req/min).
// Cada aba é cacheada por 10s (sensação de "ao vivo") e marcada
// com uma tag — toda escrita chama revalidateTag e a próxima
// leitura busca dados frescos na planilha imediatamente.
// ============================================================

import { unstable_cache } from "next/cache";
import { readSheet, type SheetData, type TabName } from "../sheets";

export const REVALIDATE_SECONDS = 10;

export function sheetTag(tab: TabName): string {
  return `sheet-${tab}`;
}

const readers: Record<TabName, () => Promise<SheetData>> = {
  Parcerias: unstable_cache(() => readSheet("Parcerias"), ["sheet-Parcerias"], {
    revalidate: REVALIDATE_SECONDS,
    tags: [sheetTag("Parcerias")],
  }),
  Contatos: unstable_cache(() => readSheet("Contatos"), ["sheet-Contatos"], {
    revalidate: REVALIDATE_SECONDS,
    tags: [sheetTag("Contatos")],
  }),
  Touches: unstable_cache(() => readSheet("Touches"), ["sheet-Touches"], {
    revalidate: REVALIDATE_SECONDS,
    tags: [sheetTag("Touches")],
  }),
};

export function readSheetCached(tab: TabName): Promise<SheetData> {
  return readers[tab]();
}
