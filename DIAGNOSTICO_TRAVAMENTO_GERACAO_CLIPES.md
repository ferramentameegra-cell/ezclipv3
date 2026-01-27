# 🔍 DIAGNÓSTICO: Travamento na Geração de Clipes

**Data**: 27/01/2026  
**Arquivos Analisados**: `videoComposer.js`, `videoProcessor.js`

---

## 🚨 PROBLEMAS CRÍTICOS IDENTIFICADOS

### 1. ⚠️ **FFmpeg SEM TIMEOUT** (CRÍTICO)

**Localização**: `src/services/videoComposer.js` linha 1083-1187

**Problema**: O FFmpeg não tem timeout configurado, pode travar **INDEFINIDAMENTE** se:
- O vídeo de entrada estiver corrompido
- O filter_complex tiver erro que não é detectado imediatamente
- O sistema ficar sem memória durante o processamento
- O FFmpeg entrar em loop infinito

**Código Problemático**:
```javascript
command
  .on('start', ...)
  .on('progress', ...)
  .on('end', ...)
  .on('error', ...)
  .save(outputPath); // ❌ SEM TIMEOUT
```

**Impacto**: ⭐⭐⭐⭐⭐ (CRÍTICO) - Pode travar a geração completamente

**Solução Recomendada**:
```javascript
// Adicionar timeout de 10 minutos por clipe
const FFMPEG_TIMEOUT = 10 * 60 * 1000; // 10 minutos
const timeoutId = setTimeout(() => {
  command.kill('SIGKILL');
  reject(new Error('FFmpeg timeout após 10 minutos'));
}, FFMPEG_TIMEOUT);

command
  .on('end', () => {
    clearTimeout(timeoutId);
    // ... resto do código
  })
  .on('error', (err) => {
    clearTimeout(timeoutId);
    // ... resto do código
  });
```

---

### 2. ⚠️ **ffprobe SEM TIMEOUT** (CRÍTICO)

**Localização**: `src/services/videoComposer.js` linha 607

**Problema**: `ffprobe` pode travar indefinidamente se o arquivo estiver corrompido ou inacessível.

**Código Problemático**:
```javascript
ffmpeg.ffprobe(clipPath, (err, metadata) => {
  // ❌ SEM TIMEOUT - pode travar aqui
  if (err) {
    return reject(new Error(`Erro ao obter metadados: ${err.message}`));
  }
  // ...
});
```

**Impacto**: ⭐⭐⭐⭐⭐ (CRÍTICO) - Bloqueia toda a composição

**Solução Recomendada**:
```javascript
const probeTimeout = setTimeout(() => {
  reject(new Error('ffprobe timeout após 30 segundos'));
}, 30000);

ffmpeg.ffprobe(clipPath, (err, metadata) => {
  clearTimeout(probeTimeout);
  if (err) {
    return reject(new Error(`Erro ao obter metadados: ${err.message}`));
  }
  // ...
});
```

---

### 3. ⚠️ **VÍDEO DE RETENÇÃO OBRIGATÓRIO** (ALTO)

**Localização**: `src/services/videoComposer.js` linhas 677-679, 733-735, 951-977

**Problema**: O código **REJEITA** a composição se o vídeo de retenção não for encontrado, mesmo quando deveria ser opcional.

**Código Problemático**:
```javascript
// Linha 677-679
if (retentionVideoId && retentionVideoId !== 'none' && !retentionVideoPath) {
  return reject(new Error(`[COMPOSER] ❌ Vídeo de retenção obrigatório não encontrado: ${retentionVideoId}`));
}

// Linha 733-735
if (retentionVideoId && retentionVideoId !== 'none') {
  return reject(new Error(`[COMPOSER] ❌ Vídeo de retenção obrigatório não foi encontrado: ${retentionVideoId}`));
}

// Linha 951-977 - Múltiplas validações que rejeitam
```

**Impacto**: ⭐⭐⭐⭐ (ALTO) - Bloqueia geração se vídeo de retenção falhar

**Solução Recomendada**: Tornar vídeo de retenção **OPCIONAL** e continuar sem ele:
```javascript
if (retentionVideoId && retentionVideoId !== 'none' && !retentionVideoPath) {
  console.warn(`[COMPOSER] ⚠️ Vídeo de retenção não encontrado: ${retentionVideoId}, continuando sem retenção`);
  retentionVideoPath = null; // Continuar sem vídeo de retenção
}
```

