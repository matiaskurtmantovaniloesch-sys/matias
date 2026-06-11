// =====================================================================
// SiteAnalyzer Pro — Relatório completo
// Renderiza o JSON da análise (chrome.storage via service worker) em um
// documento HTML e exporta em PDF (jsPDF + html2canvas, com fallback
// para o diálogo de impressão nativo quando as libs não estão no bundle).
// =====================================================================

'use strict';

// ------------------------------------------------------------------
// Helpers de renderização — sempre escapar conteúdo vindo da IA/site
// ------------------------------------------------------------------
function esc(v) {
  if (v == null) return '—';
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function lista(itens, vazio = 'Nenhum item.') {
  const arr = (itens || []).filter((x) => x != null);
  if (!arr.length) return `<p>${esc(vazio)}</p>`;
  return `<ul>${arr.map((i) => `<li>${esc(typeof i === 'object' ? JSON.stringify(i) : i)}</li>`).join('')}</ul>`;
}

function selo(nivelOuStatus) {
  const t = String(nivelOuStatus || '').toLowerCase();
  let cls = 'medio';
  if (/excelente|bom|otimizado|completo|alto|presente/.test(t)) cls = 'bom';
  if (/cr[ií]tico|ruim|ausente|baixo|incompleto|precisa/.test(t)) cls = 'ruim';
  return `<span class="selo ${cls}">${esc(nivelOuStatus || '—')}</span>`;
}

function tabelaPlano(plano) {
  const linhas = (plano || []).map((a) => {
    const p = String(a.prioridade || '').toLowerCase();
    const cls = /alta/.test(p) ? 'alta' : /m[ée]dia/.test(p) ? 'media' : 'baixa';
    return `<tr>
      <td class="prio ${cls}">${esc(a.prioridade)}</td>
      <td>${esc(a.acao)}</td>
      <td>${esc(a.impactoEsperado)}</td>
      <td>${esc(a.prazo)}</td>
    </tr>`;
  }).join('');
  if (!linhas) return '<p>Nenhuma ação listada.</p>';
  return `<table>
    <thead><tr><th>Prioridade</th><th>Ação</th><th>Impacto esperado</th><th>Prazo</th></tr></thead>
    <tbody>${linhas}</tbody>
  </table>`;
}

function cardMetatag(titulo, m) {
  if (!m) return '';
  return `<div class="card">
    <h3>${esc(titulo)} ${selo(m.status)}</h3>
    ${m.valor != null ? `<p><strong>Valor atual:</strong> ${esc(m.valor)}${m.comprimento != null ? ` (${esc(m.comprimento)} caracteres)` : ''}</p>` : ''}
    <p>${esc(m.analise)}</p>
    ${m.sugestao ? `<div class="alerta ok"><strong>Sugestão:</strong> ${esc(m.sugestao)}</div>` : ''}
    ${m.sugestoes?.length ? `<h4>Sugestões</h4>${lista(m.sugestoes)}` : ''}
    ${m.camposPresentes?.length ? `<h4>Campos presentes</h4>${lista(m.camposPresentes)}` : ''}
    ${m.camposFaltantes?.length ? `<h4>Campos faltantes</h4>${lista(m.camposFaltantes)}` : ''}
  </div>`;
}

function cardEEAT(titulo, e) {
  if (!e) return '';
  return `<div class="card">
    <h3>${esc(titulo)} ${selo(e.status)}</h3>
    <p>${esc(e.analise)}</p>
    ${e.sugestoes?.length ? `<h4>Sugestões</h4>${lista(e.sugestoes)}` : ''}
  </div>`;
}

// ------------------------------------------------------------------
// Seções
// ------------------------------------------------------------------
function seloSeveridade(sev) {
  const t = String(sev || '').toLowerCase();
  const cls = /cr[ií]tico|alto/.test(t) ? 'ruim' : /m[ée]dio/.test(t) ? 'medio' : 'bom';
  return `<span class="selo ${cls}">${esc(sev || '—')}</span>`;
}

function secaoProblemas(rel, entrada) {
  const itens = rel.problemasESolucoes || [];
  const auditoria = entrada.auditoria || [];
  const subs = entrada.subpaginasAnalisadas || [];
  if (!itens.length && !auditoria.length) return '';

  const ordem = { 'crítico': 0, 'critico': 0, 'alto': 1, 'médio': 2, 'medio': 2, 'baixo': 3 };
  const ordenados = [...itens].sort((a, b) =>
    (ordem[String(a.severidade || '').toLowerCase()] ?? 9) - (ordem[String(b.severidade || '').toLowerCase()] ?? 9));

  const cards = ordenados.map((p, i) => `<div class="card">
    <h3>${i + 1}. [${esc(p.categoria)}] ${esc(p.problema)} ${seloSeveridade(p.severidade)}</h3>
    <p><strong>Evidência:</strong> ${esc(p.evidencia)}</p>
    ${p.paginasAfetadas?.length ? `<p><strong>Páginas afetadas:</strong> ${p.paginasAfetadas.map(esc).join(' · ')}</p>` : ''}
    <h4>Como resolver — passo a passo</h4>
    <ol>${(p.solucaoPassoAPasso || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
    <div class="alerta ok"><strong>Impacto esperado:</strong> ${esc(p.impactoEsperado)}</div>
  </div>`).join('');

  const linhasAuditoria = auditoria.map((a) => `<tr>
    <td>${esc(a.categoria)}</td>
    <td>${seloSeveridade(a.severidade)}</td>
    <td>${esc(a.problema)}</td>
    <td>${esc(a.evidencia)}</td>
  </tr>`).join('');

  return `<section class="secao">
    <h2>⚠️ Problemas evidenciados &amp; soluções detalhadas</h2>
    ${subs.length ? `<div class="alerta ok"><strong>Análise multi-página:</strong> além da página principal, foram analisadas ${subs.length} subpáginas — ${subs.map(esc).join(' · ')}</div>` : ''}
    ${cards || '<p>A IA não detalhou problemas — veja a auditoria automática abaixo.</p>'}
    ${linhasAuditoria ? `<div class="card">
      <h3>Auditoria automática (verificações técnicas locais — ${auditoria.length} apontamentos)</h3>
      <table>
        <thead><tr><th>Categoria</th><th>Severidade</th><th>Problema</th><th>Evidência</th></tr></thead>
        <tbody>${linhasAuditoria}</tbody>
      </table>
    </div>` : ''}
  </section>`;
}

function secaoSEO(seo) {
  if (!seo) return '';
  const t = seo.seoTecnico || {};
  return `<section class="secao s-seo">
    <h2>1. SEO ${selo(seo.nivel)} — ${esc(seo.pontuacao)}/100</h2>
    <div class="card"><p>${esc(seo.resumo)}</p></div>

    <h3 style="margin:14px 0 4px">Meta tags</h3>
    <div class="grade-2">
      ${cardMetatag('Title', seo.metatags?.title)}
      ${cardMetatag('Meta Description', seo.metatags?.metaDescription)}
      ${cardMetatag('Open Graph', seo.metatags?.openGraph)}
      ${cardMetatag('Twitter Cards', seo.metatags?.twitterCards)}
    </div>

    <div class="card">
      <h3>Estrutura de headings ${selo(seo.estruturaHeadings?.status)}</h3>
      <p><strong>H1 na página:</strong> ${esc(seo.estruturaHeadings?.h1Count)}</p>
      <p>${esc(seo.estruturaHeadings?.analise)}</p>
      ${seo.estruturaHeadings?.problemas?.length ? `<h4>Problemas</h4>${lista(seo.estruturaHeadings.problemas)}` : ''}
      ${seo.estruturaHeadings?.sugestoes?.length ? `<h4>Sugestões</h4>${lista(seo.estruturaHeadings.sugestoes)}` : ''}
    </div>

    <div class="card">
      <h3>Palavras-chave</h3>
      <h4>Identificadas no conteúdo</h4>${lista(seo.palavrasChave?.principaisPalavrasIdentificadas)}
      <p>${esc(seo.palavrasChave?.densidadeAnalisada)}</p>
      <h4>Oportunidades</h4>${lista(seo.palavrasChave?.oportunidades)}
      <h4>Recomendadas para o nicho</h4>${lista(seo.palavrasChave?.palavrasChaveRecomendadasParaNicho)}
      <h4>Long tails</h4>${lista(seo.palavrasChave?.longTails)}
    </div>

    <div class="grade-2">
      <div class="card">
        <h3>Conteúdo</h3>
        <p><strong>Palavras:</strong> ${esc(seo.conteudo?.wordCount)}</p>
        <p>${esc(seo.conteudo?.qualidade)}</p>
        <p>${esc(seo.conteudo?.legibilidade)}</p>
        ${lista(seo.conteudo?.sugestoes, 'Sem sugestões.')}
      </div>
      <div class="card">
        <h3>Links</h3>
        <p><strong>Internos:</strong> ${esc(seo.links?.internos)} · <strong>Externos:</strong> ${esc(seo.links?.externos)}</p>
        <p>${esc(seo.links?.analise)}</p>
        ${lista(seo.links?.sugestoes, 'Sem sugestões.')}
      </div>
    </div>

    <div class="grade-2">
      <div class="card">
        <h3>Imagens</h3>
        <p><strong>Total:</strong> ${esc(seo.imagens?.total)} · <strong>Sem alt:</strong> ${esc(seo.imagens?.semAlt)}</p>
        <p>${esc(seo.imagens?.analise)}</p>
        ${lista(seo.imagens?.sugestoes, 'Sem sugestões.')}
      </div>
      <div class="card">
        <h3>Dados estruturados</h3>
        <h4>Presentes</h4>${lista(seo.dadosEstruturados?.schemaTiposPresentes, 'Nenhum schema encontrado.')}
        <h4>Faltantes (importantes para o nicho)</h4>${lista(seo.dadosEstruturados?.schemaTiposFaltantes)}
        <p>${esc(seo.dadosEstruturados?.analise)}</p>
        ${lista(seo.dadosEstruturados?.sugestoesSchema, 'Sem sugestões.')}
      </div>
    </div>

    <div class="card">
      <h3>SEO técnico</h3>
      <div class="alerta ${t.https ? 'ok' : 'perigo'}">HTTPS: ${t.https ? 'ativo ✓' : 'AUSENTE — crítico'}</div>
      <table><tbody>
        <tr><td><strong>Canonical</strong></td><td>${esc(t.canonical)}</td></tr>
        <tr><td><strong>Robots</strong></td><td>${esc(t.robots)}</td></tr>
        <tr><td><strong>Sitemap</strong></td><td>${esc(t.sitemap)}</td></tr>
        <tr><td><strong>Velocidade</strong></td><td>${esc(t.velocidade)}</td></tr>
        <tr><td><strong>Mobile</strong></td><td>${esc(t.mobile)}</td></tr>
        <tr><td><strong>Hreflang</strong></td><td>${esc(t.hreflang)}</td></tr>
      </tbody></table>
      ${t.problemasCriticos?.length ? `<div class="alerta perigo"><strong>Problemas críticos:</strong>${lista(t.problemasCriticos)}</div>` : ''}
      ${t.sugestoes?.length ? `<h4>Sugestões</h4>${lista(t.sugestoes)}` : ''}
    </div>

    <div class="card"><h3>Plano de ação — SEO</h3>${tabelaPlano(seo.planoDeAcaoSEO)}</div>
  </section>`;
}

function secaoGEO(geo) {
  if (!geo) return '';
  const ia = geo.otimizacaoParaIAGenerativa || {};
  return `<section class="secao s-geo">
    <h2>2. GEO — Generative Engine Optimization ${selo(geo.nivel)} — ${esc(geo.pontuacao)}/100</h2>
    <div class="card"><p>${esc(geo.resumo)}</p></div>

    <h3 style="margin:14px 0 4px">E-E-A-T</h3>
    <div class="grade-2">
      ${cardEEAT('Experiência', geo.eeat?.experiencia)}
      ${cardEEAT('Expertise', geo.eeat?.expertise)}
      ${cardEEAT('Autoridade', geo.eeat?.autoridade)}
      ${cardEEAT('Confiabilidade', geo.eeat?.confiabilidade)}
    </div>

    <div class="card">
      <h3>Otimização para IA generativa (ChatGPT, Perplexity, Gemini, Claude)</h3>
      <p>${esc(ia.analise)}</p>
      <h4>Pontos favoráveis</h4>${lista(ia.pontosFavoraveis)}
      <h4>Pontos de melhoria</h4>${lista(ia.pontosDesMelhoria)}
      <h4>Estratégias GEO para o nicho</h4>${lista(ia.estrategiasGEO)}
    </div>

    <div class="grade-2">
      <div class="card">
        <h3>Presença digital</h3>
        <p>${esc(geo.presencaDigital?.analise)}</p>
        ${lista(geo.presencaDigital?.sugestoes, 'Sem sugestões.')}
      </div>
      <div class="card">
        <h3>NAP (Name, Address, Phone) ${selo(geo.nap?.status)}</h3>
        <p>${esc(geo.nap?.analise)}</p>
        ${lista(geo.nap?.sugestoes, 'Sem sugestões.')}
      </div>
    </div>

    <div class="card">
      <h3>Conteúdo para GEO</h3>
      <h4>Tópicos recomendados</h4>${lista(geo.conteudoParaGEO?.topicosRecomendados)}
      <h4>Formatos ideais</h4>${lista(geo.conteudoParaGEO?.formatosIdeal)}
      <p><strong>Abordagem:</strong> ${esc(geo.conteudoParaGEO?.abordagemRecomendada)}</p>
    </div>

    <div class="card"><h3>Plano de ação — GEO</h3>${tabelaPlano(geo.planoDeAcaoGEO)}</div>
  </section>`;
}

function secaoAEO(aeo) {
  if (!aeo) return '';
  return `<section class="secao s-aeo">
    <h2>3. AEO — Answer Engine Optimization ${selo(aeo.nivel)} — ${esc(aeo.pontuacao)}/100</h2>
    <div class="card"><p>${esc(aeo.resumo)}</p></div>

    <div class="card">
      <h3>Featured Snippets ${selo(aeo.featuredSnippets?.potencial)}</h3>
      <p>${esc(aeo.featuredSnippets?.analise)}</p>
      <div class="grade-2">
        <div><h4>Estruturas presentes</h4>${lista(aeo.featuredSnippets?.estruturasPresentes)}</div>
        <div><h4>Estruturas faltantes</h4>${lista(aeo.featuredSnippets?.estruturasFaltantes)}</div>
      </div>
      ${lista(aeo.featuredSnippets?.sugestoes, 'Sem sugestões.')}
    </div>

    <div class="card">
      <h3>FAQ ${aeo.faq?.temFAQSchema ? selo('presente') : selo('ausente')}</h3>
      <p>${esc(aeo.faq?.qualidadePerguntas)}</p>
      <h4>Perguntas recomendadas para o nicho</h4>
      ${lista(aeo.faq?.perguntasRecomendadasParaNicho)}
      <p><strong>Como implementar:</strong> ${esc(aeo.faq?.comoImplementar)}</p>
    </div>

    <div class="grade-2">
      <div class="card">
        <h3>Dados estruturados para AEO</h3>
        <h4>Schemas recomendados</h4>${lista(aeo.dadosEstruturadosAEO?.schemasParaAEO)}
        <h4>Implementação</h4>${lista(aeo.dadosEstruturadosAEO?.implementacaoRecomendada)}
      </div>
      <div class="card">
        <h3>Busca por voz</h3>
        <p>${esc(aeo.otimizacaoParaBuscaVoice?.analise)}</p>
        ${lista(aeo.otimizacaoParaBuscaVoice?.sugestoes, 'Sem sugestões.')}
      </div>
    </div>

    <div class="grade-2">
      <div class="card">
        <h3>Respostas diretas</h3>
        <p>${esc(aeo.respostasDirectas?.analise)}</p>
        <h4>Formatos recomendados</h4>${lista(aeo.respostasDirectas?.formatosRecomendados)}
        <h4>Exemplos de conteúdo</h4>${lista(aeo.respostasDirectas?.exemplosDeConteudo)}
      </div>
      <div class="card">
        <h3>Knowledge Graph</h3>
        <p>${esc(aeo.knowledgeGraph?.analise)}</p>
        ${lista(aeo.knowledgeGraph?.sugestoes, 'Sem sugestões.')}
      </div>
    </div>

    <div class="card"><h3>Plano de ação — AEO</h3>${tabelaPlano(aeo.planoDeAcaoAEO)}</div>
  </section>`;
}

function secaoFrontend(fe) {
  if (!fe) return '';
  const cwv = fe.performance?.coreWebVitals || {};
  return `<section class="secao s-frontend">
    <h2>4. Frontend ${selo(fe.nivel)} — ${esc(fe.pontuacao)}/100</h2>
    <div class="card"><p>${esc(fe.resumo)}</p></div>

    <div class="card">
      <h3>UX / UI</h3>
      <p><strong>Primeira impressão:</strong> ${esc(fe.uxUI?.primeiraImpressao)}</p>
      <p><strong>Hierarquia visual:</strong> ${esc(fe.uxUI?.hierarquiaVisual)}</p>
      <p><strong>Consistência:</strong> ${esc(fe.uxUI?.consistencia)}</p>
      ${lista(fe.uxUI?.sugestoes, 'Sem sugestões.')}
    </div>

    <div class="card">
      <h3>Performance &amp; Core Web Vitals</h3>
      <p>${esc(fe.performance?.analise)}</p>
      <table><tbody>
        <tr><td><strong>LCP estimado</strong></td><td>${esc(cwv.lcpEstimado)}</td></tr>
      </tbody></table>
      <h4>Recomendações FID/INP</h4>${lista(cwv.fidRecomendacoes)}
      <h4>Recomendações CLS</h4>${lista(cwv.clsRecomendacoes)}
      <h4>Otimizações</h4>${lista(fe.performance?.otimizacoes)}
    </div>

    <div class="grade-2">
      <div class="card">
        <h3>Mobile ${selo(fe.mobile?.status)}</h3>
        <p>${esc(fe.mobile?.analise)}</p>
        ${lista(fe.mobile?.sugestoes, 'Sem sugestões.')}
      </div>
      <div class="card">
        <h3>Acessibilidade — ${esc(fe.acessibilidade?.pontuacao)}/100</h3>
        <h4>Problemas</h4>${lista(fe.acessibilidade?.problemas, 'Nenhum problema apontado.')}
        <h4>Sugestões</h4>${lista(fe.acessibilidade?.sugestoes, 'Sem sugestões.')}
      </div>
    </div>

    <div class="card">
      <h3>Conversão</h3>
      <p><strong>CTAs:</strong> ${esc(fe.conversao?.ctas)}</p>
      <p><strong>Formulários:</strong> ${esc(fe.conversao?.formularios)}</p>
      <p><strong>Elementos de confiança:</strong> ${esc(fe.conversao?.elementos)}</p>
      ${lista(fe.conversao?.sugestoes, 'Sem sugestões.')}
    </div>

    <div class="grade-2">
      <div class="card">
        <h3>Velocidade</h3>
        <p>${esc(fe.velocidade?.analise)}</p>
        <p><strong>Scripts na página:</strong> ${esc(fe.velocidade?.scripts)}</p>
        ${lista(fe.velocidade?.otimizacoes, 'Sem otimizações listadas.')}
      </div>
      <div class="card">
        <h3>Segurança</h3>
        <div class="alerta ${fe.seguranca?.https ? 'ok' : 'perigo'}">HTTPS: ${fe.seguranca?.https ? 'ativo ✓' : 'AUSENTE'}</div>
        <p>${esc(fe.seguranca?.analise)}</p>
        ${lista(fe.seguranca?.sugestoes, 'Sem sugestões.')}
      </div>
    </div>

    <div class="card"><h3>Plano de ação — Frontend</h3>${tabelaPlano(fe.planoDeAcaoFrontend)}</div>
  </section>`;
}

function secaoPlano90(rel) {
  const p = rel.planoDeAcaoMestral || {};
  const mes = (m, rotulo) => `<div class="mes">
    <h3>${rotulo}</h3>
    <div class="foco">${esc(m?.foco)}</div>
    ${lista(m?.acoes, 'Sem ações.')}
  </div>`;
  return `<section class="secao">
    <h2>5. Plano de ação — 90 dias</h2>
    <div class="card">
      <h3>Competitividade</h3>
      <p>${esc(rel.competitividade?.posicionamentoAtual)}</p>
      <div class="grade-2">
        <div><h4>Diferenciais</h4>${lista(rel.competitividade?.diferenciais)}</div>
        <div><h4>Vulnerabilidades</h4>${lista(rel.competitividade?.vulnerabilidades)}</div>
      </div>
      <h4>Oportunidades de mercado</h4>${lista(rel.competitividade?.oportunidadesDeMercado)}
    </div>
    <div class="timeline">
      ${mes(p.mes1, 'Mês 1')}
      ${mes(p.mes2, 'Mês 2')}
      ${mes(p.mes3, 'Mês 3')}
    </div>
  </section>`;
}

function secaoKPIs(kpis) {
  if (!kpis) return '';
  return `<section class="secao">
    <h2>6. KPIs e monitoramento</h2>
    <div class="grade-2">
      <div class="card"><h3>KPIs para monitorar</h3>${lista(kpis.kpisParaMonitorar)}</div>
      <div class="card"><h3>Ferramentas recomendadas</h3>${lista(kpis.ferramentasRecomendadas)}</div>
    </div>
    <div class="card"><h3>Metas realistas em 90 dias</h3>${lista(kpis.metasRealistasSugeridasEm90Dias)}</div>
  </section>`;
}

// ------------------------------------------------------------------
// Montagem do documento
// ------------------------------------------------------------------
function renderizar(entrada) {
  const rel = entrada.relatorio;
  const container = document.getElementById('relatorio');

  const scores = `<div class="scores-grid">
    <div class="score-card"><div class="num">${esc(rel.scoreGeral)}</div><div class="nome">Geral</div></div>
    <div class="score-card seo"><div class="num">${esc(rel.scoreSEO)}</div><div class="nome">SEO</div></div>
    <div class="score-card geo"><div class="num">${esc(rel.scoreGEO)}</div><div class="nome">GEO</div></div>
    <div class="score-card aeo"><div class="num">${esc(rel.scoreAEO)}</div><div class="nome">AEO</div></div>
    <div class="score-card frontend"><div class="num">${esc(rel.scoreFrontend)}</div><div class="nome">Frontend</div></div>
  </div>`;

  const limitacoes = entrada.limitacoes?.length
    ? `<div class="alerta aviso"><strong>Limitações da coleta:</strong> ${esc(entrada.limitacoes.join('; '))}</div>`
    : '';

  container.innerHTML = `
    <div class="cabecalho">
      <img src="../icons/icon128.png" alt="SiteAnalyzer Pro">
      <div>
        <h1>SiteAnalyzer Pro — Relatório de Análise</h1>
        <div class="meta">
          <strong>${esc(rel.urlAnalisada)}</strong> · ${esc(rel.dataAnalise)}<br>
          Nicho: <strong>${esc(rel.nicho)}</strong>
        </div>
      </div>
    </div>

    ${scores}
    ${limitacoes}

    <div class="card">
      <h3>Resumo executivo</h3>
      <p>${esc(rel.resumoExecutivo)}</p>
      <h4>Nicho detalhado</h4>
      <p>${esc(rel.nichoDetalhado)}</p>
    </div>

    ${secaoProblemas(rel, entrada)}
    ${secaoSEO(rel.seo)}
    ${secaoGEO(rel.geo)}
    ${secaoAEO(rel.aeo)}
    ${secaoFrontend(rel.frontend)}
    ${secaoPlano90(rel)}
    ${secaoKPIs(rel.kpis)}

    <div class="rodape-relatorio">
      Gerado por SiteAnalyzer Pro v${esc(chrome.runtime.getManifest().version)} ·
      Análise por IA (Groq) · ${new Date().toLocaleString('pt-BR')}
    </div>
  `;
}

// ------------------------------------------------------------------
// Exportação em PDF
// ------------------------------------------------------------------
async function gerarPDF(entrada) {
  const btn = document.getElementById('btn-exportar-pdf');

  // Fallback: libs não incluídas no bundle → diálogo nativo (Salvar como PDF)
  if (!window.jspdf || !window.html2canvas) {
    alert('Bibliotecas jsPDF/html2canvas não encontradas em libs/.\n' +
      'Será aberto o diálogo de impressão — escolha "Salvar como PDF".\n' +
      'Para a exportação direta, rode libs/baixar-libs.sh (ver libs/README.md).');
    window.print();
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Gerando PDF…';
  try {
    const { jsPDF } = window.jspdf;
    const elemento = document.getElementById('relatorio');

    const canvas = await html2canvas(elemento, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#0f1117',
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;            // largura A4 em mm
    const pageHeight = 295;          // altura útil A4 em mm
    const imgHeight = canvas.height * imgWidth / canvas.width;
    const imgData = canvas.toDataURL('image/jpeg', 0.92);

    // Paginação automática deslocando a mesma imagem para cima
    let restante = imgHeight;
    let posicao = 0;
    pdf.addImage(imgData, 'JPEG', 0, posicao, imgWidth, imgHeight);
    restante -= pageHeight;
    while (restante > 0) {
      posicao -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, posicao, imgWidth, imgHeight);
      restante -= pageHeight;
    }

    const dominio = (entrada.dominio || 'site').replace(/[^\w.-]/g, '_');
    const data = new Date().toISOString().slice(0, 10);
    pdf.save(`SiteAnalyzer_${dominio}_${data}.pdf`);
  } catch (e) {
    alert('Falha ao gerar o PDF: ' + e.message + '\nUsando o diálogo de impressão como alternativa.');
    window.print();
  } finally {
    btn.disabled = false;
    btn.textContent = '📄 Exportar PDF';
  }
}

// ------------------------------------------------------------------
// Inicialização
// ------------------------------------------------------------------
(async function init() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id') || undefined;

  const resp = await new Promise((res) =>
    chrome.runtime.sendMessage({ tipo: 'OBTER_ANALISE', id }, res));

  const entrada = resp?.entrada;
  if (!entrada?.relatorio) {
    document.getElementById('estado-vazio').textContent =
      'Nenhuma análise encontrada. Volte ao popup e clique em "Analisar Este Site".';
    return;
  }

  renderizar(entrada);
  document.title = `Relatório — ${entrada.dominio}`;
  document.getElementById('btn-exportar-pdf').addEventListener('click', () => gerarPDF(entrada));

  // Aberto via botão "Gerar PDF" do popup → exporta automaticamente
  if (params.get('pdf') === '1') {
    setTimeout(() => gerarPDF(entrada), 600);
  }
})();
