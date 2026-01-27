/**
 * CONFIGURAÇÃO DE VÍDEOS DE RETENÇÃO POR NICHO
 * 
 * Este arquivo contém a lista de vídeos de retenção pré-definidos organizados por nicho.
 * Os vídeos serão baixados automaticamente do YouTube e processados em clipes de 60 segundos.
 * 
 * IMPORTANTE: Os vídeos de retenção NÃO terão áudio (serão processados sem faixa de áudio).
 */

export const retentionVideosByNiche = {
  podcast: [
    { id: 'prensa-hidraulica', url: 'https://www.youtube.com/watch?v=5HYs06bAEdc' },
    { id: 'prensa-hidraulica-1', url: 'https://www.youtube.com/watch?v=boDnPvIMyek' },
    { id: 'prensa-hidraulica-2', url: 'https://www.youtube.com/watch?v=sVOz-0ce12E' },
    { id: 'satisfatorio-1', url: 'https://www.youtube.com/watch?v=KCMf3a1XEo0' },
    { id: 'areia-1', url: 'https://www.youtube.com/watch?v=31ZpyOrXcoQ' },
  ],
  tech: [
    { id: 'sabonete-1', url: 'https://www.youtube.com/watch?v=oyzxo-nSOYk' },
    { id: 'natureza-1', url: 'https://www.youtube.com/watch?v=mBprct8tbG8' },
    { id: 'areia-tech-1', url: 'https://www.youtube.com/watch?v=qXiiDrX9WVk' },
  ],
  default: [
    // Vídeos padrão caso o nicho não seja encontrado
    { id: 'default-satisfatorio', url: 'https://www.youtube.com/watch?v=KCMf3a1XEo0' },
  ],
};

/**
 * Obter lista de vídeos de retenção para um nicho específico
 * 
 * @param {string} niche - ID do nicho (ex: 'podcast', 'tech')
 * @returns {Array} - Array de objetos { id, url }
 */
export function getRetentionVideosForNiche(niche) {
  if (!niche || typeof niche !== 'string') {
    return retentionVideosByNiche.default || [];
  }
  
  return retentionVideosByNiche[niche] || retentionVideosByNiche.default || [];
}

/**
 * Verificar se um nicho tem vídeos de retenção configurados
 * 
 * @param {string} niche - ID do nicho
 * @returns {boolean} - true se o nicho tem vídeos configurados
 */
export function hasRetentionVideos(niche) {
  const videos = getRetentionVideosForNiche(niche);
  return videos && videos.length > 0;
}
