// =====================================================================
// SiteAnalyzer Pro — Configuração da API Groq
// Carregado via importScripts() no service worker e <script> no popup.
// =====================================================================

const GROQ_CONFIG = {
  endpoint: 'https://api.groq.com/openai/v1/chat/completions',
  modelo: 'llama-3.3-70b-versatile',
  modeloFallback: 'llama-3.1-8b-instant',
  temperatura: 0.3,
  // O tier gratuito da Groq limita a 12.000 tokens/minuto (prompt + resposta
  // contam juntos). O orçamento abaixo deixa margem; o max_tokens efetivo é
  // calculado por requisição: orcamentoTPM - tokens estimados do prompt.
  orcamentoTPM: 11000,
  maxTokensTeto: 8000,     // teto da resposta mesmo com prompt pequeno
  maxTokensPiso: 3000,     // mínimo p/ relatório não truncar (json_validate_failed)
  timeoutMs: 60000,
  tentativas: 3,           // 1 chamada + 2 retries com backoff
  backoffBaseMs: 2000,
  urlObterKey: 'https://console.groq.com/keys',
  cacheHoras: 24,
  historicoMax: 10,
};

// Estimativa grosseira de tokens para texto pt-BR/JSON (~3,3 chars/token)
function estimarTokens(texto) {
  return Math.ceil((texto || '').length / 3.3);
}

// ------------------------------------------------------------------
// Compactação dos dados coletados antes de montar o prompt.
// nivel 1: remove campos pesados de baixo valor analítico.
// nivel 2 (ultra): usado após HTTP 413 — mantém apenas o essencial.
// ------------------------------------------------------------------
function compactarDados(dados, nivel) {
  const d = JSON.parse(JSON.stringify(dados || {}));
  const seo = d.seoData || {};
  const geo = d.geoData || {};
  const aeo = d.aeoData || {};
  const fe = d.frontendData || {};
  const corta = (s, n) => (typeof s === 'string' ? s.substring(0, n) : s);
  const fatia = (a, n) => (Array.isArray(a) ? a.slice(0, n) : a);

  // Sempre: o HTML bruto e campos de formulário pesam muito e a IA já
  // recebe os mesmos sinais de forma estruturada.
  delete fe.pageHTML;
  fe.formFields = fatia(fe.formFields, nivel >= 2 ? 0 : 8);
  fe.footerContent = corta(fe.footerContent, nivel >= 2 ? 0 : 200);
  fe.ctaButtons = fatia(fe.ctaButtons, nivel >= 2 ? 5 : 10);
  fe.navItems = fatia(fe.navItems, nivel >= 2 ? 6 : 12);
  fe.fontFamilies = fatia(fe.fontFamilies, 4);

  seo.textContent = corta(seo.textContent, nivel >= 2 ? 600 : 1100);
  seo.schemaRaw = corta(seo.schemaRaw, nivel >= 2 ? 0 : 500);
  seo.imagesAltList = (fatia(seo.imagesAltList, nivel >= 2 ? 0 : 4) || [])
    .map((i) => ({ src: (i.src || '').slice(-60), alt: corta(i.alt, 60) }));
  ['h2', 'h3', 'h4', 'h5', 'h6'].forEach((h) => { seo[h] = fatia(seo[h], nivel >= 2 ? 4 : 8); });
  seo.hreflangTags = fatia(seo.hreflangTags, 6);

  geo.localBusinessSchema = corta(geo.localBusinessSchema, nivel >= 2 ? 0 : 400);

  aeo.faqContent = fatia(aeo.faqContent, nivel >= 2 ? 4 : 10);
  aeo.questionElements = fatia(aeo.questionElements, nivel >= 2 ? 4 : 10);
  aeo.breadcrumbSchema = corta(aeo.breadcrumbSchema, nivel >= 2 ? 0 : 300);
  aeo.sameAsLinks = fatia(aeo.sameAsLinks, 6);
  aeo.schemaValidationIssues = fatia(aeo.schemaValidationIssues, nivel >= 2 ? 4 : 10);

  // Subpáginas: resumo por página (nível 2 mantém só as 2 primeiras)
  d.subpaginas = (fatia(d.subpaginas, nivel >= 2 ? 2 : 5) || []).map((p) => ({
    ...p,
    title: corta(p.title, 80),
    metaDescription: nivel >= 2 ? !!p.metaDescription : corta(p.metaDescription, 120),
    h1: fatia(p.h1, 2),
    schemaTypes: fatia(p.schemaTypes, 5),
  }));

  // Auditoria local: a IA precisa dela para destrinchar as soluções
  d.auditoriaLocal = fatia(d.auditoriaLocal, nivel >= 2 ? 18 : 35);

  return d;
}

