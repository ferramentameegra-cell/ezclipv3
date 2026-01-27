# 🔍 DIAGNÓSTICO COMPLETO: Por que os clipes não estão sendo gerados

## 📋 SUMÁRIO EXECUTIVO

Este documento identifica **todos os possíveis bloqueios e processos não executados** que podem impedir a geração de clipes no sistema.

---

## 🚨 BLOQUEIOS CRÍTICOS (Alto Impacto)

### 1. **VÍDEO NÃO ENCONTRADO NO VIDEOSTORE**
**Localização:** `src/services/videoProcessor.js:88-152`

**Problema:**
- O vídeo não está no `videoStore` quando a geração inicia
- Sistema tenta procurar em múltiplos caminhos, mas pode falhar

**Validações que bloqueiam:**
```javascript
if (!video) {
  // Tenta procurar em múltiplos caminhos
  // Se não encontrar, lança erro:
  throw new Error(`Vídeo ${videoId} não encontrado no videoStore e nenhum arquivo encontrado.`)
}
```

**Possíveis causas:**
- Download do YouTube não foi concluído
- Arquivo foi deletado antes da geração
- Caminho do arquivo está incorreto
- `videoStore` não foi inicializado corretamente

**Como verificar:**
- Verificar logs: `[PROCESSING] ⚠️ Vídeo ${videoId} não encontrado no videoStore`
- Verificar se arquivo existe em `/tmp/uploads/${videoId}.mp4`
- Verificar se download foi concluído antes de iniciar geração

---

### 2. **DOWNLOAD DO YOUTUBE FALHANDO**
**Localização:** `src/services/videoProcessor.js:207-271`

**Problema:**
- Download do YouTube pode falhar silenciosamente
- Erro 403 (bloqueio do YouTube)
- Timeout no download
- Arquivo baixado está vazio

**Validações que bloqueiam:**
```javascript
if (!fs.existsSync(downloadPath)) {
  throw new Error('Download não criou o arquivo');
}
if (stats.size === 0) {
  throw new Error('Arquivo baixado está vazio');
}
```

**Possíveis causas:**
- YouTube bloqueou acesso (403)
- Cookies não configurados (`YTDLP_COOKIES`)
- Timeout no download
- Erro de rede/conexão
- Vídeo privado ou restrito

**Como verificar:**
- Verificar logs: `[PROCESSING] Baixando vídeo do YouTube: ${youtubeVideoId}`
- Verificar se erro 403 aparece nos logs
- Verificar se `YTDLP_COOKIES` está configurado no Railway

---

### 3. **VALIDAÇÃO DO VÍDEO COM FFPROBE FALHANDO**
**Localização:** `src/services/videoProcessor.js:289-294`

**Problema:**
- FFprobe não consegue validar o vídeo
- Vídeo corrompido ou formato inválido
- FFprobe não está instalado/configurado

**Validações que bloqueiam:**
```javascript
try {
  await validateVideoWithFfprobe(sourceVideoPath);
} catch (validationError) {
  throw new Error(`Vídeo inválido: ${validationError.message}`);
}
```

**Possíveis causas:**
- FFprobe não está no PATH
- Vídeo corrompido durante download
- Formato de vídeo não suportado
- Permissões de arquivo incorretas

**Como verificar:**
- Verificar logs: `[PROCESSING] Vídeo validado: ${sourceVideoPath}`
- Verificar se FFprobe está instalado: `ffprobe -version`
- Verificar se arquivo não está corrompido

---

### 4. **DURAÇÃO DO VÍDEO INVÁLIDA**
**Localização:** `src/services/videoProcessor.js:301-321`

**Problema:**
- Duração do vídeo não está disponível ou é inválida
- FFprobe não consegue obter duração
- Duração é 0 ou negativa

**Validações que bloqueiam:**
```javascript
if (videoDuration <= 0 || isNaN(videoDuration)) {
  throw new Error(`Duração do vídeo inválida: ${videoDuration}s`);
}
```

