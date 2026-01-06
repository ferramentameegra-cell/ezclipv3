/**
 * TRANSCRIPTION ROUTES
 * 
 * Rotas para transcrição de vídeos
 */

import express from 'express';
import { transcribeVideoEndpoint } from '../controllers/transcriptionController.js';

const router = express.Router();

// POST /api/transcription/:videoId - Transcrever vídeo
router.post('/:videoId', transcribeVideoEndpoint);

export default router;

