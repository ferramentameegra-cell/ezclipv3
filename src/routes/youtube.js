/**
 * ROTAS YOUTUBE ESTÁVEIS
 * Usa yt-dlp CLI e fluxo síncrono
 */

import express from 'express';
import {
  getYouTubeInfo,
  acknowledgeConsent,
  downloadVideo,
  playVideo,
  getVideoDuration
} from '../controllers/youtubeStableController.js';

const router = express.Router();

// Rotas específicas (ordem importa - específicas primeiro)
router.get('/info', getYouTubeInfo);
router.post('/acknowledge', acknowledgeConsent);
router.post('/download', downloadVideo);
router.get('/play/:videoId', playVideo);
router.get('/duration/:videoId', getVideoDuration);

export default router;
