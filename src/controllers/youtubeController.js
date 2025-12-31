import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadWithYtDlp, isYtDlpAvailable } from '../services/ytdlpDownloader.js';
import { downloadYouTubeVideo } from '../services/youtubeDownloader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store para vídeos baixados
const youtubeVideoStore = new Map();

/**
 * Download de vídeo do YouTube
 * Retorna URL jogável imediatamente após download completo
 */
export const downloadYouTubeVideoEndpoint = async (req, res) => {
  try {
    const { youtubeUrl } = req.body;

    if (!youtubeUrl) {
      return res.status(400).json({ 
        error: 'URL do YouTube não fornecida' 
      });
    }

    // Extrair video ID
    let videoId = null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/.*[?&]v=([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
      const match = youtubeUrl.trim().match(pattern);
      if (match) {
        videoId = match[1];
        break;
      }
    }

    if (!videoId) {
      return res.status(400).json({ 
        error: 'URL do YouTube inválida' 
      });
    }

    // Gerar ID único para o vídeo baixado
    const storedVideoId = uuidv4();
    const videoPath = path.join(__dirname, '../../uploads', `${storedVideoId}.mp4`);

    // Garantir diretório existe
    const uploadDir = path.dirname(videoPath);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    console.log(`[YOUTUBE] Iniciando download: ${youtubeUrl} -> ${videoPath}`);

    // Tentar yt-dlp primeiro (mais robusto)
    let downloadSuccess = false;
    let downloadError = null;

    const ytdlpAvailable = await isYtDlpAvailable();
    if (ytdlpAvailable) {
      try {
        await downloadWithYtDlp(youtubeUrl.trim(), videoPath);
        downloadSuccess = true;
        console.log(`[YOUTUBE] Download concluído com yt-dlp: ${videoPath}`);
      } catch (error) {
        console.warn(`[YOUTUBE] yt-dlp falhou, tentando ytdl-core: ${error.message}`);
        downloadError = error;
      }
    }

    // Fallback para ytdl-core
    if (!downloadSuccess) {
      try {
        await downloadYouTubeVideo(videoId, videoPath);
        downloadSuccess = true;
        console.log(`[YOUTUBE] Download concluído com ytdl-core: ${videoPath}`);
      } catch (error) {
        console.error(`[YOUTUBE] Erro no download: ${error.message}`);
        downloadError = error;
      }
    }

    // Validar download
    if (!downloadSuccess || !fs.existsSync(videoPath)) {
      return res.status(500).json({ 
        error: `Falha ao baixar vídeo: ${downloadError?.message || 'Erro desconhecido'}` 
      });
    }

    const stats = fs.statSync(videoPath);
    if (stats.size === 0) {
      fs.unlinkSync(videoPath);
      return res.status(500).json({ 
        error: 'Arquivo baixado está vazio' 
      });
    }

    // Obter informações do vídeo (duração)
    let duration = 0;
    try {
      const ffmpeg = (await import('fluent-ffmpeg')).default;
      await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
          if (err) {
            console.warn(`[YOUTUBE] Erro ao obter metadados: ${err.message}`);
            resolve();
          } else {
            duration = Math.floor(metadata.format.duration || 0);
            resolve();
          }
        });
      });
    } catch (error) {
      console.warn(`[YOUTUBE] Erro ao obter duração: ${error.message}`);
    }

    // Armazenar informações do vídeo
    const videoInfo = {
      id: storedVideoId,
      youtubeUrl: youtubeUrl.trim(),
      youtubeVideoId: videoId,
      path: videoPath,
      duration: duration,
      fileSize: stats.size,
      downloaded: true,
      downloadedAt: new Date(),
      localVideoUrl: `/api/video/play/${storedVideoId}`,
      playableUrl: `/api/video/play/${storedVideoId}`
    };

    youtubeVideoStore.set(storedVideoId, videoInfo);

    console.log(`[YOUTUBE] Vídeo pronto: ${storedVideoId} (${(stats.size / 1024 / 1024).toFixed(2)} MB, ${duration}s)`);

    // Retornar URL jogável imediatamente
    res.json({
      success: true,
      videoId: storedVideoId,
      playableUrl: videoInfo.playableUrl,
      localVideoUrl: videoInfo.localVideoUrl,
      duration: duration,
      fileSize: stats.size,
      message: 'Vídeo baixado e pronto para uso'
    });

  } catch (error) {
    console.error('[YOUTUBE] Erro:', error);
    res.status(500).json({ 
      error: `Erro ao processar vídeo: ${error.message}` 
    });
  }
};

/**
 * Obter informações do vídeo baixado
 */
export const getVideoInfo = (req, res) => {
  try {
    const { videoId } = req.params;
    const video = youtubeVideoStore.get(videoId);

    if (!video) {
      return res.status(404).json({ error: 'Vídeo não encontrado' });
    }

    res.json({
      videoId: video.id,
      playableUrl: video.playableUrl,
      duration: video.duration,
      fileSize: video.fileSize,
      downloaded: video.downloaded
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Servir vídeo baixado para player HTML5
 */
export const playVideo = (req, res) => {
  try {
    const { videoId } = req.params;
    const video = youtubeVideoStore.get(videoId);

    if (!video || !video.path) {
      return res.status(404).json({ error: 'Vídeo não encontrado' });
    }

    if (!fs.existsSync(video.path)) {
      return res.status(404).json({ error: 'Arquivo de vídeo não encontrado' });
    }

    const stat = fs.statSync(video.path);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(video.path, { start, end });
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
      fs.createReadStream(video.path).pipe(res);
    }
  } catch (error) {
    console.error('[YOUTUBE] Erro ao servir vídeo:', error);
    res.status(500).json({ error: error.message });
  }
};

// Exportar store para uso em outros módulos
export { youtubeVideoStore };

