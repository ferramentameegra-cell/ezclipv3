import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { downloadYouTubeVideo as downloadVideoService } from '../services/youtubeDownloader.js';
import { sanitizeYouTubeUrl, extractVideoId } from '../services/youtubeUrlUtils.js';

// ===============================
// CONFIG RAILWAY (OBRIGATÓRIO)
// ===============================
const TMP_UPLOADS_DIR = '/tmp/uploads';

// Garantir diretório
if (!fs.existsSync(TMP_UPLOADS_DIR)) {
  fs.mkdirSync(TMP_UPLOADS_DIR, { recursive: true });
}

// Store para vídeos baixados
const videoStore = new Map();

/**
 * POST /api/download
 */
export const downloadYouTubeVideo = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL do YouTube não fornecida'
      });
    }

    const sanitizedUrl = sanitizeYouTubeUrl(url);
    const videoId = extractVideoId(sanitizedUrl);

    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'URL do YouTube inválida'
      });
    }

    const storedVideoId = uuidv4();
    const videoPath = path.join(TMP_UPLOADS_DIR, `${storedVideoId}.mp4`);

    console.log(`[DOWNLOAD] ${sanitizedUrl} -> ${videoPath}`);

    // Download
    await downloadVideoService(videoId, videoPath);

    // Validação
    if (!fs.existsSync(videoPath)) {
      return res.status(500).json({ success: false, error: 'Arquivo não criado' });
    }

    const stats = fs.statSync(videoPath);
    if (stats.size === 0) {
      fs.unlinkSync(videoPath);
      return res.status(500).json({ success: false, error: 'Arquivo vazio' });
    }

    // Obter duração
    let duration = 0;
    try {
      const ffmpeg = (await import('fluent-ffmpeg')).default;
      await new Promise(resolve => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
          if (!err && metadata?.format?.duration) {
            duration = Math.floor(metadata.format.duration);
          }
          resolve();
        });
      });
    } catch {}

    const videoInfo = {
      id: storedVideoId,
      youtubeUrl: sanitizedUrl,
      youtubeVideoId: videoId,
      path: videoPath,
      duration,
      fileSize: stats.size,
      downloaded: true,
      downloadedAt: new Date()
    };

    videoStore.set(storedVideoId, videoInfo);

    console.log(`[DOWNLOAD] OK ${storedVideoId} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

    res.json({
      success: true,
      videoId: storedVideoId,
      playableUrl: `/api/play/${storedVideoId}`,
      duration,
      fileSize: stats.size
    });

  } catch (error) {
    console.error('[DOWNLOAD] Erro:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/play/:videoId
 */
export const playVideo = (req, res) => {
  const { videoId } = req.params;
  const video = videoStore.get(videoId);

  if (!video || !fs.existsSync(video.path)) {
    return res.status(404).json({ error: 'Vídeo não encontrado' });
  }

  const stat = fs.statSync(video.path);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = (end - start) + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4'
    });

    fs.createReadStream(video.path, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4'
    });
    fs.createReadStream(video.path).pipe(res);
  }
};

export { videoStore };
