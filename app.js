const STORAGE_KEY = 'adega.produtos.v1';

const state = {
    produtos: [],
    busca: '',
    buscaPrecif: '',
    selecionados: {},
    qtdVenda: {},
    descontoTipo: 'percent',
    descontoValor: 0,
    pagamento: 'vista',
    parcelas: 2,
    jurosMes: 0,
    cliente: { nome: '', data: new Date().toISOString().slice(0, 10) },
    editId: null,
};

function uid() {
    return 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatBRL(v) {
    if (isNaN(v) || v === null) v = 0;
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseNumber(v) {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return v;
    let s = String(v).trim();
    s = s.replace(/R\$\s?/gi, '').replace(/\s/g, '');
    if (s.includes(',') && s.includes('.')) {
        s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes(',')) {
        s = s.replace(',', '.');
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
}

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            if (Array.isArray(data)) state.produtos = data;
        }
    } catch (e) {
        console.warn('Falha ao carregar estado', e);
    }
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.produtos));
    } catch (e) {
        console.warn('Falha ao salvar', e);
    }
}

function toast(msg, type = '') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast show ' + type;
    setTimeout(() => el.classList.remove('show'), 2600);
}

// ======= ABAS =======
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        document.getElementById('tab-' + tab).classList.add('active');
        if (tab === 'precificacao') renderPrecif();
        if (tab === 'relatorio') renderReport();
    });
});

// ======= IMPORTAR EXCEL =======
const fileInput = document.getElementById('file-input');
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('file-name').textContent = file.name;
    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const data = new Uint8Array(evt.target.result);
            const wb = XLSX.read(data, { type: 'array' });
            const sheetName = wb.SheetNames[0];
            const sheet = wb.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            importarLinhas(rows);
        } catch (err) {
            console.error(err);
            toast('Erro ao ler o arquivo Excel', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
});

function importarLinhas(rows) {
    if (!rows || !rows.length) {
        toast('Planilha vazia', 'error');
        return;
    }
    const chaves = Object.keys(rows[0]).map(k => k.toString());
    const kNome = chaves.find(k => /nome|produto|descri|item|vinho/i.test(k)) || chaves[0];
    const kQtd = chaves.find(k => /qtd|quant|estoque/i.test(k)) || chaves[1];
    const kPreco = chaves.find(k => /pre[cç]o|valor|unit/i.test(k)) || chaves[2];

    let adicionados = 0;
    rows.forEach(r => {
        const nome = (r[kNome] || '').toString().trim();
        if (!nome) return;
        const qtd = Math.max(0, Math.floor(parseNumber(r[kQtd])));
        const preco = Math.max(0, parseNumber(r[kPreco]));
        const existente = state.produtos.find(p => p.nome.toLowerCase() === nome.toLowerCase());
        if (existente) {
            existente.quantidade = qtd;
            existente.preco = preco;
        } else {
            state.produtos.push({ id: uid(), nome, quantidade: qtd, preco });
        }
        adicionados++;
    });
    saveState();
    renderProdutos();
    toast(`${adicionados} linha(s) importada(s)`, 'success');
    fileInput.value = '';
}

