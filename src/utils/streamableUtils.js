/**
 * UTILITÁRIOS PARA STREAMABLE
 * Converte URLs do Streamable para URLs diretas de vídeo que o FFmpeg pode usar
 */

/**
 * Converter URL do Streamable para URL direta do vídeo
 * Streamable URLs: https://streamable.com/{id}
 * Direct video URL: https://cdn.streamable.com/video/mp4/{id}.mp4
 * 
 * @param {string} streamableUrl - URL do Streamable (ex: https://streamable.com/zzzw81)
 * @returns {string} - URL direta do vídeo MP4
 */
export function convertStreamableToDirectUrl(streamableUrl) {
  if (!streamableUrl || typeof streamableUrl !== 'string') {
    return streamableUrl;
  }

  // Se já é uma URL direta (começa com http e termina com .mp4), retornar como está
  if (streamableUrl.match(/^https?:\/\/.*\.mp4(\?.*)?$/i)) {
    return streamableUrl;
  }

  // Se é URL do Streamable, converter para URL direta
  const streamableMatch = streamableUrl.match(/streamable\.com\/([a-z0-9]+)/i);
  if (streamableMatch) {
    const videoId = streamableMatch[1];
    // Streamable usa CDN para servir vídeos diretamente
    // Formato: https://cdn.streamable.com/video/mp4/{id}.mp4
    const directUrl = `https://cdn.streamable.com/video/mp4/${videoId}.mp4`;
    console.log(`[STREAMABLE] Convertendo URL: ${streamableUrl} -> ${directUrl}`);
    return directUrl;
  }

  // Se não é Streamable, retornar como está
  return streamableUrl;
}

/**
 * Verificar se uma URL é do Streamable
 * 
 * @param {string} url - URL para verificar
 * @returns {boolean} - true se é URL do Streamable
 */
export function isStreamableUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  return url.includes('streamable.com');
}

export default {
  convertStreamableToDirectUrl,
  isStreamableUrl
};
