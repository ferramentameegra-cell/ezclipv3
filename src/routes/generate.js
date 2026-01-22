import express from 'express';
import { generateSeries, getSeriesStatus, downloadSeries } from '../controllers/generateController.js';
import { progressSSE } from '../controllers/progressEvents.js';
import { optionalSupabaseAuth } from '../middleware/supabaseAuth.js';

const router = express.Router();

// Gerar série de vídeos - AUTENTICAÇÃO OPCIONAL (não bloqueia se não autenticado)
router.post('/series', optionalSupabaseAuth, generateSeries);

// Verificar status da geração - AUTENTICAÇÃO OPCIONAL
router.get('/status/:jobId', optionalSupabaseAuth, getSeriesStatus);

// SSE para progresso em tempo real - AUTENTICAÇÃO OPCIONAL
router.get('/progress/:jobId', optionalSupabaseAuth, progressSSE);

// Download da série - AUTENTICAÇÃO OPCIONAL
router.get('/download/:seriesId', optionalSupabaseAuth, downloadSeries);

export default router;


