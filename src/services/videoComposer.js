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
// Sistema antigo de retenção removido - usar apenas retentionManager
import { getRetentionClip } from './retentionManager.js';
import { STORAGE_CONFIG } from '../config/storage.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Timeout em segundos para composição (evitar travamento indefinido) */
const FFMPEG_COMPOSE_TIMEOUT = parseInt(process.env.FFMPEG_COMPOSE_TIMEOUT || '300', 10);

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

  console.log(`[COMPOSER] Procurando background fixo nos seguintes caminhos:`);
  for (const bgPath of possiblePaths) {
    console.log(`[COMPOSER]   - ${bgPath} ${fs.existsSync(bgPath) ? '✅ EXISTE' : '❌ não existe'}`);
    if (fs.existsSync(bgPath)) {
      console.log(`[COMPOSER] ✅ Background fixo encontrado: ${bgPath}`);
      return bgPath;
    }
  }

  console.warn(`[COMPOSER] ⚠️ Background fixo não encontrado. Usando cor sólida como fallback.`);
  console.warn(`[COMPOSER] Coloque a imagem em: assets/backgrounds/ezclip-background.png (1080x1920)`);
  console.warn(`[COMPOSER] Ou em: /tmp/assets/backgrounds/ezclip-background.png (Railway)`);
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
 * Quebra as linhas da headline para caber na largura (margens laterais).
 * @param {string[]} rawLines - Linhas já divididas por \n
 * @param {number} maxCharsPerLine - Máximo de caracteres por linha
 * @returns {string[]} Linhas prontas para drawtext
 */
