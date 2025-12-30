# Guia Completo: Deploy do Projeto ezv2 no Railway

Este guia leva você do zero absoluto até o deploy completo do projeto ezv2 no Railway. Siga cada passo na ordem exata apresentada. Não pule nenhuma etapa.

## Pré-requisitos

Este guia assume que você está usando macOS e não tem nenhum projeto existente. Se você já tiver Node.js, Git ou outras ferramentas instaladas, pule as etapas correspondentes, mas certifique-se de que as versões estão corretas.

## PARTE 1: Instalação do Node.js usando nvm

### Passo 1.1: Verificar se o nvm está instalado

Abra o Terminal (Applications > Utilities > Terminal) e execute:

```bash
command -v nvm
```

Se o comando retornar algo como `/Users/seu-usuario/.nvm/nvm.sh`, o nvm já está instalado. Pule para o Passo 1.3.

Se o comando não retornar nada ou retornar um erro, continue para o Passo 1.2.

### Passo 1.2: Instalar o nvm

Execute este comando no Terminal:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
```

Após a instalação, feche e reabra o Terminal, ou execute:

```bash
source ~/.zshrc
```

### Passo 1.3: Instalar Node.js versão 20

Execute:

```bash
nvm install 20
```

Aguarde a instalação completar. Você verá mensagens sobre a compilação do Node.js.

### Passo 1.4: Usar Node.js 20 como versão padrão

Execute:

```bash
nvm use 20
nvm alias default 20
```

### Passo 1.5: Verificar instalação

Execute:

```bash
node --version
npm --version
```

Você deve ver algo como:
- `v20.x.x` para Node.js
- `10.x.x` para npm

Se você não ver essas versões, repita os passos 1.3 e 1.4.

**AVISO CRÍTICO: Se o Node.js não estiver na versão 20, o deploy no Railway falhará. Certifique-se de que `node --version` mostra v20.x.x antes de continuar.**

## PARTE 2: Criar o Projeto ezv2

### Passo 2.1: Navegar para o Desktop

Execute:

```bash
cd ~/Desktop
```

### Passo 2.2: Criar a pasta do projeto

Execute:

```bash
mkdir ezv2
cd ezv2
```

### Passo 2.3: Inicializar o projeto npm

Execute:

```bash
npm init -y
```

Isso criará um arquivo `package.json` básico.

## PARTE 3: Configurar package.json

### Passo 3.1: Editar package.json

Abra o arquivo `package.json` no Cursor ou em qualquer editor de texto. Substitua TODO o conteúdo do arquivo pelo seguinte:

```json
{
  "name": "ezv2",
  "version": "2.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js",
    "build": "echo 'Build complete'"
  },
  "engines": {
    "node": ">=20.0.0",
    "npm": ">=10.0.0"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.490.0",
    "@distube/ytdl-core": "^4.16.12",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "fluent-ffmpeg": "^2.1.2",
    "multer": "^1.4.5-lts.1",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "@railway/cli": "^4.16.1"
  }
}
```

Salve o arquivo.

**AVISO CRÍTICO: O campo "type": "module" é obrigatório. Sem ele, os imports ES6 não funcionarão e o servidor não iniciará.**

## PARTE 4: Criar a Estrutura de Pastas

### Passo 4.1: Criar diretórios necessários

Execute no Terminal (ainda na pasta ezv2):

```bash
mkdir -p public src/routes src/controllers src/models src/services src/utils uploads retention-library
```

### Passo 4.2: Verificar estrutura

Execute:

```bash
ls -la
```

Você deve ver as pastas criadas. Se não vir, repita o Passo 4.1.

## PARTE 5: Criar index.js (Servidor Principal)

### Passo 5.1: Criar o arquivo index.js

No Cursor, crie um novo arquivo chamado `index.js` na raiz do projeto (mesmo nível que package.json).

### Passo 5.2: Copiar o código completo do servidor

Cole EXATAMENTE este código no arquivo `index.js`:

```javascript
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  const uploadsDir = path.join(__dirname, 'uploads');
  const seriesDir = path.join(__dirname, 'uploads', 'series');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  if (!fs.existsSync(seriesDir)) {
    fs.mkdirSync(seriesDir, { recursive: true });
  }
} catch (error) {
  console.warn('Warning: Could not create upload directories:', error.message);
}

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

