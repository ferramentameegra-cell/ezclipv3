import { v4 as uuidv4 } from 'uuid';
import ytdl from 'ytdl-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Armazenar informações dos vídeos processados
const videoStore = new Map();

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

    // Tentar obter informações do vídeo com retry e opções
    let info;
    try {
      info = await ytdl.getInfo(videoId, {
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        }
      });
    } catch (ytdlError) {
      // Se falhar, tentar com a URL completa
      try {
        info = await ytdl.getInfo(normalizedUrl, {
          requestOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          }
        });
      } catch (secondError) {
        console.error('Erro ao obter info do YouTube:', secondError);
        return res.status(500).json({ 
          error: 'Erro ao processar vídeo do YouTube. Verifique se a URL está correta e o vídeo está disponível.',
          details: secondError.message 
        });
      }
    }

    const storedVideoId = uuidv4();
    const videoPath = path.join(__dirname, '../../uploads', `${storedVideoId}.mp4`);

    // Criar diretório se não existir
    const uploadDir = path.dirname(videoPath);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const duration = parseInt(info.videoDetails.lengthSeconds) || 0;
    const thumbnail = info.videoDetails.thumbnails?.[info.videoDetails.thumbnails.length - 1]?.url || 
                     info.videoDetails.thumbnails?.[0]?.url || '';

    const videoInfo = {
      id: storedVideoId,
      youtubeUrl: normalizedUrl,
      youtubeVideoId: videoId,
      title: info.videoDetails.title || 'Vídeo sem título',
      duration: duration,
      thumbnail: thumbnail,
      path: videoPath,
      processedAt: new Date(),
      // URL para streaming direto (não baixar, apenas usar para preview)
      streamUrl: `https://www.youtube.com/embed/${videoId}`
    };

    videoStore.set(storedVideoId, videoInfo);

    res.json({
      videoId: storedVideoId,
      message: 'Vídeo do YouTube processado com sucesso',
      video: videoInfo
    });
  } catch (error) {
    console.error('Erro completo:', error);
    res.status(500).json({ 
      error: 'Erro ao processar vídeo do YouTube',
      details: error.message,
      suggestion: 'Verifique se a URL está correta e tente novamente'
    });
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

