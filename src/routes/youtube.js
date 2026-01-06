import express from 'express';
import { getYouTubeInfo } from '../controllers/youtubeController.js';
import { downloadWithProgress, getVideoState } from '../controllers/downloadProgressController.js';
import { playVideo } from '../controllers/downloadController.js';

const router = express.Router();

// METADATA
router.get('/info', getYouTubeInfo);

// DOWNLOAD COM PROGRESSO (USADO PELO FRONTEND)
router.get('/download/progress', downloadWithProgress);

// ESTADO DO VÍDEO (DURAÇÃO PARA O TRIM)
router.get('/download/state/:videoId', getVideoState);

// STREAM DO VÍDEO
router.get('/play/:videoId', playVideo);

export default router;
