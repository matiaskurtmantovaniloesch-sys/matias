// Diretório de contatos captados (item 4.4).

import { getContatos } from "@/lib/data/contatos";
import { getParcerias } from "@/lib/data/parcerias";
import { SheetsError } from "@/lib/sheets";
import { SheetsErrorPanel } from "@/components/sheets-error-panel";
import type { Contato, Parceria } from "@/lib/types";
import { ContatosTable } from "@/components/contatos/contatos-table";
import { ContatoFormModal } from "@/components/contatos/contato-form";

export const dynamic = "force-dynamic";

export default async function ContatosPage() {
  let contatos: Contato[], parcerias: Parceria[];
  try {
    [contatos, parcerias] = await Promise.all([getContatos(), getParcerias()]);
  } catch (err) {
    if (err instanceof SheetsError) return <SheetsErrorPanel message={err.message} />;
    throw err;
  }
  const parceriasMin = parcerias.map((p) => ({ id: p.id, nome: p.nome }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contatos</h1>
          <p className="text-sm text-muted-foreground">
            {contatos.length} contato(s) captado(s) — dados vivos da planilha
          </p>
        </div>
        <ContatoFormModal parcerias={parceriasMin} />
      </div>
      <ContatosTable contatos={contatos} parcerias={parceriasMin} />
    </div>
  );
}
