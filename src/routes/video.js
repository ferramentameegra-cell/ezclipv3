import express from 'express';
import multer from 'multer';
import { uploadVideo, processVideo, getVideoInfo, streamVideo, playVideo } from '../controllers/videoController.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Upload de vídeo
router.post('/upload', upload.single('video'), uploadVideo);

// Processar vídeo do YouTube
router.post('/youtube', processVideo);

// Obter informações do vídeo
router.get('/info/:videoId', getVideoInfo);

// Stream de vídeo (para preview local)
router.get('/stream/:videoId', streamVideo);

// Servir vídeo baixado localmente (para player HTML5)
router.get('/play/:videoId', playVideo);

export default router;

