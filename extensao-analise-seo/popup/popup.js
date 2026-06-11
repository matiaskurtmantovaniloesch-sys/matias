// =====================================================================
// SiteAnalyzer Pro — Popup
// Orquestra as 4 telas: configuração, dashboard, progresso e resultado.
// =====================================================================

'use strict';

const $ = (id) => document.getElementById(id);
const TELAS = ['tela-config', 'tela-dashboard', 'tela-progresso', 'tela-resultado'];

let abaAtual = null;
let analiseAtual = null;   // entrada do histórico exibida (id, relatorio, ...)
let cacheDisponivel = false;

// ------------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------------
function mostrarTela(id) {
  TELAS.forEach((t) => $(t).classList.toggle('oculta', t !== id));
}

function enviar(msg) {
  return new Promise((res) => chrome.runtime.sendMessage(msg, res));
}

function corDoScore(v) {
  if (v == null) return 'var(--text-secondary)';
  if (v >= 75) return 'var(--success)';
  if (v >= 50) return 'var(--warning)';
  return 'var(--danger)';
}

function pintarScore(idEl, valor) {
  const el = $(idEl);
  el.textContent = valor != null ? valor : '—';
  el.style.color = corDoScore(valor);
}

function pintarScoreGeral(valor) {
  $('score-geral-valor').textContent = valor != null ? valor : '—';
  const arco = $('score-geral-arco');
  const circ = 2 * Math.PI * 52;
  arco.style.strokeDashoffset = valor != null ? circ * (1 - valor / 100) : circ;
  arco.style.stroke = corDoScore(valor);
}

function mostrarErro(mensagem, codigo) {
  const el = $('erro-dashboard');
  if (codigo === 'KEY_INVALIDA' || codigo === 'SEM_KEY') {
    el.innerHTML = `${mensagem} <a href="${GROQ_CONFIG.urlObterKey}" target="_blank" rel="noopener">Criar/verificar API Key na Groq →</a>`;
  } else {
    el.textContent = mensagem;
  }
  el.classList.remove('oculta');
}

// ------------------------------------------------------------------
// Tela 1 — Configuração
// ------------------------------------------------------------------
$('btn-salvar-key').addEventListener('click', async () => {
  const key = $('input-apikey').value.trim();
  if (!key) { $('input-apikey').focus(); return; }
  await enviar({ tipo: 'SALVAR_KEY', apiKey: key });
  $('input-apikey').value = '';
  mostrarTela('tela-dashboard');
});

// ------------------------------------------------------------------
// Tela 2 — Dashboard
// ------------------------------------------------------------------
async function carregarDashboard() {
  // URL da aba ativa
  const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
  abaAtual = aba || null;
  $('site-url').textContent = aba?.url ? new URL(aba.url).hostname : 'Página indisponível';

  const analisavel = !!aba?.url && /^https?:/.test(aba.url);
  await renderHtmlExtra();
  await atualizarBotaoAnalisar();
  if (!analisavel) {
    mostrarErro('Esta aba não é analisável (apenas http/https) — mas você pode adicionar o HTML do site abaixo e analisar a partir dele.');
  }

  // Histórico + última análise do domínio atual
  const respHist = await enviar({ tipo: 'HISTORICO' });
  const historico = respHist?.historico || [];
  renderHistorico(historico);

  const dominio = analisavel ? new URL(aba.url).hostname : null;
  const entradaDominio = dominio ? historico.find((h) => h.dominio === dominio) : null;
  cacheDisponivel = !!entradaDominio && (Date.now() - entradaDominio.timestamp) / 36e5 < GROQ_CONFIG.cacheHoras;

  if (entradaDominio) {
    pintarScoreGeral(entradaDominio.scores?.geral);
    pintarScore('card-seo', entradaDominio.scores?.seo);
    pintarScore('card-geo', entradaDominio.scores?.geo);
    pintarScore('card-aeo', entradaDominio.scores?.aeo);
    pintarScore('card-frontend', entradaDominio.scores?.frontend);
    if (entradaDominio.nicho) {
      $('nicho-status').innerHTML = `Nicho identificado: <strong></strong>`;
      $('nicho-status').querySelector('strong').textContent = entradaDominio.nicho;
      $('nicho-status').classList.remove('oculta');
    }
    $('aviso-cache').classList.toggle('oculta', !cacheDisponivel);
    $('btn-relatorio').disabled = false;
    $('btn-pdf').disabled = false;
    const r = await enviar({ tipo: 'OBTER_ANALISE', id: entradaDominio.id });
    analiseAtual = r?.entrada || null;
  } else {
    pintarScoreGeral(null);
    ['card-seo', 'card-geo', 'card-aeo', 'card-frontend'].forEach((id) => pintarScore(id, null));
    $('nicho-status').classList.add('oculta');
    $('aviso-cache').classList.add('oculta');
    $('btn-relatorio').disabled = true;
    $('btn-pdf').disabled = true;
    analiseAtual = null;
  }
}

