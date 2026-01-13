# Sistema de Legendas Automáticas

## 📋 Visão Geral

Sistema completo de legendas automáticas com IA, editor visual e renderização profissional. Similar a ferramentas premium como CapCut e Subtitles AI.

## 🏗️ Arquitetura

### Backend

```
src/
├── services/
│   ├── captionService.js      # Geração de legendas com OpenAI Whisper
│   └── captionRenderer.js      # Renderização com FFmpeg
├── controllers/
│   └── captionController.js   # Endpoints da API
├── models/
│   └── captionPresets.js      # Presets de estilo
└── routes/
    └── captions.js             # Rotas da API
```

### Frontend

```
public/
├── captions-editor.js          # Editor visual (JavaScript vanilla)
└── captions-editor.css         # Estilos do editor
```

## 🚀 Funcionalidades

### 1. Geração Automática de Legendas (IA)

- **Transcrição**: Usa OpenAI Whisper para transcrever áudio
- **Timestamps**: Retorna timestamps por palavra/frase
- **Quebra Inteligente**: Máximo 2 linhas por bloco, quebra por sentido
- **Destaque Automático**: Detecta palavras-chave automaticamente

**Endpoint:**
```javascript
POST /api/captions/generate
Body: { videoId: "uuid" }
```

### 2. Editor Visual

- Preview em tempo real sobre o vídeo
- Timeline sincronizada
- Controles de estilo:
  - Fonte (Google Fonts + locais)
  - Tamanho, cor, contorno, sombra
  - Fundo da legenda (cor, opacidade, padding)
  - Posição (top/center/bottom)
  - Animações (fade, pop, slide)

**Uso:**
```html
<link rel="stylesheet" href="/captions-editor.css">
<script src="/captions-editor.js"></script>

<div id="editor-container"></div>

<script>
  const editor = new CaptionsEditor('editor-container', {
    videoId: 'video-uuid',
    apiBase: '/api'
  });
</script>
```

### 3. Headline com Tarja

- Texto customizável
- Tarja de fundo (cor, opacidade, altura)
- Posição (top/center/bottom)
- Animações de entrada/saída

### 4. Renderização Final

- Converte configurações em comandos FFmpeg
- Sincronização perfeita com timestamps
- Formato 1080x1920 (Reels/Shorts)
- Qualidade otimizada

**Endpoint:**
```javascript
POST /api/captions/render
Body: {
  videoId: "uuid",
  style: { ... },
  headline: { text: "...", ... }
}
```

## 📦 Instalação

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

```env
OPENAI_API_KEY=sk-...
```

### 3. Iniciar Servidor

```bash
npm start
```

## 🎨 Presets Disponíveis

### Legendas

- **classic**: Estilo tradicional com fundo preto
- **modern**: Minimalista sem fundo
- **bold**: Texto grande e destacado
- **minimal**: Discreto e elegante
- **neon**: Estilo neon com brilho

### Headlines

- **redBar**: Tarja vermelha no topo
- **gradient**: Tarja com gradiente
- **minimal**: Headline discreta

## 📡 API Endpoints

### Gerar Legendas

```javascript
POST /api/captions/generate
{
  "videoId": "uuid",
  "maxLinesPerBlock": 2,
  "maxCharsPerLine": 40,
  "highlightKeywords": true
}
```

### Atualizar Legendas

```javascript
POST /api/captions/update
{
  "videoId": "uuid",
  "captions": [
    {
      "start": 12.4,
      "end": 14.8,
      "text": "Transforme ideias em resultados",
      "highlight": ["ideias", "resultados"]
    }
  ]
}
```

### Obter Legendas

```javascript
GET /api/captions/:videoId
```

### Renderizar Vídeo

```javascript
POST /api/captions/render
{
  "videoId": "uuid",
  "style": {
    "font": "Arial",
    "fontSize": 64,
    "color": "#FFFFFF",
    "highlightColor": "#FFD700",
    "strokeColor": "#000000",
    "strokeWidth": 2,
    "shadow": true,
    "background": {
      "enabled": true,
      "color": "#000000",
      "opacity": 0.6,
      "padding": 10,
      "borderRadius": 8
    },
    "position": "bottom",
    "animation": "fade"
  },
  "headline": {
    "text": "Título do Vídeo",
    "startTime": 0,
    "endTime": 5
  }
}
```

### Download Vídeo Renderizado

```javascript
GET /api/captions/download/:videoId
```

### Listar Presets

```javascript
GET /api/captions/presets/list
```

## 💡 Exemplo de Uso Completo

```javascript
// 1. Gerar legendas
const generateResponse = await fetch('/api/captions/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ videoId: 'video-uuid' })
});

const { captions } = await generateResponse.json();

// 2. Editar no editor visual
const editor = new CaptionsEditor('editor-container', {
  videoId: 'video-uuid',
  apiBase: '/api'
});

// 3. Renderizar vídeo final
const renderResponse = await fetch('/api/captions/render', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    videoId: 'video-uuid',
    style: {
      font: 'Arial',
      fontSize: 64,
      color: '#FFFFFF',
      background: { enabled: true, color: '#000000', opacity: 0.6 }
    },
    headline: {
      text: 'Meu Vídeo',
      startTime: 0,
      endTime: 5
    }
  })
});

const { downloadUrl } = await renderResponse.json();
window.open(downloadUrl, '_blank');
```

## 🔧 Estrutura de Dados

### Caption Object

```javascript
{
  start: 12.4,           // Timestamp início (segundos)
  end: 14.8,            // Timestamp fim (segundos)
  text: "Texto completo",
  lines: ["Linha 1", "Linha 2"],  // Texto quebrado em linhas
  highlight: ["palavra1", "palavra2"],  // Palavras-chave
  duration: 2.4          // Duração do bloco
}
```

### Style Object

```javascript
{
  font: "Arial",
  fontSize: 64,
  color: "#FFFFFF",
  highlightColor: "#FFD700",
  strokeColor: "#000000",
  strokeWidth: 2,
  shadow: true,
  shadowBlur: 3,
  shadowOffsetX: 2,
  shadowOffsetY: 2,
  shadowColor: "#000000",
  background: {
    enabled: true,
    color: "#000000",
    opacity: 0.6,
    padding: 10,
    borderRadius: 8
  },
  position: "bottom",  // "top" | "center" | "bottom"
  animation: "fade"    // "fade" | "pop" | "slide"
}
```

## ⚡ Performance

- **Cache de legendas**: Evita re-geração desnecessária
- **Renderização assíncrona**: Não bloqueia o servidor
- **Preview otimizado**: Canvas com atualização frame a frame
- **FFmpeg otimizado**: Preset medium, CRF 23

## 🎯 Próximos Passos

- [ ] Suporte a múltiplas fontes do Google Fonts
- [ ] Exportação de presets customizados
- [ ] Animações mais avançadas (typewriter, bounce)
- [ ] Suporte a múltiplos idiomas
- [ ] Sincronização automática de legendas existentes
- [ ] Editor de timeline visual (drag & drop)

## 📝 Notas

- Requer FFmpeg instalado no servidor
- OpenAI API key obrigatória
- Vídeos devem estar no formato suportado (MP4 recomendado)
- Renderização pode levar tempo dependendo do tamanho do vídeo
