import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { downloadYouTubeVideo as downloadVideoService } from '../services/youtubeDownloader.js';
import { sanitizeYouTubeUrl, extractVideoId } from '../services/youtubeUrlUtils.js';

const TMP_UPLOADS_DIR = '/tmp/uploads';

// Garante diretório no Railway
if (!fs.existsSync(TMP_UPLOADS_DIR)) {
  fs.mkdirSync(TMP_UPLOADS_DIR, { recursive: true });
}

// Store simples em memória
const videoStore = new Map();

/**
 * POST /api/youtube/download
 */
export const downloadYouTubeVideo = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: 'URL não informada' });
    }

    const sanitizedUrl = sanitizeYouTubeUrl(url);
    const youtubeVideoId = extractVideoId(sanitizedUrl);

    if (!youtubeVideoId) {
      return res.status(400).json({ success: false, error: 'URL inválida' });
    }

    const videoId = uuidv4();
    const videoPath = path.join(TMP_UPLOADS_DIR, `${videoId}.mp4`);

    console.log(`[DOWNLOAD] ${sanitizedUrl}`);
    console.log(`[DOWNLOAD] Path: ${videoPath}`);

    await downloadVideoService(youtubeVideoId, videoPath);

    if (!fs.existsSync(videoPath)) {
      throw new Error('Arquivo não criado');
    }

    const stats = fs.statSync(videoPath);
    if (stats.size === 0) {
      fs.unlinkSync(videoPath);
      throw new Error('Arquivo vazio');
    }

    videoStore.set(videoId, {
      id: videoId,
      youtubeVideoId,
      path: videoPath,
      fileSize: stats.size,
      downloadedAt: new Date()
    });

    return res.json({
      success: true,
      videoId,
      playableUrl: `/api/youtube/play/${videoId}`,
      fileSize: stats.size
    });

  } catch (err) {
    console.error('[DOWNLOAD ERROR]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/youtube/play/:videoId
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
    const [startStr, endStr] = range.replace('bytes=', '').split('-');
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : fileSize - 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
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
