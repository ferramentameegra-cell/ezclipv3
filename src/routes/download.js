import express from 'express';
import { downloadYouTubeVideo } from '../controllers/downloadController.js';

const router = express.Router();

// Download de vídeo do YouTube
router.post('/', downloadYouTubeVideo);

export default router;

