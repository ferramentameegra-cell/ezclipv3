import express from 'express';
import { generateSeries, getSeriesStatus, downloadSeries } from '../controllers/generateController.js';
import { progressSSE } from '../controllers/progressEvents.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// Gerar série de vídeos - AUTENTICAÇÃO OBRIGATÓRIA
router.post('/series', requireAuth, generateSeries);

// Verificar status da geração - AUTENTICAÇÃO OBRIGATÓRIA
router.get('/status/:jobId', requireAuth, getSeriesStatus);

// SSE para progresso em tempo real - AUTENTICAÇÃO OBRIGATÓRIA
router.get('/progress/:jobId', requireAuth, progressSSE);

// Download da série - AUTENTICAÇÃO OBRIGATÓRIA
router.get('/download/:seriesId', requireAuth, downloadSeries);

export default router;


