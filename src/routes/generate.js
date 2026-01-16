import express from 'express';
import { generateSeries, getSeriesStatus, downloadSeries } from '../controllers/generateController.js';
import { progressSSE } from '../controllers/progressEvents.js';

const router = express.Router();

// Gerar série de vídeos
router.post('/series', generateSeries);

// Verificar status da geração
router.get('/status/:jobId', getSeriesStatus);

// SSE para progresso em tempo real
router.get('/progress/:jobId', progressSSE);

// Download da série
router.get('/download/:seriesId', downloadSeries);

export default router;