function wrapHeadlineToFitWidth(rawLines, maxCharsPerLine) {
  const out = [];
  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.length <= maxCharsPerLine) {
      out.push(trimmed);
      continue;
    }
    const words = trimmed.split(/\s+/);
    let current = '';
    for (const word of words) {
      const withWord = current ? current + ' ' + word : word;
      if (withWord.length <= maxCharsPerLine) {
        current = withWord;
      } else {
        if (current) out.push(current);
        if (word.length > maxCharsPerLine) {
          for (let i = 0; i < word.length; i += maxCharsPerLine) {
            out.push(word.slice(i, i + maxCharsPerLine));
          }
          current = '';
        } else {
          current = word;
        }
      }
    }
    if (current) out.push(current);
  }
  return out;
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
 * @param {number} options.clipNumber - Número do clipe atual (1-based)
 * @param {number} options.totalClips - Total de clipes gerados
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
  headlineStrokeColor = '#000000',
  headlineFontSize = 'medium',
  headlineTitlePosition = 'center',
  headlineTarjaSuperiorSize = null,
  headlineTarjaInferiorSize = null,
  headlineTarjaCentralSize = null,
  headlineTarjaSuperiorColor = null,
  headlineTarjaInferiorColor = null,
  headlineTarjaCentralColor = null,
  retentionVideoId = 'random',
  nicheId = null,
  backgroundColor = '#000000',
  format = '9:16', // FORMATO FIXO: Sempre 9:16 (1080x1920) vertical - IGNORAR parâmetro recebido
  platforms = { tiktok: true, reels: true, shorts: true },
  safeMargins = 10,
  clipNumber = null,
  totalClips = null,
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

  // Obter vídeo de retenção usando APENAS o novo sistema retentionManager
  // Sistema antigo foi completamente removido
  // TESTE 4: Validar Sistema de Retenção Unificado
  let retentionVideoPath = null;
  
  // Se há nicheId e retenção não foi desabilitada, usar o sistema de retenção por nicho
  if (nicheId && retentionVideoId !== 'none') {
    console.log(`[RETENTION] ========================================`);
    console.log(`[RETENTION] Usando retentionManager (sistema unificado)`);
    console.log(`[RETENTION] Nicho: ${nicheId}`);
    console.log(`[RETENTION] ========================================`);
    console.log(`[COMPOSER] 📥 Obtendo clipe de retenção do nicho: ${nicheId}`);
    try {
      // ✅ CORREÇÃO: Validar totalClips antes de passar para getRetentionClip
      // Garantir que totalClips é um número válido (> 0)
      // Se não for válido, passar null para usar o fallback (60s por clipe)
      const validTotalClips = (typeof totalClips === 'number' && totalClips > 0) ? totalClips : null;
      
      console.log(`[COMPOSER] 📊 totalClips recebido: ${totalClips} (tipo: ${typeof totalClips})`);
      console.log(`[COMPOSER] 📊 validTotalClips a passar: ${validTotalClips}`);
      
      // getRetentionClip faz todo o trabalho: download, processamento em clipes, seleção aleatória
      // Passar totalClips VALIDADO para sincronizar clipes de retenção com o vídeo principal
      retentionVideoPath = await getRetentionClip(nicheId, validTotalClips);
      
      if (retentionVideoPath && fs.existsSync(retentionVideoPath)) {
        const stats = fs.statSync(retentionVideoPath);
        if (stats.size > 0) {
          console.log(`[RETENTION] ✅ Vídeo de retenção obtido: ${retentionVideoPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
          console.log(`[COMPOSER] ✅ Clipe de retenção obtido do nicho ${nicheId}: ${retentionVideoPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        } else {
          console.warn(`[RETENTION] ⚠️ Nenhum vídeo de retenção disponível para o nicho (arquivo vazio)`);
          console.warn(`[COMPOSER] ⚠️ Clipe de retenção está vazio, continuando sem retenção.`);
          retentionVideoPath = null;
        }
      } else {
        console.warn(`[RETENTION] ⚠️ Nenhum vídeo de retenção disponível para o nicho`);
        console.warn(`[COMPOSER] ⚠️ Nenhum vídeo de retenção disponível para o nicho ${nicheId}, continuando sem.`);
        retentionVideoPath = null;
      }
    } catch (error) {
      console.error(`[RETENTION] ❌ Erro ao obter clipe de retenção: ${error.message}`);
      console.error(`[COMPOSER] ❌ Erro ao obter clipe de retenção do nicho: ${error.message}`);
      console.error(`[COMPOSER] Continuando sem vídeo de retenção.`);
      retentionVideoPath = null; // Continuar sem vídeo de retenção
    }
  } else if (retentionVideoId === 'none') {
    console.log(`[RETENTION] Vídeo de retenção desabilitado (retentionVideoId='none')`);
    console.log(`[COMPOSER] Vídeo de retenção desabilitado (retentionVideoId='none')`);
  } else if (!nicheId) {
    console.warn(`[RETENTION] ⚠️ Nenhum nicheId fornecido, não é possível obter vídeo de retenção.`);
    console.warn(`[COMPOSER] ⚠️ Nenhum nicheId fornecido, não é possível obter vídeo de retenção.`);
  }
  
  // FORMATO FIXO: Sempre 9:16 (1080x1920) vertical para todos os vídeos gerados
  // Garantir que o formato seja sempre 9:16, independente do parâmetro recebido
  // HARDCODED: Sempre usar 1080x1920
  const finalFormat = '9:16';
  const OUTPUT_WIDTH = 1080; // HARDCODED - sempre 1080
  const OUTPUT_HEIGHT = 1920; // HARDCODED - sempre 1920
  const safeZones = getSafeZones(finalFormat, platforms, safeMargins);
  
  console.log(`[COMPOSER] ⚠️ FORMATO FORÇADO: 9:16 (1080x1920) - formato recebido: ${format} foi IGNORADO`);
  console.log(`[COMPOSER] ✅ Dimensões HARDCODED: ${OUTPUT_WIDTH}x${OUTPUT_HEIGHT} (vertical)`);
  
  console.log(`[COMPOSER] Formato: ${format} (IGNORADO - sempre 9:16)`);
  console.log(`[COMPOSER] Layout: 1080x1920 (HARDCODED - sempre vertical)`);
  console.log(`[COMPOSER] Safe zones: top=${safeZones.top}px, bottom=${safeZones.bottom}px`);
  console.log(`[COMPOSER] Background: ${backgroundColor}`);

  return new Promise(async (resolve, reject) => {
    console.log(`[COMPOSER] Iniciando composição final 9:16 (1080x1920)...`);
    console.log(`[COMPOSER] Layout: 1080x1920 (HARDCODED - sempre vertical)`);
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
      console.log(`[COMPOSER] Áudio: ${hasAudio ? 'Sim' : 'Não'}`);
      console.log(`[COMPOSER] Vídeo: ${videoStream?.width}x${videoStream?.height}`);

      // ============================================
      // LAYOUT FORÇADO 9:16 (1080x1920) - HARDCODED
      // ============================================

      // Dimensões FIXAS: clipe 1080x1920; vídeo principal e retenção em 16:9; headline ao centro
      const CANVAS_WIDTH = 1080;
      const CANVAS_HEIGHT = 1920;
      const VIDEO_WIDTH = 1080;
      const VIDEO_HEIGHT = 608;    // 16:9
      const VIDEO_Y_TOP = 180;
      const VIDEO_Y_BOTTOM = 1172;
      const HEADLINE_MARGIN_PX = 80;

      let filterComplex = [];

      // Obter background
      const bgPath = getFixedBackgroundPath();
      let currentLabel = '[0:v]';
      let inputCount = 1; // Começar em 1 porque 0 é o vídeo principal

      // 1. Background (input 1) - Escala e corta para 1080x1920
      if (bgPath && fs.existsSync(bgPath)) {
        filterComplex.push(`[${inputCount}:v]scale=${CANVAS_WIDTH}:${CANVAS_HEIGHT}:force_original_aspect_ratio=increase,crop=${CANVAS_WIDTH}:${CANVAS_HEIGHT}[bg_fixed]`);
        currentLabel = '[bg_fixed]';
        inputCount++;
      } else {
        // Fallback: cor sólida
        filterComplex.push(`color=${backgroundColor}:s=${CANVAS_WIDTH}x${CANVAS_HEIGHT}:d=${videoDuration}[bg_fixed]`);
        currentLabel = '[bg_fixed]';
      }

      // 2. Vídeo Principal (input 0) - 1080x608 (16:9), fit sem distorção
      filterComplex.push(`[0:v]scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=decrease,pad=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:(${VIDEO_WIDTH}-iw)/2:(${VIDEO_HEIGHT}-ih)/2[main_scaled]`);

      // 3. Overlay do Vídeo Principal sobre o Background
      filterComplex.push(`${currentLabel}[main_scaled]overlay=(W-w)/2:${VIDEO_Y_TOP}[composed]`);
      currentLabel = '[composed]';

      // Tarjas e headline (mesmo padrão do gerador de thumbnails)
      const TARJA_PERCENT = { 1: 0.05, 2: 0.15, 3: 0.25, 4: 0.5 };
      const FONT_SIZE_MAP = { xs: 36, small: 48, medium: 72, large: 96, xl: 120 };
      const tarjaTopH = (headlineTarjaSuperiorSize >= 1 && headlineTarjaSuperiorSize <= 4) ? Math.round(CANVAS_HEIGHT * (TARJA_PERCENT[headlineTarjaSuperiorSize] || 0.05)) : 0;
      const tarjaBottomH = (headlineTarjaInferiorSize >= 1 && headlineTarjaInferiorSize <= 4) ? Math.round(CANVAS_HEIGHT * (TARJA_PERCENT[headlineTarjaInferiorSize] || 0.05)) : 0;
      const tarjaCenterH = (headlineTarjaCentralSize >= 1 && headlineTarjaCentralSize <= 4) ? Math.round(CANVAS_HEIGHT * (TARJA_PERCENT[headlineTarjaCentralSize] || 0.05)) : 0;
      const hexToFfmpeg = (hex) => {
        if (!hex || typeof hex !== 'string') return '0x000000';
        const h = hex.replace(/^#/, '');
        if (/^[0-9A-Fa-f]{6}$/.test(h)) return '0x' + h;
        return '0x000000';
      };
      if (tarjaTopH > 0 && headlineTarjaSuperiorColor) {
        filterComplex.push(`${currentLabel}drawbox=x=0:y=0:w=${CANVAS_WIDTH}:h=${tarjaTopH}:color=${hexToFfmpeg(headlineTarjaSuperiorColor)}@0.92:t=fill[with_tarja_top]`);
        currentLabel = '[with_tarja_top]';
      }
      if (tarjaCenterH > 0 && headlineTarjaCentralColor) {
        const centerY = Math.round((CANVAS_HEIGHT - tarjaCenterH) / 2);
        filterComplex.push(`${currentLabel}drawbox=x=0:y=${centerY}:w=${CANVAS_WIDTH}:h=${tarjaCenterH}:color=${hexToFfmpeg(headlineTarjaCentralColor)}@0.92:t=fill[with_tarja_center]`);
        currentLabel = '[with_tarja_center]';
      }
      if (tarjaBottomH > 0 && headlineTarjaInferiorColor) {
        filterComplex.push(`${currentLabel}drawbox=x=0:y=${CANVAS_HEIGHT - tarjaBottomH}:w=${CANVAS_WIDTH}:h=${tarjaBottomH}:color=${hexToFfmpeg(headlineTarjaInferiorColor)}@0.92:t=fill[with_tarja_bottom]`);
        currentLabel = '[with_tarja_bottom]';
      }
      const safeFontSize = FONT_SIZE_MAP[headlineFontSize] || headlineStyle.fontSize || 72;
      const textColor = headlineStyle.color || '#FFFFFF';
      const strokeCol = headlineStrokeColor || headlineStyle.strokeColor || '#000000';
      const posKey = (headlineTitlePosition || 'center').toLowerCase();
      if (headlineText && headlineText.trim()) {
        const rawLines = String(headlineText).trim().split(/\r?\n/).filter(Boolean);
        const maxTextWidthPx = CANVAS_WIDTH - 2 * HEADLINE_MARGIN_PX;
        const maxCharsPerLine = Math.max(10, Math.floor(maxTextWidthPx / (safeFontSize * 0.52)));
        const lines = wrapHeadlineToFitWidth(rawLines, maxCharsPerLine);
        const lineHeight = Math.round(safeFontSize * 1.25);
        let textBlockH = lines.length * lineHeight + 20;
        let textTopY;
        if (posKey === 'top') {
          textTopY = tarjaTopH > 0 ? Math.round(tarjaTopH / 2 - textBlockH / 2) : 120;
          textTopY = Math.max(20, textTopY);
        } else if (posKey === 'bottom') {
          textTopY = tarjaBottomH > 0 ? CANVAS_HEIGHT - tarjaBottomH - Math.round(tarjaBottomH / 2 + textBlockH / 2) : CANVAS_HEIGHT - textBlockH - 80;
          textTopY = Math.min(CANVAS_HEIGHT - textBlockH - 20, Math.max(20, textTopY));
        } else {
          textTopY = Math.round((CANVAS_HEIGHT - textBlockH) / 2);
        }
        const escapeT = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        let headLabel = currentLabel;
        for (let i = 0; i < lines.length; i++) {
          const y = textTopY + i * lineHeight + Math.round(safeFontSize * 0.35);
          const outLabel = i === lines.length - 1 ? '[with_headline]' : `[headline_${i}]`;
          const fc = textColor.startsWith('#') ? textColor.slice(1) : textColor;
          const sc = strokeCol.startsWith('#') ? strokeCol.slice(1) : strokeCol;
          filterComplex.push(
            `${headLabel}drawtext=fontfile='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf':text='${escapeT(lines[i])}':fontsize=${safeFontSize}:fontcolor=0x${fc}:borderw=3:bordercolor=0x${sc}:x=(w-text_w)/2:y=${y}${outLabel}`
          );
          headLabel = outLabel;
        }
        if (lines.length > 0) currentLabel = '[with_headline]';
      }

      // 5. Vídeo de Retenção (input 2 ou mais) - 1080x608 (16:9), fit sem distorção
      if (retentionVideoPath && fs.existsSync(retentionVideoPath)) {
        filterComplex.push(`[${inputCount}:v]scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=decrease,pad=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:(${VIDEO_WIDTH}-iw)/2:(${VIDEO_HEIGHT}-ih)/2[retention_scaled]`);

        // 6. Overlay do Vídeo de Retenção
        filterComplex.push(
          `${currentLabel}[retention_scaled]overlay=(W-w)/2:${VIDEO_Y_BOTTOM}:shortest=1[with_retention]`
        );
        currentLabel = '[with_retention]';
        inputCount++;
      }

      // 7. Adicionar Contador "Parte X/Y" (se existir)
      if (clipNumber && totalClips) {
        filterComplex.push(
          `${currentLabel}drawtext=fontfile='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf':` +
          `text='Parte ${clipNumber}/${totalClips}':fontsize=48:fontcolor=#FFFFFF:` +
          `borderw=3:bordercolor=#000000:x=(w-text_w-80):y=80[with_counter]`
        );
        currentLabel = '[with_counter]';
      }

      // 8. Final - Forçar 1080x1920
      filterComplex.push(`${currentLabel}scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(1080-iw)/2:(1920-ih)/2[final]`);

      // Construir a string final
      const filterComplexString = filterComplex.join(';');

      console.log(`[DIAG-FINAL-LAYOUT] Filter Complex String: ${filterComplexString}`);
      console.log(`[DIAG-FINAL-LAYOUT] Contém [final]? ${filterComplexString.includes('[final]') ? 'SIM' : 'NÃO'}`);

      // Construir comando FFmpeg
      let command = ffmpeg(clipPath, { timeout: FFMPEG_COMPOSE_TIMEOUT });

      // Adicionar inputs
      if (bgPath && fs.existsSync(bgPath)) {
        command = command.input(bgPath);
      }

      if (retentionVideoPath && fs.existsSync(retentionVideoPath)) {
        command = command.input(retentionVideoPath);
      }

      // Aplicar filter_complex
      command
        .complexFilter(filterComplexString)
        .outputOptions([
          '-map', '[final]',
          '-map', '0:a?',
          '-s', '1080x1920',
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-preset', 'veryfast',
          '-crf', '23',
          '-pix_fmt', 'yuv420p',
          '-shortest',
          '-movflags', '+faststart',
          '-y'
        ])
        .output(outputPath)
        .on('progress', (progress) => {
          const percent = Math.round((progress.frames / (videoDuration * 30)) * 100);
          if (onProgress) onProgress(Math.min(percent, 99));
        })
        .on('end', () => {
          console.log(`[COMPOSER] ✅ Composição concluída: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error(`[COMPOSER] ❌ Erro na composição: ${err.message}`);
          reject(new Error(`Erro na composição: ${err.message}`));
        })
        .run();
    });
  });
}
