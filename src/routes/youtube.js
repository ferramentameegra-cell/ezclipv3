import express from 'express';
import { getYouTubeInfo } from '../controllers/youtubeStableController.js';
import { playVideo } from '../controllers/youtubeStableController.js';

const router = express.Router();

// METADATA
router.get('/info', getYouTubeInfo);

// STREAM DO VÍDEO
router.get('/play/:videoId', playVideo);

export default router;
