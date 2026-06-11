// =====================================================================
// SiteAnalyzer Pro — Importação de HTML manual
// Permite ao usuário colar/enviar o HTML de páginas do site para dar
// mais acesso à análise (áreas logadas, páginas renderizadas por JS,
// páginas que o fetch de subpáginas não alcançou).
//
// Observação: replica parte dos coletores do content script adaptados
// para documentos do DOMParser (sem runtime: performance, computedStyle
// e innerText não existem aqui — usa textContent e marca as limitações).
// =====================================================================

'use strict';

const HTML_EXTRA_KEY = 'siteanalyzer.htmlExtra';
const HTML_EXTRA_MAX = 6;            // máximo de páginas manuais
const HTML_EXTRA_MAX_CHARS = 400000; // ~400KB por página

// ------------------------------------------------------------------
// Armazenamento das páginas adicionadas (sobrevive ao fechar o popup)
// ------------------------------------------------------------------
function obterHtmlExtra() {
  return new Promise((res) => chrome.storage.local.get(HTML_EXTRA_KEY, (r) => res(r[HTML_EXTRA_KEY] || [])));
}
function salvarHtmlExtra(lista) {
  return new Promise((res) => chrome.storage.local.set({ [HTML_EXTRA_KEY]: lista.slice(0, HTML_EXTRA_MAX) }, res));
}

// ------------------------------------------------------------------
// Helpers sobre um Document do DOMParser
// ------------------------------------------------------------------
function parsearHTML(html) {
  return new DOMParser().parseFromString(html, 'text/html');
}

function textoCorpo(doc) {
  const corpo = doc.body ? doc.body.cloneNode(true) : null;
  if (!corpo) return '';
  corpo.querySelectorAll('script, style, noscript, template').forEach((e) => e.remove());
  return (corpo.textContent || '').replace(/\s+/g, ' ').trim();
}

function schemasDeDoc(doc) {
  const brutos = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  const objetos = [];
  const tipos = [];
  let invalidos = 0;
  const achatar = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { obj.forEach(achatar); return; }
    objetos.push(obj);
    if (obj['@type']) (Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']]).forEach((t) => tipos.push(String(t)));
    if (obj['@graph']) achatar(obj['@graph']);
  };
  brutos.forEach((s) => {
    try { achatar(JSON.parse(s.textContent)); }
    catch { invalidos++; tipos.push('INVÁLIDO'); }
  });
  return {
    objetos, tipos, invalidos,
    raw: brutos.map((s) => s.textContent).join('\n').substring(0, 2000),
    temTipo: (re) => tipos.some((t) => re.test(t)),
    buscar: (re) => objetos.find((o) => {
      const t = o['@type'];
      return t && (Array.isArray(t) ? t : [t]).some((x) => re.test(String(x)));
    }) || null,
  };
}

// ------------------------------------------------------------------
// Resumo no formato de subpágina (mesmo shape do content script)
// ------------------------------------------------------------------
function resumoSubpaginaDeHTML(html, url) {
  const doc = parsearHTML(html);
  const q = (sel) => doc.querySelector(sel);
  const schemas = schemasDeDoc(doc);
  const imgs = Array.from(doc.querySelectorAll('img'));
  return {
    url,
    title: doc.title || null,
    titleLength: (doc.title || '').length,
    metaDescription: q('meta[name="description"]')?.content || null,
    metaDescriptionLength: (q('meta[name="description"]')?.content || '').length,
    canonical: q('link[rel="canonical"]')?.getAttribute('href') || null,
    h1: Array.from(doc.querySelectorAll('h1')).map((h) => (h.textContent || '').trim()).slice(0, 3),
    h1Count: doc.querySelectorAll('h1').length,
    totalImages: imgs.length,
    imagesWithoutAlt: imgs.filter((i) => !i.getAttribute('alt')).length,
    wordCount: textoCorpo(doc).split(/\s+/).filter(Boolean).length,
    schemaTypes: [...new Set(schemas.tipos)].slice(0, 8),
    hasFAQSchema: schemas.temTipo(/FAQPage/i),
    hasViewport: !!q('meta[name="viewport"]'),
    hasOgTitle: !!q('meta[property="og:title"]'),
    hasBreadcrumb: schemas.temTipo(/BreadcrumbList/i) || !!q('.breadcrumb, .breadcrumbs'),
    origem: 'html-manual',
  };
}

