# Relatório de Diagnóstico: Geração de Clipes

## 1. Fluxo de geração – onde a lógica falha?

### 1.1 Resumo do fluxo (videoProcessor → videoComposer)

1. **videoProcessor** (`generateVideoSeries`):
   - Obtém vídeo fonte, trim, `actualStartTime` / `actualEndTime`, `finalCutDuration`, `finalNumberOfCuts`.
   - Chama `splitVideoIntoClips(...)` → gera N clipes em `seriesPath` (`clip_001.mp4`, …).
   - Limita a `finalClips` (ex.: 2) via `clipsQuantity` / `numberOfCuts`.
   - Se `retentionVideoId !== 'none'` e `nicheId`: chama `getRetentionClips(nicheId, finalClips.length, retentionClipsDir)` → preenche `retentionClips[]`.
   - Para cada clipe, chama `composeFinalVideo({ clipPath, outputPath, … })`.
   - `clipPath` = caminho do clipe **cru** (ex.: `…/series/{seriesId}/clip_001.mp4`).
   - `outputPath` = `getFinalClipPath(seriesId, clipIndex)` = `…/clip_001_final.mp4`.
   - Atualiza `finalClips[i]` com o **resultado** da composição (caminho do `_final`).

2. **composeFinalVideo** (videoComposer):
   - Recebe `clipPath`, `outputPath`, `captions`, `headline`, `retentionVideoPath`, `nicheId`, `clipNumber`, `totalClips`, etc.
   - Monta `filter_complex`, adiciona inputs (0 = clip, 1 = bg, 2 = retenção), valida, chama FFmpeg e grava em `outputPath`.

### 1.2 Chamada a `composeFinalVideo`

- **Quem chama:** `videoProcessor` no loop de composição (batch paralelo).
- **Quando:** para cada clipe em `finalClips`, na ordem `batch.map(async (clipPath, batchIndex) => { ... })`.
- **Parâmetros passados (trecho relevante):**

```js
await composeFinalVideo({
  clipPath,                           // clipe cru (ex.: .../clip_001.mp4)
  outputPath: finalClipPath,          // .../clip_001_final.mp4
  captions: clipCaptions,
  captionStyle: captionStyleObj,
  headline: clipHeadline,
  headlineStyle: headlineStyleObj,
  headlineText: headlineText,
  retentionVideoId,
  retentionVideoPath: currentRetentionVideoPath,  // retentionClips[clipIndex-1] ou null
  nicheId,
  backgroundColor,
  format: '9:16',
  platforms: { tiktok: true, reels: true, shorts: true },
  safeMargins: 10,
  clipNumber: clipIndex,              // 1-based
  totalClips: finalClips.length,
  onProgress: ...
});
```

- **Retenção:** `currentRetentionVideoPath = retentionClips[clipIndex - 1]` se existir e o arquivo existir; caso contrário `null`.

Conclusão: o processor **está** chamando `composeFinalVideo` para cada clipe e passando `clipPath`, `outputPath`, `clipNumber`, `totalClips` e `retentionVideoPath` quando há clipes de retenção.

### 1.3 Falha crítica: validação de `inputCount` vs. uso de retenção

No **videoComposer**:

- `inputCount` começa em `1` (apenas input 0 = clip).
- Se há background: `backgroundInputIndex = 1`, `inputCount++` → `inputCount = 2`.
- Quando há **vídeo de retenção**, o composer:
  - Adiciona o retenção como input (índice 2 se há bg, 1 se não há).
  - Usa `[2:v]` ou `[1:v]` no `filter_complex`.
  - **Nunca** incrementa `inputCount` para o input de retenção.

A validação é:

```js
if (maxInputIndex >= inputCount) {
  return reject(new Error(`Filter complex referencia input ${maxInputIndex} mas apenas ${inputCount} inputs foram adicionados`));
}
```

- Com **bg + retenção**: filter referencia `[0:v]`, `[1:v]`, `[2:v]` → `maxInputIndex = 2`, `inputCount = 2` → `2 >= 2` → **reject**.
- Com **apenas retenção** (sem bg): `[0:v]`, `[1:v]` → `maxInputIndex = 1`, `inputCount = 1` → `1 >= 1` → **reject**.

Ou seja: **sempre que há vídeo de retenção, a validação rejeita** e o FFmpeg **não chega a ser executado**. Por isso os arquivos `*_final.mp4` não são gerados quando se usa retenção.

Sem retenção, a validação passa e a composição pode seguir (bg opcional, etc.).

---

## 2. `filter_complex` gerado para cada clipe

### 2.1 Estrutura geral (ordem dos filtros)

A construção é sequencial. Resumo:

