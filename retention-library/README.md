# Vídeos de Retenção

Coloque os arquivos de vídeo de retenção nesta pasta.

## Formato dos arquivos:
- Nome do arquivo deve corresponder ao ID do vídeo em `src/models/niches.js`
- Exemplo: `hydraulic-press-1.mp4` para o vídeo com ID `hydraulic-press-1`
- Formatos suportados: .mp4, .webm, .mov

## Como adicionar um vídeo:
1. Adicione o metadado do vídeo em `src/models/niches.js` (se ainda não existir)
2. Coloque o arquivo de vídeo nesta pasta com o nome correspondente ao ID
3. Exemplo: Se o ID é `meu-video`, o arquivo deve ser `meu-video.mp4`

## Estrutura:
```
retention-library/
  ├── hydraulic-press-1.mp4
  ├── hydraulic-press-2.mp4
  ├── hydraulic-press-3.mp4
  └── ...
```

## Nota:
- **IMPORTANTE**: Os vídeos NÃO são commitados no Git (arquivos muito grandes)
- Em produção (Railway), os vídeos DEVEM ser colocados manualmente em `/tmp/retention-library/`
- Ou configure a variável de ambiente `RETENTION_LIBRARY_DIR` para um caminho personalizado
- Para adicionar no Railway: use SFTP, Railway CLI, ou copie via volume persistente

