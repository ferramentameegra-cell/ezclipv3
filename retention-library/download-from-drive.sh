#!/bin/bash

# Script para baixar vídeos de prensa hidráulica do Google Drive
# Link: https://drive.google.com/drive/folders/1kdiGFY604ETx4CalQUdc1zhmFomscjne

# Diretório de destino
DEST_DIR="$(dirname "$0")"
cd "$DEST_DIR"

echo "📥 Baixando vídeos de prensa hidráulica do Google Drive..."
echo "📁 Diretório de destino: $DEST_DIR"

# Verificar se gdown está instalado
if ! command -v gdown &> /dev/null; then
    echo "⚠️  gdown não encontrado. Instalando..."
    pip install gdown
fi

# IDs dos arquivos (você precisará obter esses IDs compartilhando cada arquivo individualmente)
# Para obter o ID:
# 1. Abra o arquivo no Google Drive
# 2. Clique em "Compartilhar" > "Obter link"
# 3. O ID está na URL: https://drive.google.com/file/d/FILE_ID/view

# Por enquanto, vamos usar o link da pasta e tentar baixar
# Você precisará compartilhar cada arquivo individualmente para obter os IDs

echo ""
echo "📋 Para baixar os vídeos:"
echo "1. Acesse: https://drive.google.com/drive/folders/1kdiGFY604ETx4CalQUdc1zhmFomscjne"
echo "2. Para cada vídeo (Video1.mp4, Video2.mp4, Video3.mp4):"
echo "   - Clique com botão direito > Compartilhar > Obter link"
echo "   - Copie o ID do arquivo da URL"
echo "   - Execute: gdown --id FILE_ID -O hydraulic-press-N.mp4"
echo ""
echo "Ou baixe manualmente e renomeie:"
echo "  Video1.mp4 -> hydraulic-press-1.mp4"
echo "  Video2.mp4 -> hydraulic-press-2.mp4"
echo "  Video3.mp4 -> hydraulic-press-3.mp4"
echo ""

# Se você tiver os IDs, descomente e ajuste:
# gdown --id VIDEO1_ID -O hydraulic-press-1.mp4
# gdown --id VIDEO2_ID -O hydraulic-press-2.mp4
# gdown --id VIDEO3_ID -O hydraulic-press-3.mp4

echo "✅ Script preparado. Siga as instruções acima para baixar os vídeos."
