# 🔍 Diagnóstico: Ambiente e Caminhos de Armazenamento

## 📋 Respostas às Perguntas de Diagnóstico

### 1. Qual é o ambiente? Desenvolvimento local ou produção (Railway)?

**Resposta:**
O ambiente é determinado pela variável `NODE_ENV`:

- **Produção (Railway)**: `NODE_ENV=production` → Usa `/tmp` como base
- **Desenvolvimento Local**: `NODE_ENV` não definido ou diferente de `production` → Usa diretório do projeto

**Como verificar:**
```bash
# No Railway (produção)
echo $NODE_ENV
# Deve retornar: production

# Localmente (desenvolvimento)
echo $NODE_ENV
# Geralmente vazio ou não definido
```

---

### 2. Qual é o valor de NODE_ENV? Verificar nos logs do deploy

**Resposta:**
O `NODE_ENV` é definido automaticamente pelo Railway quando você faz deploy. 

**Como verificar nos logs:**

1. **No Railway Dashboard:**
   - Acesse seu projeto no Railway
   - Vá em "Deployments" → Selecione o deploy mais recente
   - Procure por logs que contenham:
     ```
     [STARTUP] Ambiente: production
     ```
   - Ou procure por:
     ```
     [STORAGE_CONFIG] Configuração inicializada. BASE_DIR: /tmp
     ```

2. **Nos logs de startup da aplicação:**
   ```
   [STARTUP] ========================================
   [STARTUP] Configuração de armazenamento:
   [STARTUP]   UPLOADS_DIR: /tmp/uploads          ← Produção
   [STARTUP]   SERIES_DIR: /tmp/uploads/series   ← Produção
   [STARTUP]   RETENTION_DIR: /tmp/retention-library
   [STARTUP]   CAPTIONS_DIR: /tmp/captions
   [STARTUP] Ambiente: production                 ← Confirma produção
   [STARTUP] ========================================
   ```

3. **Se for desenvolvimento local:**
   ```
   [STARTUP] Ambiente: development
   [STORAGE_CONFIG] BASE_DIR: /Users/josyasborba/Desktop/ezv2
   [STARTUP]   UPLOADS_DIR: /Users/josyasborba/Desktop/ezv2/uploads
   ```

---

### 3. Onde o vídeo foi salvo? Verificar se existe em /tmp/uploads/ ou /app/uploads/

**Resposta:**

**Em Produção (Railway):**
- ✅ **Caminho correto**: `/tmp/uploads/{videoId}.mp4`
- ❌ **Caminho antigo (não usado mais)**: `/app/uploads/` (não existe no Railway)

**Em Desenvolvimento Local:**
- ✅ **Caminho correto**: `{projeto}/uploads/{videoId}.mp4`
- Exemplo: `/Users/josyasborba/Desktop/ezv2/uploads/{videoId}.mp4`

**Como verificar:**

1. **No código (logs):**
   Procure por logs que mostram onde o vídeo foi salvo:
   ```
   [PROCESSING] ✅ Arquivo encontrado em: /tmp/uploads/videoId.mp4
   ```

2. **No Railway (via terminal):**
   ```bash
   # Conectar ao container do Railway
   railway shell
   
   # Verificar se o diretório existe
   ls -la /tmp/uploads/
   
   # Verificar se há vídeos
   ls -la /tmp/uploads/*.mp4
   ```

3. **Verificar via código:**
   O sistema agora usa `STORAGE_CONFIG.getVideoPath(videoId)` que automaticamente:
   - Em produção: retorna `/tmp/uploads/{videoId}.mp4`
   - Em desenvolvimento: retorna `{projeto}/uploads/{videoId}.mp4`

---

### 4. Qual é o conteúdo do storage.config.js? Como ficou após as correções?

**Resposta:**
Aqui está o conteúdo completo do arquivo `src/config/storage.config.js`:

