import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadYouTubeVideo as downloadVideoService } from '../services/youtubeDownloader.js';
import { sanitizeYouTubeUrl, extractVideoId } from '../services/youtubeUrlUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store para vídeos baixados
const videoStore = new Map();

/**
 * POST /api/download
 * Download de vídeo do YouTube
 * Retorna URL jogável após download completo
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

    // Sanitizar URL (remove parâmetros de playlist/radio)
    const sanitizedUrl = sanitizeYouTubeUrl(url);
    
    // Extrair video ID
    const videoId = extractVideoId(sanitizedUrl);
    if (!videoId) {
      return res.status(400).json({ 
        success: false,
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

    console.log(`[DOWNLOAD] Iniciando download: ${sanitizedUrl} (ID: ${videoId}) -> ${videoPath}`);

    try {
      // Baixar vídeo usando ytdl-core (Node.js puro, compatível com containers)
      await downloadVideoService(videoId, videoPath);

      // Validar download
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
        console.warn(`[DOWNLOAD] Erro ao obter duração: ${error.message}`);
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

      console.log(`[DOWNLOAD] Download concluído: ${storedVideoId} (${(stats.size / 1024 / 1024).toFixed(2)} MB, ${duration}s)`);

      // Retornar URL jogável
      res.json({
        success: true,
        videoId: storedVideoId,
        playableUrl: `/api/play/${storedVideoId}`,
        duration: duration,
        fileSize: stats.size,
        message: 'Vídeo baixado com sucesso'
      });

    } catch (downloadError) {
      console.error(`[DOWNLOAD] Erro no download: ${downloadError.message}`);
      
      // Limpar arquivo corrompido se existir
      if (fs.existsSync(videoPath)) {
        try {
          fs.unlinkSync(videoPath);
        } catch (unlinkError) {
          console.error('[DOWNLOAD] Erro ao remover arquivo corrompido:', unlinkError);
        }
      }
      
      return res.status(500).json({ 
        success: false,
        error: `Erro ao baixar vídeo: ${downloadError.message}` 
      });
    }

  } catch (error) {
    console.error('[DOWNLOAD] Erro:', error);
    res.status(500).json({ 
      success: false,
      error: `Erro ao processar download: ${error.message}` 
    });
  }
};

/**
 * GET /api/play/:videoId
 * Servir vídeo baixado para player HTML5
 */
export const playVideo = (req, res) => {
  try {
    const { videoId } = req.params;
    const video = videoStore.get(videoId);

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
    console.error('[PLAY] Erro ao servir vídeo:', error);
    res.status(500).json({ error: error.message });
  }
};

// Exportar store para uso em outros módulos
export { videoStore };

