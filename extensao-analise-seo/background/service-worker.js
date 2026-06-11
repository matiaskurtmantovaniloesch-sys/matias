// =====================================================================
// SiteAnalyzer Pro — Background Service Worker
// Responsável por: chamada à API Groq (com retry/backoff), cache de
// 24h por domínio, histórico das últimas análises e fila simples para
// respeitar rate limits.
// =====================================================================

importScripts('../config/groq-config.js');

const CHAVES = {
  apiKey: 'siteanalyzer.apikey',
  historico: 'siteanalyzer.historico',
};

// ------------------------------------------------------------------
// Storage helpers
// ------------------------------------------------------------------
function storageGet(chave) {
  return new Promise((res) => chrome.storage.local.get(chave, (r) => res(r[chave])));
}
function storageSet(obj) {
  return new Promise((res) => chrome.storage.local.set(obj, res));
}

async function obterApiKey() {
  const blob = await storageGet(CHAVES.apiKey);
  return blob ? desofuscarKey(blob) : null;
}

// ------------------------------------------------------------------
// Histórico / cache (24h por domínio)
// ------------------------------------------------------------------
async function obterHistorico() {
  return (await storageGet(CHAVES.historico)) || [];
}

async function buscarCache(dominio) {
  const historico = await obterHistorico();
  const entrada = historico.find((h) => h.dominio === dominio);
  if (!entrada) return null;
  const idadeHoras = (Date.now() - entrada.timestamp) / 36e5;
  return idadeHoras < GROQ_CONFIG.cacheHoras ? entrada : null;
}

async function salvarNoHistorico(entrada) {
  let historico = await obterHistorico();
  historico = historico.filter((h) => h.dominio !== entrada.dominio);
  historico.unshift(entrada);
  historico = historico.slice(0, GROQ_CONFIG.historicoMax);
  await storageSet({ [CHAVES.historico]: historico });
}

