# Diagnóstico: Resolução 1080x1920 dos Clipes

## 1. Problema

Os clipes não eram gerados em 1080x1920 mesmo com `-s 1080x1920` e `-aspect 9:16` no comando FFmpeg.

## 2. Investigação Realizada

### Passo 1: Busca por `-s`, `-aspect` e `scale=`

- **videoComposer.js**: já usava `-s 1080x1920` e `-aspect 9:16` em `outputOptions`, e `scale=` no filter_complex (bg, main, retention). O composer não usa `.size()` nem `.aspect()` do fluent-ffmpeg.
- **videoProcessor.js**: fallback simplificado usa `-s`/`-aspect` e filter com `scale=1080:...`. A validação do filter exigia `=[final]`, que não existe no fallback, **impedindo o fallback de rodar** e podendo resultar em uso do clip original (sem 1080x1920).
- **captionRenderer.js**: usa `.size('1080x1920')` noutro fluxo (legendas).
- **videoOverlayService.js**: usa `scale=` em filtros próprios, fluxo distinto.

### Passo 2: Filter_complex

- O canvas vem de `[bg_fixed]` (1080x1920 via scale+crop ou `color=s=1080x1920`). Overlays e drawtext mantêm o tamanho do primeiro input.
- O label `[final]` era criado só com `format=yuv420p[final]`, **sem scale explícito**. Em teoria o tamanho já seria 1080x1920, mas não havia garantia no próprio filter.
- **Causa provável**: dependência apenas de `-s`/`-aspect` e do tamanho implícito do overlay, sem step de scale explícito para 1080x1920 no filter, deixando margem para comportamento diferente entre versões do FFmpeg ou do fluent-ffmpeg.

### Passo 3: Ordem das opções FFmpeg

- Uso de `command.input(...)` → `complexFilter(...)` → `outputOptions(...)` → `save(outputPath)` está correto. As opções de saída vêm após o filter.
- `-s` e `-aspect` aplicam-se ao output; com `-map [final]` o fluxo é o esperado.

### Passo 4: Comando FFmpeg completo

- Já existe log em `on('start')`: `[FFMPEG_COMMAND]` imprime o comando completo. Isso permite checar se `-s 1080x1920`, `-aspect 9:16` e o filter são os esperados.

## 3. Correções Aplicadas

### 3.1. videoComposer.js

1. **Scale explícito antes de `[final]`**  
   A última etapa do filter passou de  
   `…format=yuv420p[final]`  
   para  
   `…scale=1080:1920,format=yuv420p[final]`.  
   Assim, **o stream `[final]` é sempre 1080x1920** no filter, independente de `-s`/`-aspect`.

2. **Log em caso de resolução errada**  
   Quando a resolução verificada (ffprobe) não for 1080x1920, o log orienta checar `[FFMPEG_COMMAND]` e a presença de `-s 1080x1920`, `-aspect 9:16` e `scale=1080:1920` no filter.

### 3.2. videoProcessor.js

3. **Validação do fallback**  
   A checagem do filter do fallback deixou de exigir `=[final]` e passou a só exigir `[final]`, permitindo que o fallback rode. O fallback já usa `-s 1080x1920`, `-aspect 9:16` e filter com canvas 1080x1920.

## 4. Validação

- **videoComposer**: `[final]` é sempre 1080x1920 via `scale=1080:1920` no filter; `-s` e `-aspect` seguem como reforço.
- **Fallback**: voltou a ser executável e continua gerando 1080x1920.
- **Log**: comando completo em `[FFMPEG_COMMAND]`; em falha de resolução, log indica o que verificar.

## 5. Como conferir

1. Gerar clipes e inspecionar os logs: `[FFMPEG_COMMAND]` e `[COMPOSER] ✅ Resolução de saída verificada: 1080x1920`.
2. Se aparecer `ERRO CRÍTICO: Resolução esperada 1080x1920, mas obteve ...`, usar o comando em `[FFMPEG_COMMAND]` para validar `-s 1080x1920`, `-aspect 9:16` e `scale=1080:1920` no filter.
