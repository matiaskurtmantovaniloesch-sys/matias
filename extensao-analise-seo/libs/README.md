# libs/ — bibliotecas de geração de PDF

A exportação direta em PDF usa **jsPDF 2.5.1** + **html2canvas 1.4.1**
carregados localmente (Manifest V3 não permite CDN remoto em páginas da
extensão).

Os arquivos neste diretório são **stubs**: o ambiente onde a extensão foi
gerada não tinha acesso aos CDNs. Antes de usar a exportação direta, baixe
as bibliotecas reais:

```bash
bash libs/baixar-libs.sh
```

Ou baixe manualmente e salve com estes nomes exatos:

| Arquivo               | URL                                                                          |
|-----------------------|------------------------------------------------------------------------------|
| `jspdf.umd.min.js`    | https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js          |
| `html2canvas.min.js`  | https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js  |

**Sem as libs a extensão continua funcional**: o botão "Exportar PDF" abre o
diálogo de impressão do Chrome — escolha "Salvar como PDF".
