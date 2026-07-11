// ============================================================
// Tipos das entidades — espelham exatamente as colunas das abas
// da planilha do Google Sheets (ver README, seção "Estrutura das abas").
// Todos os campos são string porque o Sheets devolve tudo como texto;
// datas ficam no formato dd/MM/yyyy (ou dd/MM/yyyy HH:mm em touches).
// ============================================================

export interface Parceria {
  id: string;
  nome: string;
  tipo: string;
  status: string;
  responsavel: string;
  data_inicio: string;
  health: string;
  ultima_interacao: string;
  proximo_followup: string;
  notas: string;
}

export interface Contato {
  id: string;
  parceria_id: string;
  nome: string;
  cargo: string;
  email: string;
  telefone: string;
  linkedin: string;
  origem: string;
  decisor: string; // "Sim" | "Não"
  notas: string;
}

export interface Touch {
  id: string;
  parceria_id: string;
  contato_id: string;
  data: string;
  canal: string;
  tipo: string;
  resumo: string;
  sentimento: string;
  proxima_acao: string;
  data_proxima_acao: string;
  responsavel: string;
}

// ------------------------------------------------------------
// Vocabulários controlados (usados em selects e validação Zod)
// ------------------------------------------------------------

export const TIPOS_PARCERIA = [
  "Estratégica",
  "Comercial",
  "Institucional",
  "Mídia",
  "Comunidade",
] as const;

export const STATUS_PARCERIA = [
  "Ativa",
  "Em negociação",
  "Pausada",
  "Encerrada",
] as const;

export const HEALTH_PARCERIA = ["Saudável", "Atenção", "Em risco"] as const;

export const CANAIS_TOUCH = [
  "Reunião",
  "Call",
  "E-mail",
  "WhatsApp",
  "Evento",
  "Outro",
] as const;

export const TIPOS_TOUCH = [
  "Alinhamento",
  "Follow-up",
  "Negociação",
  "Suporte",
  "Social",
  "Onboarding",
] as const;

export const SENTIMENTOS_TOUCH = ["Positivo", "Neutro", "Negativo"] as const;

export type Health = (typeof HEALTH_PARCERIA)[number];
export type Sentimento = (typeof SENTIMENTOS_TOUCH)[number];
