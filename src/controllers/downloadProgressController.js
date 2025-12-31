import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizeYouTubeUrl, extractVideoId } from '../services/youtubeUrlUtils.js';
import { downloadYouTubeVideoWithProgress } from '../services/youtubeDownloaderWithProgress.js';
import { downloadYouTubeVideo as downloadVideoService } from '../services/youtubeDownloader.js';
import { videoStore } from './downloadController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * GET /api/download/progress
 * Download de vídeo com progresso em tempo real via Server-Sent Events (SSE)
 */
export const downloadWithProgress = async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ 
      success: false,
      error: 'URL do YouTube não fornecida' 
    });
  }

  // Configurar SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Desabilitar buffering no nginx

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Sanitizar URL
    const sanitizedUrl = sanitizeYouTubeUrl(url);
    const videoId = extractVideoId(sanitizedUrl);

    if (!videoId) {
      sendEvent({ 
        success: false,
        error: 'URL do YouTube inválida',
        progress: 0
      });
      res.end();
      return;
    }

    // Gerar ID único para o vídeo baixado
    const storedVideoId = uuidv4();
    const videoPath = path.join(__dirname, '../../uploads', `${storedVideoId}.mp4`);

    // Garantir diretório existe
    const uploadDir = path.dirname(videoPath);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    console.log(`[DOWNLOAD-PROGRESS] Iniciando download com progresso: ${sanitizedUrl} -> ${videoPath}`);

    sendEvent({ 
      success: true,
      progress: 0,
      message: 'Iniciando download...',
      videoId: storedVideoId
    });

    let downloadSuccess = false;
    let downloadError = null;

    // Tentar yt-dlp com progresso primeiro
    try {
      await downloadYouTubeVideoWithProgress(
        sanitizedUrl,
        videoPath,
        (percent) => {
          sendEvent({ 
            success: true,
            progress: percent,
            message: `Baixando... ${percent.toFixed(1)}%`,
            videoId: storedVideoId
          });
        }
      );
      downloadSuccess = true;
      console.log(`[DOWNLOAD-PROGRESS] Download concluído com yt-dlp: ${videoPath}`);
    } catch (ytdlpError) {
      console.warn(`[DOWNLOAD-PROGRESS] yt-dlp falhou, tentando ytdl-core: ${ytdlpError.message}`);
      downloadError = ytdlpError;
      
      // Fallback para ytdl-core (sem progresso granular)
      try {
        sendEvent({ 
          success: true,
          progress: 50,
          message: 'Usando método alternativo...',
          videoId: storedVideoId
        });

        await downloadVideoService(videoId, videoPath);
        downloadSuccess = true;
        
        sendEvent({ 
          success: true,
          progress: 100,
          message: 'Download concluído',
          videoId: storedVideoId
        });

        console.log(`[DOWNLOAD-PROGRESS] Download concluído com ytdl-core: ${videoPath}`);
      } catch (fallbackError) {
        console.error(`[DOWNLOAD-PROGRESS] Erro no download: ${fallbackError.message}`);
        downloadError = fallbackError;
      }
    }

    // Validar download
    if (!downloadSuccess || !fs.existsSync(videoPath)) {
      const errorMessage = downloadError?.message || 'Erro desconhecido';
      sendEvent({ 
        success: false,
        error: `Falha ao baixar vídeo: ${errorMessage}`,
        progress: 0
      });
      res.end();
      return;
    }

    const stats = fs.statSync(videoPath);
    if (stats.size === 0) {
      fs.unlinkSync(videoPath);
      sendEvent({ 
        success: false,
        error: 'Arquivo baixado está vazio',
        progress: 0
      });
      res.end();
      return;
    }

    // Obter informações do vídeo (duração)
    let duration = 0;
    try {
      const ffmpeg = (await import('fluent-ffmpeg')).default;
      await new Promise((resolve) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
          if (!err && metadata?.format?.duration) {
            duration = Math.floor(metadata.format.duration);
          }
          resolve();
        });
      });
    } catch (error) {
      console.warn(`[DOWNLOAD-PROGRESS] Erro ao obter duração: ${error.message}`);
    }

    // Armazenar informações do vídeo
    const videoInfo = {
      id: storedVideoId,
      youtubeUrl: sanitizedUrl,
      youtubeVideoId: videoId,
      path: videoPath,
      duration: duration,
      fileSize: stats.size,
      downloaded: true,
      downloadedAt: new Date()
    };

    videoStore.set(storedVideoId, videoInfo);

    console.log(`[DOWNLOAD-PROGRESS] Vídeo pronto: ${storedVideoId} (${(stats.size / 1024 / 1024).toFixed(2)} MB, ${duration}s)`);

    // Enviar conclusão
    sendEvent({ 
      success: true,
      progress: 100,
      message: 'Download concluído',
      videoId: storedVideoId,
      playableUrl: `/api/play/${storedVideoId}`,
      duration: duration,
      fileSize: stats.size,
      completed: true
    });

    res.end();

  } catch (error) {
    console.error('[DOWNLOAD-PROGRESS] Erro:', error);
    sendEvent({ 
      success: false,
      error: `Erro ao processar download: ${error.message}`,
      progress: 0
    });
    res.end();
  }
};