// ------------------------------------------------------------------
// Auditoria local: verificações determinísticas sobre os dados coletados.
// Gera a lista de problemas EVIDENCIADOS (com evidência concreta) que a IA
// deve destrinchar com soluções — e que o relatório exibe mesmo sem IA.
// ------------------------------------------------------------------
function gerarAuditoriaLocal(dados) {
  const seo = dados.seoData || {};
  const geo = dados.geoData || {};
  const aeo = dados.aeoData || {};
  const fe = dados.frontendData || {};
  const subs = dados.subpaginas || [];
  const problemas = [];
  const add = (categoria, severidade, problema, evidencia) =>
    problemas.push({ categoria, severidade, problema, evidencia });

  // ----- SEO (página atual) -----
  if (!seo.title) add('SEO', 'Crítico', 'Página sem <title>', 'document.title vazio');
  else if (seo.titleLength < 30) add('SEO', 'Alto', 'Title muito curto', `"${seo.title}" tem ${seo.titleLength} caracteres (ideal 50-60)`);
  else if (seo.titleLength > 65) add('SEO', 'Médio', 'Title muito longo (será cortado na SERP)', `${seo.titleLength} caracteres (ideal 50-60)`);
  if (!seo.metaDescription) add('SEO', 'Alto', 'Meta description ausente', 'Google gera snippet automático, reduzindo CTR');
  else if (seo.metaDescriptionLength < 120 || seo.metaDescriptionLength > 165) add('SEO', 'Médio', 'Meta description fora do tamanho ideal', `${seo.metaDescriptionLength} caracteres (ideal 150-160)`);
  if (!seo.canonicalURL) add('SEO', 'Médio', 'Sem tag canonical', 'Risco de conteúdo duplicado entre variações de URL');
  const h1s = seo.h1 || [];
  if (h1s.length === 0) add('SEO', 'Alto', 'Página sem H1', 'Nenhum <h1> encontrado');
  else if (h1s.length > 1) add('SEO', 'Médio', 'Múltiplos H1 na página', `${h1s.length} H1 encontrados: ${h1s.slice(0, 3).join(' | ')}`);
  if ((seo.imagesWithoutAlt || 0) > 0) add('SEO', 'Médio', 'Imagens sem atributo alt', `${seo.imagesWithoutAlt} de ${seo.totalImages} imagens sem alt`);
  if ((seo.schemaTypes || []).length === 0) add('SEO', 'Alto', 'Nenhum dado estruturado (Schema.org)', 'Sem LD+JSON na página');
  if ((seo.schemaTypes || []).includes('INVÁLIDO')) add('SEO', 'Alto', 'Schema LD+JSON com JSON inválido', 'Bloco não parseável — ignorado pelo Google');
  if (!seo.isHTTPS) add('SEO', 'Crítico', 'Site sem HTTPS', `Protocolo atual: ${seo.protocol}`);
  if (!seo.lang) add('SEO', 'Médio', 'Atributo lang ausente no <html>', 'Buscadores e leitores de tela não identificam o idioma');
  if ((seo.wordCount || 0) < 300) add('SEO', 'Alto', 'Conteúdo raso (thin content)', `Apenas ${seo.wordCount} palavras na página`);
  if ((seo.brokenLinkCandidates || 0) > 0) add('SEO', 'Baixo', 'Links vazios ou com href="#"', `${seo.brokenLinkCandidates} candidatos a link quebrado`);
  if (!seo.ogTitle || !seo.ogDescription || !seo.ogImage) {
    const faltam = [!seo.ogTitle && 'og:title', !seo.ogDescription && 'og:description', !seo.ogImage && 'og:image'].filter(Boolean);
    add('SEO', 'Médio', 'Open Graph incompleto', `Faltam: ${faltam.join(', ')}`);
  }
  if (!seo.twitterCard) add('SEO', 'Baixo', 'Twitter Card ausente', 'meta name="twitter:card" não encontrada');
  if (!seo.hasFavicon) add('SEO', 'Baixo', 'Favicon ausente', 'link rel="icon" não encontrado');

  // ----- SEO (subpáginas) -----
  const titulos = {};
  subs.forEach((p) => {
    if (p.title) (titulos[p.title.toLowerCase()] = titulos[p.title.toLowerCase()] || []).push(p.url);
  });
  if (seo.title) (titulos[seo.title.toLowerCase()] = titulos[seo.title.toLowerCase()] || []).push(seo.url);
  Object.entries(titulos).filter(([, urls]) => urls.length > 1).slice(0, 3).forEach(([t, urls]) => {
    add('SEO', 'Alto', 'Title duplicado entre páginas', `"${t.substring(0, 60)}" em: ${urls.join(' ; ')}`);
  });
  subs.forEach((p) => {
    if (!p.metaDescription) add('SEO', 'Médio', 'Subpágina sem meta description', p.url);
    if (p.h1Count === 0) add('SEO', 'Médio', 'Subpágina sem H1', p.url);
    if (p.h1Count > 1) add('SEO', 'Baixo', 'Subpágina com múltiplos H1', `${p.url} (${p.h1Count} H1)`);
    if (!p.canonical) add('SEO', 'Baixo', 'Subpágina sem canonical', p.url);
    if ((p.imagesWithoutAlt || 0) > 0) add('SEO', 'Baixo', 'Subpágina com imagens sem alt', `${p.url}: ${p.imagesWithoutAlt}/${p.totalImages}`);
    if ((p.wordCount || 0) < 200) add('SEO', 'Médio', 'Subpágina com conteúdo raso', `${p.url}: ${p.wordCount} palavras`);
    if ((p.schemaTypes || []).length === 0) add('SEO', 'Baixo', 'Subpágina sem dados estruturados', p.url);
  });

  // ----- GEO -----
  if (!geo.hasAboutPage) add('GEO', 'Alto', 'Sem página "Sobre/Quem somos"', 'Sinal E-E-A-T de experiência/transparência ausente');
  if (!geo.hasContactPage) add('GEO', 'Alto', 'Sem página de contato visível', 'IAs e usuários não encontram canal de contato');
  if (!geo.hasPrivacyPolicy) add('GEO', 'Médio', 'Sem política de privacidade', 'Sinal de confiabilidade ausente (LGPD)');
  if (!geo.hasAuthorInfo) add('GEO', 'Médio', 'Sem autoria identificável no conteúdo', 'Nenhum marcador de autor (rel=author, .author, Person)');
  if (!geo.hasNAP) add('GEO', 'Médio', 'NAP incompleto (Nome, Endereço, Telefone)', `Encontrado: tel=${geo.napData?.phone || '—'}, end=${geo.napData?.address || '—'}`);
  if (!geo.hasSocialProof) add('GEO', 'Médio', 'Sem prova social no site', 'Nenhum depoimento/avaliação/review detectado');
  if (!aeo.hasSameAs) add('GEO', 'Médio', 'Schema sem sameAs', 'Perfis sociais não conectados ao Knowledge Graph');

  // ----- AEO -----
  if (!aeo.hasFAQSchema) add('AEO', 'Alto', 'Sem FAQ Schema (FAQPage)', 'Site não concorre a rich results de perguntas');
  if ((aeo.questionElements || []).length === 0) add('AEO', 'Médio', 'Nenhum heading em formato de pergunta', 'Headings com "?" são âncora para featured snippets e busca por voz');
  if (!aeo.hasBreadcrumb) add('AEO', 'Médio', 'Sem breadcrumbs', 'Nem BreadcrumbList nem navegação estrutural detectadas');
  if ((aeo.hasConciseAnswers || 0) === 0) add('AEO', 'Médio', 'Sem respostas concisas após headings', 'Nenhum parágrafo <50 palavras após H2/H3 (formato de resposta direta)');
  if ((aeo.hasTableData || 0) === 0 && (aeo.hasNumberedLists || 0) === 0) add('AEO', 'Baixo', 'Sem tabelas nem listas numeradas', 'Estruturas favoritas de featured snippets ausentes');
  if ((aeo.schemaValidationIssues || []).length > 0) add('AEO', 'Alto', 'Schemas com campos obrigatórios faltando', (aeo.schemaValidationIssues || []).slice(0, 3).join('; '));

  // ----- Frontend -----
  if (!fe.hasViewportMeta) add('Frontend', 'Crítico', 'Sem meta viewport', 'Página não responsiva em mobile — penalidade no mobile-first index');
  if (fe.hasMixedContent) add('Frontend', 'Crítico', 'Mixed content (recursos http em página https)', 'Navegadores bloqueiam ou alertam');
  if ((fe.loadTime || 0) > 4000) add('Frontend', 'Alto', 'Carregamento lento', `loadTime ≈ ${fe.loadTime}ms (meta: <2500ms)`);
  if ((fe.totalImages || 0) > 5 && (fe.lazyImages || 0) === 0) add('Frontend', 'Médio', 'Nenhuma imagem com lazy loading', `${fe.totalImages} imagens, 0 com loading="lazy"`);
  if ((fe.totalImages || 0) > 5 && (fe.modernImageFormats || 0) === 0) add('Frontend', 'Médio', 'Sem formatos modernos de imagem', 'Nenhuma imagem WebP/AVIF detectada');
  if ((seo.totalScripts || 0) > 30) add('Frontend', 'Médio', 'Excesso de scripts', `${seo.totalScripts} tags <script> na página`);
  if (!fe.hasSkipLink && (fe.hasAriaLabels || 0) < 3) add('Frontend', 'Médio', 'Acessibilidade fraca', `Sem skip link e apenas ${fe.hasAriaLabels || 0} aria-label`);
  if ((fe.ctaButtons || []).length === 0) add('Frontend', 'Alto', 'Nenhum CTA detectado', 'Sem botões/chamadas para ação visíveis');
  if (!fe.hasFooter) add('Frontend', 'Baixo', 'Sem <footer> semântico', 'Rodapé estrutural ausente');
  subs.forEach((p) => {
    if (!p.hasViewport) add('Frontend', 'Alto', 'Subpágina sem meta viewport', p.url);
  });

  return problemas;
}

