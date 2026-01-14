# Background Fixo - Instruções

## Como Adicionar a Imagem de Background

1. **Coloque a imagem** neste diretório (`assets/backgrounds/`)
2. **Nomeie como:** `ezclip-background.png` ou `ezclip-background.jpg`
3. **Resolução recomendada:** 1080x1920 pixels (9:16)
4. **Formatos suportados:** PNG, JPG, JPEG

## Comportamento

- ✅ A imagem será aplicada **automaticamente** em **TODOS** os vídeos gerados
- ✅ O background será redimensionado para 1080x1920 mantendo proporção (sem distorção)
- ✅ O vídeo será renderizado **sobre** o background (não substitui)
- ✅ Se o vídeo não preencher o canvas, o background aparecerá automaticamente
- ✅ Legendas, headlines e elementos gráficos ficam **acima** do vídeo e do background

## Estrutura de Camadas

```
Layer 0: Background fixo (ezclip-background.png)
Layer 1: Vídeo principal (corte)
Layer 2: Vídeo de retenção (se configurado)
Layer 3: Legendas (burn-in)
Layer 4: Headline
```

## Fallback

Se a imagem não for encontrada, o sistema usará uma cor sólida como fallback (cor configurada pelo usuário ou preto).

## Para Produção (Railway)

Em produção, a imagem deve estar em `/tmp/assets/backgrounds/ezclip-background.png`

Você pode:
1. Adicionar a imagem ao repositório (recomendado)
2. Ou fazer upload via API/script durante o deploy
