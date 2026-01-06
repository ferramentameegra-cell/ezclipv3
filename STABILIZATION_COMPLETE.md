# ESTABILIZAÇÃO DO BACKEND - COMPLETA

## ✅ OBJETIVO ATINGIDO

Backend estabilizado para produção no Railway com fluxo síncrono e estável.

## 📋 ARQUIVOS MODIFICADOS

### 1. `src/index.js` (ENTRYPOINT)
**Mudanças:**
- ✅ PORT agora é obrigatório (sem fallback para 3000)
- ✅ Erro fatal se PORT não estiver definido
- ✅ Error handling global (unhandledRejection, uncaughtException)
- ✅ Logs claros e explícitos

**NÃO importa:**
- ❌ workers/
- ❌ queue/
- ❌ controllers legados

### 2. `src/routes/youtube.js` (ROTAS)
**Mudanças:**
- ✅ Rotas específicas declaradas antes de catch-all
- ✅ 5 endpoints estáveis:
  - `GET /api/youtube/info` - Metadata
  - `POST /api/youtube/acknowledge` - Consentimento
  - `POST /api/youtube/download` - Download síncrono
  - `GET /api/youtube/play/:videoId` - Playback
  - `GET /api/youtube/duration/:videoId` - Duração para trim

### 3. `src/controllers/youtubeStableController.js` (NOVO)
**Implementado:**
- ✅ `getYouTubeInfo` - Usa yt-dlp CLI para metadata
- ✅ `acknowledgeConsent` - Valida consentimento do usuário
- ✅ `downloadVideo` - Download síncrono com yt-dlp
- ✅ `playVideo` - Servir vídeo com range requests
- ✅ `getVideoDuration` - Duração + cálculo de clips (60s/120s)

### 4. `src/services/youtubeServiceStable.js` (NOVO)
**Implementado:**
- ✅ `getYouTubeVideoInfo` - Usa yt-dlp CLI com `--dump-json`
- ✅ `downloadYouTubeVideo` - Download com formato mp4 forçado
- ✅ Validação de URL
- ✅ Verificação de disponibilidade do yt-dlp
- ✅ Logs claros de progresso

### 5. `nixpacks.toml` (ATUALIZADO)
**Mudanças:**
- ✅ Instala yt-dlp via pip
- ✅ Instala ffmpeg via nixpacks
- ✅ start cmd: `node src/index.js`

## 🚫 CÓDIGO LEGADO INTENCIONALMENTE IGNORADO

**NÃO é importado:**
- `src/workers/` - Workers assíncronos
- `src/queue/` - Sistema de filas Bull
- Controllers legados:
  - `downloadController.js`
  - `downloadProgressController.js`
  - `generateController.js`
  - `trimController.js`
  - `videoController.js`

**Todos os arquivos legados permanecem intactos no projeto.**

## ✅ FLUXO COMPLETO ESTABILIZADO

### 1. Obter Info do Vídeo
```
GET /api/youtube/info?url=YOUTUBE_URL
```
- Valida URL
- Usa yt-dlp CLI: `yt-dlp --dump-json URL`
- Retorna: `title`, `duration`, `thumbnail`, `author`

### 2. Consentimento do Usuário
```
POST /api/youtube/acknowledge
Body: { url, userHasRights: true }
```
- Valida consentimento
- Bloqueia download se `userHasRights: false`
- Armazena em memória (temporário)

### 3. Download do Vídeo
```
POST /api/youtube/download
Body: { url }
```
- Verifica consentimento prévio
- Download síncrono com yt-dlp
- Formato: `mp4/h264/aac` forçado
- Salva em: `/tmp/uploads/{uuid}.mp4`
- Valida arquivo (tamanho > 0)
- Obtém duração com ffprobe
- Retorna: `videoId`, `duration`, `playableUrl`

### 4. Duração para Trim
```
GET /api/youtube/duration/:videoId
```
- Lê duração do vídeo com ffprobe
- Calcula clips possíveis:
  - `clips60s`: floor(duration / 60)
  - `clips120s`: floor(duration / 120)
- Retorna JSON com cálculos

### 5. Playback do Vídeo
```
GET /api/youtube/play/:videoId
```
- Servir vídeo com range requests (206)
- Suporta seeking no player

## 🔧 DEPENDÊNCIAS USADAS

**Apenas instaladas:**
- `express` - Servidor HTTP
- `cors` - CORS middleware
- `fluent-ffmpeg` - Para ffprobe (obter duração)
- `uuid` - Gerar IDs únicos

**Binários do sistema:**
- `yt-dlp` - Instalado via pip (nixpacks)
- `ffmpeg` - Instalado via nixpacks

**NENHUMA nova dependência npm foi adicionada.**

## 🚀 POR QUE O SERVIDOR NÃO VAI MAIS CRASHAR

1. ✅ **PORT obrigatório** - Fala imediatamente se não estiver configurado
2. ✅ **Error handling global** - Captura erros não tratados
3. ✅ **yt-dlp verificado** - Checa disponibilidade antes de usar
4. ✅ **Validações explícitas** - URL, arquivo, tamanho validados em cada etapa
5. ✅ **Sem workers/queues** - Não há processos assíncronos que podem falhar silenciosamente
6. ✅ **Logs claros** - Cada etapa loga progresso explícito
7. ✅ **Rotas específicas** - Sem conflitos de roteamento
8. ✅ **Síncrono** - Cada request completa antes de retornar

## 📊 FLUXO HAPPY PATH CONFIRMADO

1. ✅ **Usuário cola URL do YouTube**
   - Frontend chama: `GET /api/youtube/info?url=...`
   - Backend valida URL e retorna metadata

2. ✅ **Usuário aceita termos**
   - Frontend chama: `POST /api/youtube/acknowledge`
   - Backend registra consentimento

3. ✅ **Usuário solicita download**
   - Frontend chama: `POST /api/youtube/download`
   - Backend verifica consentimento
   - Download síncrono com yt-dlp
   - Arquivo salvo em `/tmp/uploads`
   - Retorna `videoId` e `duration`

4. ✅ **Usuário quer fazer trim**
   - Frontend chama: `GET /api/youtube/duration/:videoId`
   - Backend retorna duração + cálculos de clips
   - Frontend pode calcular trim baseado em duração real

## ⚠️ LIMITAÇÕES CONHECIDAS

- Store em memória (consent e vídeos) - Perde ao reiniciar
- Sem geração real de clips ainda (apenas cálculo)
- Sem persistência de downloads

## 🔮 PRÓXIMOS PASSOS SUGERIDOS

1. Implementar trim real (corte de vídeo)
2. Implementar geração de clips sequenciais
3. Adicionar persistência (Redis ou DB) se necessário

## 📝 COMO TESTAR

```bash
# Health check
curl http://localhost:$PORT/health

# Info
curl "http://localhost:$PORT/api/youtube/info?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Acknowledge
curl -X POST http://localhost:$PORT/api/youtube/acknowledge \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","userHasRights":true}'

# Download
curl -X POST http://localhost:$PORT/api/youtube/download \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'

# Duration
curl http://localhost:$PORT/api/youtube/duration/{videoId}
```

