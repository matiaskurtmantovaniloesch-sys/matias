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
  $('btn-analisar').disabled = !analisavel;
  if (!analisavel) {
    mostrarErro('Esta página não pode ser analisada (apenas http/https).');
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
  if (!abaAtual?.id) return;
  $('erro-dashboard').classList.add('oculta');

  // Confirmação para reuso de cache
  if (!forcar && cacheDisponivel && analiseAtual) {
    mostrarResultado(analiseAtual);
    return;
  }

  mostrarTela('tela-progresso');
  setProgresso(10, 1);

  try {
    const dados = await coletarDadosDaAba(abaAtual.id);
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
function extrairTopProblemas(rel) {
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
  extrairTopProblemas(rel).forEach((p) => {
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
