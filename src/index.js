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
const PORT = process.env.PORT || 3000;

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
    status: 'EZ Clips AI - Clean Backend',
    version: '2.0.0-clean',
    endpoints: {
      health: '/health',
      youtubeInfo: 'GET /api/youtube/info?url=YOUTUBE_URL'
    }
  });
});

// ============================================
// SERVER START
// ============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Clean Backend rodando na porta ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`📁 Public files: ${publicPath}`);
});
