# SiteAnalyzer Pro — SEO · GEO · AEO · Frontend

Extensão Chrome (Manifest V3, Vanilla JS) que analisa qualquer site em quatro
dimensões — **SEO**, **GEO** (Generative Engine Optimization), **AEO** (Answer
Engine Optimization) e **Frontend Visual** — usando a API da **Groq**
(`llama-3.3-70b-versatile`) como motor de IA, com relatório completo em HTML e
exportação em **PDF**.

## Instalação (modo desenvolvedor)

1. *(Opcional, para exportação direta de PDF)* baixe as libs:
   `bash libs/baixar-libs.sh` — veja `libs/README.md`.
2. Abra `chrome://extensions`, ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione a pasta
   `extensao-analise-seo/`.
4. Abra o popup, informe sua **Groq API Key**
   (gratuita em https://console.groq.com/keys) e clique em
   **Salvar e Continuar**.
5. Navegue até qualquer site e clique em **🔍 Analisar Este Site**.

## Como funciona

```
popup (UI, 4 telas)
  │ COLETAR_DADOS            ┌──────────────────────────────┐
  ├──────────────────────────► content-script.js            │
  │                           │ extrai ~120 sinais do DOM   │
  │ ANALISAR (dados)          └──────────────────────────────┘
  ├──────────────────────────► service-worker.js
  │                             ├─ cache 24h por domínio
  │                             ├─ fila p/ rate limit
  │                             ├─ Groq API (retry 2x + backoff,
  │                             │  fallback llama-3.1-8b-instant)
  │                             └─ histórico (10 análises)
  └─ report/report.html ◄────── renderiza JSON + exporta PDF
```

- **Coleta** (`content/content-script.js`): metatags, Open Graph, Twitter
  Cards, headings, imagens/alt, links, schemas LD+JSON (com validação de
  campos obrigatórios), NAP, E-E-A-T, FAQ, breadcrumbs, Core Web Vitals
  estimados, CTAs, formulários, acessibilidade etc. Tolerante a falhas:
  coleta o que conseguir e reporta limitações.
- **IA** (`background/service-worker.js` + `config/groq-config.js`): prompt
  estruturado que exige relatório JSON completo, com timeout de 60s, 2
  retries com backoff exponencial (2s/4s), fallback `llama-3.1-8b-instant`
  e re-parse tolerante de JSON (cercas de código, vírgulas penduradas).
- **Cache**: análises ficam válidas por 24h por domínio; o popup oferece
  "Forçar nova análise".
- **Relatório** (`report/`): página dark-mode com scores, E-E-A-T, planos de
  ação priorizados, timeline de 90 dias e KPIs. Botão fixo **Exportar PDF**
  (jsPDF + html2canvas; sem as libs, cai no diálogo nativo de impressão).

## Segurança e privacidade

- A API Key é gravada em `chrome.storage.local` com ofuscação XOR+Base64
  (**não** é criptografia forte — uma extensão client-side não tem onde
  esconder segredos) e nunca é logada no console.
- Os dados extraídos da página analisada (texto, metadados, estrutura) são
  enviados à API da Groq — o aviso é exibido na tela de configuração e no
  rodapé do popup.

## Estrutura

```
extensao-analise-seo/
├── manifest.json              # MV3
├── popup/                     # UI: config, dashboard, progresso, resultado
├── background/service-worker.js  # Groq, cache, histórico, fila
├── content/content-script.js  # coleta SEO/GEO/AEO/Frontend
├── config/groq-config.js      # modelo, prompt, (des)ofuscação da key
├── report/                    # relatório completo + exportação PDF
├── libs/                      # jsPDF + html2canvas (ver libs/README.md)
├── icons/                     # gerados por tools/gerar-icones.py
└── tools/gerar-icones.py
```

## Teste rápido

Carregue a extensão e analise sites de nichos diferentes (e-commerce, blog,
serviço local, SaaS, institucional) para validar a identificação de nicho e a
especificidade das sugestões.