```javascript
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define o diretório base dependendo do ambiente
const BASE_DIR = process.env.NODE_ENV === 'production' 
  ? '/tmp' 
  : path.join(__dirname, '../../');

export const STORAGE_CONFIG = {
  // Diretórios principais
  UPLOADS_DIR: path.join(BASE_DIR, 'uploads'),
  SERIES_DIR: path.join(BASE_DIR, 'uploads', 'series'),
  RETENTION_DIR: path.join(BASE_DIR, 'retention-library'),
  CAPTIONS_DIR: path.join(BASE_DIR, 'captions'),

  // Funções Helper para obter caminhos dinâmicos
  getVideoPath: (videoId) => path.join(BASE_DIR, 'uploads', `${videoId}.mp4`),
  getTrimmedVideoPath: (videoId) => path.join(BASE_DIR, 'uploads', `${videoId}_trimmed.mp4`),
  getDownloadedVideoPath: (videoId) => path.join(BASE_DIR, 'uploads', `${videoId}_downloaded.mp4`),
  getSeriesPath: (seriesId) => path.join(BASE_DIR, 'uploads', 'series', seriesId),
  getClipPath: (seriesId, clipIndex) => path.join(BASE_DIR, 'uploads', 'series', seriesId, `clip_${String(clipIndex).padStart(3, '0')}.mp4`),
  getFinalClipPath: (seriesId, clipIndex) => path.join(BASE_DIR, 'uploads', 'series', seriesId, `clip_${String(clipIndex).padStart(3, '0')}_final.mp4`),
};

// Garante que os diretórios existam ao iniciar
Object.values(STORAGE_CONFIG).forEach(dir => {
  if (typeof dir === 'string' && !dir.includes('(') && !fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`[STORAGE_CONFIG] ✅ Diretório criado: ${dir}`);
    } catch (error) {
      console.warn(`[STORAGE_CONFIG] ⚠️ Erro ao criar diretório ${dir}: ${error.message}`);
    }
  }
});

console.log(`[STORAGE_CONFIG] Configuração inicializada. BASE_DIR: ${BASE_DIR}`);
console.log(`[STORAGE_CONFIG] UPLOADS_DIR: ${STORAGE_CONFIG.UPLOADS_DIR}`);
console.log(`[STORAGE_CONFIG] SERIES_DIR: ${STORAGE_CONFIG.SERIES_DIR}`);
console.log(`[STORAGE_CONFIG] RETENTION_DIR: ${STORAGE_CONFIG.RETENTION_DIR}`);
```

**Explicação:**

1. **BASE_DIR**: 
   - Produção: `/tmp`
   - Desenvolvimento: `{projeto}/` (raiz do projeto)

2. **Diretórios configurados:**
   - `UPLOADS_DIR`: Onde os vídeos baixados são salvos
   - `SERIES_DIR`: Onde as séries de clipes são salvas
   - `RETENTION_DIR`: Onde os vídeos de retenção são armazenados
   - `CAPTIONS_DIR`: Onde as legendas são salvas

3. **Funções helper:**
   - `getVideoPath(videoId)`: Retorna caminho do vídeo principal
   - `getTrimmedVideoPath(videoId)`: Retorna caminho do vídeo trimado
   - `getDownloadedVideoPath(videoId)`: Retorna caminho do vídeo baixado
   - `getSeriesPath(seriesId)`: Retorna caminho da série
   - `getClipPath(seriesId, clipIndex)`: Retorna caminho de um clip
   - `getFinalClipPath(seriesId, clipIndex)`: Retorna caminho do clip final

4. **Criação automática de diretórios:**
   - Os diretórios são criados automaticamente ao iniciar a aplicação
   - Logs mostram quais diretórios foram criados

---

## 🔍 Como Diagnosticar Problemas

### Problema: Vídeo não encontrado

**Verificar:**

1. **Logs de startup:**
   ```
   [STORAGE_CONFIG] UPLOADS_DIR: /tmp/uploads
   ```
   Confirme que o caminho está correto para o ambiente.

2. **Logs durante download:**
   ```
   [YT-DLP] ✅ Download concluído usando Android Client
   [PROCESSING] ✅ Arquivo encontrado em: /tmp/uploads/videoId.mp4
   ```

3. **Verificar se o arquivo existe:**
   - No Railway: `railway shell` → `ls -la /tmp/uploads/`
   - Nos logs: Procure por `[PROCESSING] ✅ Arquivo encontrado em:`