// ------------------------------------------------------------------
// ETAPA 2: prompt de detalhamento — destrincha cada problema com solução
// completa (código pronto, dificuldade, tempo, métrica) + roadmap de
// próximos passos. Chamada separada para não disputar tokens com o
// relatório principal.
// ------------------------------------------------------------------
const FORMATO_DETALHAMENTO = `{
  "problemasDetalhados": [
    {
      "id": 1,
      "categoria": "SEO | GEO | AEO | Frontend",
      "severidade": "Crítico | Alto | Médio | Baixo",
      "problema": "título objetivo do problema",
      "porqueImporta": "explicação didática de por que isso prejudica o site, específica para o nicho",
      "evidencia": "dado coletado que comprova, com valores e URLs",
      "paginasAfetadas": ["urls"],
      "comoResolver": {
        "passos": ["passo 1 bem concreto", "passo 2", "passo 3"],
        "codigoExemplo": "tag/código PRONTO PARA COLAR, já adaptado ao site e nicho (string vazia se não se aplica)",
        "ferramentas": ["ferramentas gratuitas que ajudam"],
        "dificuldade": "Fácil | Média | Avançada",
        "tempoEstimado": "ex.: 30 minutos"
      },
      "metricaDeSucesso": "como medir que foi resolvido (ferramenta + indicador)",
      "impactoEsperado": "ganho concreto esperado (tráfego, CTR, citação por IAs, conversão)"
    }
  ],
  "proximosPassos": [
    {
      "ordem": 1,
      "semana": "Semana 1",
      "acao": "ação clara e específica",
      "categoria": "SEO | GEO | AEO | Frontend",
      "dependeDe": "número da ordem de outra ação, ou —",
      "resultadoEsperado": "o que muda quando concluído"
    }
  ],
  "quickWins": ["4-6 ações de menos de 1 hora com impacto imediato, específicas deste site"]
}`;

