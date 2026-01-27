import { v4 as uuidv4 } from 'uuid';
import ytdl from '@distube/ytdl-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadYouTubeVideo, isVideoDownloaded } from '../services/youtubeDownloader.js';
import { STORAGE_CONFIG } from '../config/storage.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Armazenar informações dos vídeos processados
const videoStore = new Map();

// Exportar videoStore para uso em outros módulos
export { videoStore };

export const uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const videoId = uuidv4();
    const videoInfo = {
      id: videoId,
      path: req.file.path,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadedAt: new Date()
    };

    videoStore.set(videoId, videoInfo);

    res.json({
      videoId,
      message: 'Vídeo enviado com sucesso',
      video: videoInfo
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const processVideo = async (req, res) => {
  try {
    const { youtubeUrl } = req.body;

    if (!youtubeUrl) {
      return res.status(400).json({ error: 'URL do YouTube não fornecida' });
    }

    // Validar e normalizar URL
    let normalizedUrl = youtubeUrl.trim();
    
    // Extrair ID do vídeo de diferentes formatos de URL
    let videoId = null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/.*[?&]v=([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
      const match = normalizedUrl.match(pattern);
      if (match) {
        videoId = match[1];
        break;
      }
    }

    if (!videoId) {
      return res.status(400).json({ error: 'URL do YouTube inválida. Use formato: https://youtube.com/watch?v=VIDEO_ID ou https://youtu.be/VIDEO_ID' });
    }

    // Tentar obter informações do vídeo com múltiplas estratégias
    let info;
    let lastError = null;
    
    // Estratégia 1: Usar @distube/ytdl-core (mais atualizado)
    try {
      info = await ytdl.getInfo(videoId, {
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          }
        }
      });
    } catch (error1) {
      lastError = error1;
      console.error('Tentativa 1 falhou:', error1.message);
      
      // Estratégia 2: Tentar com URL completa
      try {
        info = await ytdl.getInfo(normalizedUrl, {
          requestOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Accept-Encoding': 'gzip, deflate',
              'DNT': '1',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1'
            }
          }
        });
      } catch (error2) {
        lastError = error2;
        console.error('Tentativa 2 falhou:', error2.message);
        
        // Estratégia 3: Fallback - criar objeto básico mesmo sem conseguir todas as informações
        // Isso permite que o usuário continue usando o vídeo
        const errorDetails = {
          message: lastError?.message || 'Erro desconhecido',
          code: lastError?.code || 'UNKNOWN',
          videoId: videoId,
          url: normalizedUrl
        };
        
        console.error('Todas as tentativas falharam, usando fallback:', errorDetails);
        
        const storedVideoId = uuidv4();
        // Usar STORAGE_CONFIG para caminho correto
        const videoPath = STORAGE_CONFIG.getVideoPath(storedVideoId);
        
        console.log(`[VIDEO_CONTROLLER_DEBUG] Salvando vídeo em: ${videoPath}`);
        console.log(`[VIDEO_CONTROLLER_DEBUG] STORAGE_CONFIG.UPLOADS_DIR: ${STORAGE_CONFIG.UPLOADS_DIR}`);
        
        // Criar diretório se não existir
        const uploadDir = path.dirname(videoPath);
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Tentar baixar mesmo em modo fallback
        console.log(`Tentando baixar vídeo em modo fallback: ${videoId}`);
        let downloaded = false;
        try {
          await downloadYouTubeVideo(videoId, videoPath);
          downloaded = fs.existsSync(videoPath) && fs.statSync(videoPath).size > 0;
          console.log(`Download fallback ${downloaded ? 'bem-sucedido' : 'falhou'}`);
        } catch (downloadError) {
          console.error('Erro no download fallback:', downloadError);
        }

        const fallbackVideo = {
          id: storedVideoId,
          youtubeUrl: normalizedUrl,
          youtubeVideoId: videoId,
          title: 'Vídeo do YouTube',
          duration: 0, // Usuário pode definir manualmente
          thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          path: videoPath,
          processedAt: new Date(),
          localVideoUrl: `/api/video/play/${storedVideoId}`,
          downloaded: downloaded,
          limited: true,
          error: errorDetails.message
        };
        
        videoStore.set(storedVideoId, fallbackVideo);
        
        return res.status(200).json({
          videoId: storedVideoId,
          message: downloaded ? 'Vídeo baixado (informações limitadas)' : 'Vídeo processado (modo limitado)',
          video: fallbackVideo,
          warning: downloaded ? null : 'Não foi possível obter todas as informações automaticamente. Você pode continuar e definir a duração manualmente no trim.'
        });
      }
    }

    const storedVideoId = uuidv4();
    // Usar STORAGE_CONFIG para caminho correto
    const videoPath = STORAGE_CONFIG.getVideoPath(storedVideoId);
    
    console.log(`[VIDEO_CONTROLLER_DEBUG] Salvando vídeo em: ${videoPath}`);
    console.log(`[VIDEO_CONTROLLER_DEBUG] STORAGE_CONFIG.UPLOADS_DIR: ${STORAGE_CONFIG.UPLOADS_DIR}`);

    // Criar diretório se não existir
    const uploadDir = path.dirname(videoPath);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const duration = parseInt(info.videoDetails.lengthSeconds) || 0;
    const thumbnail = info.videoDetails.thumbnails?.[info.videoDetails.thumbnails.length - 1]?.url || 
                     info.videoDetails.thumbnails?.[0]?.url || '';

    // ENFILEIRAR DOWNLOAD ASSÍNCRONO (Arquitetura Escalável)
    console.log(`[API] Enfileirando download do vídeo do YouTube: ${videoId}`);
    
    // Importar queue dinamicamente
    const { videoDownloadQueue } = await import('../queue/queue.js');
    
    // Adicionar job à fila (processamento assíncrono)
    const downloadJob = await videoDownloadQueue.add('download-youtube-video', {
      videoId: storedVideoId,
      youtubeVideoId: videoId,
      videoPath: videoPath
    }, {
      jobId: `download-${storedVideoId}`,
      priority: 1
    });

    console.log(`[API] Download enfileirado: Job ${downloadJob.id}`);
    
    // Download será processado assincronamente pelo worker
    // A API retorna imediatamente (stateless)

    const videoInfo = {
      id: storedVideoId,
      youtubeUrl: normalizedUrl,
      youtubeVideoId: videoId,
      title: info.videoDetails.title || 'Vídeo sem título',
      duration: duration,
      thumbnail: thumbnail,
      path: videoPath,
      processedAt: new Date(),
      // URL para servir o vídeo local baixado
      localVideoUrl: `/api/video/play/${storedVideoId}`,
      downloaded: false, // Será atualizado pelo worker quando download completar
      downloadJobId: downloadJob.id,
      downloadError: null
    };

    videoStore.set(storedVideoId, videoInfo);

    res.json({
      videoId: storedVideoId,
      message: 'Vídeo do YouTube processado. Download iniciado em background.',
      video: videoInfo,
      downloadStatus: 'queued',
      downloadJobId: downloadJob.id
    });
  } catch (error) {
    console.error('Erro completo no processVideo:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    
    // Retornar erro mais detalhado
    const errorResponse = {
      error: 'Erro ao processar vídeo do YouTube',
      details: error.message,
      errorCode: error.code || 'UNKNOWN',
      suggestion: 'Verifique se: 1) A URL está correta, 2) O vídeo está público e disponível, 3) Não há restrições de região'
    };
    
    // Se for erro de validação, retornar 400
    if (error.message?.includes('invalid') || error.message?.includes('Invalid')) {
      return res.status(400).json(errorResponse);
    }
    
    res.status(500).json(errorResponse);
  }
};

