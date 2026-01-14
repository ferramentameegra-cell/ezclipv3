# Como Baixar Vídeos de Prensa Hidráulica do Google Drive

## Link do Google Drive
https://drive.google.com/drive/folders/1kdiGFY604ETx4CalQUdc1zhmFomscjne?usp=share_link

## Vídeos Disponíveis
- Video1.mp4 (102 MB)
- Video2.mp4 (93.6 MB)
- Video3.mp4 (86.9 MB)

## Instruções para Adicionar à Biblioteca

### Opção 1: Download Manual

1. Acesse o link do Google Drive acima
2. Baixe os 3 vídeos para sua máquina
3. Renomeie os arquivos:
   - `Video1.mp4` → `hydraulic-press-1.mp4`
   - `Video2.mp4` → `hydraulic-press-2.mp4`
   - `Video3.mp4` → `hydraulic-press-3.mp4`
4. Copie os arquivos para a pasta `retention-library/`:
   ```bash
   cp Video1.mp4 retention-library/hydraulic-press-1.mp4
   cp Video2.mp4 retention-library/hydraulic-press-2.mp4
   cp Video3.mp4 retention-library/hydraulic-press-3.mp4
   ```

### Opção 2: Usando gdown (Google Drive Downloader)

```bash
# Instalar gdown
pip install gdown

# Baixar vídeos (você precisará dos IDs dos arquivos do Google Drive)
# Para obter os IDs, compartilhe cada arquivo individualmente e pegue o ID da URL

# Exemplo (substitua FILE_ID pelos IDs reais):
gdown --id FILE_ID_1 -O retention-library/hydraulic-press-1.mp4
gdown --id FILE_ID_2 -O retention-library/hydraulic-press-2.mp4
gdown --id FILE_ID_3 -O retention-library/hydraulic-press-3.mp4
```

### Opção 3: Via API de Upload (Recomendado para Produção)

Use o endpoint de upload da plataforma:

```bash
# Para cada vídeo:
curl -X POST http://localhost:8080/api/retention/upload \
  -F "file=@Video1.mp4" \
  -F "retentionVideoId=hydraulic-press-1"

curl -X POST http://localhost:8080/api/retention/upload \
  -F "file=@Video2.mp4" \
  -F "retentionVideoId=hydraulic-press-2"

curl -X POST http://localhost:8080/api/retention/upload \
  -F "file=@Video3.mp4" \
  -F "retentionVideoId=hydraulic-press-3"
```

## Verificação

Após adicionar os vídeos, verifique se estão no lugar correto:

```bash
ls -lh retention-library/hydraulic-press*.mp4
```

Você deve ver:
- `hydraulic-press-1.mp4`
- `hydraulic-press-2.mp4`
- `hydraulic-press-3.mp4`

## Nota para Railway/Produção

Em produção, os vídeos devem estar em `/tmp/retention-library/` ou no diretório configurado pela variável de ambiente `RETENTION_LIBRARY_DIR`.

Para adicionar em produção:
1. Use o endpoint de upload via API
2. Ou configure um volume persistente no Railway
3. Ou use um serviço de armazenamento (S3, etc.)
