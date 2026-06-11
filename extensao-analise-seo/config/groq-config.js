// =====================================================================
// SiteAnalyzer Pro — Configuração da API Groq
// Carregado via importScripts() no service worker e <script> no popup.
// =====================================================================

const GROQ_CONFIG = {
  endpoint: 'https://api.groq.com/openai/v1/chat/completions',
  modelo: 'llama-3.3-70b-versatile',
  modeloFallback: 'llama-3.1-8b-instant',
  temperatura: 0.3,
  // O relatório completo é longo; com limite baixo a resposta é truncada e
  // o modo json_object da Groq rejeita com HTTP 400 (json_validate_failed).
  maxTokens: 16384,
  timeoutMs: 60000,
  tentativas: 3,           // 1 chamada + 2 retries com backoff
  backoffBaseMs: 2000,
  urlObterKey: 'https://console.groq.com/keys',
  cacheHoras: 24,
  historicoMax: 10,
};

// Obfuscação simples da API key antes de gravar no chrome.storage.local.
// Atenção: NÃO é criptografia forte — uma extensão client-side não tem
// onde esconder um segredo. Serve apenas para evitar exposição casual.
const GROQ_KEY_XOR = 'SiteAnalyzerPro2024';

function ofuscarKey(key) {
  const x = Array.from(key).map((c, i) =>
    String.fromCharCode(c.charCodeAt(0) ^ GROQ_KEY_XOR.charCodeAt(i % GROQ_KEY_XOR.length)));
  return btoa(x.join(''));
}

function desofuscarKey(blob) {
  try {
    const x = atob(blob);
    return Array.from(x).map((c, i) =>
      String.fromCharCode(c.charCodeAt(0) ^ GROQ_KEY_XOR.charCodeAt(i % GROQ_KEY_XOR.length))).join('');
  } catch {
    return null;
  }
}