export const getVideoInfo = (req, res) => {
  try {
    const { videoId } = req.params;
    const video = videoStore.get(videoId);

    if (!video) {
      return res.status(404).json({ error: 'Vídeo não encontrado' });
    }

    res.json({ video });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const streamVideo = (req, res) => {
  try {
    const { videoId } = req.params;
    const video = videoStore.get(videoId);

    if (!video) {
      return res.status(404).json({ error: 'Vídeo não encontrado' });
    }

    if (!video.path || !fs.existsSync(video.path)) {
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
        'Content-Type': video.mimetype || 'video/mp4',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': video.mimetype || 'video/mp4',
      };
      res.writeHead(200, head);
      fs.createReadStream(video.path).pipe(res);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Nova rota para servir vídeo baixado (alias para streamVideo)
export const playVideo = streamVideo;

// Verificar status do download
export const checkDownloadStatus = (req, res) => {
  try {
    const { videoId } = req.params;
    const video = videoStore.get(videoId);

    if (!video) {
      return res.status(404).json({ error: 'Vídeo não encontrado' });
    }

    const downloaded = video.path && fs.existsSync(video.path) && fs.statSync(video.path).size > 0;

    res.json({
      videoId,
      downloaded,
      downloadJobId: video.downloadJobId || null,
      downloadError: video.downloadError || null,
      videoPath: downloaded ? video.path : null,
      localVideoUrl: downloaded ? `/api/video/play/${videoId}` : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

