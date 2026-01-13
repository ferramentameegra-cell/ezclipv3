/**
 * CONTROLLER DE UPLOAD DE VÍDEO
 * Permite upload de vídeos próprios e integra com o mesmo sistema do YouTube
 */

import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { videoStore } from './downloadProgressController.js';
import { initVideoState, updateVideoState, VIDEO_STATES } from '../services/videoStateManager.js';
import { validateVideoWithFfprobe } from '../services/videoValidator.js';

const TMP_UPLOADS_DIR = '/tmp/uploads';

// Garantir diretório
if (!fs.existsSync(TMP_UPLOADS_DIR)) {
  fs.mkdirSync(TMP_UPLOADS_DIR, { recursive: true });
}

/**
 * Upload de vídeo do usuário
 */
export const uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const uploadedFile = req.file;
    const videoId = uuidv4();

    console.log(`[UPLOAD] Arquivo recebido: ${uploadedFile.originalname} (${(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)`);

    // Validar tipo de arquivo
    const validMimeTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
    const validExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
    
    const fileExtension = path.extname(uploadedFile.originalname).toLowerCase();
    const isValidType = validMimeTypes.includes(uploadedFile.mimetype) || validExtensions.includes(fileExtension);
    
    if (!isValidType) {
      // Limpar arquivo inválido
      if (fs.existsSync(uploadedFile.path)) {
        fs.unlinkSync(uploadedFile.path);
      }
      return res.status(400).json({ 
        error: 'Formato de arquivo não suportado. Use MP4, WebM, MOV, AVI ou MKV.' 
      });
    }

    // Mover arquivo para /tmp/uploads com nome UUID
    const finalPath = path.join(TMP_UPLOADS_DIR, `${videoId}.mp4`);
    
    // Se o arquivo já está no local correto, apenas renomear
    if (uploadedFile.path !== finalPath) {
      // Copiar para garantir que está no lugar certo
      fs.copyFileSync(uploadedFile.path, finalPath);
      // Remover arquivo temporário original
      if (fs.existsSync(uploadedFile.path)) {
        fs.unlinkSync(uploadedFile.path);
      }
    }

    // Validar arquivo com ffprobe para obter duração e metadados
    console.log(`[UPLOAD] Validando vídeo com ffprobe: ${finalPath}`);
    
    let videoMetadata;
    try {
      videoMetadata = await validateVideoWithFfprobe(finalPath);
    } catch (validationError) {
      // Limpar arquivo inválido
      if (fs.existsSync(finalPath)) {
        fs.unlinkSync(finalPath);
      }
      console.error(`[UPLOAD] Erro na validação: ${validationError.message}`);
      return res.status(400).json({ 
        error: `Vídeo inválido: ${validationError.message}` 
      });
    }

    const duration = videoMetadata.duration || 0;
    const fileSize = fs.statSync(finalPath).size;

    if (!duration || duration <= 0) {
      // Limpar arquivo sem duração válida
      if (fs.existsSync(finalPath)) {
        fs.unlinkSync(finalPath);
      }
      return res.status(400).json({ 
        error: 'Não foi possível determinar a duração do vídeo. Certifique-se de que o arquivo está completo e válido.' 
      });
    }

    // Criar estrutura de dados igual ao download do YouTube
    const videoData = {
      id: videoId,
      path: finalPath,
      duration: duration,
      fileSize: fileSize,
      originalName: uploadedFile.originalname,
      mimetype: uploadedFile.mimetype,
      uploadedAt: new Date(),
      youtubeUrl: null, // Não é do YouTube
      youtubeVideoId: null
    };

    // Salvar no videoStore (mesmo usado pelo downloadProgressController)
    videoStore.set(videoId, videoData);

    // Inicializar estado do vídeo (igual ao download)
    initVideoState(videoId);
    updateVideoState(videoId, {
      state: VIDEO_STATES.READY,
      progress: 100,
      metadata: videoData
    });

    console.log(`[UPLOAD] ✅ Vídeo enviado e validado: ${videoId} (${duration}s, ${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

    // Retornar no mesmo formato do download do YouTube para compatibilidade
    res.json({
      success: true,
      completed: true,
      ready: true,
      state: 'ready',
      videoId: videoId,
      duration: duration,
      videoDuration: duration,
      playableUrl: `/api/youtube/play/${videoId}`, // Usa mesma rota de playback
      fileSize: fileSize,
      originalName: uploadedFile.originalname,
      uploaded: true
    });

  } catch (error) {
    console.error('[UPLOAD] Erro ao processar upload:', error);
    
    // Limpar arquivo em caso de erro
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('[UPLOAD] Erro ao limpar arquivo:', unlinkError.message);
      }
    }
    
    res.status(500).json({ 
      error: `Erro ao processar upload: ${error.message}` 
    });
  }
};
