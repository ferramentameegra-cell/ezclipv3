/**
 * RENDERIZADOR DE LEGENDAS COM FFMPEG
 * 
 * Converte configurações visuais em comandos FFmpeg drawtext
 * Suporta: fonte, cor, stroke, shadow, background, animações
 */

import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

/**
 * Gera filtro drawtext para uma legenda
 */
function generateDrawtextFilter(caption, style, index, totalCaptions) {
  const {
    start,
    end,
    text,
    lines = [],
    highlight = []
  } = caption;

  const {
    font = 'Arial',
    fontSize = 64,
    color = '#FFFFFF',
    highlightColor = '#FFD700',
    strokeColor = '#000000',
    strokeWidth = 2,
    shadow = true,
    shadowBlur = 3,
    shadowOffsetX = 2,
    shadowOffsetY = 2,
    shadowColor = '#000000',
    background = {
      enabled: true,
      color: '#000000',
      opacity: 0.6,
      padding: 10,
      borderRadius: 8
    },
    position = 'bottom',
    animation = 'fade'
  } = style;

  // Usar linhas se disponível, senão usar texto completo
  const displayText = lines.length > 0 ? lines.join('\\n') : text;

  // Posição vertical
  let yPosition = 'h-th-60'; // bottom por padrão
  if (position === 'center') {
    yPosition = '(h-text_h)/2';
  } else if (position === 'top') {
    yPosition = '60';
  }

  // Posição horizontal (centralizado)
  const xPosition = '(w-text_w)/2';

  // Cor do texto com highlight
  let textColor = color;
  if (highlight.length > 0) {
    // FFmpeg não suporta cores diferentes na mesma linha facilmente
    // Usaremos a cor de highlight se houver palavras destacadas
    textColor = highlightColor;
  }

  // Background box
  let boxFilter = '';
  if (background.enabled) {
    const bgColor = hexToRgba(background.color, background.opacity);
    boxFilter = `:box=1:boxcolor=${bgColor}:boxborderw=${background.padding}`;
  }

  // Stroke (contorno)
  const strokeFilter = strokeWidth > 0 
    ? `:borderw=${strokeWidth}:bordercolor=${strokeColor}`
    : '';

  // Shadow (sombra)
  let shadowFilter = '';
  if (shadow) {
    shadowFilter = `:shadowcolor=${shadowColor}:shadowx=${shadowOffsetX}:shadowy=${shadowOffsetY}`;
  }

  // Animação
  let animationFilter = '';
  if (animation === 'fade') {
    const fadeIn = `alpha='if(lt(t,${start}),0,if(lt(t,${start + 0.3}),((t-${start})/0.3),1))'`;
    const fadeOut = `alpha='if(gt(t,${end - 0.3}),if(lt(t,${end}),((t-${end})/-0.3),0),1)'`;
    animationFilter = `:enable='between(t,${start},${end})'`;
  } else if (animation === 'pop') {
    // Efeito de escala
    animationFilter = `:enable='between(t,${start},${end})'`;
  }

  // Montar filtro completo
  const fontPath = getFontPath(font);
  const filter = `drawtext=fontfile='${fontPath}':text='${escapeText(displayText)}':fontsize=${fontSize}:fontcolor=${textColor}${strokeFilter}${shadowFilter}${boxFilter}:x=${xPosition}:y=${yPosition}${animationFilter}`;

  return {
    filter,
    start,
    end
  };
}

/**
 * Gera filtro para headline
 */
