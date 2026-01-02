import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { downloadYouTubeVideo as downloadVideoService } from '../services/youtubeDownloader.js';
import { sanitizeYouTubeUrl, extractVideoId } from '../services/youtubeUrlUtils.js';

// ===============================
// CONFIGURAÇÃO RAILWAY (OBRIGATÓRIA)
// ===============================
const TMP_UPLOADS_DIR = '/tmp/uploads';

// Garantir diretório base
if (!fs.existsSync(TMP_UPLOADS_DIR)) {
  fs.mkdirSync(TMP_UPLOADS_DIR, { recursive: true });
}

// Store em memória (simples e funcional)
const videoStore = new Map();

/**
 * POST /api/download
 * Faz download do vídeo do YouTube e salva em /tmp/uploads
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

    // Sanitizar e extrair ID
    const sanitizedUrl = sanitizeYouTubeUrl(url);
    const youtubeVideoId = extractVideoId(sanitizedUrl);

    if (!youtubeVideoId) {
      return res.status(400).json({
        success: false,
        error: 'URL do YouTube inválida'
      });
    }

    // ID interno do sistema
    const storedVideoId = uuidv4();
    const videoPath = path.join(TMP_UPLOADS_DIR, `${storedVideoId}.mp4`);

    console.log(`[DOWNLOAD] Iniciando: ${sanitizedUrl}`);
    console.log(`[DOWNLOAD] Salvando em: ${videoPath}`);

    // Download
    await downloadVideoService(youtubeVideoId, videoPath);

    // Validação
    if (!fs.existsSync(videoPath)) {
      return res.status(500).json({
        success: false,
        error: 'Arquivo não foi criado após download'
      });
    }

    const stats = fs.statSync(videoPath);
    if (stats.size === 0) {
      fs.unlinkSync(videoPath);
      return res.status(500).json({
        success: false,
        error: 'Arquivo baixado está vazio'
      });
    }

    // Obter duração (opcional)
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
    } catch (err) {
      console.warn('[DOWNLOAD] Não foi possível obter duração do vídeo');
    }

    // Salvar no store
    videoStore.set(storedVideoId, {
      id: storedVideoId,
      youtubeUrl: sanitizedUrl,
      youtubeVideoId,
      path: videoPath,
      duration,
      fileSize: stats.size,
      downloaded: true,
      downloadedAt: new Date()
    });

    console.log(
      `[DOWNLOAD] Concluído: ${(stats.size / 1024 / 1024).toFixed(2)} MB`
    );

    return res.json({
      success: true,
      videoId: storedVideoId,
      playableUrl: `/api/play/${storedVideoId}`,
      duration,
      fileSize: stats.size
    });

  } catch (error) {
    console.error('[DOWNLOAD] Erro:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/play/:videoId
 * Serve o vídeo para o player HTML5 (streaming com range)
 */
export const playVideo = (req, res) => {
  try {
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

  } catch (error) {
    console.error('[PLAY] Erro ao servir vídeo:', error);
    res.status(500).json({ error: error.message });
  }
};

// Exportar store para uso em outros módulos
export { videoStore };