1. **Background (layer 0)**
   - Com imagem: `[1:v]scale=1080:1920:force_original_aspect_ratio=increase[bg_scaled];[bg_scaled]crop=1080:1920[bg_fixed];`
   - Sem imagem: `color=c=...:s=1080:1920:d=${videoDuration}[bg_fixed];`

2. **Vídeo principal**
   - `[0:v]scale=1080:${mainVideoHeightFinal}:force_original_aspect_ratio=decrease[main_scaled];`

3. **Overlay principal em cima do bg**
   - `[bg_fixed][main_scaled]overlay=(W-w)/2:180:shortest=1[composed];`

4. **Headline** (se `headlineText` ou `headline.text`)
   - `drawtext=...:x=(w-text_w)/2:y=${headlineY}[with_headline];`
   - `currentLabel` → `[with_headline]`.

5. **Vídeo de retenção** (se existir e válido)
   - `[2:v]` ou `[1:v]` → `scale` → `pad` → `overlay=(W-w)/2:${retentionY}:shortest=1[with_retention]`
   - `retentionY = 1920 - retentionHeight - 140` (base 140 px da borda inferior).

6. **Contador "Parte X/Y"**
   - Sempre: `drawtext=...:text='Parte ${partNum}/${partTotal}':...:x=(w-text_w-80):y=80[with_part_number];`

7. **Legendas** (se houver)
   - Vários `drawtext` com `enable='between(t,start,end)'`, `y=1920 - safeZones.bottom`.

8. **Saída**
   - `[currentLabel]scale=1080:1920,format=yuv420p[final]`

### 2.2 Exemplo (com bg, retenção, headline, "Parte 1/2", sem legendas)

Ordem dos inputs: 0 = clip, 1 = bg, 2 = retenção.

```
[1:v]scale=1080:1920:force_original_aspect_ratio=increase[bg_scaled];
[bg_scaled]crop=1080:1920[bg_fixed];
[0:v]scale=1080:607:force_original_aspect_ratio=decrease[main_scaled];
[bg_fixed][main_scaled]overlay=(W-w)/2:180:shortest=1[composed];
[composed]drawtext=...headline...[with_headline];
[2:v]scale=...:force_original_aspect_ratio=decrease[retention_scaled];
[retention_scaled]pad=...[retention_padded];
[with_headline][retention_padded]overlay=(W-w)/2:${retentionY}:shortest=1[with_retention];
[with_retention]drawtext=...'Parte 1/2'...[with_part_number];
[with_part_number]scale=1080:1920,format=yuv420p[final]
```

### 2.3 O que o `filter_complex` inclui vs. o que você pediu

| Item | No filter? | Onde |
|------|------------|------|
| Áudio | Não | Áudio não entra no filter; é mapeado nas opções de saída com `-map '0:a?'` |
| Background | Sim | `[bg_fixed]` (imagem ou `color`) sempre como base |
| "Parte x/y" | Sim | `drawtext` "Parte N/M" em bold, canto superior direito |
| Vídeo de retenção | Sim | Overlay na parte inferior (`retentionY`), quando retenção é usada |

O `filter_complex` em si está coerente com background, "Parte x/y" e retenção. O bloqueio vem da **validação de `inputCount`** quando há retenção, não do desenho do filter.

---

## 3. Vídeo de retenção – está sendo usado na composição?

### 3.1 No processor

- Retenção é gerada com `getRetentionClips(nicheId, finalClips.length, retentionClipsDir)` quando `retentionVideoId !== 'none'` e `nicheId` existe.
- Para o clipe `i` usa-se `retentionClips[clipIndex - 1]` como `currentRetentionVideoPath` e isso é passado em `retentionVideoPath` para `composeFinalVideo`.

Então o vídeo de retenção **é** obtido e **é** repassado ao composer quando há retenção.

### 3.2 No composer

- Se `retentionVideoPath` existe, o arquivo é validado (existe e não vazio) e o composer:
  - Adiciona o retenção como input (índice 2 com bg, 1 sem bg).
  - Inclui no `filter_complex` o `scale` → `pad` → `overlay` do retenção na parte inferior.

Porém, **antes** de rodar o FFmpeg, a validação `maxInputIndex >= inputCount` falha (por causa do `inputCount` que não considera o input de retenção). O comando **não é executado**, então o vídeo de retenção **nunca chega a ser usado** na composição quando está presente.

---

## 4. Comando FFmpeg – o que seria executado

### 4.1 Estrutura (que o código monta)

Ordem lógica:

1. **Inputs**
   - `-i <clipPath>` (0)
   - Se bg: `-loop 1 -i <fixedBackgroundPath>` (1)
   - Se retenção: `-stream_loop -1 -i <retentionVideoPath>` (2 ou 1)

