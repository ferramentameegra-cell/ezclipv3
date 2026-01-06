/**
 * ENTRYPOINT PRINCIPAL - ESTÁVEL PARA PRODUÇÃO RAILWAY
 * 
 * Este é o único arquivo executado quando a aplicação inicia.
 * NÃO importa código legado (workers/, queue/, controllers legados).
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import youtubeRoutes from './routes/youtube.js';
import downloadRoutes from './routes/download.js';
import aiRoutes from './routes/ai.js';
import authRoutes from './routes/auth.js';
import nichesRoutes from './routes/niches.js';
import retentionRoutes from './routes/retention.js';
import trimRoutes from './routes/trim.js';
import generateRoutes from './routes/generate.js';
import transcriptionRoutes from './routes/transcription.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Railway: PORT é obrigatório, não usar fallback
if (!process.env.PORT) {
  console.error('ERROR: PORT environment variable is required');
  process.exit(1);
}
const PORT = parseInt(process.env.PORT, 10);

// ============================================
// MIDDLEWARES
// ============================================
app.use(cors());
app.use(express.json());

// ============================================
// ROTAS API
// ============================================
// YouTube e Download
app.use('/api/youtube', youtubeRoutes);
app.use('/api', downloadRoutes);

// IA (Transcrição e Geração de Clips)
app.use('/api/ai', aiRoutes);

// Autenticação
app.use('/api/auth', authRoutes);

// Nichos
app.use('/api/niches', nichesRoutes);

// Vídeos de Retenção
app.use('/api/retention', retentionRoutes);

// Trim
app.use('/api/trim', trimRoutes);

// Geração de Séries (Legado)
app.use('/api/generate', generateRoutes);

// Transcrição (AssemblyAI)
app.use('/api/transcription', transcriptionRoutes);

// ============================================
// FRONTEND ESTÁTICO
// ============================================
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0-stable'
  });
});

app.get('/', (req, res) => {
  res.json({
    status: 'EZ Clips AI - Stable Backend',
    version: '2.0.0-stable',
    endpoints: {
      health: 'GET /health',
      // YouTube e Download
      youtubeInfo: 'GET /api/youtube/info?url=YOUTUBE_URL',
      youtubeDownload: 'GET /api/youtube/download/progress?url=YOUTUBE_URL',
      youtubeState: 'GET /api/youtube/download/state/:videoId',
      youtubePlay: 'GET /api/youtube/play/:videoId',
      // IA
      aiTranscribe: 'POST /api/ai/transcribe',
      aiGenerateClips: 'POST /api/ai/generate-clips',
      aiClip: 'GET /api/ai/clip/:seriesId/:index',
      // Autenticação
      authRegister: 'POST /api/auth/register',
      authLogin: 'POST /api/auth/login',
      authMe: 'GET /api/auth/me',
      // Nichos
      niches: 'GET /api/niches',
      nicheDetails: 'GET /api/niches/:nicheId',
      // Retenção
      retention: 'GET /api/retention',
      retentionByNiche: 'GET /api/retention/niche/:nicheId',
      // Trim
      trim: 'POST /api/trim',
      trimCountClips: 'POST /api/trim/count-clips',
      // Transcrição
      transcription: 'POST /api/transcription/:videoId',
      // Geração (Legado)
      generateSeries: 'POST /api/generate/series',
      generateStatus: 'GET /api/generate/status/:jobId'
    }
  });
});

// ============================================
// VERIFICAR BINÁRIOS DO SISTEMA (STEP 1)
// ============================================
import { spawn } from 'child_process';

async function checkSystemBinaries() {
  console.log('[STARTUP] Verificando binários do sistema...');
  
  // Verificar yt-dlp
  const ytdlpAvailable = await new Promise((resolve) => {
    const proc = spawn('yt-dlp', ['--version'], { stdio: 'pipe' });
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
    setTimeout(() => {
      proc.kill();
      resolve(false);
    }, 3000);
  });
  
  if (!ytdlpAvailable) {
    console.error('[STARTUP] ⚠️  AVISO: yt-dlp não está disponível. Downloads falharão.');
  } else {
    console.log('[STARTUP] ✅ yt-dlp disponível');
  }
  
  // Verificar ffprobe
  const ffprobeAvailable = await new Promise((resolve) => {
    const proc = spawn('ffprobe', ['-version'], { stdio: 'pipe' });
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
    setTimeout(() => {
      proc.kill();
      resolve(false);
    }, 3000);
  });
  
  if (!ffprobeAvailable) {
    console.error('[STARTUP] ⚠️  AVISO: ffprobe não está disponível. Duração não será calculada.');
  } else {
    console.log('[STARTUP] ✅ ffprobe disponível');
  }
  
  return { ytdlpAvailable, ffprobeAvailable };
}

// ============================================
// SERVER START
// ============================================
checkSystemBinaries().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server started on port ${PORT}`);
    console.log(`📡 Health: http://0.0.0.0:${PORT}/health`);
    console.log(`📁 Static files: ${publicPath}`);
  });
});

// Error handling global
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
