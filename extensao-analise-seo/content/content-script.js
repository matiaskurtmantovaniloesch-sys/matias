// =====================================================================
// SiteAnalyzer Pro — Content Script
// Coleta dados de SEO, GEO, AEO e Frontend do DOM da página ativa.
// Responde à mensagem { tipo: 'COLETAR_DADOS' } enviada pelo popup.
// =====================================================================

(() => {
  'use strict';

  // Evita registrar o listener duas vezes caso o script seja reinjetado
  if (window.__siteAnalyzerProAtivo) return;
  window.__siteAnalyzerProAtivo = true;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const meta = (sel) => $(sel)?.content || null;
  const texto = (el) => (el?.innerText || '').trim();

  // ---------------------------------------------------------------
  // Schemas LD+JSON — parse único reutilizado por todas as análises
  // ---------------------------------------------------------------
  function coletarSchemas() {
    const brutos = $$('script[type="application/ld+json"]');
    const objetos = [];
    const tipos = [];
    let invalidos = 0;

    const achatar = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) { obj.forEach(achatar); return; }
      objetos.push(obj);
      if (obj['@type']) {
        (Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']]).forEach((t) => tipos.push(String(t)));
      }
      if (obj['@graph']) achatar(obj['@graph']);
    };

    brutos.forEach((s) => {
      try { achatar(JSON.parse(s.textContent)); }
      catch { invalidos++; tipos.push('INVÁLIDO'); }
    });

    return {
      objetos,
      tipos,
      invalidos,
      raw: brutos.map((s) => s.textContent).join('\n').substring(0, 2000),
      temTipo: (re) => tipos.some((t) => re.test(t)),
      buscar: (re) => objetos.find((o) => {
        const t = o['@type'];
        return t && (Array.isArray(t) ? t : [t]).some((x) => re.test(String(x)));
      }) || null,
    };
  }

  function validarSchemas(schemas) {
    // Verificação superficial de campos obrigatórios dos schemas mais comuns
    const regras = {
      Article: ['headline', 'author', 'datePublished'],
      BlogPosting: ['headline', 'author', 'datePublished'],
      Product: ['name', 'offers'],
      LocalBusiness: ['name', 'address'],
      FAQPage: ['mainEntity'],
      HowTo: ['name', 'step'],
      BreadcrumbList: ['itemListElement'],
      Organization: ['name', 'url'],
    };
    const problemas = [];
    schemas.objetos.forEach((obj) => {
      const tipos = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
      tipos.forEach((t) => {
        const obrigatorios = regras[t];
        if (!obrigatorios) return;
        obrigatorios.forEach((campo) => {
          if (!(campo in obj)) problemas.push(`${t}: campo obrigatório "${campo}" ausente`);
        });
      });
    });
    if (schemas.invalidos > 0) problemas.push(`${schemas.invalidos} bloco(s) LD+JSON com JSON inválido`);
    return problemas.slice(0, 20);
  }

  // ---------------------------------------------------------------
  // 1. SEO
  // ---------------------------------------------------------------
  function coletarSEO(schemas) {
    const imgs = $$('img');
    const links = $$('a');
    const bodyText = document.body?.innerText || '';

    return {
      // Meta básico
      title: document.title,
      titleLength: document.title.length,
      metaDescription: meta('meta[name="description"]'),
      metaDescriptionLength: (meta('meta[name="description"]') || '').length,
      metaKeywords: meta('meta[name="keywords"]'),
      canonicalURL: $('link[rel="canonical"]')?.href || null,

      // Open Graph
      ogTitle: meta('meta[property="og:title"]'),
      ogDescription: meta('meta[property="og:description"]'),
      ogImage: meta('meta[property="og:image"]'),
      ogType: meta('meta[property="og:type"]'),
      ogURL: meta('meta[property="og:url"]'),

      // Twitter Cards
      twitterCard: meta('meta[name="twitter:card"]'),
      twitterTitle: meta('meta[name="twitter:title"]'),
      twitterDescription: meta('meta[name="twitter:description"]'),
      twitterImage: meta('meta[name="twitter:image"]'),

      // Headings — estrutura completa (limitadas para não estourar tokens)
      h1: $$('h1').map(texto).slice(0, 10),
      h2: $$('h2').map(texto).slice(0, 20),
      h3: $$('h3').map(texto).slice(0, 20),
      h4: $$('h4').map(texto).slice(0, 15),
      h5: $$('h5').map(texto).slice(0, 10),
      h6: $$('h6').map(texto).slice(0, 10),

      // Imagens
      totalImages: imgs.length,
      imagesWithoutAlt: imgs.filter((i) => !i.alt).length,
      imagesWithAlt: imgs.filter((i) => i.alt).length,
      imagesAltList: imgs.map((i) => ({ src: (i.src || '').substring(0, 150), alt: i.alt || 'AUSENTE' })).slice(0, 20),

      // Links
      totalLinks: links.length,
      internalLinks: links.filter((a) => a.href && a.href.includes(window.location.hostname)).length,
      externalLinks: links.filter((a) => a.href && !a.href.includes(window.location.hostname) && a.href.startsWith('http')).length,
      brokenLinkCandidates: links.filter((a) => !a.getAttribute('href') || a.getAttribute('href') === '#').length,

      // Conteúdo
      wordCount: bodyText.split(/\s+/).filter((w) => w.length > 0).length,
      paragraphCount: $$('p').length,
      textContent: bodyText.substring(0, 3000),

      // Schema Markup
      schemaTypes: schemas.tipos,
      schemaRaw: schemas.raw,

      // Técnico
      url: window.location.href,
      domain: window.location.hostname,
      protocol: window.location.protocol,
      isHTTPS: window.location.protocol === 'https:',
      hasRobotsMeta: !!$('meta[name="robots"]'),
      robotsContent: meta('meta[name="robots"]'),
      hasViewport: !!$('meta[name="viewport"]'),
      viewportContent: meta('meta[name="viewport"]'),
      lang: document.documentElement.lang || null,
      charset: document.characterSet,

      // Hreflang
      hreflangTags: $$('link[hreflang]').map((l) => ({ lang: l.hreflang, href: l.href })).slice(0, 20),

      // Paginação
      hasPagination: !!$('link[rel="next"], link[rel="prev"]'),

      // Performance visual
      totalScripts: $$('script').length,
      externalScripts: $$('script[src]').length,
      totalStylesheets: $$('link[rel="stylesheet"]').length,
      inlineStyles: $$('[style]').length,

      // Favicon
      hasFavicon: !!$('link[rel*="icon"]'),
    };
  }

  // ---------------------------------------------------------------
  // 2. GEO (Generative Engine Optimization)
  // ---------------------------------------------------------------
  function coletarGEO(schemas) {
    const bodyText = (document.body?.innerText || '').substring(0, 30000);
    const links = $$('a');

    const telefone = bodyText.match(/(\+?55[\s.-]?)?(\(?\d{2}\)?[\s.-]?)?(9?\d{4})[\s.-]?\d{4}\b/);
    const email = bodyText.match(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/);
    const endereco = bodyText.match(/\b(rua|av\.?|avenida|alameda|travessa|rodovia|estrada|pra[çc]a|street|avenue)\s+[^\n,;]{3,60}/i);

    const lbSchema = schemas.buscar(/LocalBusiness|Store|Restaurant|Hotel|Dentist|Attorney|MedicalBusiness/i);

    return {
      // Dados locais/geográficos
      hasLocalBusiness: !!lbSchema,
      hasNAP: !!(telefone && endereco),
      napData: {
        address: endereco ? endereco[0].trim().substring(0, 120) : null,
        phone: telefone ? telefone[0].trim() : null,
        email: email ? email[0].trim() : null,
      },

      // Presença em múltiplos idiomas
      multiLanguage: $$('link[hreflang]').length > 0,
      availableLanguages: $$('link[hreflang]').map((l) => l.hreflang).slice(0, 20),

      // Geolocalização meta
      geoRegion: meta('meta[name="geo.region"]'),
      geoPlacename: meta('meta[name="geo.placename"]'),
      geoPosition: meta('meta[name="geo.position"]'),
      icbm: meta('meta[name="ICBM"]'),

      // Schema localizado
      localBusinessSchema: lbSchema ? JSON.stringify(lbSchema).substring(0, 1000) : null,

      // Sinais de E-E-A-T
      hasAuthorInfo: !!$('[itemtype*="Person"], [rel="author"], .author, .byline'),
      hasAboutPage: links.some((a) => /sobre|about|quem somos/i.test(texto(a))),
      hasContactPage: links.some((a) => /contato|contact/i.test(texto(a))),
      hasPrivacyPolicy: links.some((a) => /privacidade|privacy/i.test(texto(a))),
      hasTerms: links.some((a) => /termos|terms/i.test(texto(a))),

      // Confiança e autoridade
      hasSocialProof: !!$('.testimonial, .review, .depoimento, [itemtype*="Review"]'),
      hasCertifications: /certifica|certified|iso \d|selo de/i.test(bodyText),
      hasAwards: /pr[êe]mio|award|vencedor|winner|top \d+ (de|do|da)/i.test(bodyText),
    };
  }

  // ---------------------------------------------------------------
  // 3. AEO (Answer Engine Optimization)
  // ---------------------------------------------------------------
  function coletarAEO(schemas) {
    const headings = $$('h2, h3, h4');

    // Parágrafos curtos (<50 palavras) logo após headings = respostas concisas
    let respostasConcisas = 0;
    headings.forEach((h) => {
      const prox = h.nextElementSibling;
      if (prox && prox.tagName === 'P') {
        const palavras = texto(prox).split(/\s+/).filter(Boolean).length;
        if (palavras > 0 && palavras < 50) respostasConcisas++;
      }
    });

    const perguntas = headings.filter((h) => texto(h).includes('?')).map(texto).slice(0, 20);

    // sameAs em qualquer schema
    const comSameAs = schemas.objetos.find((o) => o.sameAs);
    const sameAsLinks = comSameAs
      ? (Array.isArray(comSameAs.sameAs) ? comSameAs.sameAs : [comSameAs.sameAs]).slice(0, 15)
      : [];

    const bcSchema = schemas.buscar(/BreadcrumbList/i);

    return {
      // FAQ e perguntas
      hasFAQSchema: schemas.temTipo(/FAQPage/i),
      faqContent: $$('[itemtype*="FAQPage"] .faq-question, details summary, .accordion-header, [class*="faq"] h3, [class*="faq"] h4')
        .map(texto).filter(Boolean).slice(0, 20),
      questionElements: perguntas,

      // Featured Snippets
      hasDefinitionBox: !!$('.definition, .glossary, [class*="definition"]'),
      hasNumberedLists: $$('ol').length,
      hasBulletLists: $$('ul').length,
      hasTableData: $$('table').length,

      // Schemas relevantes
      hasHowToSchema: schemas.temTipo(/HowTo/i),
      hasArticleSchema: schemas.temTipo(/Article|BlogPosting|NewsArticle/i),

      // Breadcrumbs
      hasBreadcrumb: !!$('[itemtype*="BreadcrumbList"], nav[aria-label*="breadcrumb" i], .breadcrumb, .breadcrumbs') || !!bcSchema,
      breadcrumbSchema: bcSchema ? JSON.stringify(bcSchema).substring(0, 800) : null,

      // Conteúdo conversacional
      hasConversationalContent: perguntas.length >= 2,

      // Voice Search
      hasConciseAnswers: respostasConcisas,

      // Speakable
      hasSpeakableSchema: schemas.temTipo(/Speakable/i) || schemas.objetos.some((o) => o.speakable),

      // Knowledge Graph
      hasSameAs: !!comSameAs,
      sameAsLinks,

      // Dados estruturados completos
      allSchemaTypes: [...new Set(schemas.tipos)],
      schemaValidationIssues: validarSchemas(schemas),
    };
  }

  // ---------------------------------------------------------------
  // 4. Frontend
  // ---------------------------------------------------------------
  function coletarFrontend() {
    const nav = performance.getEntriesByType?.('navigation')?.[0] || null;
    const t = performance.timing || null;

    // Media queries acessíveis (folhas same-origin)
    let mediaQueries = 0;
    try {
      Array.from(document.styleSheets).forEach((folha) => {
        try {
          Array.from(folha.cssRules || []).forEach((r) => {
            if (r instanceof CSSMediaRule) mediaQueries++;
          });
        } catch { /* folha cross-origin: ignorar */ }
      });
    } catch { /* ignorar */ }

    // Fontes dos elementos principais
    const fontFamilies = [...new Set(['body', 'h1', 'p', 'button'].map((sel) => {
      const el = $(sel);
      return el ? getComputedStyle(el).fontFamily : null;
    }).filter(Boolean))].slice(0, 6);

    // Mixed content em páginas https
    const isHTTPS = window.location.protocol === 'https:';
    const hasMixedContent = isHTTPS && $$('img[src^="http:"], script[src^="http:"], iframe[src^="http:"], link[href^="http:"]').length > 0;

    // Estimativa de LCP: maior imagem visível ou maior bloco de texto
    let maior = null;
    let maiorArea = 0;
    $$('img, h1, p, section, [class*="hero"]').slice(0, 300).forEach((el) => {
      const r = el.getBoundingClientRect();
      const area = r.width * r.height;
      if (area > maiorArea) {
        maiorArea = area;
        maior = `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(/\s+/)[0] : ''} (${Math.round(r.width)}x${Math.round(r.height)}px)`;
      }
    });

    const imgs = $$('img');

    return {
      // Performance e carregamento
      loadTime: nav ? Math.round(nav.loadEventEnd) : (t ? t.loadEventEnd - t.navigationStart : null),
      domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : (t ? t.domContentLoadedEventEnd - t.navigationStart : null),

      // Responsividade
      hasViewportMeta: !!$('meta[name="viewport"]'),
      viewportContent: meta('meta[name="viewport"]'),
      hasMediaQueries: mediaQueries > 0,
      mediaQueriesCount: mediaQueries,

      // Acessibilidade visual
      hasSkipLink: !!$('a[href="#main"], a[href="#content"]'),
      hasAriaLabels: $$('[aria-label]').length,
      hasAriaRoles: $$('[role]').length,
      imagesWithoutAlt: imgs.filter((i) => !i.alt).length,
      hasLangAttribute: !!document.documentElement.lang,

      // Design e UX
      fontFamilies,
      colorScheme: getComputedStyle(document.documentElement).colorScheme || null,
      hasDarkMode: !!$('[data-theme], [class*="dark"]') || window.matchMedia('(prefers-color-scheme: dark)').matches,

      // CTA e conversão
      ctaButtons: $$('button, .btn, [class*="cta"], [class*="button"]').map(texto).filter(Boolean).slice(0, 15),
      hasNewsletterForm: !!$('input[type="email"]'),
      hasChatWidget: !!$('[class*="chat"], [id*="chat"], [class*="intercom"], [class*="crisp"]'),

      // Segurança e confiança
      isHTTPS,
      hasMixedContent,

      // Assets e otimização
      totalImages: imgs.length,
      lazyImages: $$('img[loading="lazy"]').length,
      modernImageFormats: imgs.filter((i) => /\.webp|\.avif/i.test(i.src)).length,
      hasWebFonts: $$('link').some((l) => /fonts\.googleapis|typekit/i.test(l.href || '')),

      // Core Web Vitals — estimativa via DOM
      largestElement: maior,

      // Social
      hasSocialLinks: $$('a').filter((a) => /instagram|facebook|twitter|linkedin|youtube|tiktok/i.test(a.href || '')).length,

      // Interatividade
      hasVideo: $$('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length,
      hasAnimation: !!$('[class*="animate"], [class*="transition"], [data-aos]'),

      // Footer
      hasFooter: !!$('footer'),
      footerContent: texto($('footer')).substring(0, 500) || null,

      // Navegação
      hasNav: !!$('nav'),
      navItems: $$('nav a').map(texto).filter(Boolean).slice(0, 20),
      hasMegaMenu: !!$('.mega-menu, [class*="mega-menu"]'),

      // Formulários
      totalForms: $$('form').length,
      formFields: $$('input, textarea, select').map((f) => ({ type: f.type, name: f.name, placeholder: f.placeholder })).slice(0, 20),

      // Análise visual geral
      pageHTML: document.documentElement.outerHTML.substring(0, 5000),
      bodyClasses: document.body?.className || '',
      hasPopups: !!$('.modal, .popup, [class*="overlay"], [class*="modal"]'),
      hasCookieBanner: !!$('[class*="cookie"], [id*="cookie"], [class*="gdpr"]'),
    };
  }

  // ---------------------------------------------------------------
  // Coleta completa com tolerância a falhas: se uma categoria quebrar
  // (sites com JS agressivo), coleta o que for possível e registra a
  // limitação para o relatório informar o usuário.
  // ---------------------------------------------------------------
  function coletarTudo() {
    const limitacoes = [];
    let schemas;
    try { schemas = coletarSchemas(); }
    catch { schemas = { objetos: [], tipos: [], invalidos: 0, raw: '', temTipo: () => false, buscar: () => null }; limitacoes.push('Falha ao ler schemas LD+JSON'); }

    const seguro = (nome, fn, ...args) => {
      try { return fn(...args); }
      catch (e) { limitacoes.push(`Coleta parcial de ${nome}: ${e.message}`); return {}; }
    };

    return {
      seoData: seguro('SEO', coletarSEO, schemas),
      geoData: seguro('GEO', coletarGEO, schemas),
      aeoData: seguro('AEO', coletarAEO, schemas),
      frontendData: seguro('Frontend', coletarFrontend),
      limitacoes,
      coletadoEm: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------
  // Subpáginas: busca links internos, baixa o HTML (fetch same-origin)
  // e extrai um resumo SEO de cada uma. Análise estática (sem JS).
  // ---------------------------------------------------------------
  async function coletarSubpaginas(max = 5) {
    const atual = new URL(window.location.href);
    const candidatos = new Map();

    const considerar = (a) => {
      try {
        const u = new URL(a.href, window.location.href);
        if (!/^https?:$/.test(u.protocol) || u.hostname !== atual.hostname) return;
        u.hash = '';
        if (u.pathname === atual.pathname) return;
        if (/\.(pdf|jpe?g|png|gif|webp|avif|svg|zip|rar|mp4|mp3|xml|ico|css|js|json)$/i.test(u.pathname)) return;
        const chave = u.pathname + u.search;
        if (!candidatos.has(chave)) candidatos.set(chave, u.href);
      } catch { /* href inválido */ }
    };
    // Links do menu primeiro (páginas mais representativas do site)
    $$('nav a[href]').forEach(considerar);
    $$('a[href]').forEach(considerar);

    const urls = [...candidatos.values()].slice(0, max);

    const analisarHTML = (url, html) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const q = (sel) => doc.querySelector(sel);

      const tipos = [];
      doc.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
        try {
          const reg = (o) => {
            if (!o || typeof o !== 'object') return;
            if (Array.isArray(o)) { o.forEach(reg); return; }
            if (o['@type']) (Array.isArray(o['@type']) ? o['@type'] : [o['@type']]).forEach((t) => tipos.push(String(t)));
            if (o['@graph']) reg(o['@graph']);
          };
          reg(JSON.parse(s.textContent));
        } catch { /* JSON inválido */ }
      });

      doc.body?.querySelectorAll('script, style, noscript').forEach((e) => e.remove());
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
        wordCount: (doc.body?.textContent || '').split(/\s+/).filter(Boolean).length,
        schemaTypes: [...new Set(tipos)].slice(0, 8),
        hasFAQSchema: tipos.some((t) => /FAQPage/i.test(t)),
        hasViewport: !!q('meta[name="viewport"]'),
        hasOgTitle: !!q('meta[property="og:title"]'),
        hasBreadcrumb: tipos.some((t) => /BreadcrumbList/i.test(t)) || !!q('.breadcrumb, .breadcrumbs'),
      };
    };

    const resultados = await Promise.allSettled(urls.map(async (url) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const r = await fetch(url, { signal: ctrl.signal, credentials: 'include' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const html = await r.text();
        return analisarHTML(url, html.substring(0, 500000));
      } finally {
        clearTimeout(timer);
      }
    }));

    return {
      paginas: resultados.filter((r) => r.status === 'fulfilled').map((r) => r.value),
      falhas: resultados.filter((r) => r.status === 'rejected').length,
      candidatasEncontradas: candidatos.size,
    };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.tipo === 'COLETAR_DADOS') {
      (async () => {
        const dados = coletarTudo();
        try {
          const sub = await coletarSubpaginas(5);
          dados.subpaginas = sub.paginas;
          if (sub.falhas > 0) dados.limitacoes.push(`${sub.falhas} subpágina(s) não puderam ser baixadas`);
          if (sub.candidatasEncontradas > 5) dados.limitacoes.push(`Site tem ${sub.candidatasEncontradas} páginas internas; 5 foram amostradas`);
        } catch (e) {
          dados.subpaginas = [];
          dados.limitacoes.push('Análise de subpáginas indisponível: ' + e.message);
        }
        sendResponse({ ok: true, dados });
      })();
      return true; // resposta assíncrona
    }
    return false;
  });
})();
