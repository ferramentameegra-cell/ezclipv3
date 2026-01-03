import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizeYouTubeUrl, extractVideoId } from '../services/youtubeUrlUtils.js';
import { downloadWithYtDlpFixed, isYtDlpAvailable } from '../services/ytdlpDownloaderFixed.js';
import { validateVideoWithFfprobe } from '../services/videoValidator.js';
import { 
  initVideoState, 
  updateVideoState, 
  getVideoState,
  VIDEO_STATES 
} from '../services/videoStateManager.js';
import { videoStore } from './downloadController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TMP_UPLOADS_DIR = '/tmp/uploads';

/**
 * GET /api/download/progress
 * Download de vídeo com progresso em tempo real via Server-Sent Events (SSE)
 * REFATORADO: Usa state machine e validação robusta
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
  res.setHeader('Access-Control-Allow-Origin', '*'); // Railway CORS

  const sendEvent = (data) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      console.error('[SSE] Erro ao enviar evento:', error);
    }
  };

  let storedVideoId = null;

  try {
    // Sanitizar URL
    const sanitizedUrl = sanitizeYouTubeUrl(url);
    const videoId = extractVideoId(sanitizedUrl);

    if (!videoId) {
      sendEvent({ 
        success: false,
        error: 'URL do YouTube inválida',
        progress: 0,
        state: VIDEO_STATES.ERROR
      });
      res.end();
      return;
    }

    // Gerar ID único para o vídeo baixado
    storedVideoId = uuidv4();
    const videoPath = path.join(TMP_UPLOADS_DIR, `${storedVideoId}.mp4`);

    // Garantir diretório existe
    if (!fs.existsSync(TMP_UPLOADS_DIR)) {
      fs.mkdirSync(TMP_UPLOADS_DIR, { recursive: true });
    }

    // Inicializar estado
    initVideoState(storedVideoId);
    updateVideoState(storedVideoId, {
      state: VIDEO_STATES.DOWNLOADING,
      progress: 0
    });

    console.log(`[DOWNLOAD-PROGRESS] Iniciando download: ${sanitizedUrl} -> ${videoPath}`);

    sendEvent({ 
      success: true,
      progress: 0,
      message: 'Verificando yt-dlp...',
      videoId: storedVideoId,
      state: VIDEO_STATES.DOWNLOADING
    });

    // Verificar se yt-dlp está disponível
    const ytdlpAvailable = await isYtDlpAvailable();
    if (!ytdlpAvailable) {
      throw new Error('yt-dlp não está disponível no sistema. Verifique a instalação.');
    }

    sendEvent({ 
      success: true,
      progress: 5,
      message: 'Iniciando download...',
      videoId: storedVideoId,
      state: VIDEO_STATES.DOWNLOADING
    });

    // Download com yt-dlp corrigido
    try {
      await downloadWithYtDlpFixed(
        sanitizedUrl,
        videoPath,
        (percent, downloaded, total, status) => {
          const progress = Math.min(95, Math.max(5, percent)); // Máximo 95% antes da validação
          updateVideoState(storedVideoId, {
            progress: progress,
            state: VIDEO_STATES.DOWNLOADING
          });

          const message = status === 'finished' 
            ? 'Download concluído, validando vídeo...' 
            : `Baixando... ${percent.toFixed(1)}%`;
          
          sendEvent({ 
            success: true,
            progress: progress,
            downloaded: downloaded,
            total: total,
            status: status,
            message: message,
            videoId: storedVideoId,
            state: VIDEO_STATES.DOWNLOADING
          });
        }
      );

      console.log(`[DOWNLOAD-PROGRESS] Download concluído: ${videoPath}`);
    } catch (downloadError) {
      console.error(`[DOWNLOAD-PROGRESS] Erro no download: ${downloadError.message}`);
      updateVideoState(storedVideoId, {
        state: VIDEO_STATES.ERROR,
        error: downloadError.message
      });
      
      sendEvent({ 
        success: false,
        error: `Falha ao baixar vídeo: ${downloadError.message}`,
        progress: 0,
        state: VIDEO_STATES.ERROR
      });
      res.end();
      return;
    }

    // Validar que arquivo existe
    if (!fs.existsSync(videoPath)) {
      throw new Error('Arquivo não foi criado após download');
    }

    const stats = fs.statSync(videoPath);
    if (stats.size === 0) {
      fs.unlinkSync(videoPath);
      throw new Error('Arquivo baixado está vazio');
    }

    // VALIDAÇÃO CRÍTICA: Usar ffprobe para validar vídeo
    sendEvent({ 
      success: true,
      progress: 96,
      message: 'Validando vídeo...',
      videoId: storedVideoId,
      state: VIDEO_STATES.PROCESSING
    });

    updateVideoState(storedVideoId, {
      state: VIDEO_STATES.PROCESSING,
      progress: 96
    });

    let videoMetadata;
    try {
      videoMetadata = await validateVideoWithFfprobe(videoPath);
      console.log(`[DOWNLOAD-PROGRESS] Vídeo validado: ${videoMetadata.duration}s, ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    } catch (validationError) {
      console.error(`[DOWNLOAD-PROGRESS] Erro na validação: ${validationError.message}`);
      // Limpar arquivo inválido
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }
      
      updateVideoState(storedVideoId, {
        state: VIDEO_STATES.ERROR,
        error: `Vídeo inválido: ${validationError.message}`
      });

      sendEvent({ 
        success: false,
        error: `Vídeo baixado é inválido: ${validationError.message}`,
        progress: 0,
        state: VIDEO_STATES.ERROR
      });
      res.end();
      return;
    }

    // Armazenar informações do vídeo
    const videoInfo = {
      id: storedVideoId,
      youtubeUrl: sanitizedUrl,
      youtubeVideoId: videoId,
      path: videoPath,
      duration: videoMetadata.duration,
      fileSize: stats.size,
      downloaded: true,
      downloadedAt: new Date(),
      validated: true,
      metadata: videoMetadata
    };

    videoStore.set(storedVideoId, videoInfo);

    // Estado READY
    updateVideoState(storedVideoId, {
      state: VIDEO_STATES.READY,
      progress: 100,
      metadata: videoMetadata
    });

    console.log(`[DOWNLOAD-PROGRESS] Vídeo pronto: ${storedVideoId} (${(stats.size / 1024 / 1024).toFixed(2)} MB, ${videoMetadata.duration}s)`);

    // Enviar conclusão
    sendEvent({ 
      success: true,
      progress: 100,
      message: 'Vídeo pronto!',
      videoId: storedVideoId,
      playableUrl: `/api/play/${storedVideoId}`,
      duration: videoMetadata.duration,
      fileSize: stats.size,
      completed: true,
      state: VIDEO_STATES.READY,
      ready: true // Flag explícita para frontend
    });

    res.end();

  } catch (error) {
    console.error('[DOWNLOAD-PROGRESS] Erro geral:', error);
    
    if (storedVideoId) {
      updateVideoState(storedVideoId, {
        state: VIDEO_STATES.ERROR,
        error: error.message
      });
    }
    
    sendEvent({ 
      success: false,
      error: `Erro ao processar download: ${error.message}`,
      progress: 0,
      state: VIDEO_STATES.ERROR
    });
    res.end();
  }
};