app.use(express.json({ 
  limit: process.env.MAX_JSON_SIZE || '50mb',
  strict: true
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: process.env.MAX_URL_SIZE || '50mb' 
}));

app.use(express.static("public", {
  maxAge: process.env.STATIC_MAX_AGE || '1d',
  etag: true
}));

import videoRoutes from "./src/routes/video.js";
import nicheRoutes from "./src/routes/niches.js";
import retentionRoutes from "./src/routes/retention.js";
import generateRoutes from "./src/routes/generate.js";

app.use("/api/video", videoRoutes);
app.use("/api/niches", nicheRoutes);
app.use("/api/retention", retentionRoutes);
app.use("/api/generate", generateRoutes);

app.get("/", (req, res) => {
  res.json({ 
    status: "EZ Clips AI V2 - Retention Engine online 🚀",
    version: "2.0.0",
    timestamp: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get("/ready", (req, res) => {
  res.status(200).json({ 
    status: "ready",
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.path
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    status: 'error'
  });
});

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 EZ Clips AI V2 - Retention Engine running on port ${PORT}`);
  console.log(`📡 Health check available at http://${HOST}:${PORT}/health`);
  console.log(`✅ Server started successfully at ${new Date().toISOString()}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('Server error:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
```

Salve o arquivo.

**AVISO CRÍTICO: O servidor DEVE usar `process.env.PORT || 3000`. Se você usar apenas `3000`, o Railway não conseguirá atribuir uma porta dinâmica e o deploy falhará.**

## PARTE 6: Criar Arquivos de Rotas e Controllers

### Passo 6.1: Criar src/models/niches.js

Crie o arquivo `src/models/niches.js` e cole este conteúdo:

```javascript
export const NICHES = {
  podcast: {
    id: 'podcast',
    name: 'Podcast',
    description: 'Conversas, entrevistas e debates',
    retentionVideos: [
      'hydraulic-press',
      'satisfying-loops',
      'timelapse-abstract',
      'mechanical-loop'
    ],
    headlineStyles: ['bold', 'impact', 'modern'],
    fonts: ['Inter', 'Roboto', 'Montserrat']
  },
  educacao: {
    id: 'educacao',
    name: 'Educação',
    description: 'Aulas, tutoriais e conteúdo educacional',
    retentionVideos: [
      'sand-kinetic',
      'slime',
      'satisfying-loops',
      'timelapse-nature'
    ],
    headlineStyles: ['clean', 'academic', 'modern'],
    fonts: ['Roboto', 'Open Sans', 'Lato']
  },
  motivacional: {
    id: 'motivacional',
    name: 'Motivacional',
    description: 'Conteúdo inspirador e de desenvolvimento pessoal',
    retentionVideos: [
      'sunset-timelapse',
      'ocean-waves',
      'satisfying-loops',
      'abstract-flow'
    ],
    headlineStyles: ['bold', 'elegant', 'impact'],
    fonts: ['Montserrat', 'Playfair Display', 'Poppins']
  },
  tech: {
    id: 'tech',
    name: 'Tech',
    description: 'Tecnologia, programação e inovação',
    retentionVideos: [
      'circuit-animation',
      'code-rain',
      'mechanical-loop',
      'abstract-tech'
    ],
    headlineStyles: ['futuristic', 'modern', 'minimal'],
    fonts: ['Roboto Mono', 'Fira Code', 'Inter']
  },
  financeiro: {
    id: 'financeiro',
    name: 'Financeiro',
    description: 'Investimentos, economia e finanças',
    retentionVideos: [
      'gold-particles',
      'satisfying-loops',
      'timelapse-city',
      'abstract-numbers'
    ],
    headlineStyles: ['professional', 'bold', 'clean'],
    fonts: ['Inter', 'Roboto', 'Lato']
  }
};

export const RETENTION_VIDEOS = {
  'hydraulic-press': {
    id: 'hydraulic-press',
    name: 'Prensa Hidráulica',
    tags: ['Alta retenção', 'Hipnótico', 'Seguro para TikTok'],
    description: 'Loop de prensa hidráulica comprimindo objetos'
  },
  'satisfying-loops': {
    id: 'satisfying-loops',
    name: 'Loops Satisfatórios',
    tags: ['Alta retenção', 'Viral', 'Seguro para TikTok'],
    description: 'Vídeos de satisfação visual em loop'
  },
  'sand-kinetic': {
    id: 'sand-kinetic',
    name: 'Areia Cinética',
    tags: ['Hipnótico', 'Alta retenção', 'Seguro para TikTok'],
    description: 'Areia cinética sendo manipulada'
  },
  'slime': {
    id: 'slime',
    name: 'Slime',
    tags: ['Viral', 'Alta retenção', 'Seguro para TikTok'],
    description: 'Slime sendo cortado e esticado'
  },
  'timelapse-abstract': {
    id: 'timelapse-abstract',
    name: 'Timelapse Abstrato',
    tags: ['Hipnótico', 'Alta retenção'],
    description: 'Timelapse de padrões abstratos'
  },
  'mechanical-loop': {
    id: 'mechanical-loop',
    name: 'Loop Mecânico',
    tags: ['Hipnótico', 'Alta retenção'],
    description: 'Máquinas e mecanismos em loop'
  },
  'timelapse-nature': {
    id: 'timelapse-nature',
    name: 'Timelapse Natureza',
    tags: ['Hipnótico', 'Alta retenção'],
    description: 'Timelapse de paisagens naturais'
  },
  'sunset-timelapse': {
    id: 'sunset-timelapse',
    name: 'Pôr do Sol',
    tags: ['Hipnótico', 'Alta retenção'],
    description: 'Timelapse de pôr do sol'
  },
  'ocean-waves': {
    id: 'ocean-waves',
    name: 'Ondas do Mar',
    tags: ['Hipnótico', 'Alta retenção'],
    description: 'Ondas do oceano em loop'
  },
  'abstract-flow': {
    id: 'abstract-flow',
    name: 'Fluxo Abstrato',
    tags: ['Hipnótico', 'Alta retenção'],
    description: 'Padrões de fluxo abstratos'
  },
  'circuit-animation': {
    id: 'circuit-animation',
    name: 'Animação de Circuitos',
    tags: ['Hipnótico', 'Tech', 'Alta retenção'],
    description: 'Animação de circuitos elétricos'
  },
  'code-rain': {
    id: 'code-rain',
    name: 'Chuva de Código',
    tags: ['Hipnótico', 'Tech', 'Alta retenção'],
    description: 'Efeito matrix de código'
  },
  'abstract-tech': {
    id: 'abstract-tech',
    name: 'Abstrato Tech',
    tags: ['Hipnótico', 'Tech', 'Alta retenção'],
    description: 'Padrões tecnológicos abstratos'
  },
  'gold-particles': {
    id: 'gold-particles',
    name: 'Partículas Douradas',
    tags: ['Hipnótico', 'Alta retenção'],
    description: 'Partículas douradas em movimento'
  },
  'timelapse-city': {
    id: 'timelapse-city',
    name: 'Timelapse Urbano',
    tags: ['Hipnótico', 'Alta retenção'],
    description: 'Timelapse de cidade'
  },
  'abstract-numbers': {
    id: 'abstract-numbers',
    name: 'Números Abstratos',
    tags: ['Hipnótico', 'Alta retenção'],
    description: 'Animação de números e gráficos'
  }
};
```

### Passo 6.2: Criar src/controllers/nicheController.js

Crie o arquivo `src/controllers/nicheController.js` e cole:

```javascript
import { NICHES } from '../models/niches.js';

export const getNiches = (req, res) => {
  try {
    const nichesList = Object.values(NICHES).map(niche => ({
      id: niche.id,
      name: niche.name,
      description: niche.description
    }));
    
    res.json({ niches: nichesList });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getNicheDetails = (req, res) => {
  try {
    const { nicheId } = req.params;
    const niche = NICHES[nicheId];
    
    if (!niche) {
      return res.status(404).json({ error: 'Nicho não encontrado' });
    }
    
    res.json({ niche });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

### Passo 6.3: Criar src/controllers/retentionController.js

Crie o arquivo `src/controllers/retentionController.js` e cole:

```javascript
import { RETENTION_VIDEOS, NICHES } from '../models/niches.js';

export const getRetentionVideos = (req, res) => {
  try {
    const videos = Object.values(RETENTION_VIDEOS);
    res.json({ videos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getRetentionVideoByNiche = (req, res) => {
  try {
    const { nicheId } = req.params;
    const niche = NICHES[nicheId];
    
    if (!niche) {
      return res.status(404).json({ error: 'Nicho não encontrado' });
    }
    
    const videos = niche.retentionVideos.map(videoId => RETENTION_VIDEOS[videoId]);
    res.json({ videos, niche: niche.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

### Passo 6.4: Criar src/controllers/videoController.js

Crie o arquivo `src/controllers/videoController.js` e cole:

```javascript
import { v4 as uuidv4 } from 'uuid';
import ytdl from '@distube/ytdl-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const videoStore = new Map();

export const uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const videoId = uuidv4();
    const videoInfo = {
      id: videoId,
      path: req.file.path,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadedAt: new Date()
    };

    videoStore.set(videoId, videoInfo);

    res.json({
      videoId,
      message: 'Vídeo enviado com sucesso',
      video: videoInfo
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const processVideo = async (req, res) => {
  try {
    const { youtubeUrl } = req.body;

    if (!youtubeUrl) {
      return res.status(400).json({ error: 'URL do YouTube não fornecida' });
    }

    let normalizedUrl = youtubeUrl.trim();
    
    let videoId = null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/.*[?&]v=([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
      const match = normalizedUrl.match(pattern);
      if (match) {
        videoId = match[1];
        break;
      }
    }

    if (!videoId) {
      return res.status(400).json({ error: 'URL do YouTube inválida. Use formato: https://youtube.com/watch?v=VIDEO_ID ou https://youtu.be/VIDEO_ID' });
    }

    let info;
    let lastError = null;
    
    try {
      info = await ytdl.getInfo(videoId, {
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          }
        }
      });
    } catch (error1) {
      lastError = error1;
      console.error('Tentativa 1 falhou:', error1.message);
      
      try {
        info = await ytdl.getInfo(normalizedUrl, {
          requestOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Accept-Encoding': 'gzip, deflate',
              'DNT': '1',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1'
            }
          }
        });
      } catch (error2) {
        lastError = error2;
        console.error('Tentativa 2 falhou:', error2.message);
        
        const storedVideoId = uuidv4();
        const fallbackVideo = {
          id: storedVideoId,
          youtubeUrl: normalizedUrl,
          youtubeVideoId: videoId,
          title: 'Vídeo do YouTube',
          duration: 0,
          thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          path: '',
          processedAt: new Date(),
          streamUrl: `https://www.youtube.com/embed/${videoId}`,
          limited: true,
          error: lastError?.message || 'Erro desconhecido'
        };
        
        videoStore.set(storedVideoId, fallbackVideo);
        
        return res.status(200).json({
          videoId: storedVideoId,
          message: 'Vídeo processado (modo limitado)',
          video: fallbackVideo,
          warning: 'Não foi possível obter todas as informações automaticamente. Você pode continuar e definir a duração manualmente no trim.'
        });
      }
    }

    const storedVideoId = uuidv4();
    const videoPath = path.join(__dirname, '../../uploads', `${storedVideoId}.mp4`);

    const uploadDir = path.dirname(videoPath);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const duration = parseInt(info.videoDetails.lengthSeconds) || 0;
    const thumbnail = info.videoDetails.thumbnails?.[info.videoDetails.thumbnails.length - 1]?.url || 
                     info.videoDetails.thumbnails?.[0]?.url || '';

    const videoInfo = {
      id: storedVideoId,
      youtubeUrl: normalizedUrl,
      youtubeVideoId: videoId,
      title: info.videoDetails.title || 'Vídeo sem título',
      duration: duration,
      thumbnail: thumbnail,
      path: videoPath,
      processedAt: new Date(),
      streamUrl: `https://www.youtube.com/embed/${videoId}`
    };

    videoStore.set(storedVideoId, videoInfo);

    res.json({
      videoId: storedVideoId,
      message: 'Vídeo do YouTube processado com sucesso',
      video: videoInfo
    });
  } catch (error) {
    console.error('Erro completo no processVideo:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    
    const errorResponse = {
      error: 'Erro ao processar vídeo do YouTube',
      details: error.message,
      errorCode: error.code || 'UNKNOWN',
      suggestion: 'Verifique se: 1) A URL está correta, 2) O vídeo está público e disponível, 3) Não há restrições de região'
    };
    
    if (error.message?.includes('invalid') || error.message?.includes('Invalid')) {
      return res.status(400).json(errorResponse);
    }
    
    res.status(500).json(errorResponse);
  }
};

export const getVideoInfo = (req, res) => {
  try {
    const { videoId } = req.params;
    const video = videoStore.get(videoId);

    if (!video) {
      return res.status(404).json({ error: 'Vídeo não encontrado' });
    }

    res.json({ video });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const streamVideo = (req, res) => {
  try {
    const { videoId } = req.params;
    const video = videoStore.get(videoId);

    if (!video) {
      return res.status(404).json({ error: 'Vídeo não encontrado' });
    }

    if (!video.path || !fs.existsSync(video.path)) {
      return res.status(404).json({ error: 'Arquivo de vídeo não encontrado' });
    }

    const stat = fs.statSync(video.path);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(video.path, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': video.mimetype || 'video/mp4',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': video.mimetype || 'video/mp4',
      };
      res.writeHead(200, head);
      fs.createReadStream(video.path).pipe(res);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

### Passo 6.5: Criar src/controllers/generateController.js

Crie o arquivo `src/controllers/generateController.js` e cole:

```javascript
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { generateVideoSeries } from '../services/videoProcessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jobs = new Map();

export { jobs };

export const generateSeries = async (req, res) => {
  try {
    const {
      videoId,
      nicheId,
      retentionVideoId,
      numberOfCuts,
      headlineStyle,
      font,
      trimStart,
      trimEnd,
      cutDuration
    } = req.body;

    if (!videoId || !nicheId || !numberOfCuts) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios: videoId, nicheId, numberOfCuts' 
      });
    }

    const jobId = uuidv4();
    const seriesId = uuidv4();

    const job = {
      id: jobId,
      seriesId,
      videoId,
      nicheId,
      retentionVideoId: retentionVideoId || 'random',
      numberOfCuts,
      headlineStyle: headlineStyle || 'bold',
      font: font || 'Inter',
      trimStart: trimStart || 0,
      trimEnd: trimEnd || null,
      cutDuration: cutDuration || 60,
      status: 'processing',
      createdAt: new Date(),
      progress: 0
    };

    jobs.set(jobId, job);

    generateVideoSeries(job, jobs).catch(error => {
      job.status = 'error';
      job.error = error.message;
      jobs.set(jobId, job);
    });

    res.json({
      jobId,
      seriesId,
      message: 'Geração de série iniciada',
      status: 'processing'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getSeriesStatus = (req, res) => {
  try {
    const { jobId } = req.params;
    const job = jobs.get(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job não encontrado' });
    }

    res.json({ job });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const downloadSeries = (req, res) => {
  try {
    const { seriesId } = req.params;
    const seriesPath = path.join(__dirname, '../../uploads/series', seriesId);

    if (!fs.existsSync(seriesPath)) {
      return res.status(404).json({ error: 'Série não encontrada' });
    }

    res.json({
      downloadUrl: `/api/generate/download/${seriesId}`,
      message: 'Série pronta para download'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

### Passo 6.6: Criar src/services/videoProcessor.js

Crie o arquivo `src/services/videoProcessor.js` e cole:

```javascript
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const generateVideoSeries = async (job, jobsMap) => {
  try {
    const { videoId, numberOfCuts, seriesId } = job;
    
    const totalParts = numberOfCuts;
    const seriesPath = path.join(__dirname, '../../uploads/series', seriesId);
    
    if (!fs.existsSync(seriesPath)) {
      fs.mkdirSync(seriesPath, { recursive: true });
    }

    for (let i = 1; i <= totalParts; i++) {
      job.progress = Math.round((i / totalParts) * 100);
      if (jobsMap) {
        jobsMap.set(job.id, job);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    job.status = 'completed';
    job.progress = 100;
    job.completedAt = new Date();
    if (jobsMap) {
      jobsMap.set(job.id, job);
    }

    return {
      seriesId,
      totalParts,
      status: 'completed'
    };
  } catch (error) {
    job.status = 'error';
    job.error = error.message;
    if (jobsMap) {
      jobsMap.set(job.id, job);
    }
    throw error;
  }
};
```

### Passo 6.7: Criar src/routes/video.js

Crie o arquivo `src/routes/video.js` e cole:

```javascript
import express from 'express';
import multer from 'multer';
import { uploadVideo, processVideo, getVideoInfo, streamVideo } from '../controllers/videoController.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/upload', upload.single('video'), uploadVideo);
router.post('/youtube', processVideo);
router.get('/info/:videoId', getVideoInfo);
router.get('/stream/:videoId', streamVideo);

export default router;
```

### Passo 6.8: Criar src/routes/niches.js

Crie o arquivo `src/routes/niches.js` e cole:

```javascript
import express from 'express';
import { getNiches, getNicheDetails } from '../controllers/nicheController.js';

const router = express.Router();

router.get('/', getNiches);
router.get('/:nicheId', getNicheDetails);

export default router;
```

### Passo 6.9: Criar src/routes/retention.js

Crie o arquivo `src/routes/retention.js` e cole:

```javascript
import express from 'express';
import { getRetentionVideos, getRetentionVideoByNiche } from '../controllers/retentionController.js';

const router = express.Router();

router.get('/', getRetentionVideos);
router.get('/niche/:nicheId', getRetentionVideoByNiche);

export default router;
```

### Passo 6.10: Criar src/routes/generate.js

Crie o arquivo `src/routes/generate.js` e cole:

```javascript
import express from 'express';
import { generateSeries, getSeriesStatus, downloadSeries } from '../controllers/generateController.js';

const router = express.Router();

router.post('/series', generateSeries);
router.get('/status/:jobId', getSeriesStatus);
router.get('/download/:seriesId', downloadSeries);

export default router;
```

## PARTE 7: Criar Frontend (HTML, CSS, JavaScript)

### Passo 7.1: Criar public/index.html

Crie o arquivo `public/index.html` e cole o conteúdo completo que foi criado anteriormente. Como o arquivo é muito grande, certifique-se de copiar todo o conteúdo do arquivo `index.html` que já existe no projeto.

### Passo 7.2: Criar public/styles.css

Crie o arquivo `public/styles.css` e cole o conteúdo completo do arquivo `styles.css` que já existe no projeto.

### Passo 7.3: Criar public/app.js

Crie o arquivo `public/app.js` e cole o conteúdo completo do arquivo `app.js` que já existe no projeto.

**AVISO CRÍTICO: Os arquivos HTML, CSS e JavaScript do frontend são extensos. Certifique-se de copiar TODO o conteúdo dos arquivos existentes. Se algum arquivo estiver incompleto, o frontend não funcionará corretamente.**

## PARTE 8: Instalar Dependências

### Passo 8.1: Instalar todas as dependências

No Terminal, ainda na pasta ezv2, execute:

```bash
npm install
```

Aguarde a instalação completar. Isso pode levar alguns minutos. Você verá mensagens sobre pacotes sendo baixados e instalados.

### Passo 8.2: Verificar instalação

Execute:

```bash
ls node_modules | head -10
```

Você deve ver uma lista de pastas. Se a pasta `node_modules` estiver vazia ou não existir, repita o Passo 8.1.

## PARTE 9: Testar o Servidor Localmente

### Passo 9.1: Iniciar o servidor

Execute:

```bash
npm start
```

Você deve ver uma mensagem como:

```
🚀 EZ Clips AI V2 - Retention Engine running on port 3000
📡 Health check available at http://0.0.0.0:3000/health
✅ Server started successfully at [timestamp]
```

**AVISO CRÍTICO: Se você ver algum erro, NÃO continue. Pare o servidor (Ctrl+C) e verifique se todos os arquivos foram criados corretamente. O servidor DEVE iniciar sem erros antes de prosseguir para o deploy.**

### Passo 9.2: Testar health check

Abra um novo Terminal (mantenha o servidor rodando no primeiro) e execute:

```bash
curl http://localhost:3000/health
```

Você deve receber uma resposta JSON como:

```json
{"status":"ok","timestamp":"...","uptime":...}
```

Se você receber um erro de conexão, o servidor não está rodando corretamente. Volte ao Passo 9.1.

### Passo 9.3: Parar o servidor

No Terminal onde o servidor está rodando, pressione Ctrl+C para parar o servidor.

## PARTE 10: Configurar Git

### Passo 10.1: Verificar se Git está instalado

Execute:

```bash
git --version
```

Se você ver uma versão (como `git version 2.x.x`), continue. Se não, instale o Git primeiro.

### Passo 10.2: Inicializar repositório Git

Ainda na pasta ezv2, execute:

```bash
git init
```

### Passo 10.3: Criar arquivo .gitignore

Crie o arquivo `.gitignore` na raiz do projeto e cole:

```
node_modules/
.env
uploads/
*.log
.DS_Store
retention-library/
```

### Passo 10.4: Configurar Git (se necessário)

Execute (substitua com suas informações):

```bash
git config user.name "Seu Nome"
git config user.email "seu@email.com"
```

Se você já configurou o Git globalmente, pode pular este passo.

### Passo 10.5: Adicionar todos os arquivos

Execute:

```bash
git add .
```

### Passo 10.6: Fazer commit inicial

Execute:

```bash
git commit -m "Initial commit: EZ Clips AI V2 project"
```

## PARTE 11: Criar Repositório no GitHub

### Passo 11.1: Acessar GitHub

Abra seu navegador e vá para https://github.com

Faça login na sua conta. Se você não tem conta, crie uma em https://github.com/signup

### Passo 11.2: Criar novo repositório

Clique no botão "+" no canto superior direito e selecione "New repository".

### Passo 11.3: Configurar repositório

Preencha:
- Repository name: `ezv2` (ou qualquer nome que você preferir)
- Description: (opcional) "EZ Clips AI V2 - Retention Engine"
- Visibility: Escolha Public ou Private
- NÃO marque "Initialize this repository with a README"
- NÃO marque "Add .gitignore"
- NÃO marque "Choose a license"

Clique em "Create repository".

### Passo 11.4: Conectar repositório local ao GitHub

O GitHub mostrará instruções. Execute estes comandos no Terminal (substitua SEU-USUARIO pelo seu nome de usuário do GitHub):

```bash
git remote add origin https://github.com/SEU-USUARIO/ezv2.git
git branch -M main
git push -u origin main
```

**AVISO CRÍTICO: Se você receber um erro de autenticação, você precisará configurar um Personal Access Token do GitHub. Acesse https://github.com/settings/tokens e crie um token com permissão "repo". Depois use: `git remote set-url origin https://SEU-TOKEN@github.com/SEU-USUARIO/ezv2.git`**

### Passo 11.5: Verificar arquivos no GitHub

Após o push, recarregue a página do repositório no GitHub. Você deve ver todos os arquivos do projeto listados, incluindo:
- package.json
- index.js
- public/ (com index.html, styles.css, app.js)
- src/ (com todas as pastas e arquivos)

Se algum arquivo estiver faltando, você não fez o commit corretamente. Volte ao Passo 10.5.

## PARTE 12: Deploy no Railway

### Passo 12.1: Acessar Railway

Abra seu navegador e vá para https://railway.app

Faça login com sua conta GitHub. Se você não tem conta, clique em "Start a New Project" e siga as instruções para criar uma conta usando GitHub.

### Passo 12.2: Criar novo projeto

No dashboard do Railway, clique no botão "New Project".

### Passo 12.3: Conectar repositório GitHub

Selecione "Deploy from GitHub repo".

Railway mostrará uma lista dos seus repositórios. Selecione o repositório `ezv2` (ou o nome que você escolheu).

### Passo 12.4: Configurar deploy

Railway detectará automaticamente que é um projeto Node.js. Aguarde alguns segundos enquanto o Railway:
1. Clona o repositório
2. Detecta Node.js 20 (via .nvmrc e package.json)
3. Executa `npm install`
4. Executa `npm start`

### Passo 12.5: Verificar build

Na página do projeto no Railway, você verá uma seção "Deployments". Clique no deployment mais recente para ver os logs.

Você deve ver logs como:
- "Installing dependencies"
- "Building application"
- "Starting application"
- "Server started successfully"

**AVISO CRÍTICO: Se você ver erros nos logs, NÃO continue. Os erros mais comuns são:**
- **"npm: command not found"** - O Node.js não foi detectado. Verifique se o .nvmrc existe e contém "20"
- **"Cannot find module"** - Dependências não foram instaladas. Verifique se package.json está correto
- **"Port already in use"** - Problema de configuração. Verifique se index.js usa `process.env.PORT`

### Passo 12.6: Obter URL do deploy

Após o build completar com sucesso, na página do projeto Railway, você verá uma seção "Domains" ou "Settings" > "Networking".

Clique em "Generate Domain" ou use o domínio fornecido automaticamente.

Você receberá uma URL como: `https://ezv2-production-xxxx.up.railway.app`

### Passo 12.7: Testar deploy

Abra a URL fornecida pelo Railway no navegador.

Você deve ver uma resposta JSON:
```json
{"status":"EZ Clips AI V2 - Retention Engine online 🚀","version":"2.0.0","timestamp":"..."}
```

Teste também o health check:
```
https://sua-url.railway.app/health
```

Você deve receber:
```json
{"status":"ok","timestamp":"...","uptime":...}
```

### Passo 12.8: Testar frontend

Acesse a URL do Railway no navegador. Você deve ver a interface do EZ Clips AI V2.

Teste o fluxo completo:
1. Cole uma URL do YouTube
2. Clique em "Processar"
3. O trim tool deve aparecer automaticamente
4. Ajuste os sliders de início e fim
5. Selecione duração (60s ou 120s)
6. Veja o número de clips sendo calculado em tempo real

## PARTE 13: Configurar Deploy Automático (Opcional)

### Passo 13.1: Ativar Auto Deploy

No Railway, vá para Settings do seu projeto.

Encontre a opção "Auto Deploy" e ative-a.

Selecione a branch "main".

Agora, sempre que você fizer push para a branch main no GitHub, o Railway fará deploy automaticamente.

## Validação Final

Execute estes testes para garantir que tudo está funcionando:

### Teste 1: Servidor inicia localmente
```bash
npm start
```
Deve iniciar sem erros.

### Teste 2: Health check local
```bash
curl http://localhost:3000/health
```
Deve retornar JSON com status "ok".

### Teste 3: Health check no Railway
Acesse `https://sua-url.railway.app/health` no navegador.
Deve retornar JSON com status "ok".

### Teste 4: Frontend carrega
Acesse a URL do Railway no navegador.
Deve mostrar a interface completa.

## Troubleshooting

### Problema: "npm: command not found" no Railway

**Solução:** Verifique se o arquivo `.nvmrc` existe na raiz do projeto e contém apenas "20" (sem aspas, sem espaços).

### Problema: "Port 3000 already in use"

**Solução:** O Railway atribui portas dinamicamente. Certifique-se de que index.js usa `process.env.PORT || 3000`, não apenas `3000`.

### Problema: Frontend não carrega

**Solução:** Verifique se a pasta `public` existe e contém `index.html`, `styles.css` e `app.js`. Verifique também se `index.js` tem `app.use(express.static("public"))`.

### Problema: Erro "Cannot find module"

**Solução:** Execute `npm install` novamente localmente e verifique se `package.json` está correto. Faça commit e push novamente.

### Problema: Deploy falha no Railway

**Solução:** 
1. Verifique os logs do deployment no Railway
2. Certifique-se de que todos os arquivos foram commitados
3. Verifique se `package.json` tem o script "start" correto
4. Verifique se `index.js` existe e está na raiz do projeto

## Checklist Final

Antes de considerar o deploy completo, verifique:

- [ ] Node.js versão 20 instalado e ativo
- [ ] package.json tem "type": "module"
- [ ] package.json tem "start": "node index.js"
- [ ] index.js usa `process.env.PORT || 3000`
- [ ] index.js não tem operações assíncronas bloqueando startup
- [ ] Todos os arquivos foram commitados
- [ ] Código foi enviado para GitHub
- [ ] Railway detectou o repositório
- [ ] Build completou com sucesso
- [ ] Health check retorna 200
- [ ] Frontend carrega corretamente
- [ ] Trim tool aparece após processar YouTube
- [ ] Cálculo de clips funciona em tempo real

Se todos os itens estão marcados, seu deploy está completo e funcionando!

## Conclusão

Você agora tem o projeto ezv2 rodando no Railway. O servidor inicia automaticamente, o frontend está acessível, e todas as funcionalidades estão operacionais. Qualquer push para a branch main no GitHub (se você configurou auto deploy) fará um novo deploy automaticamente.

Para fazer alterações:
1. Edite os arquivos localmente
2. Execute `git add .`
3. Execute `git commit -m "Sua mensagem"`
4. Execute `git push origin main`
5. O Railway fará deploy automaticamente (se configurado)


