import express from 'express';
import { generateSeries, getSeriesStatus, downloadSeries } from '../controllers/generateController.js';

const router = express.Router();

// Gerar série de vídeos
router.post('/series', generateSeries);

// Verificar status da geração
router.get('/status/:jobId', getSeriesStatus);

// Download da série
router.get('/download/:seriesId', downloadSeries);

export default router;