2. **Filter**
   - `-filter_complex "..."` com o grafo descrito acima.

3. **Output**
   - `-map '[final]'`
   - `-s 1080x1920 -aspect 9:16`
   - `-c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -movflags +faststart`
   - `-map '0:a?' -c:a aac -b:a 128k`
   - `-y <outputPath>`

### 4.2 Onde ver o comando completo

- No `composer`, no `on('start')` do FFmpeg, o comando completo é logado em:
  - `[FFMPEG_COMMAND] Comando FFmpeg completo:`
  - `[FFMPEG_COMMAND] <cmdline>`

Ou seja, o comando **chegaria** a ser logado **somente se** a validação do `filter_complex` passasse. Como a validação **falha** quando há retenção, o FFmpeg **não** é iniciado e esse log **não** aparece para esses casos. Para clipes **sem** retenção, o log aparece (se o resto do fluxo seguir).

### 4.3 Log do `filter_complex`

- O composer loga:
  - `[COMPOSER] Filter complex (primeiros 500 chars):` e
  - `[COMPOSER] Filter complex (restante):` (até 1000 chars).

Isso ocorre **antes** da validação que rejeita. Ou seja, **o `filter_complex` é logado mesmo quando há retenção**; o que não chega a rodar é o FFmpeg.

---

## 5. Recomendações (o que corrigir)

### 5.1 Crítico: validação de `inputCount` (videoComposer.js)

**Problema:** Ao usar vídeo de retenção, o filter referencia `[1:v]` ou `[2:v]`, mas `inputCount` não é incrementado para o input de retenção. A checagem `maxInputIndex >= inputCount` passa a falhar e a composição é rejeitada.

**Correção:** Atualizar `inputCount` quando o vídeo de retenção for adicionado, por exemplo:

- Se há retenção e há bg: usar input 2 → fazer `inputCount = 3` (ou equivalente) **antes** da validação.
- Se há retenção e não há bg: usar input 1 → fazer `inputCount = 2` **antes** da validação.

A validação deve usar esse `inputCount` atualizado para que `maxInputIndex >= inputCount` só falhe quando realmente houver referência a um input não adicionado.

### 5.2 Garantir log completo do `filter_complex`

- Manter ou ampliar o log do `filter_complex` completo (hoje limitado a 500 + 500 chars) para facilitar diagnóstico em produção, sobretudo quando retention/headline/legendas variam.

### 5.3 Garantir log do comando FFmpeg mesmo em caso de rejeição (opcional)

- Hoje o `[FFMPEG_COMMAND]` só aparece se o FFmpeg for efetivamente iniciado. Em caso de **rejeição na validação**, o comando não é montado nem logado. Para debugar melhor, pode-se logar também o “comando que seria executado” (inputs + `-filter_complex` + output options) quando a validação falhar, logo antes do `reject`.

### 5.4 Verificações adicionais (já ok no código, só conferir)

- **Áudio:** `-map '0:a?'` e `-c:a aac` já são sempre adicionados às `outputOptions` no composer. Nada a alterar aí.
- **Background:** Sempre há `[bg_fixed]` (imagem ou `color`). Ok.
- **"Parte x/y":** Sempre adicionado com `drawtext`, bold, canto superior direito. Ok.
- **Retenção:** Incluída no filter e posicionada na parte inferior (margem 140 px) quando existe. O que impede o uso é só a validação de `inputCount`.

---

## 6. Resumo

| Ponto | Situação |
|-------|----------|
| Processor chama `composeFinalVideo` por clipe? | Sim, com `clipPath`, `outputPath`, `clipNumber`, `totalClips`, `retentionVideoPath`, etc. |
| Parâmetros corretos? | Sim. |
| `filter_complex` com bg, "Parte x/y", retenção? | Sim. |
| Áudio no comando? | Sim, via `-map '0:a?'` (não no filter). |
| Vídeo de retenção usado na composição? | Só seria usado; na prática a execução do FFmpeg **não ocorre** quando há retenção. |
| Comando FFmpeg logado? | Só quando o FFmpeg é iniciado; com retenção a validação falha antes e o comando não chega a rodar nem a ser logado. |
| Causa raiz dos arquivos finais não gerados | Validação `maxInputIndex >= inputCount` no **videoComposer**: `inputCount` não considera o input de retenção, logo há **reject** sempre que se usa vídeo de retenção. |

**Ação prioritária:** Ajustar a lógica de `inputCount` no **videoComposer.js** para refletir o input de retenção quando ele for adicionado, de modo que a validação deixe de rejeitar nesses casos e o FFmpeg execute, gerando os `*_final.mp4` com áudio, background, "Parte x/y" e vídeo de retenção.
