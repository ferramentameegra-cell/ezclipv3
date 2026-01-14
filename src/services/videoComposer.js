/**
 * VIDEO COMPOSER - Composição Final de Vídeo
 * 
 * Unifica todas as camadas em um único arquivo final 9:16 (1080x1920)
 * Layout:
 * - Vídeo principal (topo, ~75%)
 * - Legendas (burn-in, parte inferior do vídeo principal)
 * - Headline (zona central)
 * - Vídeo de retenção (parte inferior, ~12.5%)
 * - Background configurável
 * - Safe zones para TikTok/Reels/Shorts
 */

import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRetentionVideoPath, getRandomRetentionVideoPath } from './retentionVideoManager.js';
import { RETENTION_VIDEOS, NICHES } from '../models/niches.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===============================
// BACKGROUND FIXO (OBRIGATÓRIO)
// ===============================
/**
 * Obter caminho da imagem de background fixo
 * A imagem será aplicada como layer 0 em TODOS os vídeos gerados
 * 
 * @returns {string|null} - Caminho da imagem de background ou null se não encontrada
 */
function getFixedBackgroundPath() {
  // Tentar diferentes locais e extensões
  const possiblePaths = [
    // Em produção (Railway): /tmp/assets/backgrounds
    path.join('/tmp', 'assets', 'backgrounds', 'ezclip-background.png'),
    path.join('/tmp', 'assets', 'backgrounds', 'ezclip-background.jpg'),
    // Em desenvolvimento: assets/backgrounds na raiz
    path.join(__dirname, '../../assets/backgrounds/ezclip-background.png'),
    path.join(__dirname, '../../assets/backgrounds/ezclip-background.jpg'),
    // Fallback: variável de ambiente
    process.env.FIXED_BACKGROUND_PATH || null
  ].filter(p => p !== null);

  for (const bgPath of possiblePaths) {
    if (fs.existsSync(bgPath)) {
      console.log(`[COMPOSER] ✅ Background fixo encontrado: ${bgPath}`);
      return bgPath;
    }
  }

  console.warn(`[COMPOSER] ⚠️ Background fixo não encontrado. Usando cor sólida como fallback.`);
  console.warn(`[COMPOSER] Coloque a imagem em: assets/backgrounds/ezclip-background.png (1080x1920)`);
  return null;
}

// ===============================
// CONSTANTES DE LAYOUT (DINÂMICAS BASEADAS EM FORMATO)
// ===============================
function getFormatDimensions(format) {
  switch (format) {
    case '1:1':
      return { width: 1080, height: 1080 };
    case '16:9':
      return { width: 1920, height: 1080 };
    case '9:16':
    default:
      return { width: 1080, height: 1920 };
  }
}

function getSafeZones(format, platforms, safeMarginsPercent) {
  const { width, height } = getFormatDimensions(format);
  
  // Calcular margens baseadas em porcentagem
  const safeMarginTop = Math.round(height * (safeMarginsPercent / 100));
  const safeMarginBottom = Math.round(height * (safeMarginsPercent / 100));
  const safeMarginLeft = Math.round(width * (safeMarginsPercent / 100));
  const safeMarginRight = Math.round(width * (safeMarginsPercent / 100));
  
  // Ajustar baseado em plataformas (safe zones específicas)
  let platformAdjustment = { top: 0, bottom: 0 };
  if (platforms.tiktok) {
    platformAdjustment.top = Math.max(platformAdjustment.top, 120);
    platformAdjustment.bottom = Math.max(platformAdjustment.bottom, 200);
  }
  if (platforms.reels) {
    platformAdjustment.top = Math.max(platformAdjustment.top, 100);
    platformAdjustment.bottom = Math.max(platformAdjustment.bottom, 180);
  }
  if (platforms.shorts) {
    platformAdjustment.top = Math.max(platformAdjustment.top, 120);
    platformAdjustment.bottom = Math.max(platformAdjustment.bottom, 200);
  }
  
  return {
    top: Math.max(safeMarginTop, platformAdjustment.top),
    bottom: Math.max(safeMarginBottom, platformAdjustment.bottom),
    left: safeMarginLeft,
    right: safeMarginRight
  };
}

