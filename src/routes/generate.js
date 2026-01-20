import express from 'express';
import { generateSeries, getSeriesStatus, downloadSeries } from '../controllers/generateController.js';
import { progressSSE } from '../controllers/progressEvents.js';
import { requireSupabaseAuth } from '../middleware/supabaseAuth.js';

const router = express.Router();

// Gerar série de vídeos - AUTENTICAÇÃO OBRIGATÓRIA (Supabase)
router.post('/series', requireSupabaseAuth, generateSeries);

// Verificar status da geração - AUTENTICAÇÃO OBRIGATÓRIA (Supabase)
router.get('/status/:jobId', requireSupabaseAuth, getSeriesStatus);

// SSE para progresso em tempo real - AUTENTICAÇÃO OBRIGATÓRIA (Supabase)
router.get('/progress/:jobId', requireSupabaseAuth, progressSSE);

// Download da série - AUTENTICAÇÃO OBRIGATÓRIA (Supabase)
router.get('/download/:seriesId', requireSupabaseAuth, downloadSeries);

export default router;