// ------------------------------------------------------------------
// Conjunto completo de dados a partir de um HTML (página principal)
// Usado quando a aba ativa não pode ser analisada (chrome://, etc.)
// ------------------------------------------------------------------
function dadosCompletosDeHTML(html, urlStr) {
  const doc = parsearHTML(html);
  const q = (sel) => doc.querySelector(sel);
  const qq = (sel) => Array.from(doc.querySelectorAll(sel));
  const meta = (sel) => q(sel)?.content || null;
  const txt = (el) => (el?.textContent || '').trim();

  let urlObj;
  try { urlObj = new URL(urlStr); }
  catch { urlObj = new URL('https://pagina-local.invalida/'); }

  const schemas = schemasDeDoc(doc);
  const corpoTexto = textoCorpo(doc);
  const imgs = qq('img');
  const links = qq('a');

  const seoData = {
    title: doc.title || '',
    titleLength: (doc.title || '').length,
    metaDescription: meta('meta[name="description"]'),
    metaDescriptionLength: (meta('meta[name="description"]') || '').length,
    metaKeywords: meta('meta[name="keywords"]'),
    canonicalURL: q('link[rel="canonical"]')?.getAttribute('href') || null,
    ogTitle: meta('meta[property="og:title"]'),
    ogDescription: meta('meta[property="og:description"]'),
    ogImage: meta('meta[property="og:image"]'),
    ogType: meta('meta[property="og:type"]'),
    ogURL: meta('meta[property="og:url"]'),
    twitterCard: meta('meta[name="twitter:card"]'),
    twitterTitle: meta('meta[name="twitter:title"]'),
    twitterDescription: meta('meta[name="twitter:description"]'),
    twitterImage: meta('meta[name="twitter:image"]'),
    h1: qq('h1').map(txt).slice(0, 10),
    h2: qq('h2').map(txt).slice(0, 20),
    h3: qq('h3').map(txt).slice(0, 20),
    h4: qq('h4').map(txt).slice(0, 15),
    h5: qq('h5').map(txt).slice(0, 10),
    h6: qq('h6').map(txt).slice(0, 10),
    totalImages: imgs.length,
    imagesWithoutAlt: imgs.filter((i) => !i.getAttribute('alt')).length,
    imagesWithAlt: imgs.filter((i) => i.getAttribute('alt')).length,
    imagesAltList: imgs.map((i) => ({ src: (i.getAttribute('src') || '').substring(0, 150), alt: i.getAttribute('alt') || 'AUSENTE' })).slice(0, 20),
    totalLinks: links.length,
    internalLinks: links.filter((a) => (a.getAttribute('href') || '').includes(urlObj.hostname) || /^[/#.]/.test(a.getAttribute('href') || '')).length,
    externalLinks: links.filter((a) => /^https?:/.test(a.getAttribute('href') || '') && !(a.getAttribute('href') || '').includes(urlObj.hostname)).length,
    brokenLinkCandidates: links.filter((a) => !a.getAttribute('href') || a.getAttribute('href') === '#').length,
    wordCount: corpoTexto.split(/\s+/).filter(Boolean).length,
    paragraphCount: qq('p').length,
    textContent: corpoTexto.substring(0, 3000),
    schemaTypes: schemas.tipos,
    schemaRaw: schemas.raw,
    url: urlObj.href,
    domain: urlObj.hostname,
    protocol: urlObj.protocol,
    isHTTPS: urlObj.protocol === 'https:',
    hasRobotsMeta: !!q('meta[name="robots"]'),
    robotsContent: meta('meta[name="robots"]'),
    hasViewport: !!q('meta[name="viewport"]'),
    viewportContent: meta('meta[name="viewport"]'),
    lang: doc.documentElement.lang || null,
    charset: (q('meta[charset]')?.getAttribute('charset')) || null,
    hreflangTags: qq('link[hreflang]').map((l) => ({ lang: l.hreflang, href: l.getAttribute('href') })).slice(0, 20),
    hasPagination: !!q('link[rel="next"], link[rel="prev"]'),
    totalScripts: qq('script').length,
    externalScripts: qq('script[src]').length,
    totalStylesheets: qq('link[rel="stylesheet"]').length,
    inlineStyles: qq('[style]').length,
    hasFavicon: !!q('link[rel*="icon"]'),
  };

  const telefone = corpoTexto.match(/(\+?55[\s.-]?)?(\(?\d{2}\)?[\s.-]?)?(9?\d{4})[\s.-]?\d{4}\b/);
  const email = corpoTexto.match(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/);
  const endereco = corpoTexto.match(/\b(rua|av\.?|avenida|alameda|travessa|rodovia|estrada|pra[çc]a|street|avenue)\s+[^\n,;]{3,60}/i);
  const lbSchema = schemas.buscar(/LocalBusiness|Store|Restaurant|Hotel|Dentist|Attorney|MedicalBusiness/i);

  const geoData = {
    hasLocalBusiness: !!lbSchema,
    hasNAP: !!(telefone && endereco),
    napData: {
      address: endereco ? endereco[0].trim().substring(0, 120) : null,
      phone: telefone ? telefone[0].trim() : null,
      email: email ? email[0].trim() : null,
    },
    multiLanguage: qq('link[hreflang]').length > 0,
    availableLanguages: qq('link[hreflang]').map((l) => l.hreflang).slice(0, 20),
    geoRegion: meta('meta[name="geo.region"]'),
    geoPlacename: meta('meta[name="geo.placename"]'),
    geoPosition: meta('meta[name="geo.position"]'),
    icbm: meta('meta[name="ICBM"]'),
    localBusinessSchema: lbSchema ? JSON.stringify(lbSchema).substring(0, 1000) : null,
    hasAuthorInfo: !!q('[itemtype*="Person"], [rel="author"], .author, .byline'),
    hasAboutPage: links.some((a) => /sobre|about|quem somos/i.test(txt(a))),
    hasContactPage: links.some((a) => /contato|contact/i.test(txt(a))),
    hasPrivacyPolicy: links.some((a) => /privacidade|privacy/i.test(txt(a))),
    hasTerms: links.some((a) => /termos|terms/i.test(txt(a))),
    hasSocialProof: !!q('.testimonial, .review, .depoimento, [itemtype*="Review"]'),
    hasCertifications: /certifica|certified|iso \d|selo de/i.test(corpoTexto),
    hasAwards: /pr[êe]mio|award|vencedor|winner/i.test(corpoTexto),
  };

  const headings = qq('h2, h3, h4');
  let respostasConcisas = 0;
  headings.forEach((h) => {
    const prox = h.nextElementSibling;
    if (prox && prox.tagName === 'P') {
      const n = txt(prox).split(/\s+/).filter(Boolean).length;
      if (n > 0 && n < 50) respostasConcisas++;
    }
  });
  const perguntas = headings.filter((h) => txt(h).includes('?')).map(txt).slice(0, 20);
  const comSameAs = schemas.objetos.find((o) => o.sameAs);
  const bcSchema = schemas.buscar(/BreadcrumbList/i);

  const aeoData = {
    hasFAQSchema: schemas.temTipo(/FAQPage/i),
    faqContent: qq('[itemtype*="FAQPage"] .faq-question, details summary, .accordion-header, [class*="faq"] h3, [class*="faq"] h4').map(txt).filter(Boolean).slice(0, 20),
    questionElements: perguntas,
    hasDefinitionBox: !!q('.definition, .glossary, [class*="definition"]'),
    hasNumberedLists: qq('ol').length,
    hasBulletLists: qq('ul').length,
    hasTableData: qq('table').length,
    hasHowToSchema: schemas.temTipo(/HowTo/i),
    hasArticleSchema: schemas.temTipo(/Article|BlogPosting|NewsArticle/i),
    hasBreadcrumb: !!q('[itemtype*="BreadcrumbList"], nav[aria-label*="breadcrumb" i], .breadcrumb, .breadcrumbs') || !!bcSchema,
    breadcrumbSchema: bcSchema ? JSON.stringify(bcSchema).substring(0, 800) : null,
    hasConversationalContent: perguntas.length >= 2,
    hasConciseAnswers: respostasConcisas,
    hasSpeakableSchema: schemas.temTipo(/Speakable/i) || schemas.objetos.some((o) => o.speakable),
    hasSameAs: !!comSameAs,
    sameAsLinks: comSameAs ? (Array.isArray(comSameAs.sameAs) ? comSameAs.sameAs : [comSameAs.sameAs]).slice(0, 15) : [],
    allSchemaTypes: [...new Set(schemas.tipos)],
    schemaValidationIssues: [],
  };

  // Frontend estático: sem performance/computedStyle (HTML colado)
  const frontendData = {
    loadTime: null,
    domContentLoaded: null,
    hasViewportMeta: !!q('meta[name="viewport"]'),
    viewportContent: meta('meta[name="viewport"]'),
    hasMediaQueries: qq('style').some((s) => (s.textContent || '').includes('@media')),
    hasSkipLink: !!q('a[href="#main"], a[href="#content"]'),
    hasAriaLabels: qq('[aria-label]').length,
    hasAriaRoles: qq('[role]').length,
    imagesWithoutAlt: seoData.imagesWithoutAlt,
    hasLangAttribute: !!doc.documentElement.lang,
    fontFamilies: [],
    colorScheme: null,
    hasDarkMode: !!q('[data-theme], [class*="dark"]'),
    ctaButtons: qq('button, .btn, [class*="cta"], [class*="button"]').map(txt).filter(Boolean).slice(0, 15),
    hasNewsletterForm: !!q('input[type="email"]'),
    hasChatWidget: !!q('[class*="chat"], [id*="chat"], [class*="intercom"], [class*="crisp"]'),
    isHTTPS: seoData.isHTTPS,
    hasMixedContent: seoData.isHTTPS && qq('img[src^="http:"], script[src^="http:"], iframe[src^="http:"], link[href^="http:"]').length > 0,
    totalImages: imgs.length,
    lazyImages: qq('img[loading="lazy"]').length,
    modernImageFormats: imgs.filter((i) => /\.webp|\.avif/i.test(i.getAttribute('src') || '')).length,
    hasWebFonts: qq('link').some((l) => /fonts\.googleapis|typekit/i.test(l.getAttribute('href') || '')),
    largestElement: null,
    hasSocialLinks: links.filter((a) => /instagram|facebook|twitter|linkedin|youtube|tiktok/i.test(a.getAttribute('href') || '')).length,
    hasVideo: qq('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length,
    hasAnimation: !!q('[class*="animate"], [class*="transition"], [data-aos]'),
    hasFooter: !!q('footer'),
    footerContent: txt(q('footer')).substring(0, 500) || null,
    hasNav: !!q('nav'),
    navItems: qq('nav a').map(txt).filter(Boolean).slice(0, 20),
    hasMegaMenu: !!q('.mega-menu, [class*="mega-menu"]'),
    totalForms: qq('form').length,
    formFields: qq('input, textarea, select').map((f) => ({ type: f.getAttribute('type') || f.tagName.toLowerCase(), name: f.getAttribute('name'), placeholder: f.getAttribute('placeholder') })).slice(0, 20),
    pageHTML: html.substring(0, 5000),
    bodyClasses: doc.body?.className || '',
    hasPopups: !!q('.modal, .popup, [class*="overlay"], [class*="modal"]'),
    hasCookieBanner: !!q('[class*="cookie"], [id*="cookie"], [class*="gdpr"]'),
  };

  return {
    seoData, geoData, aeoData, frontendData,
    limitacoes: [
      'Página principal analisada a partir de HTML fornecido manualmente — métricas de runtime (tempo de carregamento, fontes computadas, dark mode do sistema) indisponíveis',
    ],
    coletadoEm: new Date().toISOString(),
  };
}
