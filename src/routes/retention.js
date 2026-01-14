import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
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

// Upload customizado de retenção (não precisa estar no modelo)
// POST /api/retention/upload-custom
// Body: form-data com campo 'file' (arquivo) e 'videoId' (ID do vídeo original)
const uploadCustom = multer({
  dest: '/tmp/uploads/retention-custom',
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB máximo
  },
  fileFilter: (req, file, cb) => {
    const validMimeTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp'];
    const validExtensions = ['.mp4', '.webm', '.mov', '.jpg', '.jpeg', '.png', '.webp'];
    
    const ext = path.extname(file.originalname).toLowerCase();
    const isValid = validMimeTypes.includes(file.mimetype) || validExtensions.includes(ext);
    
    if (isValid) {
      cb(null, true);
    } else {
      cb(new Error('Formato não suportado. Use MP4, WebM, MOV, JPG, PNG ou WEBP.'), false);
    }
  }
});

router.post('/upload-custom', uploadCustom.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'Nenhum arquivo enviado' 
      });
    }

    const { videoId } = req.body;
    if (!videoId) {
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ 
        success: false,
        error: 'videoId é obrigatório' 
      });
    }

    // Mover arquivo para local permanente
    const customDir = '/tmp/uploads/retention-custom';
    if (!fs.existsSync(customDir)) {
      fs.mkdirSync(customDir, { recursive: true });
    }
    
    const finalPath = path.join(customDir, `${videoId}_retention_${Date.now()}${path.extname(req.file.originalname)}`);
    fs.renameSync(req.file.path, finalPath);

    res.json({
      success: true,
      retentionPath: finalPath,
      message: 'Arquivo de retenção customizado salvo com sucesso'
    });
  } catch (error) {
    console.error('[RETENTION-UPLOAD-CUSTOM] Erro:', error);
    
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('[RETENTION-UPLOAD-CUSTOM] Erro ao limpar arquivo:', unlinkError);
      }
    }
    
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

export default router;


