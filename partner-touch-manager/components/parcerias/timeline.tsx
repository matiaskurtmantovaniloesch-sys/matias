// Timeline de touches — o coração da ferramenta (item 4.3).
// Server component: recebe os touches já lidos do Sheets, mais
// recentes no topo.

import {
  CalendarClock,
  Mail,
  MessageCircle,
  Phone,
  PartyPopper,
  Users,
  CircleDot,
} from "lucide-react";
import { SentimentoBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { displayDate, displayDateTime } from "@/lib/dates";
import type { Contato, Touch } from "@/lib/types";

function IconeCanal({ canal }: { canal: string }) {
  const cls = "h-4 w-4";
  switch (canal) {
    case "Reunião":
      return <Users className={cls} />;
    case "Call":
      return <Phone className={cls} />;
    case "E-mail":
      return <Mail className={cls} />;
    case "WhatsApp":
      return <MessageCircle className={cls} />;
    case "Evento":
      return <PartyPopper className={cls} />;
    default:
      return <CircleDot className={cls} />;
  }
}

export function Timeline({
  touches,
  contatos,
}: {
  touches: Touch[];
  contatos: Contato[];
}) {
  const nomeContato = new Map(contatos.map((c) => [c.id, c.nome]));

  if (touches.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nenhum touch registrado ainda. Clique em “Registrar touch” para começar o histórico.
      </p>
    );
  }

  return (
    <ol className="relative space-y-6 border-l pl-6">
      {touches.map((t) => (
        <li key={t.id} className="relative">
          <span className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground">
            <IconeCanal canal={t.canal} />
          </span>
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">{displayDateTime(t.data)}</span>
              <Badge variant="secondary">{t.canal || "—"}</Badge>
              <Badge variant="outline">{t.tipo || "—"}</Badge>
              <SentimentoBadge sentimento={t.sentimento} />
              <span className="ml-auto text-xs text-muted-foreground">
                {t.responsavel}
                {t.contato_id && nomeContato.get(t.contato_id)
                  ? ` · com ${nomeContato.get(t.contato_id)}`
                  : ""}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{t.resumo}</p>
            {(t.proxima_acao || t.data_proxima_acao) && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                Próxima ação: <span className="font-medium text-foreground">{t.proxima_acao || "—"}</span>
                {t.data_proxima_acao && <>até {displayDate(t.data_proxima_acao)}</>}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
