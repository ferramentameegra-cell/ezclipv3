# INTEGRAÇÃO DE SERVIÇOS DE IA - DOCUMENTAÇÃO

## 📋 ARQUIVOS CRIADOS

### 1. `src/services/transcriptionService.js`
**Função:** Transcreve áudio de vídeo usando OpenAI Whisper API

**Funcionalidades:**
- Extrai áudio do vídeo usando FFmpeg
- Envia para Whisper API
- Retorna transcrição com timestamps por segmento

**Função principal:**
```javascript
transcribeVideo(videoPath, language = 'pt')
// Retorna: { text, segments: [{ start, end, text }] }
```

### 2. `src/services/clipDecisionService.js`
**Função:** Decide melhores momentos do vídeo usando GPT-4o

**Funcionalidades:**
- Analisa transcrição
- Seleciona momentos ideais baseado no nicho
- Gera headlines para cada clip
- Retorna ranges de tempo otimizados

**Função principal:**
```javascript
decideBestClips(segments, clipDuration, nicheId, numberOfClips, videoDuration)
// Retorna: [{ start, end, headline }]
```

### 3. `src/services/videoOverlayService.js`
**Função:** Adiciona overlay de vídeo de retenção aos clips

**Funcionalidades:**
- Redimensiona clips para formato 9:16
- Sobrepoõe vídeo de retenção na parte inferior
- Mantém proporções e qualidade

**Função principal:**
```javascript
addRetentionOverlaySimple(clipPath, retentionVideoPath, outputPath)
```

### 4. `src/controllers/aiProcessingController.js`
**Função:** Controller que integra todos os serviços de IA

**Endpoints implementados:**
- `POST /api/ai/transcribe` - Transcrever vídeo
- `POST /api/ai/generate-clips` - Gerar clips com IA
- `GET /api/ai/clip/:seriesId/:index` - Servir clip gerado

### 5. `src/routes/ai.js`
**Função:** Define rotas de IA

## 🔑 VARIÁVEIS DE AMBIENTE NECESSÁRIAS

```bash
# OpenAI API Key (obrigatória)
OPENAI_API_KEY=sk-...

# Não há outras variáveis necessárias
```

## 📡 ENDPOINTS DISPONÍVEIS

### 1. POST /api/ai/transcribe
**Request:**
```json
{
  "videoId": "uuid-do-video",
  "language": "pt" // opcional, padrão: "pt"
}
```

**Response:**
```json
{
  "success": true,
  "videoId": "uuid",
  "transcription": {
    "text": "Texto completo da transcrição...",
    "segments": [
      {
        "start": 0,
        "end": 5,
        "text": "Primeiro segmento..."
      }
    ]
  }
}
```

### 2. POST /api/ai/generate-clips
**Request:**
```json
{
  "videoId": "uuid-do-video",
  "nicheId": "podcast", // podcast, education, motivational, entertainment, news
  "clipDuration": 60, // 60 ou 120 segundos
  "numberOfClips": 5,
  "retentionVideoId": "uuid-opcional",
  "language": "pt" // opcional
}
```

**Response:**
```json
{
  "success": true,
  "seriesId": "uuid-da-serie",
  "clips": [
    {
      "index": 1,
      "start": 120,
      "end": 180,
      "duration": 60,
      "headline": "Título impactante do clip",
      "path": "/tmp/uploads/clips/.../clip_001.mp4",
      "url": "/api/ai/clip/seriesId/1"
    }
  ],
  "transcription": {
    "text": "Texto completo...",
    "segmentsCount": 45
  }
}
```

### 3. GET /api/ai/clip/:seriesId/:index
**Serve o arquivo de vídeo do clip gerado**

**Response:** Arquivo MP4 (streaming com range requests)

## 🔄 FLUXO COMPLETO

1. **Download do vídeo** (já existente)
   - Vídeo é baixado e salvo em `/tmp/uploads/{videoId}.mp4`
   - videoId é armazenado no videoStore

2. **Transcrição** (novo)
   - `POST /api/ai/transcribe`
   - Extrai áudio → Whisper API → Retorna segmentos com timestamps

3. **Decisão de clips** (novo)
   - `POST /api/ai/generate-clips`
   - Analisa transcrição → GPT-4o → Seleciona melhores momentos
   - Retorna ranges de tempo + headlines

4. **Corte de vídeo** (usando FFmpeg existente)
   - Para cada clip selecionado:
     - Corta vídeo usando `trimVideo()` de `videoTrimmer.js`
     - Salva em `/tmp/uploads/clips/{seriesId}/clip_XXX.mp4`

5. **Overlay opcional** (novo, opcional)
   - Se `retentionVideoId` for fornecido:
     - Adiciona vídeo de retenção na parte inferior
     - Formato 9:16 (vertical)

6. **Servir clips**
   - `GET /api/ai/clip/:seriesId/:index`
   - Retorna arquivo MP4 do clip

## 🎯 NICHOS SUPORTADOS

- `podcast` - Momentos de discussão, insights, opiniões
- `education` - Explicações, conceitos-chave, exemplos
- `motivational` - Mensagens inspiradoras, citações
- `entertainment` - Momentos engraçados, reações
- `news` - Informações importantes, atualizações

## ⚠️ TRATAMENTO DE ERROS

Todos os serviços de IA têm tratamento de erro robusto:

- **API Key inválida:** Erro 500 com mensagem clara
- **Rate limit:** Erro 429 com mensagem para aguardar
- **Falha na transcrição:** Erro 500 com detalhes
- **IA não selecionou clips:** Erro 400
- **Erro no corte:** Log do erro, continua com outros clips

**Regra:** Servidor nunca crasha devido a falhas de IA

## 📝 LOGS

Todos os serviços logam:
- Início de operações
- Progresso (quando aplicável)
- Conclusões bem-sucedidas
- Erros com detalhes (sem expor API keys)

## 🔒 SEGURANÇA

- ✅ API keys apenas em variáveis de ambiente
- ✅ Nenhuma key hardcoded
- ✅ Logs não expõem keys
- ✅ Validação de inputs
- ✅ Tratamento de erros sem vazar informações sensíveis

## 📦 DEPENDÊNCIAS ADICIONADAS

- `form-data` - Para upload de arquivos para Whisper API

## 🚀 PRÓXIMOS PASSOS SUGERIDOS

1. Testar integração com vídeo real
2. Implementar overlay de retenção completo (se necessário)
3. Adicionar cache de transcrições (evitar re-transcrever mesmo vídeo)
4. Adicionar progresso via SSE para geração de clips (opcional)

