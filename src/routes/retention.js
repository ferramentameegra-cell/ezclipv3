import express from 'express';
import multer from 'multer';
import path from 'path';
import { getRetentionVideos, getRetentionVideoByNiche, getRetentionVideoFile, uploadRetentionVideo } from '../controllers/retentionController.js';

const router = express.Router();

// Configurar multer para uploads de vídeos de retenção
const upload = multer({
  dest: '/tmp/uploads/retention',
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB máximo (vídeos de retenção são menores)
  },
  fileFilter: (req, file, cb) => {
    const validMimeTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    const validExtensions = ['.mp4', '.webm', '.mov'];
    
    const ext = path.extname(file.originalname).toLowerCase();
    const isValid = validMimeTypes.includes(file.mimetype) || validExtensions.includes(ext);
    
    if (isValid) {
      cb(null, true);
    } else {
      cb(new Error('Formato não suportado. Use MP4, WebM ou MOV.'), false);
    }
  }
});

// Listar todos os vídeos de retenção (com status de disponibilidade)
router.get('/', getRetentionVideos);

// Obter informações de um vídeo de retenção específico (ANTES de /niche para evitar conflito)
router.get('/video/:retentionVideoId', getRetentionVideoFile);

// Obter vídeos de retenção por nicho
router.get('/niche/:nicheId', getRetentionVideoByNiche);

// Upload de novo vídeo de retenção
// POST /api/retention/upload
// Body: form-data com campo 'video' (arquivo) e 'retentionVideoId' (ID do vídeo)
router.post('/upload', upload.single('video'), uploadRetentionVideo);

export default router;


