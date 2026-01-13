/**
 * PRESETS DE LEGENDAS
 * Estilos pré-configurados para uso rápido
 */

export const CAPTION_PRESETS = {
  classic: {
    name: 'Clássico',
    description: 'Estilo tradicional com fundo preto',
    font: 'Arial',
    fontSize: 64,
    color: '#FFFFFF',
    highlightColor: '#FFD700',
    strokeColor: '#000000',
    strokeWidth: 2,
    shadow: true,
    shadowBlur: 3,
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    shadowColor: '#000000',
    background: {
      enabled: true,
      color: '#000000',
      opacity: 0.7,
      padding: 12,
      borderRadius: 8
    },
    position: 'bottom',
    animation: 'fade'
  },
  modern: {
    name: 'Moderno',
    description: 'Estilo minimalista sem fundo',
    font: 'Inter',
    fontSize: 72,
    color: '#FFFFFF',
    highlightColor: '#00FF88',
    strokeColor: '#000000',
    strokeWidth: 3,
    shadow: true,
    shadowBlur: 5,
    shadowOffsetX: 3,
    shadowOffsetY: 3,
    shadowColor: '#000000',
    background: {
      enabled: false
    },
    position: 'bottom',
    animation: 'pop'
  },
  bold: {
    name: 'Bold',
    description: 'Texto grande e destacado',
    font: 'Arial',
    fontSize: 96,
    color: '#FFFFFF',
    highlightColor: '#FF6B6B',
    strokeColor: '#000000',
    strokeWidth: 4,
    shadow: true,
    shadowBlur: 8,
    shadowOffsetX: 4,
    shadowOffsetY: 4,
    shadowColor: '#000000',
    background: {
      enabled: true,
      color: '#FF0000',
      opacity: 0.8,
      padding: 20,
      borderRadius: 12
    },
    position: 'center',
    animation: 'pop'
  },
  minimal: {
    name: 'Minimal',
    description: 'Estilo discreto e elegante',
    font: 'Inter',
    fontSize: 48,
    color: '#FFFFFF',
    highlightColor: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 1,
    shadow: false,
    background: {
      enabled: false
    },
    position: 'bottom',
    animation: 'fade'
  },
  neon: {
    name: 'Neon',
    description: 'Estilo neon com brilho',
    font: 'Arial',
    fontSize: 80,
    color: '#00FFFF',
    highlightColor: '#FF00FF',
    strokeColor: '#000000',
    strokeWidth: 2,
    shadow: true,
    shadowBlur: 10,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    shadowColor: '#00FFFF',
    background: {
      enabled: true,
      color: '#000000',
      opacity: 0.5,
      padding: 15,
      borderRadius: 10
    },
    position: 'bottom',
    animation: 'fade'
  }
};

export const HEADLINE_PRESETS = {
  redBar: {
    name: 'Tarja Vermelha',
    description: 'Tarja vermelha no topo',
    font: 'Arial',
    fontSize: 72,
    color: '#FFFFFF',
    background: {
      enabled: true,
      color: '#FF0000',
      opacity: 0.9,
      height: 120,
      borderRadius: 0
    },
    position: 'top',
    animation: 'slide'
  },
  gradient: {
    name: 'Gradiente',
    description: 'Tarja com gradiente',
    font: 'Inter',
    fontSize: 80,
    color: '#FFFFFF',
    background: {
      enabled: true,
      color: '#FF6B6B',
      opacity: 0.85,
      height: 140,
      borderRadius: 0
    },
    position: 'top',
    animation: 'fade'
  },
  minimal: {
    name: 'Minimal',
    description: 'Headline discreta',
    font: 'Inter',
    fontSize: 56,
    color: '#FFFFFF',
    background: {
      enabled: false
    },
    position: 'top',
    animation: 'fade'
  }
};

/**
 * GET /api/captions/presets
 * Retorna lista de presets disponíveis
 */
export function getPresets() {
  return {
    captions: CAPTION_PRESETS,
    headlines: HEADLINE_PRESETS
  };
}