**Possíveis causas:**
- Vídeo não tem metadados de duração
- FFprobe falhou ao obter duração
- Vídeo está corrompido
- Store não tem duração salva

**Como verificar:**
- Verificar logs: `[PROCESSING] Duração obtida via ffprobe: ${videoDuration}s`
- Verificar se `video.duration` está no store
- Verificar se FFprobe consegue ler o vídeo

---

### 5. **TRIM INVÁLIDO**
**Localização:** `src/services/videoProcessor.js:323-340`

**Problema:**
- Tempo final menor ou igual ao inicial
- Duração do trim inválida
- Trim maior que duração do vídeo

**Validações que bloqueiam:**
```javascript
if (endTime <= startTime) {
  throw new Error(`Tempo final (${endTime}s) deve ser maior que o inicial (${startTime}s)`);
}
if (trimmedDuration < cutDuration) {
  throw new Error(`Duração do trim (${trimmedDuration}s) menor que a duração do corte (${cutDuration}s)`);
}
```

**Possíveis causas:**
- Parâmetros de trim incorretos do frontend
- Cálculo de trim incorreto
- Duração do corte maior que duração disponível

**Como verificar:**
- Verificar logs: `[PROCESSING] Trim calculado: ${startTime}s - ${endTime}s`
- Verificar parâmetros `trimStart` e `trimEnd` no request
- Verificar se `cutDuration` é menor que `trimmedDuration`

---

### 6. **VÍDEO PROCESSADO NÃO ENCONTRADO APÓS TRIM**
**Localização:** `src/services/videoProcessor.js:485-492`

**Problema:**
- Arquivo de vídeo processado não existe após trim
- Arquivo está vazio após trim
- Trim falhou silenciosamente

**Validações que bloqueiam:**
```javascript
if (!fs.existsSync(processedVideoPath)) {
  throw new Error(`Vídeo processado não encontrado: ${processedVideoPath}`);
}
if (processedVideoStats.size === 0) {
  throw new Error(`Vídeo processado está vazio: ${processedVideoPath}`);
}
```

**Possíveis causas:**
- FFmpeg falhou ao fazer trim
- Arquivo foi deletado durante processamento
- Permissões de escrita incorretas
- Espaço em disco insuficiente

**Como verificar:**
- Verificar logs: `[PROCESSING] ✅ Vídeo processado validado`
- Verificar se arquivo existe em `/tmp/uploads/${videoId}_trimmed.mp4`
- Verificar logs do FFmpeg durante trim

---

### 7. **SPLITVIDEOINTOCLIPS FALHANDO**
**Localização:** `src/services/videoProcessor.js:509-540`

**Problema:**
- Função `splitVideoIntoClips` não está gerando clipes
- Retorna array vazio
- Erro silencioso na função

**Validações que bloqueiam:**
```javascript
const clips = await splitVideoIntoClips(...);
if (!clips || clips.length === 0) {
  // Pode não bloquear, mas não gera clipes
}
```

**Possíveis causas:**
- FFmpeg falhou ao cortar vídeo
- Parâmetros incorretos para split
- Timeout no processamento
- Erro não capturado na função

**Como verificar:**
- Verificar logs: `[PROCESSING] ✅ splitVideoIntoClips retornou ${clips.length} clipe(s)`
- Verificar se arquivos de clipes foram criados em `/tmp/uploads/series/${seriesId}/`
- Verificar logs do FFmpeg durante split

---

### 8. **COMPOSIÇÃO FINAL FALHANDO**
**Localização:** `src/services/videoProcessor.js:787-1015`

**Problema:**
- `composeFinalVideo` falha para cada clip
- Erro no FFmpeg durante composição
- Arquivo final não é criado

**Validações que bloqueiam:**
```javascript
try {
  await composeFinalVideo(...);
} catch (compositionError) {
  // Tenta recuperação, mas pode falhar
  // Usa fallback, mas pode não funcionar
}
```