function generateHeadlineFilter(headline, style, videoDuration) {
  if (!headline || !headline.text) {
    return null;
  }

  const {
    text,
    startTime = 0,
    endTime = Math.min(5, videoDuration) // 5 segundos por padrão
  } = headline;

  const {
    font = 'Arial',
    fontSize = 72,
    color = '#FFFFFF',
    background = {
      enabled: true,
      color: '#FF0000',
      opacity: 0.9,
      height: 120,
      borderRadius: 0
    },
    position = 'top',
    animation = 'slide'
  } = style;

  // Posição vertical
  let yPosition = '60'; // top por padrão
  if (position === 'center') {
    yPosition = '(h-text_h)/2';
  } else if (position === 'bottom') {
    yPosition = 'h-th-60';
  }

  // Posição horizontal (centralizado)
  const xPosition = '(w-text_w)/2';

  // Background box (tarja)
  let boxFilter = '';
  if (background.enabled) {
    const bgColor = hexToRgba(background.color, background.opacity);
    const boxHeight = background.height || 120;
    boxFilter = `:box=1:boxcolor=${bgColor}:boxborderw=20`;
  }

  // Animação
  let animationFilter = '';
  if (animation === 'slide') {
    // Slide de cima para baixo
    animationFilter = `:enable='between(t,${startTime},${endTime})'`;
  } else if (animation === 'fade') {
    animationFilter = `:enable='between(t,${startTime},${endTime})'`;
  }

  const fontPath = getFontPath(font);
  const filter = `drawtext=fontfile='${fontPath}':text='${escapeText(text)}':fontsize=${fontSize}:fontcolor=${color}${boxFilter}:x=${xPosition}:y=${yPosition}${animationFilter}`;

  return {
    filter,
    start: startTime,
    end: endTime
  };
}

/**
 * Renderiza vídeo com legendas e headline
 */
export async function renderVideoWithCaptions(inputPath, outputPath, captions, style, headline = null) {
  return new Promise((resolve, reject) => {
    console.log('[RENDER] Iniciando renderização com legendas...');

    // Validar entrada
    if (!fs.existsSync(inputPath)) {
      return reject(new Error('Arquivo de vídeo não encontrado'));
    }

    // Garantir diretório de saída
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Gerar filtros para legendas
    const captionFilters = captions.map((caption, index) => 
      generateDrawtextFilter(caption, style, index, captions.length)
    );

    // Gerar filtro para headline
    let headlineFilter = null;
    if (headline) {
      // Obter duração do vídeo primeiro
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          console.warn('[RENDER] Erro ao obter duração, usando padrão');
        }
        const duration = metadata?.format?.duration || 60;
        headlineFilter = generateHeadlineFilter(headline, style.headline || {}, duration);
      });
    }

    // Combinar todos os filtros
    const allFilters = [];
    
    // Adicionar headline primeiro (se houver)
    if (headlineFilter) {
      allFilters.push(headlineFilter.filter);
    }

    // Adicionar legendas
    captionFilters.forEach(captionFilter => {
      allFilters.push(captionFilter.filter);
    });

    // Criar comando FFmpeg
    let command = ffmpeg(inputPath);

    // Aplicar filtros complexos
    if (allFilters.length > 0) {
      // Usar filter_complex para múltiplos drawtext
      const filterComplex = allFilters.join(',');
      command = command.complexFilter(filterComplex);
    }

    // Configurações de saída
    command
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-preset medium',
        '-crf 23',
        '-pix_fmt yuv420p',
        '-movflags +faststart'
      ])
      .size('1080x1920') // Formato Reels/Shorts
      .on('start', (cmdline) => {
        console.log('[RENDER] Comando FFmpeg:', cmdline);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`[RENDER] Progresso: ${Math.round(progress.percent)}%`);
        }
      })
      .on('end', () => {
        console.log('[RENDER] ✅ Renderização concluída');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('[RENDER] Erro na renderização:', err);
        reject(err);
      })
      .save(outputPath);
  });
}

/**
 * Utilitários
 */
function hexToRgba(hex, opacity = 1) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `0x${Math.round(r * opacity).toString(16).padStart(2, '0')}${Math.round(g * opacity).toString(16).padStart(2, '0')}${Math.round(b * opacity).toString(16).padStart(2, '0')}`;
}

function escapeText(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

function getFontPath(fontName) {
  // Mapear fontes comuns para caminhos do sistema
  const fontMap = {
    'Arial': '/System/Library/Fonts/Helvetica.ttc',
    'Inter': '/System/Library/Fonts/Supplemental/Inter.ttc',
    'Roboto': '/System/Library/Fonts/Supplemental/Roboto-Regular.ttf'
  };

  // Se for uma fonte do Google Fonts, tentar encontrar localmente
  if (fontMap[fontName]) {
    return fontMap[fontName];
  }

  // Fallback para fonte padrão do sistema
  return '/System/Library/Fonts/Helvetica.ttc';
}

export { generateDrawtextFilter, generateHeadlineFilter };
