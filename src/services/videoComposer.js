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

      // Dimensões FIXAS (não negociáveis)
      const CANVAS_WIDTH = 1080;
      const CANVAS_HEIGHT = 1920;
      const VIDEO_WIDTH = 1080;
      const VIDEO_HEIGHT = 608;
      const VIDEO_Y_TOP = 180;      // Vídeo principal no topo
      const VIDEO_Y_BOTTOM = 1172;  // Vídeo de retenção na base
      const HEADLINE_Y = 960;       // Headline centralizada

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

      // 2. Vídeo Principal (input 0) - Escala para 1080x608
      filterComplex.push(`[0:v]scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}[main_scaled]`);

      // 3. Overlay do Vídeo Principal sobre o Background
      filterComplex.push(`${currentLabel}[main_scaled]overlay=(W-w)/2:${VIDEO_Y_TOP}[composed]`);
      currentLabel = '[composed]';

      // 4. Adicionar Headline (se existir)
      if (headlineText && headlineText.trim()) {
        filterComplex.push(
          `${currentLabel}drawtext=fontfile='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf':` +
          `text='${headlineText.replace(/'/g, "\\'")}':fontsize=72:fontcolor=#FFFFFF:box=1:boxcolor=0x00000000:` +
          `x=(w-text_w)/2:y=${HEADLINE_Y}[with_headline]`
        );
        currentLabel = '[with_headline]';
      }

      // 5. Vídeo de Retenção (input 2 ou mais) - Escala para 1080x608
      if (retentionVideoPath && fs.existsSync(retentionVideoPath)) {
        filterComplex.push(`[${inputCount}:v]scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}[retention_scaled]`);

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

      // 8. Final - Garantir que [final] existe
      filterComplex.push(`${currentLabel}copy[final]`);

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
          '-map', '0:a?', // Mapear áudio do vídeo principal se existir
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
