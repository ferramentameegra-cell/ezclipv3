import { trimVideo as trimVideoService } from '../services/videoTrimmer.js';
import { youtubeVideoStore } from './youtubeController.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Aplicar trim no vídeo baixado
 * Retorna vídeo trimado e URL jogável
 */
export const applyTrim = async (req, res) => {
  try {
    const { videoId, startTime, endTime } = req.body;

    if (!videoId || startTime === undefined || endTime === undefined) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios: videoId, startTime, endTime' 
      });
    }

    const video = youtubeVideoStore.get(videoId);
    if (!video) {
      return res.status(404).json({ error: 'Vídeo não encontrado' });
    }

    // Validar que vídeo está baixado
    if (!video.path || !fs.existsSync(video.path)) {
      return res.status(400).json({ 
        error: 'Vídeo ainda não foi baixado' 
      });
    }

    const stats = fs.statSync(video.path);
    if (stats.size === 0) {
      return res.status(400).json({ 
        error: 'Arquivo de vídeo está vazio' 
      });
    }

    // Validar tempos de trim
    const start = Math.max(0, Math.floor(startTime));
    const end = Math.max(start + 1, Math.floor(endTime));
    const maxDuration = video.duration || Infinity;

    if (end > maxDuration) {
      return res.status(400).json({ 
        error: `Tempo final (${end}s) excede duração do vídeo (${maxDuration}s)` 
      });
    }

    if (end <= start) {
      return res.status(400).json({ 
        error: 'Tempo final deve ser maior que tempo inicial' 
      });
    }

    // Aplicar trim
    const trimmedPath = path.join(__dirname, '../../uploads', `${videoId}_trimmed.mp4`);
    
    console.log(`[TRIM] Aplicando trim: ${start}s - ${end}s em ${video.path}`);
    
    await trimVideoService(video.path, trimmedPath, start, end);

    // Validar arquivo trimado
    if (!fs.existsSync(trimmedPath)) {
      return res.status(500).json({ 
        error: 'Arquivo trimado não foi criado' 
      });
    }

    const trimmedStats = fs.statSync(trimmedPath);
    if (trimmedStats.size === 0) {
      return res.status(500).json({ 
        error: 'Arquivo trimado está vazio' 
      });
    }

    // Atualizar store com informações do trim
    video.trimmedPath = trimmedPath;
    video.trimStart = start;
    video.trimEnd = end;
    video.trimmedDuration = end - start;
    video.trimmedVideoUrl = `/api/video/play-trimmed/${videoId}`;
    youtubeVideoStore.set(videoId, video);

    console.log(`[TRIM] Trim aplicado com sucesso: ${trimmedPath} (${(trimmedStats.size / 1024 / 1024).toFixed(2)} MB)`);

    res.json({
      success: true,
      videoId,
      trimmedVideoUrl: video.trimmedVideoUrl,
      startTime: start,
      endTime: end,
      trimmedDuration: video.trimmedDuration,
      message: 'Trim aplicado com sucesso'
    });

  } catch (error) {
    console.error('[TRIM] Erro:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Calcular quantos clips podem ser gerados
 * Baseado na duração trimada e duração do clip selecionada
 */
export const calculateClipsCount = (req, res) => {
  try {
    const { videoId, startTime, endTime, clipDuration } = req.body;

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

    // CÁLCULO PRECISO: Baseado apenas na duração trimada
    const trimmedDuration = end - start;
    const clipsCount = Math.floor(trimmedDuration / duration);

    // Calcular também para a outra duração
    const otherDuration = duration === 60 ? 120 : 60;
    const otherClipsCount = Math.floor(trimmedDuration / otherDuration);

    res.json({
      success: true,
      startTime: start,
      endTime: end,
      trimmedDuration: trimmedDuration,
      clips60s: duration === 60 ? clipsCount : otherClipsCount,
      clips120s: duration === 120 ? clipsCount : otherClipsCount,
      selectedDuration: duration,
      selectedClipsCount: clipsCount,
      formula: `floor(${trimmedDuration} / ${duration}) = ${clipsCount}`
    });

  } catch (error) {
    console.error('[CALC] Erro:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Servir vídeo trimado
 */
export const playTrimmedVideo = (req, res) => {
  try {
    const { videoId } = req.params;
    const video = youtubeVideoStore.get(videoId);

    if (!video || !video.trimmedPath) {
      return res.status(404).json({ error: 'Vídeo trimado não encontrado' });
    }

    if (!fs.existsSync(video.trimmedPath)) {
      return res.status(404).json({ error: 'Arquivo trimado não encontrado' });
    }

    const stat = fs.statSync(video.trimmedPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(video.trimmedPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(200, head);
      fs.createReadStream(video.trimmedPath).pipe(res);
    }
  } catch (error) {
    console.error('[TRIM] Erro ao servir vídeo trimado:', error);
    res.status(500).json({ error: error.message });
  }
};
