import { Badge } from "@/components/ui/badge";

// Badges semânticos reutilizados em todas as telas.

export function HealthBadge({ health }: { health: string }) {
  const variant =
    health === "Saudável" ? "success" : health === "Atenção" ? "warning" : health === "Em risco" ? "danger" : "secondary";
  return <Badge variant={variant}>{health || "—"}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "Ativa"
      ? "success"
      : status === "Em negociação"
        ? "warning"
        : status === "Pausada"
          ? "secondary"
          : status === "Encerrada"
            ? "outline"
            : "secondary";
  return <Badge variant={variant}>{status || "—"}</Badge>;
}

export function SentimentoBadge({ sentimento }: { sentimento: string }) {
  const variant =
    sentimento === "Positivo" ? "success" : sentimento === "Negativo" ? "danger" : "secondary";
  return <Badge variant={variant}>{sentimento || "—"}</Badge>;
}

export function DecisorBadge({ decisor }: { decisor: string }) {
  if (decisor !== "Sim") return null;
  return <Badge variant="warning">Decisor</Badge>;
}