// Esqueleto do relatório esperado — mantido como string para o prompt.
const FORMATO_RELATORIO = `{
  "nicho": "identifique o nicho/segmento do site com base no conteúdo",
  "nichoDetalhado": "descrição detalhada do nicho, público-alvo e posicionamento percebido",
  "urlAnalisada": "url completa",
  "dataAnalise": "data atual",

  "scoreGeral": 0-100,
  "scoreSEO": 0-100,
  "scoreGEO": 0-100,
  "scoreAEO": 0-100,
  "scoreFrontend": 0-100,

  "resumoExecutivo": "parágrafo de 3-5 linhas com o panorama geral do site",

  "seo": {
    "pontuacao": 0-100,
    "nivel": "Crítico | Ruim | Regular | Bom | Excelente",
    "resumo": "análise geral do SEO em 2-3 parágrafos",
    "metatags": {
      "title": { "status": "presente | ausente | otimizado | precisa melhorar", "valor": "valor atual", "comprimento": 0, "analise": "análise detalhada se está ideal (50-60 chars), se tem a palavra-chave principal, se é atrativo para cliques", "sugestao": "sugestão de title otimizado para o nicho identificado" },
      "metaDescription": { "status": "...", "valor": "...", "comprimento": 0, "analise": "análise do meta description (ideal 150-160 chars), CTR esperado, inclusão de call-to-action", "sugestao": "sugestão otimizada" },
      "openGraph": { "status": "completo | incompleto | ausente", "camposPresentes": [], "camposFaltantes": [], "analise": "análise do impacto no compartilhamento social", "sugestoes": [] },
      "twitterCards": { "status": "...", "analise": "...", "sugestoes": [] }
    },
    "estruturaHeadings": { "status": "...", "h1Count": 0, "analise": "análise da hierarquia de headings, uso de palavras-chave, estrutura lógica", "problemas": [], "sugestoes": [] },
    "palavrasChave": { "principaisPalavrasIdentificadas": [], "densidadeAnalisada": "análise da densidade e distribuição natural das palavras-chave no conteúdo", "oportunidades": [], "palavrasChaveRecomendadasParaNicho": [], "longTails": [] },
    "conteudo": { "wordCount": 0, "qualidade": "análise da profundidade e qualidade do conteúdo para o nicho", "legibilidade": "análise da legibilidade e estrutura", "sugestoes": [] },
    "links": { "internos": 0, "externos": 0, "analise": "análise da estratégia de linkagem interna e externa", "sugestoes": [] },
    "imagens": { "total": 0, "semAlt": 0, "analise": "análise do uso de alt text, nomes de arquivo, tamanhos", "sugestoes": [] },
    "dadosEstruturados": { "schemaTiposPresentes": [], "schemaTiposFaltantes": ["liste os schemas mais importantes para o nicho identificado"], "analise": "análise detalhada dos schemas presentes e ausentes", "sugestoesSchema": [] },
    "seoTecnico": { "https": true, "canonical": "status e análise", "robots": "status e análise", "sitemap": "recomendações", "velocidade": "análise com base nos dados coletados", "mobile": "análise da compatibilidade mobile", "hreflang": "status e análise", "problemasCriticos": [], "sugestoes": [] },
    "planoDeAcaoSEO": [ { "prioridade": "Alta | Média | Baixa", "acao": "descrição clara da ação", "impactoEsperado": "descrição do impacto", "prazo": "Imediato | 1-2 semanas | 1 mês | 3 meses" } ]
  },

  "geo": {
    "pontuacao": 0-100,
    "nivel": "...",
    "resumo": "análise geral do GEO em 2-3 parágrafos",
    "eeat": {
      "experiencia": { "status": "...", "analise": "análise dos sinais de experiência real (cases, portfólio, projetos realizados)", "sugestoes": [] },
      "expertise": { "status": "...", "analise": "análise dos sinais de expertise (certificações, especializações, conteúdo técnico)", "sugestoes": [] },
      "autoridade": { "status": "...", "analise": "análise da autoridade (citações, menções, links de qualidade, reconhecimentos)", "sugestoes": [] },
      "confiabilidade": { "status": "...", "analise": "análise da confiabilidade (HTTPS, políticas, transparência, contato, avaliações)", "sugestoes": [] }
    },
    "otimizacaoParaIAGenerativa": { "analise": "análise de como o site está posicionado para ser citado por ChatGPT, Perplexity, Gemini, Claude", "pontosFavoraveis": [], "pontosDesMelhoria": [], "estrategiasGEO": ["liste 8-12 estratégias específicas para o nicho para aparecer em respostas de IA"] },
    "presencaDigital": { "analise": "análise da presença digital além do site (redes sociais, diretórios, citações)", "sugestoes": [] },
    "nap": { "status": "...", "analise": "análise da consistência de Name, Address, Phone", "sugestoes": [] },
    "conteudoParaGEO": { "topicosRecomendados": [], "formatosIdeal": [], "abordagemRecomendada": "" },
    "planoDeAcaoGEO": [ { "prioridade": "...", "acao": "...", "impactoEsperado": "...", "prazo": "..." } ]
  },

  "aeo": {
    "pontuacao": 0-100,
    "nivel": "...",
    "resumo": "análise geral do AEO",
    "featuredSnippets": { "potencial": "alto | médio | baixo", "analise": "análise do potencial para featured snippets baseado no conteúdo e estrutura", "estruturasPresentes": [], "estruturasFaltantes": [], "sugestoes": [] },
    "faq": { "temFAQSchema": false, "qualidadePerguntas": "análise das perguntas existentes", "perguntasRecomendadasParaNicho": ["liste 10-15 perguntas que o público do nicho frequentemente busca"], "comoImplementar": "" },
    "dadosEstruturadosAEO": { "schemasParaAEO": [], "implementacaoRecomendada": [] },
    "otimizacaoParaBuscaVoice": { "analise": "análise da otimização para busca por voz", "sugestoes": [] },
    "respostasDirectas": { "analise": "análise da capacidade do site de fornecer respostas diretas e concisas", "formatosRecomendados": [], "exemplosDeConteudo": [] },
    "knowledgeGraph": { "analise": "análise da preparação para o Knowledge Graph do Google", "sugestoes": [] },
    "planoDeAcaoAEO": [ { "prioridade": "...", "acao": "...", "impactoEsperado": "...", "prazo": "..." } ]
  },

  "frontend": {
    "pontuacao": 0-100,
    "nivel": "...",
    "resumo": "análise geral do frontend visual e técnico",
    "uxUI": { "primeiraImpressao": "análise da primeira impressão visual com base nos dados coletados", "hierarquiaVisual": "análise da hierarquia visual e fluxo de atenção", "consistencia": "análise da consistência visual", "sugestoes": [] },
    "performance": { "analise": "análise de performance com base nos dados disponíveis", "coreWebVitals": { "lcpEstimado": "estimativa e recomendações", "fidRecomendacoes": [], "clsRecomendacoes": [] }, "otimizacoes": [] },
    "mobile": { "status": "...", "analise": "análise da experiência mobile", "sugestoes": [] },
    "acessibilidade": { "pontuacao": 0-100, "problemas": [], "sugestoes": [] },
    "conversao": { "ctas": "análise dos CTAs presentes", "formularios": "análise dos formulários", "elementos": "análise de elementos de conversão (depoimentos, selos, garantias)", "sugestoes": [] },
    "velocidade": { "analise": "análise técnica da velocidade de carregamento", "scripts": 0, "otimizacoes": [] },
    "seguranca": { "https": true, "analise": "análise de segurança", "sugestoes": [] },
    "planoDeAcaoFrontend": [ { "prioridade": "...", "acao": "...", "impactoEsperado": "...", "prazo": "..." } ]
  },

  "competitividade": { "posicionamentoAtual": "análise do posicionamento competitivo baseado nos dados técnicos", "diferenciais": [], "vulnerabilidades": [], "oportunidadesDeMercado": [] },

  "planoDeAcaoMestral": {
    "mes1": { "foco": "título do foco", "acoes": [] },
    "mes2": { "foco": "...", "acoes": [] },
    "mes3": { "foco": "...", "acoes": [] }
  },

  "kpis": { "kpisParaMonitorar": [], "ferramentasRecomendadas": [], "metasRealistasSugeridasEm90Dias": [] }
}`;

