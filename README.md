# Adega - Sistema de Precificação de Vinhos

Site estático (HTML + CSS + JS puro) para gerenciar o catálogo de vinhos e gerar orçamentos personalizados para clientes.

## Funcionalidades

- **Importar Excel**: carregue planilhas `.xlsx` / `.xls` com colunas `Nome`, `Quantidade`, `Preço` (aceita variações como "Produto", "Qtd", "Valor").
- **Cadastro editável**: cada produto pode ter nome, quantidade e preço alterados diretamente na tabela.
- **Busca**: barra de pesquisa funcional para filtrar produtos cadastrados.
- **Checklist personalizado**: selecione os vinhos que entrarão na cotação do cliente e ajuste a quantidade de venda.
- **Resumo financeiro**: cálculo automático de subtotal, desconto (% ou R$), total, com opção à vista ou parcelado (com ou sem juros ao mês).
- **Geração de PDF**: relatório com todos os itens, quantidades, subtotais, desconto, total e forma de pagamento.
- **Persistência local**: os produtos ficam salvos no navegador (`localStorage`).

## Como usar

1. Abra `index.html` no navegador (não precisa de servidor).
2. Na aba **Produtos**, importe seu Excel ou baixe o modelo para ver o formato esperado.
3. Edite os produtos diretamente na tabela ou adicione novos via "+ Novo produto".
4. Na aba **Montar Precificação**, preencha os dados do cliente, marque os produtos desejados, ajuste quantidades e aplique desconto.
5. Na aba **Relatório / PDF**, confira a pré-visualização e clique em **Gerar PDF**.

## Estrutura

- `index.html` – marcação e carregamento das bibliotecas (SheetJS para Excel, jsPDF + AutoTable para PDF).
- `styles.css` – tema visual (paleta vinho + dourado).
- `app.js` – toda a lógica: importação, CRUD, busca, cálculo financeiro, geração de PDF.