// ------------------------------------------------------------------
// Parsing tolerante da resposta da IA
// ------------------------------------------------------------------
function parsearJSONRelatorio(textoBruto) {
  // 1ª tentativa: parse direto
  try { return JSON.parse(textoBruto); } catch { /* segue */ }

  // 2ª: remover cercas de código e texto fora das chaves
  let limpo = textoBruto.replace(/```(?:json)?/g, '').trim();
  const ini = limpo.indexOf('{');
  const fim = limpo.lastIndexOf('}');
  if (ini >= 0 && fim > ini) limpo = limpo.substring(ini, fim + 1);
  try { return JSON.parse(limpo); } catch { /* segue */ }

  // 3ª: remover vírgulas penduradas (erro comum de LLM)
  try { return JSON.parse(limpo.replace(/,\s*([}\]])/g, '$1')); } catch { /* segue */ }

  return null;
}

// ------------------------------------------------------------------
// Chamada à API Groq com timeout, retry e backoff exponencial
// ------------------------------------------------------------------
async function chamarGroq(apiKey, prompt, modelo) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GROQ_CONFIG.timeoutMs);
  try {
    const resp = await fetch(GROQ_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelo,
        messages: [
          { role: 'system', content: 'Você é um especialista em SEO, GEO, AEO e UX/UI. Sempre retorne JSON válido.' },
          { role: 'user', content: prompt },
        ],
        temperature: GROQ_CONFIG.temperatura,
        max_tokens: GROQ_CONFIG.maxTokens,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (resp.status === 401 || resp.status === 403) {
      const e = new Error('API Key inválida ou sem permissão.');
      e.codigo = 'KEY_INVALIDA';
      e.fatal = true;
      throw e;
    }
    if (resp.status === 429) {
      const e = new Error('Rate limit da Groq atingido.');
      e.codigo = 'RATE_LIMIT';
      throw e;
    }
    if (!resp.ok) {
      const corpo = await resp.text().catch(() => '');
      const e = new Error(`Erro da API Groq (HTTP ${resp.status}): ${corpo.substring(0, 200)}`);
      e.codigo = 'HTTP_' + resp.status;
      throw e;
    }

    const json = await resp.json();
    return json.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timer);
  }
}

async function analisarComRetry(apiKey, prompt) {
  let erroPrincipal = null;   // erro do modelo principal (mais informativo)
  let ultimoErro = null;
  for (let tentativa = 0; tentativa < GROQ_CONFIG.tentativas; tentativa++) {
    if (tentativa > 0) {
      await new Promise((r) => setTimeout(r, GROQ_CONFIG.backoffBaseMs * Math.pow(2, tentativa - 1)));
    }
    // Última tentativa usa o modelo de fallback
    const ehFallback = tentativa === GROQ_CONFIG.tentativas - 1;
    const modelo = ehFallback ? GROQ_CONFIG.modeloFallback : GROQ_CONFIG.modelo;
    try {
      const conteudo = await chamarGroq(apiKey, prompt, modelo);
      const relatorio = parsearJSONRelatorio(conteudo);
      if (relatorio) return relatorio;
      ultimoErro = new Error('A IA retornou um JSON inválido.');
    } catch (e) {
      if (e.fatal) throw e;
      ultimoErro = e.name === 'AbortError' ? new Error('Timeout na chamada à API Groq.') : e;
    }
    if (!ehFallback) erroPrincipal = ultimoErro;
  }
  // Se o fallback falhou por motivo próprio (ex.: modelo indisponível),
  // reporta o erro do modelo principal, que é a causa real.
  throw erroPrincipal || ultimoErro || new Error('Falha desconhecida na análise.');
}

// ------------------------------------------------------------------
// Fila simples: serializa as análises para respeitar rate limits
// ------------------------------------------------------------------
let filaAtual = Promise.resolve();
function enfileirar(tarefa) {
  const resultado = filaAtual.then(tarefa, tarefa);
  filaAtual = resultado.catch(() => {});
  return resultado;
}

// ------------------------------------------------------------------
// Handler principal de mensagens
// ------------------------------------------------------------------
async function processarAnalise(msg) {
  const { dados, forcar } = msg;
  const dominio = dados?.seoData?.domain;
  if (!dominio) throw new Error('Dados coletados sem domínio — recarregue a página e tente novamente.');

  // Cache de 24h, a menos que o usuário force nova análise
  if (!forcar) {
    const cache = await buscarCache(dominio);
    if (cache) return { relatorio: cache.relatorio, doCache: true, timestamp: cache.timestamp };
  }

  const apiKey = await obterApiKey();
  if (!apiKey) {
    const e = new Error('Nenhuma API Key configurada.');
    e.codigo = 'SEM_KEY';
    throw e;
  }

  const prompt = montarPromptGroq(dados);
  const relatorio = await enfileirar(() => analisarComRetry(apiKey, prompt));

  // Garante campos básicos mesmo se a IA omitir
  relatorio.urlAnalisada = relatorio.urlAnalisada || dados.seoData.url;
  relatorio.dataAnalise = relatorio.dataAnalise || new Date().toLocaleDateString('pt-BR');

  const entrada = {
    id: `${dominio}-${Date.now()}`,
    dominio,
    url: dados.seoData.url,
    timestamp: Date.now(),
    scores: {
      geral: relatorio.scoreGeral,
      seo: relatorio.scoreSEO,
      geo: relatorio.scoreGEO,
      aeo: relatorio.scoreAEO,
      frontend: relatorio.scoreFrontend,
    },
    nicho: relatorio.nicho,
    relatorio,
    limitacoes: dados.limitacoes || [],
  };
  await salvarNoHistorico(entrada);

  return { relatorio, doCache: false, timestamp: entrada.timestamp };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.tipo === 'ANALISAR') {
    processarAnalise(msg)
      .then((resultado) => sendResponse({ ok: true, ...resultado }))
      .catch((e) => sendResponse({ ok: false, erro: e.message, codigo: e.codigo || 'ERRO' }));
    return true; // resposta assíncrona
  }

  if (msg?.tipo === 'SALVAR_KEY') {
    storageSet({ [CHAVES.apiKey]: ofuscarKey(msg.apiKey) })
      .then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg?.tipo === 'TEM_KEY') {
    obterApiKey().then((k) => sendResponse({ ok: true, temKey: !!k }));
    return true;
  }

  if (msg?.tipo === 'HISTORICO') {
    obterHistorico().then((h) => sendResponse({
      ok: true,
      // Não envia o relatório completo na listagem (payload menor)
      historico: h.map(({ relatorio, ...resto }) => resto),
    }));
    return true;
  }

  if (msg?.tipo === 'OBTER_ANALISE') {
    obterHistorico().then((h) => {
      const entrada = h.find((x) => x.id === msg.id) || h[0] || null;
      sendResponse({ ok: true, entrada });
    });
    return true;
  }

  return false;
});