---

### 4. ⚠️ **DOWNLOAD DE VÍDEO DE RETENÇÃO PODE TRAVAR** (ALTO)

**Localização**: `src/services/videoComposer.js` linhas 234-445

**Problema**: 
- Timeout de 90s pode ser insuficiente para vídeos grandes
- Se o download falhar silenciosamente, pode travar esperando
- Múltiplas tentativas podem levar muito tempo (3 tentativas × 90s = 270s máximo)

**Código Problemático**:
```javascript
// Linha 1310 - Timeout de 90s
const timeout = setTimeout(() => {
  reject(new Error('Timeout ao baixar vídeo (90s)'));
}, 90000);

// Linha 429-445 - Tratamento de erro pode não capturar todos os casos
catch (downloadError) {
  // Se não for erro de vídeo privado, REJEITA
  if (!isPrivateVideoError && !isCookieError) {
    return reject(new Error(`Erro ao baixar vídeo de retenção: ${downloadError.message}`));
  }
}
```

**Impacto**: ⭐⭐⭐⭐ (ALTO) - Pode travar por até 4-5 minutos esperando download

**Solução Recomendada**: 
- Reduzir timeout para 60s
- Tornar download opcional (continuar sem vídeo de retenção)
- Adicionar timeout total para todo o processo de download

---

### 5. ⚠️ **VALIDAÇÕES MUITO RÍGIDAS** (MÉDIO)

**Localização**: `src/services/videoComposer.js` múltiplas linhas

**Problema**: Múltiplas validações que **REJEITAM** ao invés de continuar com fallback:

1. **Linha 678**: Vídeo de retenção obrigatório
2. **Linha 684**: Arquivo não existe
3. **Linha 689**: Arquivo vazio
4. **Linha 710-713**: Posição inválida
5. **Linha 985**: Filter complex vazio
6. **Linha 993**: Label [final] não encontrado
7. **Linha 1115**: Validação pós-render falhou

**Impacto**: ⭐⭐⭐ (MÉDIO) - Bloqueia geração desnecessariamente

**Solução Recomendada**: Tornar validações mais flexíveis, usar fallbacks ao invés de rejeitar

---

### 6. ⚠️ **PROMISE SEM TIMEOUT NO ffprobe DE RETENÇÃO** (MÉDIO)

**Localização**: `src/services/videoComposer.js` linha 450-457

**Problema**: Promise de `ffprobe` para vídeo de retenção não tem timeout.

**Código Problemático**:
```javascript
const retentionMetadata = await new Promise((retentionResolve, retentionReject) => {
  ffmpeg.ffprobe(retentionVideoPath, (retentionErr, retentionMetadata) => {
    // ❌ SEM TIMEOUT - pode travar aqui
    if (retentionErr) {
      return retentionResolve(null);
    }
    retentionResolve(retentionMetadata);
  });
});
```

**Impacto**: ⭐⭐⭐ (MÉDIO) - Pode travar se arquivo estiver corrompido

**Solução Recomendada**: Adicionar timeout de 30s

---

### 7. ⚠️ **LOOP DE ESPERA POR DOWNLOAD** (BAIXO)

**Localização**: `src/services/videoProcessor.js` linha 143-160

**Problema**: Loop aguarda até 60 segundos pelo download, mas pode travar se o estado não mudar.

**Código**:
```javascript
let waitCount = 0;
const maxWait = 60; // 60 tentativas de 1 segundo = 60 segundos
while (waitCount < maxWait) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  // ...
  waitCount++;
}
```

**Impacto**: ⭐⭐ (BAIXO) - Tem timeout, mas pode ser otimizado

---

## 📊 RESUMO DE PRIORIDADES

| # | Problema | Prioridade | Impacto | Tempo Estimado |
|---|----------|------------|---------|----------------|
| 1 | FFmpeg sem timeout | 🔴 CRÍTICA | ⭐⭐⭐⭐⭐ | 30min |
| 2 | ffprobe sem timeout | 🔴 CRÍTICA | ⭐⭐⭐⭐⭐ | 15min |
| 3 | Vídeo retenção obrigatório | 🟠 ALTA | ⭐⭐⭐⭐ | 20min |
| 4 | Download retenção pode travar | 🟠 ALTA | ⭐⭐⭐⭐ | 25min |
| 5 | Validações muito rígidas | 🟡 MÉDIA | ⭐⭐⭐ | 30min |
| 6 | Promise ffprobe sem timeout | 🟡 MÉDIA | ⭐⭐⭐ | 10min |
| 7 | Loop espera download | 🟢 BAIXA | ⭐⭐ | 5min |