function montarPromptDetalhamento(dados, relatorio, nivel = 1) {
  const compacto = compactarDados(dados, nivel);
  const { seoData = {}, subpaginas = [], auditoriaLocal = [] } = compacto;
  const resumoSite = {
    url: seoData.url,
    title: seoData.title,
    metaDescription: seoData.metaDescription,
    wordCount: seoData.wordCount,
    schemaTypes: seoData.schemaTypes,
    nicho: relatorio?.nicho,
    nichoDetalhado: (relatorio?.nichoDetalhado || '').substring(0, 300),
    scores: {
      seo: relatorio?.scoreSEO, geo: relatorio?.scoreGEO,
      aeo: relatorio?.scoreAEO, frontend: relatorio?.scoreFrontend,
    },
  };
  return `
Você é um consultor sênior de SEO/GEO/AEO/Frontend. Sua missão é DESTRINCHAR os problemas
do site abaixo em soluções completas e um roadmap de próximos passos executável.

## SITE
${JSON.stringify(resumoSite)}

## SUBPÁGINAS ANALISADAS
${JSON.stringify(subpaginas)}

## PROBLEMAS EVIDENCIADOS (auditoria técnica automática)
${JSON.stringify(auditoriaLocal)}

## INSTRUÇÕES
Produza JSON EXATAMENTE no formato abaixo, sem texto fora do JSON:

${FORMATO_DETALHAMENTO}

REGRAS:
- Cubra TODOS os problemas da auditoria: agrupe os repetidos entre subpáginas em um
  único item, listando as URLs em paginasAfetadas. Acrescente problemas que você
  identificar além da auditoria. Liste do mais crítico ao menos crítico (10-14 itens).
- codigoExemplo deve ser REAL e pronto para colar: meta tags com o texto sugerido,
  LD+JSON completo com os dados do site/nicho, atributos HTML — nunca pseudocódigo.
- proximosPassos: 10-15 ações ordenadas por dependência e impacto, distribuídas
  em semanas (Semana 1 a Semana 12).
- Tudo em Português do Brasil, específico para o nicho — nada genérico.
`;
}

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

  "problemasESolucoes": [
    {
      "categoria": "SEO | GEO | AEO | Frontend",
      "severidade": "Crítico | Alto | Médio | Baixo",
      "problema": "descrição objetiva do problema evidenciado",
      "evidencia": "dado coletado que comprova o problema, citando valores e URLs",
      "paginasAfetadas": ["urls das páginas onde o problema ocorre"],
      "solucaoPassoAPasso": ["passo 1 concreto", "passo 2", "passo 3 (inclua exemplo de código/tag quando aplicável)"],
      "impactoEsperado": "ganho esperado ao corrigir (tráfego, CTR, citação por IAs, conversão)"
    }
  ],

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

