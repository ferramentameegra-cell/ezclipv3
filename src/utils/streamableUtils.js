/**
 * UTILITÁRIOS PARA STREAMABLE
 * Converte URLs do Streamable para URLs diretas de vídeo que o FFmpeg pode usar
 */

/**
 * Converter URL do Streamable para URL direta do vídeo
 * Streamable URLs: https://streamable.com/{id}
 * 
 * O Streamable pode ter diferentes formatos de URL direta:
 * - https://cdn.streamable.com/video/mp4/{id}.mp4 (formato comum)
 * - https://streamable.com/e/{id} (formato embed)
 * 
 * FFmpeg pode usar URLs HTTP diretamente, então vamos tentar o formato mais comum.
 * Se não funcionar, o FFmpeg retornará erro e podemos ajustar.
 * 
 * @param {string} streamableUrl - URL do Streamable (ex: https://streamable.com/zzzw81)
 * @returns {string} - URL direta do vídeo MP4 ou URL original se não for Streamable
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
  // Extrair ID da URL (pode ser streamable.com/{id} ou streamable.com/e/{id})
  const streamableMatch = streamableUrl.match(/streamable\.com\/(?:e\/)?([a-z0-9]+)/i);
  if (streamableMatch) {
    const videoId = streamableMatch[1];
    
    // Streamable usa CDN para servir vídeos diretamente
    // Formato mais comum: https://cdn.streamable.com/video/mp4/{id}.mp4
    // Tentar múltiplos formatos possíveis
    const possibleUrls = [
      `https://cdn.streamable.com/video/mp4/${videoId}.mp4`,
      `https://cdn.streamable.com/video/mp4/${videoId}`,
      `https://streamable.com/e/${videoId}`
    ];
    
    // Retornar o primeiro formato (mais comum)
    const directUrl = possibleUrls[0];
    console.log(`[STREAMABLE] Convertendo URL: ${streamableUrl} -> ${directUrl}`);
    console.log(`[STREAMABLE] URL será baixada antes de usar no FFmpeg`);
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
