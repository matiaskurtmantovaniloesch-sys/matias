// Tela de Parcerias (item 4.2) — lê a aba Parcerias do Sheets a cada
// request (revalidate curto dá a sensação de "ao vivo" sem estourar cota).

import { getParcerias } from "@/lib/data/parcerias";
import { avaliarParceria, getRiskDays } from "@/lib/metrics";
import { SheetsError } from "@/lib/sheets";
import { SheetsErrorPanel } from "@/components/sheets-error-panel";
import type { Parceria } from "@/lib/types";
import { ParceriasTable, type LinhaParceria } from "@/components/parcerias/parcerias-table";
import { ParceriaFormModal } from "@/components/parcerias/parceria-form";

export const dynamic = "force-dynamic";

export default async function ParceriasPage() {
  let parcerias: Parceria[];
  try {
    parcerias = await getParcerias();
  } catch (err) {
    if (err instanceof SheetsError) return <SheetsErrorPanel message={err.message} />;
    throw err;
  }
  const riskDays = getRiskDays();

  const linhas: LinhaParceria[] = parcerias.map((p) => {
    const a = avaliarParceria(p, riskDays);
    return { ...p, followupAtrasado: a.followupAtrasado, emRisco: a.emRisco };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Parcerias</h1>
          <p className="text-sm text-muted-foreground">
            {parcerias.length} parceria(s) — dados vivos da planilha
          </p>
        </div>
        <ParceriaFormModal />
      </div>
      <ParceriasTable linhas={linhas} />
    </div>
  );
}