function montarPromptGroq(dados, nivel = 1) {
  const compacto = compactarDados(dados, nivel);
  const {
    seoData = {}, geoData = {}, aeoData = {}, frontendData = {},
    subpaginas = [], auditoriaLocal = [], limitacoes = [],
  } = compacto;
  return `
Você é um especialista sênior em SEO, GEO (Generative Engine Optimization), AEO (Answer Engine Optimization), UX/UI e Marketing Digital.
Analise profundamente os dados técnicos do site abaixo e produza um relatório COMPLETO, DETALHADO e PROFISSIONAL.

## DADOS DO SITE ANALISADO
URL: ${seoData.url || 'desconhecida'}
Domínio: ${seoData.domain || 'desconhecido'}
Data atual: ${new Date().toLocaleDateString('pt-BR')}
${limitacoes.length ? `Limitações da coleta (informe no relatório): ${limitacoes.join('; ')}` : ''}

### DADOS SEO:
${JSON.stringify(seoData)}

### DADOS GEO:
${JSON.stringify(geoData)}

### DADOS AEO:
${JSON.stringify(aeoData)}

### DADOS FRONTEND:
${JSON.stringify(frontendData)}

### SUBPÁGINAS DO SITE (análise multi-página — ${subpaginas.length} página(s) interna(s)):
${JSON.stringify(subpaginas)}

### AUDITORIA LOCAL — PROBLEMAS JÁ EVIDENCIADOS (destrinche TODOS em "problemasESolucoes"):
${JSON.stringify(auditoriaLocal)}

---

## INSTRUÇÕES PARA O RELATÓRIO

Produza um relatório JSON estruturado EXATAMENTE no formato abaixo. Não adicione texto fora do JSON.

${FORMATO_RELATORIO}

IMPORTANTE:
- Seja EXTREMAMENTE específico para o nicho identificado
- Todas as sugestões devem ser ACIONÁVEIS e PRÁTICAS
- Base todas as análises nos dados reais coletados
- Em "problemasESolucoes": liste os 6 a 10 problemas MAIS GRAVES da AUDITORIA LOCAL
  com solução passo a passo resumida (haverá uma etapa posterior de detalhamento
  completo — aqui priorize cobrir o essencial sem estourar o tamanho da resposta).
- Considere as SUBPÁGINAS na análise: consistência de titles, meta descriptions,
  H1, schemas e padrões que se repetem pelo site
- O JSON deve ser válido e completo
- Não use linguagem genérica; adapte tudo ao nicho identificado
- Escreva TODO o relatório em Português do Brasil
`;
}

// Disponibiliza no escopo global tanto do service worker quanto do popup
if (typeof globalThis !== 'undefined') {
  globalThis.GROQ_CONFIG = GROQ_CONFIG;
  globalThis.montarPromptGroq = montarPromptGroq;
  globalThis.estimarTokens = estimarTokens;
  globalThis.compactarDados = compactarDados;
  globalThis.gerarAuditoriaLocal = gerarAuditoriaLocal;
  globalThis.montarPromptDetalhamento = montarPromptDetalhamento;
  globalThis.ofuscarKey = ofuscarKey;
  globalThis.desofuscarKey = desofuscarKey;
}
