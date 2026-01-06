/**
 * AI ROUTES
 * 
 * Endpoints para processamento com IA:
 * - Transcrição (Whisper)
 * - Geração de clips com IA (GPT-4)
 */

import express from 'express';
import {
  transcribeVideoEndpoint,
  generateClipsWithAI,
  serveClip
} from '../controllers/aiProcessingController.js';

const router = express.Router();

// POST /api/ai/transcribe - Transcrever vídeo
router.post('/transcribe', transcribeVideoEndpoint);

// POST /api/ai/generate-clips - Gerar clips com IA
router.post('/generate-clips', generateClipsWithAI);

// GET /api/ai/clip/:seriesId/:index - Servir clip gerado
router.get('/clip/:seriesId/:index', serveClip);

export default router;

