import express from 'express';
import { 
  downloadYouTubeVideoEndpoint, 
  getVideoInfo, 
  playVideo 
} from '../controllers/youtubeController.js';
import { 
  applyTrim, 
  calculateClipsCount, 
  playTrimmedVideo 
} from '../controllers/trimController.js';
import { getYouTubeInfo } from '../controllers/youtubeInfoController.js';

const router = express.Router();

// Obter informações do vídeo (thumbnail, título, duração) antes do download
router.get('/info', getYouTubeInfo);

// Download de vídeo do YouTube
router.post('/download', downloadYouTubeVideoEndpoint);

// Obter informações do vídeo
router.get('/info/:videoId', getVideoInfo);

// Servir vídeo baixado (player HTML5)
router.get('/play/:videoId', playVideo);

// Aplicar trim
router.post('/trim', applyTrim);

// Calcular quantidade de clips
router.post('/calculate-clips', calculateClipsCount);

// Servir vídeo trimado
router.get('/play-trimmed/:videoId', playTrimmedVideo);

export default router;

