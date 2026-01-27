# ⚡ Prompt: Otimizar Velocidade de Geração de Clipes

## 📊 Respostas às Perguntas

### 1. Quanto tempo leva para gerar cada clipe?
**Resposta**: ~35-70 segundos por clipe (processamento sequencial)
- **Split**: 5-10 segundos por clipe
- **Composição**: 30-60 segundos por clipe
- **Total sequencial para 5 clipes**: ~3-6 minutos

### 2. Qual é o tamanho do vídeo original?
**Resposta**: Suporta qualquer tamanho
- **Típico**: 5-30 minutos
- **Máximo recomendado**: 2 horas (para evitar timeouts)
- **Duração por clipe**: 60 segundos (padrão, configurável)

### 3. Qual é a resolução final dos clipes?
**Resposta**: ✅ **1080x1920 (9:16 vertical)** - Confirmado
- Hardcoded em `videoComposer.js`
- Forçado via múltiplas camadas de validação

### 4. O sistema está gerando clipes de retenção em paralelo?
**Resposta**: ❌ **NÃO** - está sequencial
- Código atual usa `for...await` (linha 679 em videoProcessor.js)
- **Oportunidade**: Paralelizar com `Promise.all()` → **5x mais rápido**

### 5. Você quer que eu crie um prompt para otimizar a velocidade?
**Resposta**: ✅ **SIM** - Veja abaixo

---

## 🚀 Prompt de Otimização

### Objetivo

Otimizar a velocidade de geração de clipes implementando processamento paralelo e ajustes de performance, reduzindo o tempo total de geração de **~5 minutos para ~2 minutos** (para 5 clipes).

---

## 📋 Tarefas de Otimização

### Tarefa 1: Paralelizar Geração de Clipes de Retenção

**Arquivo**: `src/services/videoProcessor.js` (linhas 715-706)

**Problema Atual:**
```javascript
// Sequencial - lento
for (const interval of clipIntervals) {
  await trimVideo(retentionVideoPath, retentionClipPath, interval.start, interval.end);
}
// Tempo: 5 clipes × 5s = 25 segundos
```

**Solução:**
```javascript
// Paralelo - rápido
const retentionPromises = clipIntervals.map(async (interval) => {
  const retentionClipPath = path.join(
    retentionClipsDir,
    `retention_clip_${String(interval.index + 1).padStart(3, '0')}.mp4`
  );
  
  try {
    await trimVideo(retentionVideoPath, retentionClipPath, interval.start, interval.end);
    
    // Validar clip gerado
    if (fs.existsSync(retentionClipPath)) {
      const clipStats = fs.statSync(retentionClipPath);
      if (clipStats.size > 0) {
        console.log(`[PROCESSING] ✅ Clip de retenção ${interval.index + 1} gerado: ${(clipStats.size / 1024 / 1024).toFixed(2)} MB`);
        return retentionClipPath;
      }
    }
    return null;
  } catch (clipError) {
    console.error(`[PROCESSING] ❌ Erro ao gerar clip de retenção ${interval.index + 1}: ${clipError.message}`);
    return null;
  }
});

const retentionResults = await Promise.all(retentionPromises);
retentionClips = retentionResults.filter(path => path !== null);

console.log(`[PROCESSING] ✅ ${retentionClips.length}/${clipIntervals.length} clipes de retenção gerados em paralelo`);
```

**Ganho**: De 25s para ~5s (5x mais rápido)

---

### Tarefa 2: Paralelizar Composição de Clipes Finais (com Limite)

**Arquivo**: `src/services/videoProcessor.js` (linha 917)

**Problema Atual:**
```javascript
// Sequencial - muito lento
for (let i = 0; i < finalClips.length; i++) {
  await composeFinalVideo({ ... }); // ~45s cada
}
// Tempo: 5 clipes × 45s = 225 segundos
```

**Solução:**
```javascript
// Paralelo com batch (2-3 clipes por vez para evitar sobrecarga)
const COMPOSITION_BATCH_SIZE = parseInt(process.env.COMPOSITION_BATCH_SIZE || '2', 10);

for (let i = 0; i < finalClips.length; i += COMPOSITION_BATCH_SIZE) {
  const batch = finalClips.slice(i, i + COMPOSITION_BATCH_SIZE);
  
  console.log(`[PROCESSING] Processando batch de composição: clipes ${i + 1} a ${Math.min(i + COMPOSITION_BATCH_SIZE, finalClips.length)}`);
  
  const batchPromises = batch.map(async (clipPath, batchIndex) => {
    const clipIndex = i + batchIndex + 1;
    
    // ... código de validação e preparação ...
    
    const finalClipPath = STORAGE_CONFIG.getFinalClipPath(seriesId, clipIndex);
    
    // ... preparar parâmetros de composição ...
    
    try {
      await composeFinalVideo({
        clipPath,
        outputPath: finalClipPath,
        // ... outros parâmetros ...
      });
      
      // Validar e atualizar progresso
      if (fs.existsSync(finalClipPath)) {
        const finalClipStats = fs.statSync(finalClipPath);
        if (finalClipStats.size > 0) {
          console.log(`[PROCESSING] ✅ Clip final ${clipIndex} composto com sucesso`);
          return finalClipPath;
        }
      }
      throw new Error(`Clip final ${clipIndex} inválido após composição`);
    } catch (compositionError) {
      console.error(`[PROCESSING] ❌ Erro ao compor clip ${clipIndex}: ${compositionError.message}`);
      throw compositionError;
    }
  });
  
  // Processar batch em paralelo
  const batchResults = await Promise.all(batchPromises);
  
  // Atualizar array de clipes finais
  batchResults.forEach((resultPath, batchIndex) => {
    finalClips[i + batchIndex] = resultPath;
  });
  
  // Atualizar progresso após cada batch
  const batchProgress = Math.min(99, Math.round(compositionProgress + (compositionRange * ((i + COMPOSITION_BATCH_SIZE) / finalClips.length))));
  updateProgressEvent(job.id, {
    status: 'processing',
    totalClips: finalClips.length,
    currentClip: Math.min(i + COMPOSITION_BATCH_SIZE, finalClips.length),
    progress: batchProgress,
    message: `Batch ${Math.floor(i / COMPOSITION_BATCH_SIZE) + 1} concluído: ${batchResults.length} clipes compostos`
  });
}
```

