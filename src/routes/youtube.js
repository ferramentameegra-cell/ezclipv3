import express from 'express';
import {
  downloadYouTubeVideo,
  playVideo
} from '../controllers/downloadController.js';

const router = express.Router();

// POST /api/youtube/download
router.post('/download', downloadYouTubeVideo);

// GET /api/youtube/play/:videoId
router.get('/play/:videoId', playVideo);

// ⚠️ OBRIGATÓRIO
export default router;
