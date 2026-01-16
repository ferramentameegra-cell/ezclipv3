/**
 * CONFIGURAÇÃO COMPARTILHADA DE HEADLINE
 * Usada tanto no preview quanto no vídeo final gerado
 * Garante 100% de fidelidade WYSIWYG
 */

// Tornar disponível globalmente
(function() {
  'use strict';

// Tamanhos de fonte nominais
const HEADLINE_SIZES = {
  XS: 36,
  S: 48,
  M: 60,
  L: 72,
  XL: 96,
  XXL: 120
};

// Margens de segurança (em pixels) - 80px de cada lado
const HEADLINE_SAFE_MARGINS = {
  LEFT: 80,
  RIGHT: 80,
  SIDE: 80 // Alias para ambos os lados
};

// Largura do canvas (1080px vertical)
const CANVAS_WIDTH = 1080;

// Largura máxima do texto (canvas - margens laterais)
const MAX_TEXT_WIDTH = CANVAS_WIDTH - (HEADLINE_SAFE_MARGINS.LEFT + HEADLINE_SAFE_MARGINS.RIGHT);

// Mapeamento de nomes de fonte para caminhos do sistema (usado no FFmpeg)
const FONT_PATHS = {
  'Arial': {
    mac: '/System/Library/Fonts/Helvetica.ttc',
    linux: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    windows: 'C:/Windows/Fonts/arial.ttf'
  },
  'Inter': {
    mac: '/System/Library/Fonts/Supplemental/Inter.ttc',
    linux: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    windows: 'C:/Windows/Fonts/inter.ttf'
  },
  'Roboto': {
    mac: '/System/Library/Fonts/Supplemental/Roboto-Regular.ttf',
    linux: '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    windows: 'C:/Windows/Fonts/roboto.ttf'
  },
  'Montserrat': {
    mac: '/System/Library/Fonts/Supplemental/Montserrat-Regular.ttf',
    linux: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    windows: 'C:/Windows/Fonts/montserrat.ttf'
  }
};

// Mapeamento de estilos para peso da fonte
const FONT_WEIGHTS = {
  'bold': 700,
  'impact': 900,
  'modern': 600
};

// Espaçamento entre linhas (em relação ao tamanho da fonte)
const LINE_HEIGHT_RATIO = 1.2;

/**
 * Obter caminho da fonte baseado no sistema operacional
 */
function getFontPath(fontName, isProduction = false) {
  const fontConfig = FONT_PATHS[fontName] || FONT_PATHS['Arial'];
  
  // Detectar sistema operacional
  const isMac = typeof window !== 'undefined' ? 
    navigator.platform.toUpperCase().indexOf('MAC') >= 0 : 
    process.platform === 'darwin';
  
  if (isProduction) {
    // Em produção (Railway/Linux), usar caminho Linux
    return fontConfig.linux || '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
  } else if (isMac) {
    return fontConfig.mac || '/System/Library/Fonts/Helvetica.ttc';
  } else {
    return fontConfig.windows || fontConfig.linux || fontConfig.mac;
  }
}

/**
 * Obter peso da fonte baseado no estilo
 */
function getFontWeight(style = 'bold') {
  return FONT_WEIGHTS[style] || 700;
}

/**
 * Obter tamanho de fonte em pixels a partir do tamanho nominal
 */
function getFontSize(sizeName) {
  return HEADLINE_SIZES[sizeName] || HEADLINE_SIZES.M;
}

/**
 * Obter tamanho nominal a partir do valor em pixels
 */
function getSizeName(pixelSize) {
  for (const [name, size] of Object.entries(HEADLINE_SIZES)) {
    if (size === pixelSize) {
      return name;
    }
  }
  // Se não encontrar exato, retornar o mais próximo
  const sizes = Object.values(HEADLINE_SIZES);
  const closest = sizes.reduce((prev, curr) => 
    Math.abs(curr - pixelSize) < Math.abs(prev - pixelSize) ? curr : prev
  );
  return Object.keys(HEADLINE_SIZES).find(key => HEADLINE_SIZES[key] === closest) || 'M';
}

// Exportar globalmente
window.HeadlineConfig = {
  SIZES: HEADLINE_SIZES,
  SAFE_MARGINS: HEADLINE_SAFE_MARGINS,
  CANVAS_WIDTH: CANVAS_WIDTH,
  MAX_TEXT_WIDTH: MAX_TEXT_WIDTH,
  FONT_PATHS: FONT_PATHS,
  FONT_WEIGHTS: FONT_WEIGHTS,
  LINE_HEIGHT_RATIO: LINE_HEIGHT_RATIO,
  getFontPath: getFontPath,
  getFontWeight: getFontWeight,
  getFontSize: getFontSize,
  getSizeName: getSizeName
};

})();
