import { trimVideo as trimVideoService } from '../services/videoTrimmer.js';
import { videoStore } from './videoController.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Aplica trim no vídeo local baixado
 * GARANTE que o vídeo está baixado antes de aplicar trim
 */
export const trimVideo = async (req, res) => {
  try {
    const { videoId, startTime, endTime } = req.body;

    if (!videoId || startTime === undefined || endTime === undefined) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios: videoId, startTime, endTime' 
      });
    }

    const video = videoStore.get(videoId);
    if (!video) {
      return res.status(404).json({ error: 'Vídeo não encontrado' });
    }

    // VALIDAR: Vídeo deve estar baixado antes de trim
    if (!video.path || !fs.existsSync(video.path)) {
      return res.status(400).json({ 
        error: 'Vídeo ainda não foi baixado. Aguarde o download completar.',
        downloadStatus: 'pending',
        downloadJobId: video.downloadJobId
      });
    }

    const stats = fs.statSync(video.path);
    if (stats.size === 0) {
      return res.status(400).json({ 
        error: 'Arquivo de vídeo está vazio ou corrompido' 
      });
    }

    // Validar tempos de trim
    const start = Math.max(0, Math.floor(startTime));
    const end = Math.max(start + 1, Math.floor(endTime));

    if (end <= start) {
      return res.status(400).json({ 
        error: 'Tempo final deve ser maior que tempo inicial' 
      });
    }

    // Aplicar trim
    const trimmedPath = path.join(__dirname, '../../uploads', `${videoId}_trimmed.mp4`);
    await trimVideoService(video.path, trimmedPath, start, end);

    // Atualizar videoStore com caminho do vídeo cortado
    video.trimmedPath = trimmedPath;
    video.trimStart = start;
    video.trimEnd = end;
    videoStore.set(videoId, video);

    res.json({
      success: true,
      videoId,
      trimmedPath,
      startTime: start,
      endTime: end,
      duration: end - start,
      message: 'Trim aplicado com sucesso'
    });
  } catch (error) {
    console.error('[TRIM] Erro:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Calcula quantos clips podem ser gerados
 * Baseado apenas no intervalo trimado
 */
export const calculateClipsCount = (req, res) => {
  try {
    const { startTime, endTime, clipDuration } = req.body;

    if (startTime === undefined || endTime === undefined || !clipDuration) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios: startTime, endTime, clipDuration' 
      });
    }

    const start = Math.max(0, Math.floor(startTime));
    const end = Math.max(start + 1, Math.floor(endTime));
    const duration = parseInt(clipDuration);

    if (end <= start) {
      return res.status(400).json({ 
        error: 'Tempo final deve ser maior que tempo inicial' 
      });
    }

    if (duration !== 60 && duration !== 120) {
      return res.status(400).json({ 
        error: 'Duração do clip deve ser 60 ou 120 segundos' 
      });
    }

    // CÁLCULO: Baseado apenas no intervalo trimado
    const trimmedSeconds = end - start;
    const clipsCount = Math.floor(trimmedSeconds / duration);

    res.json({
      startTime: start,
      endTime: end,
      trimmedDuration: trimmedSeconds,
      clipDuration: duration,
      clipsCount: clipsCount,
      formula: `floor(${trimmedSeconds} / ${duration}) = ${clipsCount}`
    });
  } catch (error) {
    console.error('[CALC] Erro:', error);
    res.status(500).json({ error: error.message });
  }
};