function renderHistorico(historico) {
  const ul = $('lista-historico');
  ul.innerHTML = '';
  if (!historico.length) {
    ul.innerHTML = '<li class="texto-secundario">Nenhuma análise ainda.</li>';
    return;
  }
  historico.slice(0, 5).forEach((h) => {
    const li = document.createElement('li');
    const dominio = document.createElement('span');
    dominio.className = 'dominio';
    dominio.textContent = h.dominio;
    const pontos = document.createElement('span');
    pontos.className = 'pontos';
    pontos.textContent = `${h.scores?.geral ?? '—'}/100 · ${new Date(h.timestamp).toLocaleDateString('pt-BR')}`;
    li.append(dominio, pontos);
    li.title = 'Abrir relatório completo';
    li.addEventListener('click', () => abrirRelatorio(h.id, false));
    ul.appendChild(li);
  });
}

// ------------------------------------------------------------------
// HTML extra: páginas coladas/enviadas pelo usuário (html-import.js)
// ------------------------------------------------------------------
async function renderHtmlExtra() {
  const extras = await obterHtmlExtra();
  $('badge-html-extra').textContent = extras.length ? String(extras.length) : '';
  const ul = $('lista-html-extra');
  ul.innerHTML = '';
  extras.forEach((e, i) => {
    const li = document.createElement('li');
    const info = document.createElement('span');
    info.className = 'info';
    info.textContent = e.nome;
    const detalhe = document.createElement('small');
    detalhe.textContent = `${e.url || 'sem URL'} · ${(e.html.length / 1024).toFixed(0)} KB`;
    info.appendChild(detalhe);
    const btn = document.createElement('button');
    btn.className = 'remover';
    btn.textContent = '✕';
    btn.title = 'Remover';
    btn.addEventListener('click', async () => {
      const lista = await obterHtmlExtra();
      lista.splice(i, 1);
      await salvarHtmlExtra(lista);
      await renderHtmlExtra();
      await atualizarBotaoAnalisar();
    });
    li.append(info, btn);
    ul.appendChild(li);
  });
}

async function adicionarHtmlExtra(nome, url, html) {
  if (!html || html.length < 50) return false;
  const lista = await obterHtmlExtra();
  if (lista.length >= HTML_EXTRA_MAX) {
    mostrarErro(`Máximo de ${HTML_EXTRA_MAX} páginas manuais. Remova alguma para adicionar outra.`);
    return false;
  }
  lista.push({ nome, url: url || null, html: html.substring(0, HTML_EXTRA_MAX_CHARS) });
  await salvarHtmlExtra(lista);
  await renderHtmlExtra();
  await atualizarBotaoAnalisar();
  return true;
}

async function atualizarBotaoAnalisar() {
  const analisavel = !!abaAtual?.url && /^https?:/.test(abaAtual.url);
  const extras = await obterHtmlExtra();
  // Com HTML manual dá para analisar mesmo sem aba http(s)
  $('btn-analisar').disabled = !analisavel && extras.length === 0;
}

$('btn-add-html').addEventListener('click', async () => {
  const html = $('input-html-texto').value.trim();
  const url = $('input-html-url').value.trim();
  if (!html) { $('input-html-texto').focus(); return; }
  const nome = url ? new URL(url, 'https://x.invalida').pathname || url : `HTML colado ${new Date().toLocaleTimeString('pt-BR')}`;
  if (await adicionarHtmlExtra(nome, url, html)) {
    $('input-html-texto').value = '';
    $('input-html-url').value = '';
  }
});

$('input-html-arquivos').addEventListener('change', async (ev) => {
  for (const arquivo of ev.target.files) {
    const html = await arquivo.text();
    await adicionarHtmlExtra(arquivo.name, null, html);
  }
  ev.target.value = '';
});

// ------------------------------------------------------------------
// Tela 3 — Progresso
// ------------------------------------------------------------------
function setProgresso(pct, stepAtivo) {
  $('barra-progresso').style.width = pct + '%';
  for (let i = 1; i <= 4; i++) {
    const li = $('step-' + i);
    li.classList.toggle('feito', i < stepAtivo);
    li.classList.toggle('ativo', i === stepAtivo);
  }
}

