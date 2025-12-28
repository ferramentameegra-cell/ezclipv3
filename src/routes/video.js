import express from 'express';
import multer from 'multer';
import { uploadVideo, processVideo, getVideoInfo } from '../controllers/videoController.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Upload de vídeo
router.post('/upload', upload.single('video'), uploadVideo);

// Processar vídeo do YouTube
router.post('/youtube', processVideo);

// Obter informações do vídeo
router.get('/info/:videoId', getVideoInfo);

export default router;