**Possíveis causas:**
- FFmpeg não consegue compor vídeo
- Arquivos de entrada não encontrados (retenção, background, etc.)
- Erro no filter_complex do FFmpeg
- Timeout na composição
- Memória insuficiente

**Como verificar:**
- Verificar logs: `[PROCESSING] ✅ Clip ${clipIndex}/${finalClips.length} composto com sucesso`
- Verificar logs: `[COMPOSER]` para erros de composição
- Verificar se arquivos `*_final.mp4` foram criados
- Verificar logs do FFmpeg durante composição

---

## ⚠️ BLOQUEIOS DE MÉDIO IMPACTO

### 9. **VIDEOSTORE NÃO CONFIGURADO**
**Localização:** `src/services/videoProcessor.js:84-86`

**Problema:**
- `videoStore` não foi injetado no processador
- Sistema não consegue acessar vídeos

**Validação que bloqueia:**
```javascript
if (!videoStore) {
  throw new Error('VideoStore não foi configurado');
}
```

**Como verificar:**
- Verificar se `setVideoStore()` foi chamado antes de processar
- Verificar inicialização do sistema

---

### 10. **VÍDEO AINDA SENDO BAIXADO**
**Localização:** `src/services/videoProcessor.js:156-181`

**Problema:**
- Geração inicia antes do download terminar
- Sistema aguarda até 60 segundos, mas pode não ser suficiente

**Validação que bloqueia:**
```javascript
if (videoState && videoState.state === VIDEO_STATES.DOWNLOADING) {
  // Aguarda até 60 segundos
  // Se não terminar, lança erro:
  throw new Error(`Vídeo ${videoId} ainda não está pronto após aguardar ${maxWait} segundos.`)
}
```

**Como verificar:**
- Verificar logs: `[PROCESSING] ⏳ Vídeo está sendo baixado, aguardando conclusão...`
- Verificar se download está demorando mais que 60 segundos

---

### 11. **FFMPEG NÃO CONFIGURADO**
**Localização:** `src/services/videoProcessor.js:459-468`

**Problema:**
- FFmpeg não está no PATH
- FFmpeg não está configurado corretamente
- Sistema continua mesmo com erro (pode falhar depois)

**Como verificar:**
- Verificar logs: `[PROCESSING] ⚠️ FFmpeg pode não estar configurado corretamente`
- Verificar se FFmpeg está instalado: `ffmpeg -version`

---

### 12. **LEGENDAS NÃO GERADAS**
**Localização:** `src/services/videoProcessor.js:664-704`

**Problema:**
- Geração automática de legendas falha
- Sistema continua sem legendas (não bloqueia, mas clipes ficam sem legendas)

**Como verificar:**
- Verificar logs: `[PROCESSING] ⚠️ Nenhuma legenda encontrada. Gerando legendas automaticamente...`
- Verificar logs: `[PROCESSING] ✅ Legendas geradas automaticamente: ${captions.length} blocos`
- Verificar se OpenAI API está funcionando

---

## 🔍 PROCESSOS QUE PODEM NÃO ESTAR SENDO EXECUTADOS

### 13. **DOWNLOAD DO YOUTUBE NÃO INICIA**
**Sintomas:**
- Vídeo não é baixado antes da geração
- `youtubeVideoId` não está no job data

**Como verificar:**
- Verificar se `youtubeVideoId` está sendo enviado no request
- Verificar se download foi enfileirado corretamente
- Verificar logs do worker de download

---

### 14. **TRIM NÃO É APLICADO**
**Sintomas:**
- Vídeo completo é usado mesmo com trimStart/trimEnd
- Arquivo `_trimmed.mp4` não é criado

**Como verificar:**
- Verificar logs: `[PROCESSING] Aplicando trim: ${startTime}s - ${endTime}s`
- Verificar se arquivo `_trimmed.mp4` existe
- Verificar se `trimStart` e `trimEnd` estão corretos

