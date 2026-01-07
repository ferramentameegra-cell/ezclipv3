/**
 * Sanitizar URL do YouTube
 * Remove parâmetros de playlist, radio, e outros que podem causar problemas
 */
export function sanitizeYouTubeUrl(url) {
  try {
    const urlObj = new URL(url.trim());
    
    // Remover parâmetros problemáticos
    const paramsToRemove = ['list', 'index', 't', 'start_radio', 'feature', 'si'];
    paramsToRemove.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    
    // Garantir que apenas o parâmetro 'v' (video ID) permanece
    const videoId = urlObj.searchParams.get('v');
    if (videoId) {
      // Reconstruir URL limpa
      const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
      console.log(`[SANITIZE] URL sanitizada: ${url} -> ${cleanUrl}`);
      return cleanUrl;
    }
    
    // Se for youtu.be, manter como está (já é limpo)
    if (urlObj.hostname === 'youtu.be') {
      return url.trim();
    }
    
    return url.trim();
  } catch (error) {
    console.warn(`[SANITIZE] Erro ao sanitizar URL, usando original: ${error.message}`);
    return url.trim();
  }
}

/**
 * Extrair video ID de URL do YouTube
 */
export function extractVideoId(url) {
  try {
    const urlObj = new URL(url.trim());
    
    // youtube.com/watch?v=VIDEO_ID
    if (urlObj.hostname.includes('youtube.com')) {
      return urlObj.searchParams.get('v');
    }
    
    // youtu.be/VIDEO_ID
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1);
    }
    
    // Fallback: regex
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/.*[?&]v=([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.trim().match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  } catch (error) {
    console.warn(`[EXTRACT] Erro ao extrair video ID: ${error.message}`);
    return null;
  }
}


