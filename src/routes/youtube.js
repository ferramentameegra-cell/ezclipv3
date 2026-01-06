/**
 * NOVA ROTA YOUTUBE - LIMPA
 * Não importa código legado
 */

import express from 'express';
import { getYouTubeInfo } from '../controllers/youtubeController.js';

const router = express.Router();

// GET /api/youtube/info?url=YOUTUBE_URL
// Retorna metadata do vídeo (título, duração, thumbnail)
router.get('/info', getYouTubeInfo);

export default router;
