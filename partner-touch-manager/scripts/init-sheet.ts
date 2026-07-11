// ============================================================
// npm run init-sheet
// Bootstrap da planilha: cria as abas Parcerias, Contatos e
// Touches (com cabeçalhos) caso ainda não existam.
// Seguro de rodar mais de uma vez — não apaga nada.
// ============================================================

import { config } from "dotenv";
config({ path: ".env.local" });
config(); // fallback para .env

async function main() {
  // Import dinâmico para garantir que o dotenv rode antes do módulo ler o env.
  const { ensureSheetStructure } = await import("../lib/sheets");

  console.log("Verificando a estrutura da planilha…");
  const actions = await ensureSheetStructure();

  if (actions.length === 0) {
    console.log("✔ Tudo certo — as 3 abas já existem com cabeçalhos.");
  } else {
    for (const a of actions) console.log(`✔ ${a}`);
    console.log("✔ Planilha pronta para uso.");
  }
}

main().catch((err) => {
  console.error(`✖ ${err?.message ?? err}`);
  process.exit(1);
});
