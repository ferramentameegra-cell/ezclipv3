# 📡 API Routes - Documentação Completa

## 🎥 Rotas de Vídeo (`/api/video`)

### `POST /api/video/youtube`
Processa URL do YouTube e inicia download assíncrono.

**Request:**
```json
{
  "youtubeUrl": "https://youtube.com/watch?v=VIDEO_ID"
}
```

**Response:**
```json
{
  "videoId": "uuid",
  "message": "Vídeo do YouTube processado. Download iniciado em background.",
  "video": {
    "id": "uuid",
    "youtubeVideoId": "VIDEO_ID",
    "title": "Título do Vídeo",
    "duration": 3600,
    "downloaded": false,
    "downloadJobId": "download-uuid",
    "localVideoUrl": "/api/video/play/uuid"
  }
}
```

### `GET /api/video/download-status/:videoId`
Verifica status do download.

**Response:**
```json
{
  "videoId": "uuid",
  "downloaded": true,
  "downloadJobId": "download-uuid",
  "downloadError": null,
  "videoPath": "/path/to/video.mp4",
  "localVideoUrl": "/api/video/play/uuid"
}
```

### `GET /api/video/info/:videoId`
Obtém informações do vídeo.

### `GET /api/video/play/:videoId`
Serve vídeo baixado para player HTML5 (com range requests).

---

## ✂️ Rotas de Trim (`/api/trim`)

### `POST /api/trim/apply`
Aplica trim no vídeo local baixado.

**Request:**
```json
{
  "videoId": "uuid",
  "startTime": 100,
  "endTime": 400
}
```

**Response:**
```json
{
  "success": true,
  "videoId": "uuid",
  "trimmedPath": "/path/to/trimmed.mp4",
  "startTime": 100,
  "endTime": 400,
  "duration": 300,
  "message": "Trim aplicado com sucesso"
}
```

**Validações:**
- ✅ Verifica que vídeo está baixado antes de trim
- ✅ Valida tempos (endTime > startTime)
- ✅ Valida arquivo existe e tem tamanho > 0

### `POST /api/trim/calculate-clips`
Calcula quantos clips podem ser gerados.

**Request:**
```json
{
  "startTime": 0,
  "endTime": 3000,
  "clipDuration": 60
}
```

**Response:**
```json
{
  "startTime": 0,
  "endTime": 3000,
  "trimmedDuration": 3000,
  "clipDuration": 60,
  "clipsCount": 50,
  "formula": "floor(3000 / 60) = 50"
}
```

**Suporta:**
- ✅ 60 segundos (1 minuto)
- ✅ 120 segundos (2 minutos)

---

## 🎬 Rotas de Geração (`/api/generate`)

### `POST /api/generate/series`
Gera série de clips (processamento assíncrono).

**Request:**
```json
{
  "videoId": "uuid",
  "nicheId": "niche-id",
  "retentionVideoId": "random",
  "numberOfCuts": 50,
  "trimStart": 0,
  "trimEnd": 3000,
  "cutDuration": 60,
  "headlineStyle": "bold",
  "font": "Inter"
}
```

**Response:**
```json
{
  "jobId": "uuid",
  "seriesId": "uuid",
  "message": "Geração de série iniciada (processamento assíncrono)",
  "status": "processing"
}
```

### `GET /api/generate/status/:jobId`
Verifica status da geração.

**Response:**
```json
{
  "job": {
    "id": "uuid",
    "status": "processing",
    "progress": 75,
    "clipsCount": 50
  }
}
```

### `GET /api/generate/download/:seriesId`
Download da série completa em ZIP.

---

## ✅ Fluxo Completo Validado

### 1. Download de Vídeo
```
POST /api/video/youtube
  → Enfileira download (assíncrono)
  → Retorna videoId e downloadJobId
  → Worker processa download em background
```

### 2. Verificar Download
```
GET /api/video/download-status/:videoId
  → Verifica se download completou
  → Retorna status e localVideoUrl
```

### 3. Calcular Clips
```
POST /api/trim/calculate-clips
  → Calcula baseado em trimStart, trimEnd, clipDuration
  → Retorna clipsCount
```

### 4. Aplicar Trim (Opcional)
```
POST /api/trim/apply
  → Valida que vídeo está baixado
  → Aplica trim no arquivo local
  → Retorna trimmedPath
```

### 5. Gerar Série
```
POST /api/generate/series
  → Valida que vídeo está baixado
  → Enfileira processamento (assíncrono)
  → Aplica trim se necessário
  → Divide em clips sequenciais
  → Retorna jobId
```

### 6. Monitorar Progresso
```
GET /api/generate/status/:jobId
  → Retorna progresso em tempo real
  → Status: processing → completed
```

### 7. Download
```
GET /api/generate/download/:seriesId
  → Retorna ZIP com todos os clips
```

---

## 🔒 Validações Implementadas

- ✅ Download completo antes de trim
- ✅ Arquivo existe e tem tamanho > 0
- ✅ Tempos de trim válidos (endTime > startTime)
- ✅ Cálculo de clips baseado apenas no trim
- ✅ Suporta 60s e 120s
- ✅ Processamento assíncrono (não bloqueia API)
- ✅ Tratamento de erros robusto

---

## 📊 Exemplos de Uso

### Exemplo 1: Vídeo de 50 minutos, clips de 60s
```javascript
// Trim: 0s - 3000s
POST /api/trim/calculate-clips
{
  "startTime": 0,
  "endTime": 3000,
  "clipDuration": 60
}
// Response: { "clipsCount": 50 }
```

### Exemplo 2: Vídeo de 50 minutos, clips de 120s
```javascript
// Trim: 0s - 3000s
POST /api/trim/calculate-clips
{
  "startTime": 0,
  "endTime": 3000,
  "clipDuration": 120
}
// Response: { "clipsCount": 25 }
```

### Exemplo 3: Trim parcial, clips de 60s
```javascript
// Trim: 100s - 400s (5 minutos)
POST /api/trim/calculate-clips
{
  "startTime": 100,
  "endTime": 400,
  "clipDuration": 60
}
// Response: { "clipsCount": 5 }
```

---

**Status:** ✅ Todas as rotas implementadas e validadas!

