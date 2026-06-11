#!/usr/bin/env bash
# Baixa as bibliotecas de PDF para o bundle local da extensão.
# Uso: bash libs/baixar-libs.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "Baixando jsPDF 2.5.1..."
curl -fsSL -o jspdf.umd.min.js \
  https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js

echo "Baixando html2canvas 1.4.1..."
curl -fsSL -o html2canvas.min.js \
  https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js

echo "OK — bibliotecas instaladas em libs/. Recarregue a extensão em chrome://extensions."