---

### 15. **SPLIT NÃO GERA CLIPES**
**Sintomas:**
- Função `splitVideoIntoClips` retorna array vazio
- Nenhum arquivo de clip é criado

**Como verificar:**
- Verificar logs: `[PROCESSING] Chamando splitVideoIntoClips...`
- Verificar se arquivos de clipes foram criados
- Verificar implementação de `splitVideoIntoClips`

---

### 16. **COMPOSIÇÃO NÃO É APLICADA**
**Sintomas:**
- Clipes não têm layout final aplicado
- Arquivos `*_final.mp4` não são criados

**Como verificar:**
- Verificar logs: `[PROCESSING] Aplicando composição final em ${finalClips.length} clips...`
- Verificar se arquivos `*_final.mp4` existem
- Verificar logs do `composeFinalVideo`

---

### 17. **PROGRESSO NÃO É ATUALIZADO**
**Sintomas:**
- Frontend não recebe atualizações de progresso
- Job fica travado em determinado percentual

**Como verificar:**
- Verificar se `updateProgressEvent` está sendo chamado
- Verificar se SSE/polling está funcionando
- Verificar logs de progresso

---

## 📊 CHECKLIST DE DIAGNÓSTICO

### ✅ Verificações Básicas

- [ ] Vídeo existe no `videoStore`?
- [ ] Arquivo de vídeo existe em `/tmp/uploads/${videoId}.mp4`?
- [ ] Download do YouTube foi concluído?
- [ ] FFmpeg está instalado e no PATH?
- [ ] FFprobe está instalado e no PATH?
- [ ] Espaço em disco suficiente?
- [ ] Permissões de escrita em `/tmp/uploads/`?

### ✅ Verificações de Processamento

- [ ] Vídeo foi validado com FFprobe?
- [ ] Duração do vídeo foi obtida corretamente?
- [ ] Trim foi aplicado (se necessário)?
- [ ] Arquivo `_trimmed.mp4` foi criado?
- [ ] `splitVideoIntoClips` retornou clipes?
- [ ] Arquivos de clipes foram criados?
- [ ] Composição final foi aplicada?
- [ ] Arquivos `*_final.mp4` foram criados?

### ✅ Verificações de Logs

- [ ] Logs mostram `[PROCESSING] Iniciando geração de série...`?
- [ ] Logs mostram download do YouTube (se necessário)?
- [ ] Logs mostram validação do vídeo?
- [ ] Logs mostram aplicação de trim?
- [ ] Logs mostram geração de clipes?
- [ ] Logs mostram composição final?
- [ ] Logs mostram `[PROCESSING] ✅ Série finalizada`?

---

## 🛠️ AÇÕES CORRETIVAS RECOMENDADAS

### 1. **Adicionar Logs Detalhados**
Adicionar logs em cada etapa crítica para identificar onde está travando.

### 2. **Melhorar Tratamento de Erros**
Capturar e logar todos os erros, não apenas lançar exceções.

### 3. **Validar Entradas Antes de Processar**
Validar todos os parâmetros antes de iniciar processamento pesado.

### 4. **Adicionar Timeouts**
Adicionar timeouts em operações que podem travar indefinidamente.

### 5. **Verificar Dependências**
Garantir que FFmpeg, FFprobe e outras dependências estão instaladas.

### 6. **Monitorar Recursos**
Verificar uso de CPU, memória e disco durante processamento.

---

## 📝 PRÓXIMOS PASSOS

1. **Verificar logs do Railway** para identificar onde está travando
2. **Executar checklist de diagnóstico** acima
3. **Adicionar logs adicionais** nas áreas críticas
4. **Testar cada etapa isoladamente** para identificar o problema
5. **Implementar correções** baseadas nos achados

---

**Data do Diagnóstico:** 2026-01-27
**Versão do Código:** Commit `4763e4a` (09:44:23)