// ------------------------------------------------------------------
// Análise
// ------------------------------------------------------------------
async function coletarDadosDaAba(tabId) {
  // O content script roda em document_idle; se a página foi carregada antes
  // da instalação da extensão, injeta sob demanda via chrome.scripting.
  const tentar = () => new Promise((res) => {
    chrome.tabs.sendMessage(tabId, { tipo: 'COLETAR_DADOS' }, (r) => {
      if (chrome.runtime.lastError) res(null);
      else res(r);
    });
  });

  let resp = await tentar();
  if (!resp) {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content/content-script.js'] });
    resp = await tentar();
  }
  if (!resp?.ok) throw new Error('Não foi possível coletar dados desta página. Recarregue-a e tente novamente.');
  return resp.dados;
}

async function analisar(forcar) {
  $('erro-dashboard').classList.add('oculta');
  const extras = await obterHtmlExtra();
  const analisavel = !!abaAtual?.id && /^https?:/.test(abaAtual.url || '');
  if (!analisavel && !extras.length) return;

  // Confirmação para reuso de cache
  if (!forcar && cacheDisponivel && analiseAtual) {
    mostrarResultado(analiseAtual);
    return;
  }

  mostrarTela('tela-progresso');
  setProgresso(10, 1);

  try {
    let dados;
    if (analisavel) {
      dados = await coletarDadosDaAba(abaAtual.id);
    } else {
      // Sem aba http(s): o primeiro HTML manual vira a página principal
      dados = dadosCompletosDeHTML(extras[0].html, extras[0].url || 'https://pagina-local.invalida/');
      dados.subpaginas = [];
    }

    // Demais HTMLs manuais entram como subpáginas (acesso extra à análise)
    const inicio = analisavel ? 0 : 1;
    const manuais = extras.slice(inicio).map((e) => {
      try { return resumoSubpaginaDeHTML(e.html, e.url || e.nome); }
      catch { return null; }
    }).filter(Boolean);
    if (manuais.length) {
      // Manuais primeiro: têm prioridade se a compactação cortar a lista
      dados.subpaginas = [...manuais, ...(dados.subpaginas || [])];
      dados.limitacoes = [...(dados.limitacoes || []), `${manuais.length} página(s) adicionada(s) manualmente via HTML pelo usuário`];
    }
    setProgresso(35, 2);

    // Avanço suave da barra enquanto a IA responde
    let pct = 35;
    const animacao = setInterval(() => {
      pct = Math.min(pct + 2, 85);
      $('barra-progresso').style.width = pct + '%';
    }, 800);

    const resp = await enviar({ tipo: 'ANALISAR', dados, forcar: !!forcar });
    clearInterval(animacao);

    if (!resp?.ok) throw Object.assign(new Error(resp?.erro || 'Falha na análise.'), { codigo: resp?.codigo });

    setProgresso(92, 3);
    const r = await enviar({ tipo: 'OBTER_ANALISE' });
    analiseAtual = r?.entrada || { relatorio: resp.relatorio };
    setProgresso(100, 4);

    setTimeout(() => mostrarResultado(analiseAtual), 450);
  } catch (e) {
    mostrarTela('tela-dashboard');
    await carregarDashboard();
    mostrarErro(e.message, e.codigo);
  }
}

// ------------------------------------------------------------------
// Tela 4 — Resultado resumido
// ------------------------------------------------------------------
function extrairTopProblemas(rel, entrada) {
  // Fonte preferida: detalhamento da etapa 2, depois o bloco do relatório
  const detalhados = entrada?.detalhamento?.problemasDetalhados;
  if (detalhados?.length) {
    const ordem = { 'crítico': 0, 'critico': 0, 'alto': 1, 'médio': 2, 'medio': 2, 'baixo': 3 };
    return [...detalhados]
      .sort((a, b) => (ordem[String(a.severidade || '').toLowerCase()] ?? 9) - (ordem[String(b.severidade || '').toLowerCase()] ?? 9))
      .slice(0, 6)
      .map((p) => `[${p.categoria}] ${p.problema}`);
  }
  if (rel.problemasESolucoes?.length) {
    const ordem = { 'crítico': 0, 'critico': 0, 'alto': 1, 'médio': 2, 'medio': 2, 'baixo': 3 };
    return [...rel.problemasESolucoes]
      .sort((a, b) => (ordem[String(a.severidade || '').toLowerCase()] ?? 9) - (ordem[String(b.severidade || '').toLowerCase()] ?? 9))
      .slice(0, 6)
      .map((p) => `[${p.categoria}] ${p.problema}`);
  }
  const problemas = [];
  const fontes = [
    ['SEO', rel.seo?.seoTecnico?.problemasCriticos, rel.seo?.estruturaHeadings?.problemas],
    ['GEO', rel.geo?.otimizacaoParaIAGenerativa?.pontosDesMelhoria],
    ['AEO', rel.aeo?.featuredSnippets?.estruturasFaltantes],
    ['Frontend', rel.frontend?.acessibilidade?.problemas],
  ];
  fontes.forEach(([cat, ...listas]) => {
    listas.flat().filter(Boolean).slice(0, 2).forEach((p) => problemas.push(`[${cat}] ${p}`));
  });
  // Fallback: planos de ação de prioridade Alta
  if (problemas.length < 3) {
    [rel.seo?.planoDeAcaoSEO, rel.geo?.planoDeAcaoGEO, rel.aeo?.planoDeAcaoAEO, rel.frontend?.planoDeAcaoFrontend]
      .flat().filter((a) => a && /alta/i.test(a.prioridade || ''))
      .forEach((a) => problemas.push(a.acao));
  }
  return problemas.slice(0, 6);
}

