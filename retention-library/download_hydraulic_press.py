#!/usr/bin/env python3
"""
Script para baixar vídeos de prensa hidráulica do Google Drive
Link: https://drive.google.com/drive/folders/1kdiGFY604ETx4CalQUdc1zhmFomscjne
"""

import os
import sys
import subprocess

# Instalar gdown se não estiver instalado
try:
    import gdown
except ImportError:
    print("Instalando gdown...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "gdown"])
    import gdown

# Diretório de destino
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEST_DIR = SCRIPT_DIR

print(f"📥 Baixando vídeos de prensa hidráulica do Google Drive...")
print(f"📁 Diretório de destino: {DEST_DIR}")

# Link da pasta do Google Drive
FOLDER_URL = "https://drive.google.com/drive/folders/1kdiGFY604ETx4CalQUdc1zhmFomscjne?usp=share_link"

# IDs dos arquivos (você precisará obter esses IDs compartilhando cada arquivo individualmente)
# Para obter o ID:
# 1. Abra cada arquivo no Google Drive
# 2. Clique em "Compartilhar" > "Obter link"
# 3. O ID está na URL: https://drive.google.com/file/d/FILE_ID/view

print("\n⚠️  Para baixar os vídeos, você precisa:")
print("1. Acessar cada arquivo individualmente no Google Drive")
print("2. Compartilhar cada arquivo e obter o link direto")
print("3. Extrair o ID do arquivo da URL")
print("\nOu baixe manualmente e renomeie:")
print("  Video1.mp4 -> hydraulic-press-1.mp4")
print("  Video2.mp4 -> hydraulic-press-2.mp4")
print("  Video3.mp4 -> hydraulic-press-3.mp4")
print(f"\nE coloque os arquivos em: {DEST_DIR}")

# Se você tiver os IDs dos arquivos, descomente e ajuste:
# VIDEO_IDS = {
#     'hydraulic-press-1': 'FILE_ID_1',
#     'hydraulic-press-2': 'FILE_ID_2',
#     'hydraulic-press-3': 'FILE_ID_3'
# }
# 
# for video_name, file_id in VIDEO_IDS.items():
#     output_path = os.path.join(DEST_DIR, f"{video_name}.mp4")
#     url = f"https://drive.google.com/uc?id={file_id}"
#     print(f"\n📥 Baixando {video_name}...")
#     try:
#         gdown.download(url, output_path, quiet=False)
#         print(f"✅ {video_name} baixado com sucesso!")
#     except Exception as e:
#         print(f"❌ Erro ao baixar {video_name}: {e}")

print("\n✅ Script preparado. Siga as instruções acima para baixar os vídeos.")
