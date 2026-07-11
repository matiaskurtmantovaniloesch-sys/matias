// ============================================================
// Modo demonstração — usado automaticamente quando as credenciais
// do Google ainda NÃO foram configuradas no .env.local.
// Os dados vivem só na memória (somem ao reiniciar o servidor) e
// as datas são relativas a hoje, para o dashboard nascer "vivo".
// Assim que o .env.local for preenchido, este módulo deixa de ser
// usado e a planilha real assume (ver lib/sheets.ts).
// ============================================================

import { SHEET_TABS, type TabName } from "./sheets-tabs";
import { formatDateBR, hojeSP } from "./dates";

function diasAtras(n: number): string {
  const h = hojeSP();
  return formatDateBR(new Date(h.getFullYear(), h.getMonth(), h.getDate() - n));
}

function emDias(n: number): string {
  return diasAtras(-n);
}

function seed(): Record<TabName, string[][]> {
  return {
    Parcerias: [
      [...SHEET_TABS.Parcerias],
      ["p1", "TechCorp Brasil", "Estratégica", "Ativa", "Ana Souza", diasAtras(180), "Saudável", diasAtras(3), emDias(7), "Parceria de co-marketing. (Dado de demonstração)"],
      ["p2", "Instituto Verde", "Institucional", "Ativa", "Bruno Lima", diasAtras(120), "Atenção", diasAtras(21), diasAtras(6), "Renovação em discussão."],
      ["p3", "Mídia Plus", "Mídia", "Em negociação", "Ana Souza", diasAtras(40), "Saudável", diasAtras(2), emDias(14), ""],
      ["p4", "Comunidade Dev BR", "Comunidade", "Ativa", "Carla Reis", diasAtras(150), "Em risco", diasAtras(52), diasAtras(10), "Sem retorno do contato principal."],
      ["p5", "LogiPar", "Comercial", "Pausada", "Bruno Lima", diasAtras(80), "Atenção", "", "", ""],
    ],
    Contatos: [
      [...SHEET_TABS.Contatos],
      ["c1", "p1", "Marina Alves", "Head de Parcerias", "marina@techcorp.com.br", "(11) 98888-1111", "https://linkedin.com/in/marina", "Evento", "Sim", "Contato principal"],
      ["c2", "p1", "Pedro Santos", "Analista de Alianças", "pedro@techcorp.com.br", "", "", "Indicação", "Não", ""],
      ["c3", "p2", "Julia Nunes", "Diretora", "julia@verde.org", "(21) 97777-2222", "https://linkedin.com/in/julia", "Inbound", "Sim", ""],
      ["c4", "p4", "Rafael Costa", "Organizador", "rafa@devbr.com", "", "", "Evento", "Não", ""],
    ],
    Touches: [
      [...SHEET_TABS.Touches],
      ["t1", "p1", "c1", `${diasAtras(3)} 14:00`, "Reunião", "Alinhamento", "Kickoff da campanha do trimestre, tudo aprovado.", "Positivo", "Enviar cronograma", emDias(7), "Ana Souza"],
      ["t2", "p1", "c2", `${diasAtras(10)} 10:30`, "E-mail", "Follow-up", "Follow-up dos materiais de marca.", "Neutro", "", "", "Ana Souza"],
      ["t3", "p2", "c3", `${diasAtras(21)} 16:00`, "Call", "Negociação", "Discutimos a renovação; pediram desconto.", "Negativo", "Levar proposta revisada", diasAtras(6), "Bruno Lima"],
      ["t4", "p3", "", `${diasAtras(2)} 11:00`, "Reunião", "Onboarding", "Primeira reunião de escopo.", "Positivo", "Assinar termo", emDias(14), "Ana Souza"],
      ["t5", "p4", "c4", `${diasAtras(52)} 09:00`, "WhatsApp", "Social", "Mensagem de aniversário da comunidade.", "Positivo", "", "", "Carla Reis"],
      ["t6", "p1", "c1", `${diasAtras(17)} 15:00`, "Evento", "Social", "Encontro no evento do setor.", "Positivo", "", "", "Carla Reis"],
      ["t7", "p2", "c3", `${diasAtras(31)} 10:00`, "Reunião", "Alinhamento", "Revisão de metas do semestre.", "Neutro", "", "", "Bruno Lima"],
      ["t8", "p1", "", `${diasAtras(24)} 09:00`, "Call", "Suporte", "Ajuda com a integração.", "Neutro", "", "", "Bruno Lima"],
    ],
  };
}

// Armazenado em globalThis para sobreviver a múltiplos bundles/HMR
// dentro do mesmo processo do servidor.
const g = globalThis as unknown as { __demoDb?: Record<TabName, string[][]> };

export function demoDb(): Record<TabName, string[][]> {
  if (!g.__demoDb) g.__demoDb = seed();
  return g.__demoDb;
}
