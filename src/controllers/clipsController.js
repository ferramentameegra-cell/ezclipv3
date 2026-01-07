import { splitVideoIntoClips } from '../services/videoTrimmer.js';
import { videoStore } from './downloadController.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * POST /api/generate-clips
 * Gerar clips do vídeo trimado
 */
export const generateClips = async (req, res) => {
  try {
    const { videoId, startTime, endTime, clipDuration } = req.body;

    if (!videoId || startTime === undefined || endTime === undefined || !clipDuration) {
      return res.status(400).json({ 
        success: false,
        error: 'Campos obrigatórios: videoId, startTime, endTime, clipDuration' 
      });
    }

    const video = videoStore.get(videoId);
    if (!video) {
      return res.status(404).json({ 
        success: false,
        error: 'Vídeo não encontrado' 
      });
    }

    // Usar vídeo trimado se disponível, senão usar original
    const sourceVideoPath = video.trimmedPath && fs.existsSync(video.trimmedPath) 
      ? video.trimmedPath 
      : video.path;

    if (!sourceVideoPath || !fs.existsSync(sourceVideoPath)) {
      return res.status(400).json({ 
        success: false,
        error: 'Vídeo não encontrado ou ainda não foi baixado' 
      });
    }

    // Validar tempos
    const start = Math.max(0, Math.floor(startTime));
    const end = Math.max(start + 1, Math.floor(endTime));
    const duration = parseInt(clipDuration);

    if (duration !== 60 && duration !== 120) {
      return res.status(400).json({ 
        success: false,
        error: 'Duração do clip deve ser 60 ou 120 segundos' 
      });
    }

    // Calcular quantidade de clips
    const trimmedDuration = end - start;
    const clipsCount = Math.floor(trimmedDuration / duration);

    if (clipsCount === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Duração do trim é menor que a duração do clip' 
      });
    }

    // Diretório para clips
    const clipsDir = path.join(__dirname, '../../uploads', 'clips', videoId);
    if (!fs.existsSync(clipsDir)) {
      fs.mkdirSync(clipsDir, { recursive: true });
    }

    console.log(`[GENERATE-CLIPS] Gerando ${clipsCount} clips de ${duration}s para vídeo ${videoId}`);

    // Gerar clips
    // Se usar vídeo trimado, startTime deve ser 0 (vídeo já está trimado)
    const actualStartTime = video.trimmedPath ? 0 : start;
    const actualEndTime = video.trimmedPath ? video.trimmedDuration : (end - start);

    const clipPaths = await splitVideoIntoClips(
      sourceVideoPath,
      clipsDir,
      duration,
      clipsCount,
      actualStartTime,
      actualEndTime
    );

    // Gerar URLs dos clips
    const clips = clipPaths.map((clipPath, index) => {
      const clipFileName = path.basename(clipPath);
      return {
        index: index + 1,
        filename: clipFileName,
        url: `/api/download-clip/${videoId}/${clipFileName}`,
        duration: duration
      };
    });

    // Armazenar informações dos clips
    video.clips = clips;
    video.clipsDir = clipsDir;
    videoStore.set(videoId, video);

    console.log(`[GENERATE-CLIPS] ${clipsCount} clips gerados com sucesso`);

    res.json({
      success: true,
      videoId,
      clipsCount: clips.length,
      clips: clips,
      message: `${clips.length} clips gerados com sucesso`
    });

  } catch (error) {
    console.error('[GENERATE-CLIPS] Erro:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

/**
 * GET /api/download-clip/:videoId/:filename
 * Download de clip individual
 */
export const downloadClip = (req, res) => {
  try {
    const { videoId, filename } = req.params;
    const video = videoStore.get(videoId);

    if (!video || !video.clipsDir) {
      return res.status(404).json({ error: 'Clips não encontrados' });
    }

    const clipPath = path.join(video.clipsDir, filename);

    if (!fs.existsSync(clipPath)) {
      return res.status(404).json({ error: 'Clip não encontrado' });
    }

    res.download(clipPath, filename, (err) => {
      if (err) {
        console.error('[DOWNLOAD-CLIP] Erro:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Erro ao baixar clip' });
        }
      }
    });
  } catch (error) {
    console.error('[DOWNLOAD-CLIP] Erro:', error);
    res.status(500).json({ error: error.message });
  }
};


