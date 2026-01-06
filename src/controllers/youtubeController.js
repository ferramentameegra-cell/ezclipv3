/**
 * NOVO CONTROLLER YOUTUBE - LIMPO
 * Apenas valida URL e retorna metadata
 * Usa youtubeServiceStable.js (yt-dlp CLI) ao invés de youtubeService.js (ytdl-core)
 */

import { getYouTubeVideoInfo } from '../services/youtubeServiceStable.js';

/**
 * GET /api/youtube/info?url=YOUTUBE_URL
 * Valida URL do YouTube e retorna metadata do vídeo
 */
export const getYouTubeInfo = async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL do YouTube não fornecida. Use: /api/youtube/info?url=YOUTUBE_URL'
      });
    }

    // Validar e obter metadata
    const metadata = await getYouTubeVideoInfo(url);

    return res.json({
      success: true,
      ...metadata
    });

  } catch (error) {
    console.error('[YOUTUBE-CONTROLLER] Erro:', error);

    // Erros de validação = 400
    if (error.message.includes('inválida') || error.message.includes('invalid')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    // Outros erros = 500
    return res.status(500).json({
      success: false,
      error: `Erro ao obter informações do vídeo: ${error.message}`
    });
  }
};