document.getElementById('btn-template').addEventListener('click', () => {
    const data = [
        { Nome: 'Cabernet Sauvignon Reserva', Quantidade: 12, Preco: 89.90 },
        { Nome: 'Malbec Argentino', Quantidade: 8, Preco: 75.50 },
        { Nome: 'Chardonnay Chileno', Quantidade: 15, Preco: 65.00 },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
    XLSX.writeFile(wb, 'modelo-produtos.xlsx');
});

document.getElementById('btn-clear-all').addEventListener('click', () => {
    if (!state.produtos.length) return;
    if (!confirm('Remover TODOS os produtos cadastrados?')) return;
    state.produtos = [];
    state.selecionados = {};
    state.qtdVenda = {};
    saveState();
    renderProdutos();
    toast('Produtos removidos');
});

// ======= TABELA PRODUTOS =======
const tbodyProdutos = document.getElementById('tbody-produtos');
const emptyProdutos = document.getElementById('empty-produtos');

function filtrar(produtos, termo) {
    if (!termo) return produtos;
    const t = termo.toLowerCase();
    return produtos.filter(p => p.nome.toLowerCase().includes(t));
}

function renderProdutos() {
    const lista = filtrar(state.produtos, state.busca);
    tbodyProdutos.innerHTML = '';
    document.getElementById('count-produtos').textContent = state.produtos.length;
    if (!lista.length) {
        emptyProdutos.style.display = 'block';
        emptyProdutos.textContent = state.produtos.length
            ? 'Nenhum produto encontrado para a busca.'
            : 'Nenhum produto cadastrado ainda. Importe um Excel ou clique em "+ Novo produto".';
        return;
    }
    emptyProdutos.style.display = 'none';
    lista.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" data-f="nome" value="${escapeHTML(p.nome)}" /></td>
            <td class="num"><input type="number" data-f="quantidade" min="0" step="1" value="${p.quantidade}" /></td>
            <td class="num"><input type="number" data-f="preco" min="0" step="0.01" value="${p.preco}" /></td>
            <td class="actions">
                <button class="btn small danger" data-act="del">Excluir</button>
            </td>
        `;
        tr.querySelectorAll('input').forEach(inp => {
            inp.addEventListener('change', () => {
                const f = inp.dataset.f;
                if (f === 'nome') p.nome = inp.value.trim() || p.nome;
                if (f === 'quantidade') p.quantidade = Math.max(0, Math.floor(parseNumber(inp.value)));
                if (f === 'preco') p.preco = Math.max(0, parseNumber(inp.value));
                saveState();
                toast('Atualizado', 'success');
            });
        });
        tr.querySelector('[data-act="del"]').addEventListener('click', () => {
            if (!confirm(`Excluir "${p.nome}"?`)) return;
            state.produtos = state.produtos.filter(x => x.id !== p.id);
            delete state.selecionados[p.id];
            delete state.qtdVenda[p.id];
            saveState();
            renderProdutos();
            toast('Produto excluído');
        });
        tbodyProdutos.appendChild(tr);
    });
}

function escapeHTML(s) {
    return (s || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

document.getElementById('search-input').addEventListener('input', (e) => {
    state.busca = e.target.value;
    renderProdutos();
});

// ======= MODAL =======
const modal = document.getElementById('modal');
function openModal(prod = null) {
    state.editId = prod ? prod.id : null;
    document.getElementById('modal-title').textContent = prod ? 'Editar Produto' : 'Novo Produto';
    document.getElementById('modal-nome').value = prod ? prod.nome : '';
    document.getElementById('modal-qtd').value = prod ? prod.quantidade : 0;
    document.getElementById('modal-preco').value = prod ? prod.preco : 0;
    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('modal-nome').focus(), 50);
}
function closeModal() {
    modal.classList.add('hidden');
    state.editId = null;
}
document.getElementById('btn-add').addEventListener('click', () => openModal());
document.getElementById('modal-cancel').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.getElementById('modal-save').addEventListener('click', () => {
    const nome = document.getElementById('modal-nome').value.trim();
    const qtd = Math.max(0, Math.floor(parseNumber(document.getElementById('modal-qtd').value)));
    const preco = Math.max(0, parseNumber(document.getElementById('modal-preco').value));
    if (!nome) { toast('Informe o nome', 'error'); return; }
    if (state.editId) {
        const p = state.produtos.find(x => x.id === state.editId);
        if (p) { p.nome = nome; p.quantidade = qtd; p.preco = preco; }
    } else {
        state.produtos.push({ id: uid(), nome, quantidade: qtd, preco });
    }
    saveState();
    renderProdutos();
    closeModal();
    toast('Produto salvo', 'success');
});

// ======= PRECIFICAÇÃO =======
const tbodyPrecif = document.getElementById('tbody-precif');
const emptyPrecif = document.getElementById('empty-precif');

function renderPrecif() {
    const lista = filtrar(state.produtos, state.buscaPrecif);
    tbodyPrecif.innerHTML = '';
    if (!state.produtos.length) {
        emptyPrecif.style.display = 'block';
        emptyPrecif.textContent = 'Nenhum produto cadastrado. Vá até a aba Produtos primeiro.';
        atualizarFinanceiro();
        return;
    }
    if (!lista.length) {
        emptyPrecif.style.display = 'block';
        emptyPrecif.textContent = 'Nenhum produto encontrado para a busca.';
        atualizarFinanceiro();
        return;
    }
    emptyPrecif.style.display = 'none';
    lista.forEach(p => {
        const checked = state.selecionados[p.id] ? 'checked' : '';
        const qtdVenda = state.qtdVenda[p.id] ?? 1;
        const subtotal = state.selecionados[p.id] ? qtdVenda * p.preco : 0;
        const tr = document.createElement('tr');
        if (state.selecionados[p.id]) tr.classList.add('selected');
        tr.innerHTML = `
            <td class="check"><input type="checkbox" data-chk="${p.id}" ${checked}/></td>
            <td>${escapeHTML(p.nome)}</td>
            <td class="num">${p.quantidade}</td>
            <td class="num">${formatBRL(p.preco)}</td>
            <td class="num"><input type="number" class="qtd-venda" data-qv="${p.id}" min="1" step="1" value="${qtdVenda}" ${state.selecionados[p.id] ? '' : 'disabled'}/></td>
            <td class="num" data-sub="${p.id}">${formatBRL(subtotal)}</td>
        `;
        tr.querySelector('[data-chk]').addEventListener('change', (e) => {
            state.selecionados[p.id] = e.target.checked;
            if (e.target.checked && !state.qtdVenda[p.id]) state.qtdVenda[p.id] = 1;
            renderPrecif();
        });
        const inp = tr.querySelector('[data-qv]');
        inp.addEventListener('input', (e) => {
            const v = Math.max(1, Math.floor(parseNumber(e.target.value)));
            state.qtdVenda[p.id] = v;
            tr.querySelector(`[data-sub="${p.id}"]`).textContent = formatBRL(v * p.preco);
            atualizarFinanceiro();
        });
        tbodyPrecif.appendChild(tr);
    });
    document.getElementById('check-all').checked = lista.every(p => state.selecionados[p.id]);
    atualizarFinanceiro();
}

document.getElementById('search-precif').addEventListener('input', (e) => {
    state.buscaPrecif = e.target.value;
    renderPrecif();
});

document.getElementById('check-all').addEventListener('change', (e) => {
    const lista = filtrar(state.produtos, state.buscaPrecif);
    lista.forEach(p => {
        state.selecionados[p.id] = e.target.checked;
        if (e.target.checked && !state.qtdVenda[p.id]) state.qtdVenda[p.id] = 1;
    });
    renderPrecif();
});

// ======= FINANCEIRO =======
function calcularSubtotal() {
    return state.produtos.reduce((sum, p) => {
        if (!state.selecionados[p.id]) return sum;
        const q = state.qtdVenda[p.id] || 1;
        return sum + q * p.preco;
    }, 0);
}

function calcularDesconto(subtotal) {
    const v = Math.max(0, parseNumber(state.descontoValor));
    if (state.descontoTipo === 'percent') {
        return Math.min(subtotal, subtotal * (v / 100));
    }
    return Math.min(subtotal, v);
}

function atualizarFinanceiro() {
    const subtotal = calcularSubtotal();
    const desconto = calcularDesconto(subtotal);
    const total = Math.max(0, subtotal - desconto);
    document.getElementById('fin-subtotal').textContent = formatBRL(subtotal);
    document.getElementById('fin-total').textContent = formatBRL(total);

    const n = Math.max(2, Math.floor(parseNumber(state.parcelas)));
    const j = Math.max(0, parseNumber(state.jurosMes)) / 100;
    let parcela, totalParcelado;
    if (j === 0) {
        parcela = total / n;
        totalParcelado = total;
    } else {
        const fator = (j * Math.pow(1 + j, n)) / (Math.pow(1 + j, n) - 1);
        parcela = total * fator;
        totalParcelado = parcela * n;
    }
    document.getElementById('valor-parcela').textContent = formatBRL(parcela);
    document.getElementById('total-parcelado').textContent = formatBRL(totalParcelado);
}

document.getElementById('desconto-tipo').addEventListener('change', (e) => {
    state.descontoTipo = e.target.value;
    atualizarFinanceiro();
});
document.getElementById('desconto-valor').addEventListener('input', (e) => {
    state.descontoValor = parseNumber(e.target.value);
    atualizarFinanceiro();
});
document.querySelectorAll('input[name="pagamento"]').forEach(r => {
    r.addEventListener('change', (e) => {
        state.pagamento = e.target.value;
        document.getElementById('parcelas-box').classList.toggle('hidden', state.pagamento !== 'parcelado');
        atualizarFinanceiro();
    });
});
document.getElementById('num-parcelas').addEventListener('input', (e) => {
    state.parcelas = Math.max(2, Math.floor(parseNumber(e.target.value)));
    atualizarFinanceiro();
});
document.getElementById('juros-mes').addEventListener('input', (e) => {
    state.jurosMes = parseNumber(e.target.value);
    atualizarFinanceiro();
});
document.getElementById('cliente-nome').addEventListener('input', (e) => {
    state.cliente.nome = e.target.value;
});
document.getElementById('cliente-data').addEventListener('change', (e) => {
    state.cliente.data = e.target.value;
});

// ======= RELATÓRIO =======
function itensSelecionados() {
    return state.produtos
        .filter(p => state.selecionados[p.id])
        .map(p => ({
            nome: p.nome,
            qtd: state.qtdVenda[p.id] || 1,
            preco: p.preco,
            subtotal: (state.qtdVenda[p.id] || 1) * p.preco,
        }));
}

function formatDataBR(iso) {
    if (!iso) return '';
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
}

function renderReport() {
    const el = document.getElementById('report-preview');
    const itens = itensSelecionados();
    if (!itens.length) {
        el.innerHTML = '<p class="empty">Nenhum produto selecionado na aba de Precificação.</p>';
        return;
    }
    const subtotal = calcularSubtotal();
    const desconto = calcularDesconto(subtotal);
    const total = subtotal - desconto;
    const n = Math.max(2, Math.floor(parseNumber(state.parcelas)));
    const j = Math.max(0, parseNumber(state.jurosMes)) / 100;
    let parcela, totalParcelado;
    if (j === 0) { parcela = total / n; totalParcelado = total; }
    else {
        const fator = (j * Math.pow(1 + j, n)) / (Math.pow(1 + j, n) - 1);
        parcela = total * fator;
        totalParcelado = parcela * n;
    }
    const pagamentoInfo = state.pagamento === 'vista'
        ? '<div class="line"><span>Pagamento:</span><span>À vista</span></div>'
        : `<div class="line"><span>Pagamento:</span><span>${n}x de ${formatBRL(parcela)} ${j > 0 ? `(juros ${(j * 100).toFixed(2)}% a.m.)` : '(sem juros)'}</span></div>
           <div class="line"><span>Total parcelado:</span><span>${formatBRL(totalParcelado)}</span></div>`;

    el.innerHTML = `
        <h3>Precificação</h3>
        <p><strong>Cliente:</strong> ${escapeHTML(state.cliente.nome) || '—'}</p>
        <p><strong>Data:</strong> ${formatDataBR(state.cliente.data) || '—'}</p>
        <table class="report-table">
            <thead>
                <tr>
                    <th style="color:#fff;">Produto</th>
                    <th style="color:#fff; text-align:right;">Qtd</th>
                    <th style="color:#fff; text-align:right;">Preço Unit.</th>
                    <th style="color:#fff; text-align:right;">Subtotal</th>
                </tr>
            </thead>
            <tbody>
                ${itens.map(i => `
                    <tr>
                        <td>${escapeHTML(i.nome)}</td>
                        <td style="text-align:right;">${i.qtd}</td>
                        <td style="text-align:right;">${formatBRL(i.preco)}</td>
                        <td style="text-align:right;">${formatBRL(i.subtotal)}</td>
                    </tr>`).join('')}
            </tbody>
        </table>
        <div class="report-totals">
            <div class="line"><span>Subtotal:</span><span>${formatBRL(subtotal)}</span></div>
            <div class="line"><span>Desconto ${state.descontoTipo === 'percent' ? `(${parseNumber(state.descontoValor)}%)` : ''}:</span><span>- ${formatBRL(desconto)}</span></div>
            <div class="line total"><span>TOTAL:</span><span>${formatBRL(total)}</span></div>
            ${pagamentoInfo}
        </div>
    `;
}

// ======= PDF =======
document.getElementById('btn-gerar-pdf').addEventListener('click', () => {
    const itens = itensSelecionados();
    if (!itens.length) {
        toast('Selecione ao menos um produto', 'error');
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const subtotal = calcularSubtotal();
    const desconto = calcularDesconto(subtotal);
    const total = subtotal - desconto;
    const n = Math.max(2, Math.floor(parseNumber(state.parcelas)));
    const j = Math.max(0, parseNumber(state.jurosMes)) / 100;
    let parcela, totalParcelado;
    if (j === 0) { parcela = total / n; totalParcelado = total; }
    else {
        const fator = (j * Math.pow(1 + j, n)) / (Math.pow(1 + j, n) - 1);
        parcela = total * fator;
        totalParcelado = parcela * n;
    }

    // Cabeçalho
    doc.setFillColor(92, 15, 29);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('MYWINE - Precificação', 14, 18);

    doc.setTextColor(43, 26, 31);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    let y = 40;
    doc.text(`Cliente: ${state.cliente.nome || '—'}`, 14, y);
    doc.text(`Data: ${formatDataBR(state.cliente.data) || '—'}`, 150, y);
    y += 8;

    doc.autoTable({
        startY: y,
        head: [['Produto', 'Qtd', 'Preço Unit.', 'Subtotal']],
        body: itens.map(i => [
            i.nome,
            String(i.qtd),
            formatBRL(i.preco),
            formatBRL(i.subtotal),
        ]),
        headStyles: { fillColor: [122, 22, 40], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 245, 246] },
        columnStyles: {
            0: { cellWidth: 90 },
            1: { halign: 'right', cellWidth: 18 },
            2: { halign: 'right', cellWidth: 40, overflow: 'hidden' },
            3: { halign: 'right', cellWidth: 40, overflow: 'hidden' },
        },
        margin: { left: 14, right: 14 },
    });

    y = doc.lastAutoTable.finalY + 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Subtotal:`, 130, y);
    doc.text(formatBRL(subtotal), 196, y, { align: 'right' });
    y += 7;
    const descLabel = state.descontoTipo === 'percent'
        ? `Desconto (${parseNumber(state.descontoValor)}%):`
        : `Desconto:`;
    doc.text(descLabel, 130, y);
    doc.text(`- ${formatBRL(desconto)}`, 196, y, { align: 'right' });
    y += 9;

    doc.setDrawColor(122, 22, 40);
    doc.setLineWidth(0.6);
    doc.line(128, y - 4, 196, y - 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(92, 15, 29);
    doc.text(`TOTAL:`, 130, y);
    doc.text(formatBRL(total), 196, y, { align: 'right' });
    y += 12;

    doc.setTextColor(43, 26, 31);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Forma de Pagamento', 14, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    if (state.pagamento === 'vista') {
        doc.text('À vista', 14, y);
    } else {
        doc.text(`Parcelado em ${n}x de ${formatBRL(parcela)} ${j > 0 ? `(juros ${(j * 100).toFixed(2)}% a.m.)` : '(sem juros)'}`, 14, y);
        y += 6;
        doc.text(`Total parcelado: ${formatBRL(totalParcelado)}`, 14, y);
    }

    // Rodapé
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(9);
    doc.setTextColor(107, 94, 99);
    doc.text(`Total de itens: ${itens.reduce((s, i) => s + i.qtd, 0)}  |  Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, pageH - 10);

    const nomeArq = `precificacao_${(state.cliente.nome || 'cliente').replace(/\s+/g, '_')}_${state.cliente.data || ''}.pdf`;
    doc.save(nomeArq);
    toast('PDF gerado!', 'success');
});

// ======= INIT =======
loadState();
document.getElementById('cliente-data').value = state.cliente.data;
renderProdutos();