function extrairTopOportunidades(rel) {
  const ops = [
    ...(rel.competitividade?.oportunidadesDeMercado || []),
    ...(rel.seo?.palavrasChave?.oportunidades || []),
    ...(rel.geo?.otimizacaoParaIAGenerativa?.estrategiasGEO || []).slice(0, 2),
  ];
  return ops.filter(Boolean).slice(0, 6);
}

function mostrarResultado(entrada) {
  const rel = entrada.relatorio;
  if (!rel) return;

  $('resultado-nicho').innerHTML = 'Nicho: <strong></strong>';
  $('resultado-nicho').querySelector('strong').textContent = rel.nicho || 'não identificado';

  pintarScore('res-seo', rel.scoreSEO);
  pintarScore('res-geo', rel.scoreGEO);
  pintarScore('res-aeo', rel.scoreAEO);
  pintarScore('res-frontend', rel.scoreFrontend);

  $('resumo-executivo').textContent = rel.resumoExecutivo || '—';

  const ulP = $('lista-problemas');
  ulP.innerHTML = '';
  extrairTopProblemas(rel, entrada).forEach((p) => {
    const li = document.createElement('li');
    li.textContent = typeof p === 'string' ? p : JSON.stringify(p);
    ulP.appendChild(li);
  });

  const ulO = $('lista-oportunidades');
  ulO.innerHTML = '';
  extrairTopOportunidades(rel).forEach((o) => {
    const li = document.createElement('li');
    li.textContent = typeof o === 'string' ? o : JSON.stringify(o);
    ulO.appendChild(li);
  });

  mostrarTela('tela-resultado');
}

// ------------------------------------------------------------------
// Relatório completo / PDF
// ------------------------------------------------------------------
function abrirRelatorio(id, autoPdf) {
  const idFinal = id || analiseAtual?.id || '';
  const url = chrome.runtime.getURL(`report/report.html?id=${encodeURIComponent(idFinal)}${autoPdf ? '&pdf=1' : ''}`);
  chrome.tabs.create({ url });
}

// ------------------------------------------------------------------
// Eventos
// ------------------------------------------------------------------
$('btn-analisar').addEventListener('click', () => analisar(false));
$('btn-forcar').addEventListener('click', () => analisar(true));
$('btn-relatorio').addEventListener('click', () => abrirRelatorio(null, false));
$('btn-pdf').addEventListener('click', () => abrirRelatorio(null, true));
$('btn-ver-relatorio').addEventListener('click', () => abrirRelatorio(null, false));
$('btn-pdf-resultado').addEventListener('click', () => abrirRelatorio(null, true));
$('btn-voltar').addEventListener('click', async () => {
  mostrarTela('tela-dashboard');
  await carregarDashboard();
});

// Progresso enviado pelo service worker durante as etapas de IA
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.tipo === 'PROGRESSO_ANALISE' && msg.texto) {
    $('estimativa').textContent = msg.texto;
  }
});

// ------------------------------------------------------------------
// Inicialização
// ------------------------------------------------------------------
(async function init() {
  $('versao').textContent = 'v' + chrome.runtime.getManifest().version;
  const resp = await enviar({ tipo: 'TEM_KEY' });
  if (!resp?.temKey) {
    mostrarTela('tela-config');
    return;
  }
  mostrarTela('tela-dashboard');
  await carregarDashboard();
})();
