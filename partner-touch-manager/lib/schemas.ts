// ============================================================
// Validação com Zod — usada nos Route Handlers (backend) e
// reaproveitada nos formulários do cliente.
// Datas chegam dos inputs como yyyy-MM-dd / yyyy-MM-ddTHH:mm
// e são convertidas para o formato da planilha na camada de dados.
// ============================================================

import { z } from "zod";
import {
  CANAIS_TOUCH,
  HEALTH_PARCERIA,
  SENTIMENTOS_TOUCH,
  STATUS_PARCERIA,
  TIPOS_PARCERIA,
  TIPOS_TOUCH,
} from "./types";

const dataOpcional = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
  .or(z.literal(""))
  .default("");

export const parceriaInputSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome da parceria"),
  tipo: z.enum(TIPOS_PARCERIA, { message: "Tipo inválido" }),
  status: z.enum(STATUS_PARCERIA, { message: "Status inválido" }),
  responsavel: z.string().trim().min(1, "Informe o responsável"),
  data_inicio: dataOpcional,
  health: z.enum(HEALTH_PARCERIA, { message: "Health inválido" }),
  proximo_followup: dataOpcional,
  notas: z.string().trim().default(""),
});

export const parceriaPatchSchema = parceriaInputSchema.partial();

export const contatoInputSchema = z.object({
  parceria_id: z.string().trim().min(1, "Selecione a parceria"),
  nome: z.string().trim().min(1, "Informe o nome do contato"),
  cargo: z.string().trim().default(""),
  email: z
    .string()
    .trim()
    .email("E-mail inválido")
    .or(z.literal(""))
    .default(""),
  telefone: z.string().trim().default(""),
  linkedin: z
    .string()
    .trim()
    .url("URL inválida")
    .or(z.literal(""))
    .default(""),
  origem: z.string().trim().default(""),
  decisor: z.enum(["Sim", "Não"]).default("Não"),
  notas: z.string().trim().default(""),
});

export const contatoPatchSchema = contatoInputSchema.partial();

export const touchInputSchema = z.object({
  parceria_id: z.string().trim().min(1, "Selecione a parceria"),
  contato_id: z.string().trim().default(""),
  // aceita datetime-local (yyyy-MM-ddTHH:mm) ou só data
  data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, "Data inválida"),
  canal: z.enum(CANAIS_TOUCH, { message: "Canal inválido" }),
  tipo: z.enum(TIPOS_TOUCH, { message: "Tipo inválido" }),
  resumo: z.string().trim().min(1, "Descreva o que aconteceu"),
  sentimento: z.enum(SENTIMENTOS_TOUCH, { message: "Sentimento inválido" }),
  proxima_acao: z.string().trim().default(""),
  data_proxima_acao: dataOpcional,
  responsavel: z.string().trim().min(1, "Informe quem conduziu"),
});

export const touchPatchSchema = touchInputSchema.partial();

export type ParceriaInput = z.infer<typeof parceriaInputSchema>;
export type ContatoInput = z.infer<typeof contatoInputSchema>;
export type TouchInput = z.infer<typeof touchInputSchema>;
