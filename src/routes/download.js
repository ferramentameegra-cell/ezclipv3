import express from 'express';
import { downloadYouTubeVideo } from '../controllers/downloadController.js';
import { downloadWithProgress } from '../controllers/downloadProgressController.js';

const router = express.Router();

// Download de vídeo do YouTube (método síncrono)
router.post('/', downloadYouTubeVideo);

// Download de vídeo com progresso em tempo real (SSE)
router.get('/progress', downloadWithProgress);

export default router;

