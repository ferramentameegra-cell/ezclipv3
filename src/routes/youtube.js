import express from 'express';
import { getYouTubeInfo } from '../controllers/youtubeController.js';
import { downloadYouTubeVideo, playVideo } from '../controllers/DownloadController.js';

const router = express.Router();

// INFO DO VÍDEO
router.post('/info', getYouTubeInfo);

// DOWNLOAD DO VÍDEO
router.post('/download', downloadYouTubeVideo);

// STREAM DO VÍDEO
router.get('/play/:videoId', playVideo);

export default router;