function montarPromptGroq(dados) {
  const { seoData = {}, geoData = {}, aeoData = {}, frontendData = {}, limitacoes = [] } = dados;
  return `
Você é um especialista sênior em SEO, GEO (Generative Engine Optimization), AEO (Answer Engine Optimization), UX/UI e Marketing Digital.
Analise profundamente os dados técnicos do site abaixo e produza um relatório COMPLETO, DETALHADO e PROFISSIONAL.

## DADOS DO SITE ANALISADO
URL: ${seoData.url || 'desconhecida'}
Domínio: ${seoData.domain || 'desconhecido'}
Data atual: ${new Date().toLocaleDateString('pt-BR')}
${limitacoes.length ? `Limitações da coleta (informe no relatório): ${limitacoes.join('; ')}` : ''}

### DADOS SEO:
${JSON.stringify(seoData, null, 2)}

### DADOS GEO:
${JSON.stringify(geoData, null, 2)}

### DADOS AEO:
${JSON.stringify(aeoData, null, 2)}

### DADOS FRONTEND:
${JSON.stringify(frontendData, null, 2)}

---

## INSTRUÇÕES PARA O RELATÓRIO

Produza um relatório JSON estruturado EXATAMENTE no formato abaixo. Não adicione texto fora do JSON.

${FORMATO_RELATORIO}

IMPORTANTE:
- Seja EXTREMAMENTE específico para o nicho identificado
- Todas as sugestões devem ser ACIONÁVEIS e PRÁTICAS
- Base todas as análises nos dados reais coletados
- O JSON deve ser válido e completo
- Não use linguagem genérica; adapte tudo ao nicho identificado
- Escreva TODO o relatório em Português do Brasil
`;
}

// Disponibiliza no escopo global tanto do service worker quanto do popup
if (typeof globalThis !== 'undefined') {
  globalThis.GROQ_CONFIG = GROQ_CONFIG;
  globalThis.montarPromptGroq = montarPromptGroq;
  globalThis.ofuscarKey = ofuscarKey;
  globalThis.desofuscarKey = desofuscarKey;
}
