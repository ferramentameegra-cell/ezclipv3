/**
 * NOVO BACKEND LIMPO - ENTRYPOINT PRINCIPAL
 *
 * Este é o único arquivo executado quando a aplicação inicia.
 * NÃO importa código legado (workers/, queue/, controllers antigos).
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
// ROTAS API (ESPECÍFICAS PRIMEIRO)
// ============================================
app.use('/api/youtube', youtubeRoutes);

// Rota base da API (informativa)
app.get('/api', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0-clean',
    endpoints: {
      health: '/health',
      youtubeInfo: 'GET /api/youtube/info?url=YOUTUBE_URL'
    }
  });
});

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

// ============================================
// FRONTEND ESTÁTICO (SEMPRE POR ÚLTIMO)
// ============================================
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// fallback para SPA (se usar JS frontend)
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// ============================================
// SERVER START
// ============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Clean Backend rodando na porta ${PORT}`);
  console.log(`📡 Health check: /health`);
  console.log(`📁 Public files: ${publicPath}`);
});
