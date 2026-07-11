"use client";

// ============================================================
// Modal global "Registrar touch" (item 4.5 da spec).
// Acessível de qualquer tela via contexto: useTouchModal().open()
// — a sidebar e o detalhe da parceria usam o mesmo modal.
// Ao salvar: POST /api/touches → grava no Sheets → atualiza a
// parceria → fecha o modal → router.refresh() revalida a tela.
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { touchInputSchema } from "@/lib/schemas";
import {
  CANAIS_TOUCH,
  SENTIMENTOS_TOUCH,
  TIPOS_TOUCH,
  type Contato,
  type Parceria,
} from "@/lib/types";

interface TouchModalContextValue {
  open: (parceriaId?: string) => void;
}

const TouchModalContext = React.createContext<TouchModalContextValue | null>(null);

export function useTouchModal(): TouchModalContextValue {
  const ctx = React.useContext(TouchModalContext);
  if (!ctx) throw new Error("useTouchModal precisa do TouchModalProvider");
  return ctx;
}

function nowLocalInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const emptyForm = {
  parceria_id: "",
  contato_id: "",
  data: "",
  canal: "Reunião",
  tipo: "Alinhamento",
  resumo: "",
  sentimento: "Positivo",
  proxima_acao: "",
  data_proxima_acao: "",
  responsavel: "",
};

