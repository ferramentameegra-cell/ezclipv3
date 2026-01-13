import express from "express";
import multer from "multer";
import path from "path";
import { downloadWithProgress, getVideoState } from "../controllers/downloadProgressController.js";
import { uploadVideo } from "../controllers/uploadController.js";

const router = express.Router();

// Configurar multer para uploads (armazenamento temporário)
const upload = multer({
  dest: '/tmp/uploads',
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB máximo
  },
  fileFilter: (req, file, cb) => {
    // Aceitar apenas vídeos
    const validMimeTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
    const validExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
    
    const ext = path.extname(file.originalname).toLowerCase();
    const isValid = validMimeTypes.includes(file.mimetype) || validExtensions.includes(ext);
    
    if (isValid) {
      cb(null, true);
    } else {
      cb(new Error('Formato de arquivo não suportado. Use MP4, WebM, MOV, AVI ou MKV.'), false);
    }
  }
});

// Rotas de download YouTube
router.get("/progress", downloadWithProgress);
router.get("/state/:videoId", getVideoState);

// Rota de upload de vídeo
router.post("/upload", upload.single('video'), uploadVideo);

export default router;