---

## 🛠️ SOLUÇÕES RECOMENDADAS (ORDEM DE PRIORIDADE)

### ✅ **SOLUÇÃO 1: Adicionar Timeout ao FFmpeg** (URGENTE)

```javascript
// Em videoComposer.js, linha ~1083
const FFMPEG_TIMEOUT = 10 * 60 * 1000; // 10 minutos
let timeoutId = null;

command
  .on('start', (cmdline) => {
    timeoutId = setTimeout(() => {
      console.error('[COMPOSER] ⏱️ FFmpeg timeout após 10 minutos, encerrando...');
      command.kill('SIGKILL');
      reject(new Error('FFmpeg timeout: processamento excedeu 10 minutos'));
    }, FFMPEG_TIMEOUT);
    // ... resto do código
  })
  .on('end', () => {
    if (timeoutId) clearTimeout(timeoutId);
    // ... resto do código
  })
  .on('error', (err) => {
    if (timeoutId) clearTimeout(timeoutId);
    // ... resto do código
  });
```

---

### ✅ **SOLUÇÃO 2: Adicionar Timeout ao ffprobe** (URGENTE)

```javascript
// Em videoComposer.js, linha ~607
return new Promise((resolve, reject) => {
  const PROBE_TIMEOUT = 30000; // 30 segundos
  const timeoutId = setTimeout(() => {
    reject(new Error('ffprobe timeout: não respondeu em 30 segundos'));
  }, PROBE_TIMEOUT);
  
  ffmpeg.ffprobe(clipPath, (err, metadata) => {
    clearTimeout(timeoutId);
    if (err) {
      return reject(new Error(`Erro ao obter metadados: ${err.message}`));
    }
    resolve(metadata);
  });
});
```

---

### ✅ **SOLUÇÃO 3: Tornar Vídeo de Retenção Opcional** (ALTA PRIORIDADE)

```javascript
// Em videoComposer.js, substituir todas as rejeições por avisos
if (retentionVideoId && retentionVideoId !== 'none' && !retentionVideoPath) {
  console.warn(`[COMPOSER] ⚠️ Vídeo de retenção não encontrado: ${retentionVideoId}, continuando sem retenção`);
  retentionVideoPath = null; // Continuar sem vídeo de retenção
  // NÃO REJEITAR - continuar composição
}
```

---

### ✅ **SOLUÇÃO 4: Reduzir Timeout de Download e Tornar Opcional**

```javascript
// Em videoComposer.js, linha ~1310
const DOWNLOAD_TIMEOUT = 60000; // Reduzir para 60s (era 90s)

// E tornar download opcional:
catch (downloadError) {
  console.warn(`[COMPOSER] ⚠️ Erro ao baixar vídeo de retenção: ${downloadError.message}`);
  console.warn(`[COMPOSER] ⚠️ Continuando sem vídeo de retenção`);
  retentionVideoPath = null; // Continuar sem vídeo de retenção
  // NÃO REJEITAR
}
```

---

## 🎯 AÇÕES IMEDIATAS RECOMENDADAS

1. **URGENTE**: Adicionar timeout ao FFmpeg (10 minutos)
2. **URGENTE**: Adicionar timeout ao ffprobe (30 segundos)
3. **ALTA**: Tornar vídeo de retenção opcional (não bloquear geração)
4. **ALTA**: Reduzir timeout de download e melhorar tratamento de erros
5. **MÉDIA**: Adicionar timeout ao ffprobe de retenção
6. **MÉDIA**: Tornar validações mais flexíveis (usar fallbacks)

---

## 📝 NOTAS ADICIONAIS

- O código atual tem **muitas validações que bloqueiam** ao invés de continuar
- **Falta de timeouts** em operações críticas (FFmpeg, ffprobe)
- **Vídeo de retenção** é tratado como obrigatório quando deveria ser opcional
- **Download de vídeos** pode travar por muito tempo sem feedback adequado

---

**Próximos Passos**: Implementar as soluções na ordem de prioridade acima.