### Problema: Caminhos inconsistentes

**Solução:**
- ✅ Todos os arquivos agora usam `STORAGE_CONFIG`
- ✅ Não há mais caminhos hardcoded nos arquivos principais
- ✅ O sistema detecta automaticamente o ambiente

**Arquivos que usam STORAGE_CONFIG:**
- ✅ `src/services/videoProcessor.js`
- ✅ `src/services/videoComposer.js`
- ✅ `src/services/retentionManager.js`
- ✅ `src/controllers/generateController.js`

---

## 📊 Mapeamento de Caminhos

### Produção (Railway) - NODE_ENV=production

```
BASE_DIR = /tmp

Vídeos baixados:     /tmp/uploads/{videoId}.mp4
Vídeos trimados:     /tmp/uploads/{videoId}_trimmed.mp4
Séries de clipes:    /tmp/uploads/series/{seriesId}/
Clipes finais:       /tmp/uploads/series/{seriesId}/clip_001_final.mp4
Vídeos de retenção:  /tmp/retention-library/{niche}/{videoId}/
Legendas:            /tmp/captions/
```

### Desenvolvimento Local - NODE_ENV não definido

```
BASE_DIR = /Users/josyasborba/Desktop/ezv2

Vídeos baixados:     /Users/josyasborba/Desktop/ezv2/uploads/{videoId}.mp4
Vídeos trimados:     /Users/josyasborba/Desktop/ezv2/uploads/{videoId}_trimmed.mp4
Séries de clipes:    /Users/josyasborba/Desktop/ezv2/uploads/series/{seriesId}/
Clipes finais:       /Users/josyasborba/Desktop/ezv2/uploads/series/{seriesId}/clip_001_final.mp4
Vídeos de retenção:  /Users/josyasborba/Desktop/ezv2/retention-library/{niche}/{videoId}/
Legendas:            /Users/josyasborba/Desktop/ezv2/captions/
```

---

## ✅ Checklist de Validação

- [ ] Logs de startup mostram `[STARTUP] Ambiente: production` (ou `development`)
- [ ] Logs mostram `[STORAGE_CONFIG] UPLOADS_DIR: /tmp/uploads` (produção)
- [ ] Vídeos são salvos em `/tmp/uploads/` (produção)
- [ ] Séries são salvas em `/tmp/uploads/series/` (produção)
- [ ] Nenhum erro relacionado a caminhos nos logs
- [ ] Diretórios são criados automaticamente ao iniciar

---

## 🚨 Problemas Comuns e Soluções

### Problema 1: "Vídeo não encontrado" em produção

**Causa:** Vídeo foi salvo em caminho diferente do esperado.

**Solução:**
1. Verifique os logs de download para ver onde o vídeo foi salvo
2. Confirme que `NODE_ENV=production` está definido
3. Verifique se o vídeo existe em `/tmp/uploads/`

### Problema 2: Caminhos diferentes entre desenvolvimento e produção

**Causa:** Código ainda usando caminhos hardcoded.

**Solução:**
- ✅ Já corrigido! Todos os arquivos principais usam `STORAGE_CONFIG`
- Se ainda houver problemas, verifique se todos os arquivos foram atualizados

### Problema 3: Diretórios não são criados

**Causa:** Permissões ou erro na criação.

**Solução:**
- Verifique os logs: `[STORAGE_CONFIG] ✅ Diretório criado: ...`
- Se houver erro: `[STORAGE_CONFIG] ⚠️ Erro ao criar diretório ...`
- No Railway, `/tmp` sempre tem permissões de escrita

---

## 📝 Notas Importantes

1. **Railway usa `/tmp`**: O Railway sempre tem `/tmp` disponível e com permissões de escrita
2. **Persistência**: Arquivos em `/tmp` são temporários e podem ser limpos entre deploys
3. **Ambiente automático**: O Railway define `NODE_ENV=production` automaticamente
4. **Logs são essenciais**: Sempre verifique os logs de startup para confirmar os caminhos

---

**Última atualização:** 27/01/2026  
**Versão:** 1.0
