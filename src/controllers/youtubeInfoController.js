import ytdl from '@distube/ytdl-core';
import { sanitizeYouTubeUrl, extractVideoId } from '../services/youtubeUrlUtils.js';

/**
 * GET /api/youtube/info
 * Obter informações do vídeo (thumbnail, título, duração) antes do download
 */
export const getYouTubeInfo = async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ 
        success: false,
        error: 'URL do YouTube não fornecida' 
      });
    }

    // Sanitizar URL
    const sanitizedUrl = sanitizeYouTubeUrl(url);
    const videoId = extractVideoId(sanitizedUrl);

    if (!videoId) {
      return res.status(400).json({ 
        success: false,
        error: 'URL do YouTube inválida' 
      });
    }

    console.log(`[YOUTUBE-INFO] Obtendo informações do vídeo: ${videoId}`);

    try {
      // Obter informações básicas do vídeo
      const info = await ytdl.getInfo(videoId);

      const videoDetails = info.videoDetails;
      const duration = parseInt(videoDetails.lengthSeconds) || 0;

      // Obter thumbnail (melhor qualidade disponível)
      const thumbnails = videoDetails.thumbnails || [];
      const thumbnail = thumbnails.length > 0 
        ? thumbnails[thumbnails.length - 1].url 
        : `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

      const response = {
        success: true,
        videoId: videoId,
        title: videoDetails.title || 'Sem título',
        duration: duration,
        thumbnail: thumbnail,
        author: videoDetails.author?.name || 'Desconhecido',
        viewCount: videoDetails.viewCount || 0
      };

      console.log(`[YOUTUBE-INFO] Informações obtidas: ${videoDetails.title} (${duration}s)`);

      res.json(response);

    } catch (infoError) {
      console.error(`[YOUTUBE-INFO] Erro ao obter informações: ${infoError.message}`);
      return res.status(500).json({ 
        success: false,
        error: `Erro ao obter informações do vídeo: ${infoError.message}` 
      });
    }

  } catch (error) {
    console.error('[YOUTUBE-INFO] Erro:', error);
    res.status(500).json({ 
      success: false,
      error: `Erro ao processar requisição: ${error.message}` 
    });
  }
};