/**
 * Composição final do vídeo com todas as camadas
 * 
 * @param {Object} options - Opções de composição
 * @param {string} options.clipPath - Caminho do clip principal (já cortado)
 * @param {string} options.outputPath - Caminho de saída
 * @param {Array} options.captions - Array de legendas [{start, end, text, lines}]
 * @param {Object} options.captionStyle - Estilo das legendas
 * @param {Object} options.headline - Headline {text, startTime, endTime}
 * @param {Object} options.headlineStyle - Estilo da headline {font, fontSize, color, fontStyle}
 * @param {string} options.headlineText - Texto da headline
 * @param {string} options.retentionVideoId - ID do vídeo de retenção ('random', 'none' ou ID específico)
 * @param {string} options.nicheId - ID do nicho (para randomizar retenção)
 * @param {string} options.backgroundColor - Cor de fundo (hex, ex: '#000000')
 * @param {Function} options.onProgress - Callback de progresso (percent)
 * @returns {Promise<string>} - Caminho do arquivo final
 */
export async function composeFinalVideo({
  clipPath,
  outputPath,
  captions = [],
  captionStyle = {},
  headline = null,
  headlineStyle = {},
  headlineText = null,
  retentionVideoId = 'random',
  nicheId = null,
  backgroundColor = '#000000',
  format = '9:16',
  platforms = { tiktok: true, reels: true, shorts: true },
  safeMargins = 10,
  onProgress = null
}) {
  // Validações
  if (!fs.existsSync(clipPath)) {
    throw new Error(`Clip não encontrado: ${clipPath}`);
  }

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Obter vídeo de retenção
  let retentionVideoPath = null;
  if (retentionVideoId && retentionVideoId !== 'none') {
    // Se retentionVideoId começa com 'upload:', é um upload customizado
    if (retentionVideoId.startsWith('upload:')) {
      const uploadPath = retentionVideoId.replace('upload:', '');
      if (fs.existsSync(uploadPath)) {
        retentionVideoPath = uploadPath;
        console.log(`[COMPOSER] Usando vídeo de retenção customizado: ${uploadPath}`);
      }
    } else if (retentionVideoId === 'random' && nicheId) {
      const niche = NICHES[nicheId];
      if (niche && niche.retentionVideos && niche.retentionVideos.length > 0) {
        retentionVideoPath = getRandomRetentionVideoPath(niche.retentionVideos);
      }
    } else if (retentionVideoId !== 'random') {
      retentionVideoPath = getRetentionVideoPath(retentionVideoId);
    }

    // Verificar se é URL externa ou arquivo local
    if (retentionVideoPath) {
      const isUrl = retentionVideoPath.startsWith('http://') || retentionVideoPath.startsWith('https://');
      const isLocalFile = !isUrl && fs.existsSync(retentionVideoPath);
      
      if (!isUrl && !isLocalFile) {
        console.warn(`[COMPOSER] Vídeo de retenção não encontrado: ${retentionVideoId}, continuando sem retenção`);
        retentionVideoPath = null;
      } else if (isUrl) {
        console.log(`[COMPOSER] Usando URL externa de retenção: ${retentionVideoPath}`);
      }
    }
  }
  
  // Obter dimensões baseadas no formato
  const { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT } = getFormatDimensions(format);
  const safeZones = getSafeZones(format, platforms, safeMargins);
  
  // Calcular alturas baseadas no formato
  // LAYOUT VERTICAL 9:16 (1080x1920):
  // - Vídeo principal: topo (75% da altura)
  // - Headline: centro vertical
  // - Vídeo de retenção: parte inferior (12.5% da altura)
  let MAIN_VIDEO_HEIGHT, RETENTION_HEIGHT;
  if (format === '9:16') {
    MAIN_VIDEO_HEIGHT = Math.round(OUTPUT_HEIGHT * 0.75); // 75% do topo = 1440px
    RETENTION_HEIGHT = Math.round(OUTPUT_HEIGHT * 0.125); // 12.5% da parte inferior = 240px
  } else if (format === '1:1') {
    MAIN_VIDEO_HEIGHT = Math.round(OUTPUT_HEIGHT * 0.75);
    RETENTION_HEIGHT = Math.round(OUTPUT_HEIGHT * 0.125);
  } else { // 16:9
    MAIN_VIDEO_HEIGHT = Math.round(OUTPUT_HEIGHT * 0.75);
    RETENTION_HEIGHT = Math.round(OUTPUT_HEIGHT * 0.125);
  }
  
  console.log(`[COMPOSER] Layout vertical 9:16: ${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}`);
  console.log(`[COMPOSER] Vídeo principal: ${OUTPUT_WIDTH}x${MAIN_VIDEO_HEIGHT} (topo)`);
  console.log(`[COMPOSER] Vídeo retenção: ${OUTPUT_WIDTH}x${RETENTION_HEIGHT} (inferior)`);

  console.log(`[COMPOSER] Formato: ${format}`);
  console.log(`[COMPOSER] Layout: ${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}`);
  console.log(`[COMPOSER] Safe zones: top=${safeZones.top}px, bottom=${safeZones.bottom}px`);
  console.log(`[COMPOSER] Background: ${backgroundColor}`);

  return new Promise((resolve, reject) => {
    console.log(`[COMPOSER] Iniciando composição final ${format}...`);
    console.log(`[COMPOSER] Layout: ${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}`);
    console.log(`[COMPOSER] Background: ${backgroundColor}`);

    // Obter duração do vídeo principal
    ffmpeg.ffprobe(clipPath, (err, metadata) => {
      if (err) {
        return reject(new Error(`Erro ao obter metadados: ${err.message}`));
      }

      const videoDuration = metadata?.format?.duration || 60;
      const hasAudio = metadata?.streams?.some(s => s.codec_type === 'audio');
      const videoStream = metadata?.streams?.find(s => s.codec_type === 'video');

      console.log(`[COMPOSER] Duração: ${videoDuration}s`);
      console.log(`[COMPOSER] Resolução original: ${videoStream?.width}x${videoStream?.height}`);

      // Construir filter_complex como string (formato correto do FFmpeg)
      const filterParts = [];
      let currentLabel = '[0:v]';

      // 1. OBTER BACKGROUND FIXO PRIMEIRO (LAYER 0 - OBRIGATÓRIO)
      const fixedBackgroundPath = getFixedBackgroundPath();
      let backgroundInputIndex = null;
      let inputCount = 1; // clipPath é input 0
      
      if (fixedBackgroundPath) {
        // Background fixo será um input adicional
        backgroundInputIndex = inputCount;
        inputCount++;
        
        // Redimensionar background para 1080x1920 mantendo proporção (sem distorção)
        // force_original_aspect_ratio=increase garante que preencha todo o canvas
        // crop garante que não ultrapasse as dimensões
        filterParts.push(`[${backgroundInputIndex}:v]scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:force_original_aspect_ratio=increase[bg_scaled]`);
        filterParts.push(`[bg_scaled]crop=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}[bg_fixed]`);
        console.log(`[COMPOSER] Background fixo aplicado como layer 0`);
      } else {
        // Fallback: criar background sólido se imagem não existir
        filterParts.push(`color=c=${backgroundColor.replace('#', '')}:s=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:d=${videoDuration}[bg_fixed]`);
        console.log(`[COMPOSER] Usando background sólido (fallback)`);
      }

      // 2. Redimensionar vídeo principal para caber no topo (sem padding)
      // force_original_aspect_ratio=decrease garante que não distorça
      // Vídeo será redimensionado para caber em 1080x1440 (75% do topo)
      filterParts.push(`${currentLabel}scale=${OUTPUT_WIDTH}:${MAIN_VIDEO_HEIGHT}:force_original_aspect_ratio=decrease[main_scaled]`);
      currentLabel = '[main_scaled]';

      // 3. Sobrepor vídeo principal no background (TOPO, centralizado horizontalmente)
      // Vídeo fica acima do background (layer 1)
      // Posição: x=(W-w)/2 (centralizado horizontalmente), y=0 (topo)
      // O background aparecerá automaticamente nas áreas vazias (sem tarja preta)
      filterParts.push(`[bg_fixed][${currentLabel}]overlay=(W-w)/2:0[composed]`);
      currentLabel = '[composed]';
      console.log(`[COMPOSER] Vídeo principal posicionado no topo (y=0), centralizado horizontalmente`);

      // 4. Adicionar vídeo de retenção (se houver) - PARTE INFERIOR
      // IMPORTANTE: Ajustar índice do input baseado na presença do background
      if (retentionVideoPath) {
        // Se background existe, retention é input 2, senão é input 1
        const retentionInputIndex = fixedBackgroundPath ? 2 : 1;
        // Redimensionar vídeo de retenção para altura definida (12.5% = 240px)
        filterParts.push(`[${retentionInputIndex}:v]scale=${OUTPUT_WIDTH}:${RETENTION_HEIGHT}:force_original_aspect_ratio=increase[retention_scaled]`);
        filterParts.push(`[retention_scaled]crop=${OUTPUT_WIDTH}:${RETENTION_HEIGHT}[retention_cropped]`);
        // Posicionar na parte inferior: y = H - altura_retenção
        // Centralizar horizontalmente: x = (W-w)/2
        const retentionY = OUTPUT_HEIGHT - RETENTION_HEIGHT;
        filterParts.push(`${currentLabel}[retention_cropped]overlay=(W-w)/2:${retentionY}[with_retention]`);
        currentLabel = '[with_retention]';
        console.log(`[COMPOSER] Vídeo de retenção posicionado na parte inferior (y=${retentionY}), centralizado horizontalmente`);
      }

      // 6. Adicionar legendas (burn-in)
      if (captions && captions.length > 0) {
        captions.forEach((caption, index) => {
          const text = (caption.lines && caption.lines.length > 0) 
            ? caption.lines.join('\\n') 
            : (caption.text || '');
          
          const font = captionStyle.font || 'Arial';
          const fontSize = captionStyle.fontSize || 48;
          const color = captionStyle.color || '#FFFFFF';
          const strokeColor = captionStyle.strokeColor || '#000000';
          const strokeWidth = captionStyle.strokeWidth || 2;
          
          // Posição Y: acima da safe zone inferior (respeitando margens configuradas)
          const yPos = OUTPUT_HEIGHT - safeZones.bottom;

          const inputLabel = index === 0 ? currentLabel : `[caption_${index - 1}]`;
          const outputLabel = `[caption_${index}]`;
          
          filterParts.push(`${inputLabel}drawtext=fontfile='${getFontPath(font)}':text='${escapeText(text)}':fontsize=${fontSize}:fontcolor=${color}:borderw=${strokeWidth}:bordercolor=${strokeColor}:x=(w-text_w)/2:y=${yPos}:enable='between(t,${caption.start},${caption.end})'${outputLabel}`);
          
          currentLabel = outputLabel;
        });
      }

      // 5. Adicionar headline (CENTRO VERTICAL do frame)
      if (headlineText || (headline && headline.text)) {
        const headlineTextValue = headlineText || headline.text;
        const font = headlineStyle.font || headlineStyle.fontFamily || 'Arial';
        const fontSize = headlineStyle.fontSize || 72;
        const color = headlineStyle.color || '#FFFFFF';
        const startTime = headline?.startTime || 0;
        const endTime = headline?.endTime || Math.min(5, videoDuration);

        // Posição Y: centro vertical exato - meio do frame (960px em 1920px)
        // Usar (h-text_h)/2 para centralizar verticalmente considerando altura do texto
        // Centralizar horizontalmente: x=(w-text_w)/2
        const yPos = `(h-text_h)/2`;

        filterParts.push(`${currentLabel}drawtext=fontfile='${getFontPath(font)}':text='${escapeText(headlineTextValue)}':fontsize=${fontSize}:fontcolor=${color}:x=(w-text_w)/2:y=${yPos}:enable='between(t,${startTime},${endTime})'[final]`);
        currentLabel = '[final]';
        console.log(`[COMPOSER] Headline posicionada no centro vertical (y=(h-text_h)/2), centralizada horizontalmente`);
      } else {
        // Sem headline, apenas copiar para [final]
        filterParts.push(`${currentLabel}copy[final]`);
        currentLabel = '[final]';
      }
      
      // 8. Garantir que a saída final seja exatamente OUTPUT_WIDTH x OUTPUT_HEIGHT
      // O background já tem as dimensões corretas, então o overlay deve manter isso

      // Construir comando FFmpeg
      const command = ffmpeg();

      // Input 0: vídeo principal
      command.input(clipPath);

      // Input 1: Background fixo (se existir) - LAYER 0
      if (fixedBackgroundPath) {
        command.input(fixedBackgroundPath);
        console.log(`[COMPOSER] Background fixo adicionado como input 1: ${fixedBackgroundPath}`);
      }

      // Input 2 (ou 1 se não houver background): vídeo de retenção (se houver)
      if (retentionVideoPath) {
        command.input(retentionVideoPath);
        console.log(`[COMPOSER] Vídeo de retenção adicionado como input ${fixedBackgroundPath ? 2 : 1}`);
      }

      // Aplicar filter_complex como string
      const filterComplex = filterParts.join(';');
      console.log('[COMPOSER] Filter complex:', filterComplex.substring(0, 300) + '...');
      
      command.complexFilter(filterComplex);

      // Mapear saída e configurar codecs
      // O filter_complex já garante a resolução 1080x1920, então não precisamos de -s ou -vf adicionais
      const outputOptions = [
        '-map', '[final]',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart'
      ];

      // Adicionar áudio se existir
      if (hasAudio) {
        outputOptions.push('-map', '0:a?', '-c:a', 'aac', '-b:a', '128k');
      }

      // Shortest para garantir que termine quando o vídeo mais curto terminar
      if (retentionVideoPath) {
        outputOptions.push('-shortest');
      }

      command.outputOptions(outputOptions);

      // Configurar saída - NÃO usar .size() ou .aspect() pois o filter_complex já define isso
      command
        .on('start', (cmdline) => {
          console.log('[COMPOSER] Comando iniciado');
          console.log(`[COMPOSER] Saída: ${OUTPUT_WIDTH}x${OUTPUT_HEIGHT} (${format})`);
          console.log('[COMPOSER] Headline: centralizada verticalmente');
          console.log(`[COMPOSER] Safe zones: topo ${safeZones.top}px, rodapé ${safeZones.bottom}px`);
        })
        .on('progress', (progress) => {
          if (progress.percent !== undefined && progress.percent !== null) {
            const percent = Math.min(100, Math.max(0, Math.round(progress.percent)));
            if (onProgress) {
              onProgress(percent);
            }
            console.log(`[COMPOSER] Progresso: ${percent}%`);
          }
        })
        .on('end', () => {
          if (!fs.existsSync(outputPath)) {
            return reject(new Error('Arquivo de saída não foi criado'));
          }

          const stats = fs.statSync(outputPath);
          if (stats.size === 0) {
            return reject(new Error('Arquivo de saída está vazio'));
          }

          // Validar resolução do arquivo gerado
          ffmpeg.ffprobe(outputPath, (probeErr, probeData) => {
            if (!probeErr) {
              const outputStream = probeData?.streams?.find(s => s.codec_type === 'video');
              if (outputStream) {
                console.log(`[COMPOSER] Resolução de saída: ${outputStream.width}x${outputStream.height}`);
                if (outputStream.width !== OUTPUT_WIDTH || outputStream.height !== OUTPUT_HEIGHT) {
                  console.warn(`[COMPOSER] ⚠️ Resolução não corresponde ao esperado! Esperado: ${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}, Obtido: ${outputStream.width}x${outputStream.height}`);
                } else {
                  console.log(`[COMPOSER] ✅ Resolução correta: ${OUTPUT_WIDTH}x${OUTPUT_HEIGHT} (${format})`);
                }
              }
            }
          });

          console.log(`[COMPOSER] ✅ Composição concluída: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('[COMPOSER] Erro:', err.message);
          reject(err);
        })
        .save(outputPath);
    });
  });
}

// ===============================
// UTILITÁRIOS
// ===============================

function escapeText(text) {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\n/g, '\\n');
}

function getFontPath(fontName) {
  // Mapear fontes comuns para caminhos do sistema
  const fontMap = {
    'Arial': '/System/Library/Fonts/Helvetica.ttc',
    'Inter': '/System/Library/Fonts/Supplemental/Inter.ttc',
    'Roboto': '/System/Library/Fonts/Supplemental/Roboto-Regular.ttf',
    'Montserrat': '/System/Library/Fonts/Supplemental/Montserrat-Regular.ttf'
  };

  // Tentar encontrar fonte mapeada
  if (fontMap[fontName]) {
    return fontMap[fontName];
  }

  // Fallback para fonte padrão do sistema
  return '/System/Library/Fonts/Helvetica.ttc';
}

export default composeFinalVideo;
