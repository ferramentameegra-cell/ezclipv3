/**
 * NOVO BACKEND LIMPO - ENTRYPOINT PRINCIPAL
 * 
 * Este é o único arquivo executado quando a aplicação inicia.
 * NÃO importa código legado (workers/, queue/, controllers legados).
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import youtubeRoutes from './routes/youtube.js';

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
app.use('/api/youtube', youtubeRoutes);

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
    version: '2.0.0-clean'
  });
});

app.get('/', (req, res) => {
  res.json({
    status: 'EZ Clips AI - Stable Backend',
    version: '2.0.0-stable',
    endpoints: {
      health: 'GET /health',
      youtubeInfo: 'GET /api/youtube/info?url=YOUTUBE_URL',
      acknowledge: 'POST /api/youtube/acknowledge',
      download: 'POST /api/youtube/download',
      play: 'GET /api/youtube/play/:videoId',
      duration: 'GET /api/youtube/duration/:videoId'
    }
  });
});

// ============================================
// SERVER START
// ============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server started on port ${PORT}`);
  console.log(`📡 Health: http://0.0.0.0:${PORT}/health`);
  console.log(`📁 Static files: ${publicPath}`);
});

// Error handling global
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
