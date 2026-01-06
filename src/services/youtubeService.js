/**
 * SERVICE YOUTUBE - USANDO yt-dlp CLI (ESTÁVEL)
 * NÃO usa bibliotecas npm, apenas yt-dlp binário do sistema
 */

// IMPORTANTE: Este arquivo foi substituído por youtubeServiceStable.js
// Mantido para compatibilidade temporária
// TODO: Migrar completamente para youtubeServiceStable.js

import ytdl from '@distube/ytdl-core';

/**
 * Valida URL do YouTube
 * @param {string} url - URL do YouTube
 * @returns {string} - Video ID extraído
 * @throws {Error} - Se URL for inválida
 */
function validateYouTubeUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL não fornecida ou inválida');
  }

  const trimmedUrl = url.trim();

  // Padrões válidos de URL do YouTube
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/.*[?&]v=([^&\n?#]+)/
  ];

  for (const pattern of patterns) {
    const match = trimmedUrl.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  throw new Error('URL do YouTube inválida. Use formato: https://youtube.com/watch?v=VIDEO_ID ou https://youtu.be/VIDEO_ID');
}

/**
 * Obtém informações do vídeo do YouTube
 * @param {string} url - URL do YouTube
 * @returns {Promise<Object>} - Metadata do vídeo (videoId, title, duration, thumbnail, author)
 * @throws {Error} - Se não conseguir obter informações
 */
export async function getYouTubeVideoInfo(url) {
  // Validar URL
  const videoId = validateYouTubeUrl(url);

  console.log(`[YOUTUBE-SERVICE] Obtendo informações do vídeo: ${videoId}`);

  try {
    // Obter informações usando ytdl-core
    const info = await ytdl.getInfo(videoId, {
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      }
    });

    const videoDetails = info.videoDetails;

    // Extrair duração em segundos
    const duration = parseInt(videoDetails.lengthSeconds) || 0;

    // Obter melhor thumbnail disponível
    const thumbnails = videoDetails.thumbnails || [];
    const thumbnail = thumbnails.length > 0
      ? thumbnails[thumbnails.length - 1].url
      : `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    // Construir resposta
    const metadata = {
      videoId: videoId,
      title: videoDetails.title || 'Sem título',
      duration: duration,
      thumbnail: thumbnail,
      author: videoDetails.author?.name || 'Desconhecido',
      viewCount: videoDetails.viewCount || 0,
      description: videoDetails.description || ''
    };

    console.log(`[YOUTUBE-SERVICE] Informações obtidas: ${metadata.title} (${duration}s)`);

    return metadata;

  } catch (error) {
    console.error(`[YOUTUBE-SERVICE] Erro ao obter informações: ${error.message}`);
    
    // Erros comuns do ytdl-core
    if (error.message.includes('Video unavailable')) {
      throw new Error('Vídeo não disponível ou privado');
    }
    if (error.message.includes('Private video')) {
      throw new Error('Vídeo privado. Apenas vídeos públicos são suportados');
    }
    if (error.message.includes('Sign in to confirm')) {
      throw new Error('Vídeo requer confirmação de idade');
    }

    throw new Error(`Não foi possível obter informações do vídeo: ${error.message}`);
  }
}