export function TouchModalProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [form, setForm] = React.useState({ ...emptyForm });
  const [parcerias, setParcerias] = React.useState<Parceria[]>([]);
  const [contatos, setContatos] = React.useState<Contato[]>([]);
  const [busca, setBusca] = React.useState("");
  const [mostrarLista, setMostrarLista] = React.useState(false);
  const [carregando, setCarregando] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [erros, setErros] = React.useState<Record<string, string>>({});

  const open = React.useCallback((parceriaId?: string) => {
    setForm({ ...emptyForm, data: nowLocalInput(), parceria_id: parceriaId ?? "" });
    setBusca("");
    setErro(null);
    setErros({});
    setIsOpen(true);
    setCarregando(true);
    // Uma leitura por aba, já cacheada no servidor — sem N+1.
    Promise.all([
      fetch("/api/parcerias").then((r) => r.json()),
      fetch("/api/contatos").then((r) => r.json()),
    ])
      .then(([ps, cs]) => {
        if (Array.isArray(ps)) {
          setParcerias(ps);
          if (parceriaId) {
            const p = ps.find((x: Parceria) => x.id === parceriaId);
            if (p) setBusca(p.nome);
          }
        } else {
          setErro(ps?.error ?? "Erro ao carregar parcerias");
        }
        if (Array.isArray(cs)) setContatos(cs);
      })
      .catch(() => setErro("Erro de rede ao carregar parcerias"))
      .finally(() => setCarregando(false));
  }, []);

  const set = (campo: string, valor: string) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const parceriasFiltradas = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return parcerias;
    return parcerias.filter((p) => p.nome.toLowerCase().includes(q));
  }, [busca, parcerias]);

  const contatosDaParceria = React.useMemo(
    () => contatos.filter((c) => c.parceria_id === form.parceria_id),
    [contatos, form.parceria_id]
  );

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setErros({});

    const parsed = touchInputSchema.safeParse(form);
    if (!parsed.success) {
      const map: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        map[issue.path.join(".")] = issue.message;
      }
      setErros(map);
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch("/api/touches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Erro ao salvar o touch");
      }
      setIsOpen(false);
      router.refresh(); // revalida a tela atual com os dados novos do Sheets
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar o touch");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <TouchModalContext.Provider value={{ open }}>
      {children}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Registrar touch</DialogTitle>
            <DialogDescription>
              O touch é gravado na planilha e a parceria tem a última interação
              atualizada automaticamente.
            </DialogDescription>
          </DialogHeader>

          {erro && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erro}
            </p>
          )}

          <form onSubmit={salvar} className="grid gap-4">
            {/* Parceria — autocomplete simples */}
            <div className="relative grid gap-1.5">
              <Label htmlFor="touch-parceria">Parceria *</Label>
              <Input
                id="touch-parceria"
                placeholder={carregando ? "Carregando parcerias…" : "Digite para buscar…"}
                value={busca}
                autoComplete="off"
                onChange={(e) => {
                  setBusca(e.target.value);
                  set("parceria_id", "");
                  set("contato_id", "");
                  setMostrarLista(true);
                }}
                onFocus={() => setMostrarLista(true)}
                onBlur={() => setTimeout(() => setMostrarLista(false), 150)}
              />
              {mostrarLista && parceriasFiltradas.length > 0 && (
                <ul className="absolute top-full z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover py-1 shadow-md">
                  {parceriasFiltradas.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
                        onMouseDown={() => {
                          set("parceria_id", p.id);
                          setBusca(p.nome);
                          setMostrarLista(false);
                        }}
                      >
                        {p.nome}
                        <span className="ml-2 text-xs text-muted-foreground">{p.tipo}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {erros.parceria_id && (
                <p className="text-xs text-destructive">{erros.parceria_id}</p>
              )}
            </div>

            {/* Contato (opcional) */}
            <div className="grid gap-1.5">
              <Label htmlFor="touch-contato">Contato (opcional)</Label>
              <Select
                id="touch-contato"
                value={form.contato_id}
                onChange={(e) => set("contato_id", e.target.value)}
                disabled={!form.parceria_id}
              >
                <option value="">— Nenhum —</option>
                {contatosDaParceria.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                    {c.cargo ? ` (${c.cargo})` : ""}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="touch-data">Data e hora *</Label>
                <Input
                  id="touch-data"
                  type="datetime-local"
                  value={form.data}
                  onChange={(e) => set("data", e.target.value)}
                />
                {erros.data && <p className="text-xs text-destructive">{erros.data}</p>}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="touch-responsavel">Responsável *</Label>
                <Input
                  id="touch-responsavel"
                  placeholder="Quem conduziu"
                  value={form.responsavel}
                  onChange={(e) => set("responsavel", e.target.value)}
                />
                {erros.responsavel && (
                  <p className="text-xs text-destructive">{erros.responsavel}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="touch-canal">Canal *</Label>
                <Select
                  id="touch-canal"
                  value={form.canal}
                  onChange={(e) => set("canal", e.target.value)}
                >
                  {CANAIS_TOUCH.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="touch-tipo">Tipo *</Label>
                <Select
                  id="touch-tipo"
                  value={form.tipo}
                  onChange={(e) => set("tipo", e.target.value)}
                >
                  {TIPOS_TOUCH.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="touch-sentimento">Sentimento *</Label>
                <Select
                  id="touch-sentimento"
                  value={form.sentimento}
                  onChange={(e) => set("sentimento", e.target.value)}
                >
                  {SENTIMENTOS_TOUCH.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="touch-resumo">O que aconteceu? *</Label>
              <Textarea
                id="touch-resumo"
                rows={3}
                placeholder="Resumo da interação…"
                value={form.resumo}
                onChange={(e) => set("resumo", e.target.value)}
              />
              {erros.resumo && <p className="text-xs text-destructive">{erros.resumo}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="touch-proxima">Próxima ação</Label>
                <Input
                  id="touch-proxima"
                  placeholder="Próximo passo combinado"
                  value={form.proxima_acao}
                  onChange={(e) => set("proxima_acao", e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="touch-prazo">Prazo da próxima ação</Label>
                <Input
                  id="touch-prazo"
                  type="date"
                  value={form.data_proxima_acao}
                  onChange={(e) => set("data_proxima_acao", e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando}>
                {salvando && <Loader2 className="animate-spin" />}
                {salvando ? "Gravando na planilha…" : "Salvar touch"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </TouchModalContext.Provider>
  );
}