**Ganho**: De 225s para ~90-135s (2-2.5x mais rápido, dependendo do batch size)

---

### Tarefa 3: Otimizar Presets do FFmpeg

**Arquivos**: 
- `src/services/videoComposer.js` (linha 758)
- `src/services/videoTrimmer.js` (linha 70)

**Mudanças:**

1. **videoComposer.js**: Mudar preset de `medium` para `fast`
   ```javascript
   // Antes
   '-preset', 'medium',
   
   // Depois
   '-preset', 'fast', // Mais rápido, qualidade ainda excelente
   ```

2. **videoTrimmer.js**: Já usa `veryfast` (ok, manter)

**Ganho**: 20-30% mais rápido na composição

---

### Tarefa 4: Adicionar Variável de Ambiente para Controle

**Arquivo**: Criar ou atualizar `.env.example`

```bash
# Otimização de Performance
COMPOSITION_BATCH_SIZE=2  # Número de clipes a compor em paralelo (2-3 recomendado)
FFMPEG_PRESET_COMPOSE=fast  # Preset FFmpeg para composição (fast/medium/slow)
FFMPEG_PRESET_TRIM=veryfast  # Preset FFmpeg para trim (ultrafast/veryfast/fast)
```

---

## 📊 Estimativa de Melhoria

### Cenário: 5 clipes de 60 segundos

**Antes (Sequencial):**
- Split: 35s
- Retenção: 25s
- Composição: 225s
- **Total: ~285 segundos (4.75 minutos)**

**Depois (Otimizado):**
- Split: 25s (melhorado com preset)
- Retenção: 5s (paralelo)
- Composição: 90s (paralelo batch=2, preset=fast)
- **Total: ~120 segundos (2 minutos)**

**Ganho Total: 2.4x mais rápido (de 4.75min para 2min)**

---

## ✅ Checklist de Implementação

- [ ] Paralelizar geração de clipes de retenção
- [ ] Paralelizar composição de clipes finais (com batch)
- [ ] Otimizar preset FFmpeg em videoComposer.js
- [ ] Adicionar variáveis de ambiente para controle
- [ ] Adicionar logs de tempo de processamento
- [ ] Testar com diferentes números de clipes
- [ ] Validar que qualidade não foi comprometida

---

## 🎯 Priorização

1. **ALTA**: Paralelizar composição (maior impacto)
2. **ALTA**: Paralelizar retenção (fácil e eficaz)
3. **MÉDIA**: Otimizar presets (ganho rápido)
4. **BAIXA**: Variáveis de ambiente (controle futuro)

---

## ⚠️ Considerações Importantes

1. **Limite de Paralelismo**: Não processar todos os clipes de uma vez (pode sobrecarregar CPU/memória)
   - Recomendado: 2-3 clipes em paralelo
   - Ajustável via `COMPOSITION_BATCH_SIZE`

2. **Qualidade vs Velocidade**: 
   - Preset `fast` ainda mantém excelente qualidade
   - Se precisar de mais velocidade, pode usar `veryfast` (sacrifica um pouco de qualidade)

3. **Memória**: Processamento paralelo consome mais memória
   - Monitorar uso de memória
   - Ajustar batch size se necessário

4. **Logs**: Adicionar logs de tempo para medir melhorias
   ```javascript
   const startTime = Date.now();
   // ... processamento ...
   const duration = (Date.now() - startTime) / 1000;
   console.log(`[PERFORMANCE] Composição concluída em ${duration.toFixed(2)}s`);
   ```

---

## 🚀 Resultado Esperado

Após implementar todas as otimizações:

- ✅ **2.4x mais rápido** na geração de clipes
- ✅ **Melhor uso de recursos** (CPU paralelo)
- ✅ **Mesma qualidade** de saída
- ✅ **Configurável** via variáveis de ambiente
- ✅ **Logs de performance** para monitoramento

---

**Pronto para implementar!** 🎉
