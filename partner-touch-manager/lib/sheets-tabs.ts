// ------------------------------------------------------------
// Definição das abas da planilha e seus cabeçalhos (linha 1).
// Módulo separado (sem dependências) para poder ser usado tanto
// pela integração real (lib/sheets.ts) quanto pelo modo demo.
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
