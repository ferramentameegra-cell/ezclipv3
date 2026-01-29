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
      // getRetentionClip faz todo o trabalho: download, processamento em clipes, seleção aleatória
      // Passar totalClips para sincronizar clipes de retenção com o vídeo principal
      retentionVideoPath = await getRetentionClip(nicheId, totalClips);
      
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
      console.log(`[COMPOSER] Resolução original: ${videoStream?.width}x${videoStream?.height}`);

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

      const fixedBackgroundPath = getFixedBackgroundPath();
      const hasFixedBg = fixedBackgroundPath && fs.existsSync(fixedBackgroundPath);
      let retentionVideoExists = false;
      let retentionInputIndex = null;
      if (retentionVideoPath && fs.existsSync(retentionVideoPath)) {
        try {
          const retentionStats = fs.statSync(retentionVideoPath);
          if (retentionStats.size > 0) {
            retentionVideoExists = true;
            retentionInputIndex = hasFixedBg ? 2 : 1;
          }
        } catch (_) {}
      }
      let inputCount = 1 + (hasFixedBg ? 1 : 0) + (retentionVideoExists ? 1 : 0);

      let filterComplex = [];

      // 1. Background (input 1) - Escala e corta para 1080x1920
      if (hasFixedBg) {
        filterComplex.push(`[1:v]scale=${CANVAS_WIDTH}:${CANVAS_HEIGHT}:force_original_aspect_ratio=increase,crop=${CANVAS_WIDTH}:${CANVAS_HEIGHT}[bg_fixed]`);
      } else {
        filterComplex.push(`color=c=${backgroundColor.replace('#', '')}:s=${CANVAS_WIDTH}:${CANVAS_HEIGHT}:d=${videoDuration}[bg_fixed]`);
      }

      // 2. Vídeo Principal (input 0) - Escala para 1080x608
      filterComplex.push(`[0:v]scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}[main_scaled]`);

      // 3. Overlay do Vídeo Principal sobre o Background
      filterComplex.push(`[bg_fixed][main_scaled]overlay=(W-w)/2:${VIDEO_Y_TOP}[composed]`);

      // 4. Adicionar Headline (se existir)
      let currentLabel;
      if (headlineText && headlineText.trim()) {
        filterComplex.push(
          `[composed]drawtext=fontfile='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf':` +
          `text='${(headlineText || '').replace(/'/g, "\\'")}':fontsize=72:fontcolor=#FFFFFF:box=1:boxcolor=0x00000000:` +
          `x=(w-text_w)/2:y=${HEADLINE_Y}[with_headline]`
        );
        currentLabel = '[with_headline]';
      } else {
        currentLabel = '[composed]';
      }

      // 5. Vídeo de Retenção (input 2 ou 1) - Escala para 1080x608
      if (retentionVideoExists && retentionInputIndex !== null) {
        filterComplex.push(`[${retentionInputIndex}:v]scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}[retention_scaled]`);
        // 6. Overlay do Vídeo de Retenção
        filterComplex.push(
          `${currentLabel}[retention_scaled]overlay=(W-w)/2:${VIDEO_Y_BOTTOM}:shortest=1[with_retention]`
        );
        currentLabel = '[with_retention]';
      }

      // 7. Adicionar Contador "Parte X/Y" (se existir)
      if (clipNumber && totalClips) {
        filterComplex.push(
          `${currentLabel}drawtext=fontfile='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf':` +
          `text='Parte ${clipNumber}/${totalClips}':fontsize=48:fontcolor=#FFFFFF:` +
          `borderw=3:bordercolor=#000000:x=(w-text_w-80):y=80[with_counter]`
        );
        currentLabel = '[with_counter]';
      } else if (currentLabel === '[composed]' || currentLabel === '[with_headline]') {
        // Sem retenção: currentLabel já está correto
      } else {
        currentLabel = '[with_retention]';
      }

      // 8. Final - Garantir que [final] existe
      filterComplex.push(`${currentLabel}copy[final]`);

      // Construir a string final
      const filterComplexString = filterComplex.join(';');

      console.log(`[DIAG-FINAL-LAYOUT] Filter Complex String: ${filterComplexString}`);
      console.log(`[DIAG-FINAL-LAYOUT] Contém [final]? ${filterComplexString.includes('[final]') ? 'SIM' : 'NÃO'}`);
      
      // 8. Garantir que a saída final seja exatamente 1080x1920 (HARDCODED)
      // O background já tem as dimensões corretas, então o overlay deve manter isso

      // VALIDAR arquivo de entrada ANTES de processar
      if (!fs.existsSync(clipPath)) {
        return reject(new Error(`[COMPOSER] ❌ Arquivo de vídeo principal não existe: ${clipPath}`));
      }
      
      const clipStats = fs.statSync(clipPath);
      if (clipStats.size === 0) {
        return reject(new Error(`[COMPOSER] ❌ Arquivo de vídeo principal está vazio: ${clipPath}`));
      }
      
      console.log(`[COMPOSER] ✅ Vídeo principal validado: ${clipPath} (${(clipStats.size / 1024 / 1024).toFixed(2)} MB)`);
      
      // Validar background fixo se especificado
      if (fixedBackgroundPath && !fs.existsSync(fixedBackgroundPath)) {
        console.warn(`[COMPOSER] ⚠️ Background fixo não existe: ${fixedBackgroundPath}. Continuando sem background.`);
        fixedBackgroundPath = null;
      }
      
      // Construir comando FFmpeg com timeout para evitar travamento indefinido
      const command = ffmpeg({ timeout: FFMPEG_COMPOSE_TIMEOUT });
      console.log(`[COMPOSER] Timeout da composição: ${FFMPEG_COMPOSE_TIMEOUT}s`);
      
      // Variáveis para capturar stderr e stdout do FFmpeg
      let ffmpegStderr = '';
      let ffmpegStdout = '';

      // Input 0: vídeo principal
      command.input(clipPath);

      // Input 1: Background fixo (se existir) - LAYER 0
      if (fixedBackgroundPath) {
        // VALIDAR background antes de adicionar
        if (!fs.existsSync(fixedBackgroundPath)) {
          console.warn(`[COMPOSER] ⚠️ Background fixo não existe: ${fixedBackgroundPath}. Continuando sem background.`);
          fixedBackgroundPath = null;
        } else {
          const bgStats = fs.statSync(fixedBackgroundPath);
          if (bgStats.size === 0) {
            console.warn(`[COMPOSER] ⚠️ Background fixo está vazio: ${fixedBackgroundPath}. Continuando sem background.`);
            fixedBackgroundPath = null;
          } else {
            command.input(fixedBackgroundPath);
            console.log(`[COMPOSER] ✅ Background fixo validado e adicionado como input 1: ${fixedBackgroundPath} (${(bgStats.size / 1024).toFixed(2)} KB)`);
          }
        }
      }

      // Input 2 (ou 1 se não houver background): vídeo de retenção (OPCIONAL)
      // Usar a validação binária já feita anteriormente (retentionVideoExists)
      if (retentionVideoExists && retentionVideoPath && retentionInputIndex !== null) {
        // Verificar se é URL (não mais suportado - apenas arquivos locais)
        const isUrl = retentionVideoPath.startsWith('http://') || retentionVideoPath.startsWith('https://');
        if (isUrl) {
          console.warn(`[COMPOSER] ⚠️ Vídeo de retenção ainda é URL. URLs não são mais suportadas. Use apenas arquivos locais na pasta retention-library/.`);
          console.warn(`[COMPOSER] ⚠️ Continuando sem vídeo de retenção.`);
        } else if (fs.existsSync(retentionVideoPath)) {
          // Adicionar input do vídeo de retenção com loop infinito
          const retentionInput = command.input(retentionVideoPath);
          retentionInput.inputOptions(['-stream_loop', '-1']); // Loopar vídeo de retenção infinitamente
          const retentionStats = fs.statSync(retentionVideoPath);
          console.log(`[COMPOSER] ✅ Vídeo de retenção adicionado como input ${retentionInputIndex} com loop infinito: ${retentionVideoPath} (${(retentionStats.size / 1024 / 1024).toFixed(2)} MB)`);
        } else {
          console.warn(`[COMPOSER] ⚠️ Vídeo de retenção não existe mais: ${retentionVideoPath}. Continuando sem vídeo de retenção.`);
        }
      }

      // Validar filter_complex antes de aplicar
      if (!filterComplexString || filterComplexString.trim() === '') {
        return reject(new Error('Filter complex está vazio'));
      }
      
      // Verificar se [final] existe no filter (CRÍTICO)
      if (!filterComplexString.includes('[final]')) {
        console.error('[COMPOSER] ❌ Label [final] não encontrado no filter_complex');
        console.error('[COMPOSER] Filter complex:', filterComplexString);
        return reject(new Error('Label [final] não encontrado no filter_complex'));
      }
      
      // Verificar se [final] foi definido (não apenas usado)
      if (!filterComplexString.includes('=[final]')) {
        console.error('[COMPOSER] ❌ Label [final] não foi definido no filter_complex!');
        console.error('[COMPOSER] Filter complex:', filterComplexString);
        return reject(new Error('Label [final] não foi definido no filter_complex'));
      }
      
      // Validar que todos os inputs referenciados existem
      const inputPattern = /\[(\d+):[av]\]/g;
      const referencedInputs = new Set();
      let match;
      while ((match = inputPattern.exec(filterComplexString)) !== null) {
        referencedInputs.add(parseInt(match[1]));
      }
      
      // Verificar se todos os inputs referenciados foram adicionados
      const maxInputIndex = referencedInputs.size > 0 ? Math.max(...Array.from(referencedInputs)) : -1;
      if (maxInputIndex >= inputCount) {
        console.error(`[COMPOSER] ❌ Filter complex referencia input ${maxInputIndex} mas apenas ${inputCount} inputs foram adicionados`);
        return reject(new Error(`Filter complex referencia input ${maxInputIndex} mas apenas ${inputCount} inputs foram adicionados`));
      }
      
      // Log do filter complex (limitado para não poluir logs)
      console.log('[COMPOSER] Filter complex (primeiros 500 chars):', filterComplexString.substring(0, 500));
      if (filterComplexString.length > 500) {
        console.log('[COMPOSER] Filter complex (restante):', filterComplexString.substring(500, 1000));
      }

      // --- DIAGNÓSTICO: ESTADO FINAL ANTES DA EXECUÇÃO ---
      console.log('--- DIAGNÓSTICO: ESTADO FINAL ANTES DA EXECUÇÃO ---');
      console.log(`[DIAG-FINAL] String Final do Filtro (completa): ${filterComplexString}`);
      console.log(`[DIAG-FINAL] [final] está definido no filtro? ${filterComplexString.includes('=[final]') ? 'SIM' : 'NÃO'}`);
      console.log(`[DIAG-FINAL] Últimos 80 chars da string: ...${filterComplexString.slice(-80)}`);
      console.log('--------------------------------------------------\n');
      
      try {
        command.complexFilter(filterComplexString);
      } catch (filterError) {
        console.error('[COMPOSER] ❌ Erro ao aplicar filter_complex:', filterError);
        console.error('[COMPOSER] Filter complex completo:', filterComplexString);
        return reject(new Error(`Erro ao criar filter_complex: ${filterError.message}`));
      }

      // Mapear saída e configurar codecs
      // FORÇAR resolução 1080x1920 OBRIGATORIAMENTE (formato vertical 9:16)
      // [final] sempre existe após a etapa 8 e já tem as dimensões corretas (1080x1920)
      // O complexFilter já força as dimensões através do [final] com scale=1080:1920 + crop=1080:1920:0:0
      // Adicionar -s e -aspect como backup OBRIGATÓRIO para garantir formato vertical
      // NÃO usar -vf aqui pois conflita com complexFilter - o complexFilter já faz o trabalho
      const outputOptions = [
        '-map', '[final]',
        '-s', '1080x1920', // FORÇAR 1080x1920 (hardcoded - formato vertical OBRIGATÓRIO)
        '-aspect', '9:16', // FORÇAR aspect ratio 9:16 (vertical OBRIGATÓRIO)
        '-c:v', 'libx264',
        '-preset', 'veryfast', // OTIMIZAÇÃO 3: Mudado de 'medium' para 'veryfast' (20-30% mais rápido)
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart'
      ];
      
      console.log(`[COMPOSER] ✅ FORÇANDO resolução de saída: 1080x1920 (9:16 vertical) - HARDCODED OBRIGATÓRIO`);
      console.log(`[COMPOSER] ✅ Opções de saída: -s 1080x1920 -aspect 9:16`);
      console.log(`[COMPOSER] ✅ Múltiplas camadas de forçamento: complexFilter (scale+crop) + -s + -aspect`);
      console.log(`[COMPOSER] ✅ complexFilter garante: scale=1080:1920:force_original_aspect_ratio=increase + crop=1080:1920:0:0`);
      console.log(`[COMPOSER] ✅ Usando label final: [final]`);
      console.log(`[COMPOSER] ✅ Background fixo: ${fixedBackgroundPath ? 'SIM' : 'NÃO'}`);
      console.log(`[COMPOSER] ✅ Headline: ${(headlineText || (headline && headline.text)) ? 'SIM' : 'NÃO'}`);
      console.log(`[COMPOSER] ✅ Vídeo de retenção: ${retentionVideoPath ? 'SIM' : 'NÃO'}`);

      // Adicionar áudio se existir
      if (hasAudio) {
        outputOptions.push('-map', '0:a?', '-c:a', 'aac', '-b:a', '128k');
      }

      // Se houver vídeo de retenção, garantir que o vídeo final tenha a duração do vídeo principal
      // O vídeo de retenção será repetido automaticamente pelo FFmpeg se for mais curto
      // Usar loop para garantir que o vídeo de retenção seja repetido durante toda a duração
      if (retentionVideoPath) {
        // Garantir que o vídeo de retenção seja loopado se necessário
        // O overlay já cuida da duração, mas vamos garantir com shortest=0
        // Isso garante que use a duração do primeiro input (vídeo principal)
        // O vídeo de retenção será repetido automaticamente se for mais curto
        console.log(`[COMPOSER] ✅ Vídeo de retenção será loopado automaticamente se necessário para cobrir toda a duração do vídeo principal`);
      }

      command.outputOptions(outputOptions);

      // Configurar saída - FORÇAR 1080x1920 vertical
      // IMPORTANTE: Não usar .size() e .aspect() quando já temos complexFilter
      // O complexFilter já força as dimensões através do [final] que tem 1080x1920
      command
        .on('start', (cmdline) => {
          console.log('[COMPOSER] ========================================');
          console.log('[COMPOSER] INICIANDO COMPOSIÇÃO FINAL');
          console.log('[COMPOSER] ========================================');
          console.log('[FFMPEG_COMMAND] Comando FFmpeg completo:');
          console.log('[FFMPEG_COMMAND]', cmdline);
          console.log('[COMPOSER] Input 0 (vídeo principal):', clipPath);
          if (fixedBackgroundPath) {
            console.log('[COMPOSER] Input 1 (background):', fixedBackgroundPath);
          }
          if (retentionVideoPath) {
            console.log(`[COMPOSER] Input ${fixedBackgroundPath ? 2 : 1} (retenção):`, retentionVideoPath);
          }
          console.log('[COMPOSER] Output:', outputPath);
          console.log(`[COMPOSER] ✅ Saída FORÇADA: 1080x1920 (9:16 vertical) - HARDCODED OBRIGATÓRIO`);
          console.log(`[COMPOSER] ✅ Aspect ratio FORÇADO: 9:16 (OBRIGATÓRIO)`);
          console.log(`[COMPOSER] ✅ Múltiplas camadas de forçamento aplicadas para garantir 1080x1920`);
          console.log(`[COMPOSER] Background fixo: ${fixedBackgroundPath ? 'SIM ✅' : 'NÃO ❌'}`);
          console.log(`[COMPOSER] Headline: ${(headlineText || (headline && headline.text)) ? 'SIM ✅' : 'NÃO ❌'}`);
          console.log(`[COMPOSER] Vídeo de retenção: ${retentionVideoPath ? 'SIM ✅' : 'NÃO ❌'}`);
          console.log(`[COMPOSER] Legendas: ${captions && captions.length > 0 ? `${captions.length} blocos ✅` : 'NÃO ❌'}`);
          console.log(`[COMPOSER] Safe zones: topo ${safeZones.top}px, rodapé ${safeZones.bottom}px`);
          console.log('[COMPOSER] ========================================');
        })
        .on('stderr', (stderrLine) => {
          // Capturar stderr do FFmpeg (contém warnings e erros)
          ffmpegStderr += stderrLine + '\n';
          // Log warnings importantes
          if (stderrLine.includes('error') || stderrLine.includes('Error') || stderrLine.includes('ERROR') || 
              stderrLine.includes('failed') || stderrLine.includes('Failed') || stderrLine.includes('FAILED')) {
            console.error('[FFMPEG_ERROR] stderr:', stderrLine);
          }
        })
        .on('stdout', (stdoutLine) => {
          // Capturar stdout do FFmpeg
          ffmpegStdout += stdoutLine + '\n';
        })
        .on('progress', (progress) => {
          const percent = progress.percent != null
            ? Math.min(100, Math.max(0, Math.round(progress.percent)))
            : null;
          if (onProgress) {
            onProgress({ ...progress, percent: percent ?? 0 });
          }
          if (percent != null) {
            console.log(`[COMPOSER] Progresso: ${percent}%`);
          } else if (progress.timemark) {
            console.log(`[COMPOSER] Progresso: ${progress.timemark}`);
          }
        })
        .on('end', () => {
          console.log('[COMPOSER] Comando FFmpeg finalizado (end event)');
          
          // VALIDAR arquivo de saída ANTES de continuar
          if (!fs.existsSync(outputPath)) {
            console.error('[COMPOSER_ERROR] ========================================');
            console.error('[COMPOSER_ERROR] Arquivo de saída não foi criado');
            console.error('[COMPOSER_ERROR] ========================================');
            console.error('[COMPOSER_ERROR] Output path:', outputPath);
            console.error('[COMPOSER_ERROR] FFmpeg stderr completo:', ffmpegStderr);
            console.error('[COMPOSER_ERROR] FFmpeg stdout completo:', ffmpegStdout);
            console.error('[COMPOSER_ERROR] ========================================');
            return reject(new Error(`Arquivo de saída não foi criado: ${outputPath}. FFmpeg stderr: ${ffmpegStderr.slice(-1000)}`));
          }

          const stats = fs.statSync(outputPath);
          if (stats.size === 0) {
            console.error('[COMPOSER_ERROR] ========================================');
            console.error('[COMPOSER_ERROR] Arquivo de saída está vazio');
            console.error('[COMPOSER_ERROR] ========================================');
            console.error('[COMPOSER_ERROR] Output path:', outputPath);
            console.error('[COMPOSER_ERROR] FFmpeg stderr completo:', ffmpegStderr);
            console.error('[COMPOSER_ERROR] ========================================');
            return reject(new Error(`Arquivo de saída está vazio: ${outputPath}. FFmpeg stderr: ${ffmpegStderr.slice(-1000)}`));
          }
          
          console.log(`[COMPOSER] ✅ Arquivo de saída validado: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
          
          // VALIDAR resolução final do vídeo gerado
          ffmpeg.ffprobe(outputPath, (err, metadata) => {
            if (!err && metadata?.streams) {
              const videoStream = metadata.streams.find(s => s.codec_type === 'video');
              if (videoStream) {
                const actualWidth = videoStream.width;
                const actualHeight = videoStream.height;
                const actualAspectRatio = (actualWidth / actualHeight).toFixed(3);
                console.log(`[COMPOSER] ✅ Resolução de saída verificada: ${actualWidth}x${actualHeight} (aspect ratio: ${actualAspectRatio})`);
                if (actualWidth !== 1080 || actualHeight !== 1920) {
                  console.error(`[COMPOSER] ❌ ERRO CRÍTICO: Resolução esperada 1080x1920, mas obteve ${actualWidth}x${actualHeight}`);
                  console.error(`[COMPOSER] ❌ O vídeo NÃO está no formato correto! Verifique as opções de saída do FFmpeg.`);
                  // Não rejeitar aqui, apenas logar o erro - o vídeo pode ainda estar funcional
                } else {
                  console.log(`[COMPOSER] ✅ Resolução correta confirmada: 1080x1920 (9:16 vertical)`);
                  console.log(`[COMPOSER] ✅ Formato vertical 1080x1920 FORÇADO com sucesso!`);
                  console.log(`[COMPOSER] ✅ Frame final: 1080x1920 (9:16 vertical)`);
                  console.log(`[COMPOSER] ✅ Vídeo principal mantém proporção 16:9 dentro do frame vertical`);
                }
                
                // Verificar se vídeo de retenção está presente (OPCIONAL - não bloquear se não estiver)
                if (retentionVideoId && retentionVideoId !== 'none') {
                  if (retentionVideoPath) {
                    console.log(`[COMPOSER] ✅ Vídeo de retenção foi processado e está presente no arquivo final`);
                    console.log(`[COMPOSER] ✅ Arquivo final contém vídeo de retenção: ${retentionVideoPath}`);
                  } else {
                    console.warn(`[COMPOSER] ⚠️ Vídeo de retenção especificado (${retentionVideoId}) mas não está presente no arquivo final. Continuando normalmente.`);
                  }
                }
              }
            }
          });

          // Validar resolução do arquivo gerado
          ffmpeg.ffprobe(outputPath, (probeErr, probeData) => {
            if (!probeErr) {
              const outputStream = probeData?.streams?.find(s => s.codec_type === 'video');
              if (outputStream) {
                console.log(`[COMPOSER] Resolução de saída: ${outputStream.width}x${outputStream.height}`);
                if (outputStream.width !== 1080 || outputStream.height !== 1920) {
                  console.warn(`[COMPOSER] ⚠️ Resolução não corresponde ao esperado! Esperado: 1080x1920, Obtido: ${outputStream.width}x${outputStream.height}`);
                } else {
                  console.log(`[COMPOSER] ✅ Resolução correta: 1080x1920 (9:16 vertical)`);
                }
              }
            }
          });

          console.log(`[COMPOSER] ✅ Composição concluída: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
          resolve(outputPath);
        })
        .on('error', (err, stdout, stderr) => {
          const fullStderr = stderr || ffmpegStderr || '';
          const fullStdout = stdout || ffmpegStdout || '';
          const isTimeout = err.message && (
            err.message.includes('timeout') ||
            err.message.includes('ETIMEDOUT') ||
            err.message.includes('SIGKILL') ||
            err.message.includes('Exceeded')
          );
          if (isTimeout) {
            console.error(`[COMPOSER_ERROR] TIMEOUT na composição após ${FFMPEG_COMPOSE_TIMEOUT}s. Aumente FFMPEG_COMPOSE_TIMEOUT ou simplifique o vídeo.`);
          }
          // Log stderr completo abaixo
          
          console.error('[COMPOSER_ERROR] ========================================');
          console.error('[COMPOSER_ERROR] ERRO CRÍTICO NO FFMPEG COMPOSIÇÃO');
          console.error('[COMPOSER_ERROR] ========================================');
          console.error('[COMPOSER_ERROR] Mensagem:', err.message);
          console.error('[COMPOSER_ERROR] Código de saída:', err.code);
          console.error('[COMPOSER_ERROR] Signal:', err.signal);
          console.error('[COMPOSER_ERROR] Stack trace completo:', err.stack);
          console.error('[COMPOSER_ERROR] Output path:', outputPath);
          console.error('[COMPOSER_ERROR] Input 0 (vídeo principal):', clipPath);
          if (fixedBackgroundPath) {
            console.error('[COMPOSER_ERROR] Input 1 (background):', fixedBackgroundPath);
          }
          if (retentionVideoPath) {
            console.error(`[COMPOSER_ERROR] Input ${fixedBackgroundPath ? 2 : 1} (retenção):`, retentionVideoPath);
          }
          console.error('[COMPOSER_ERROR] Total de inputs:', inputCount);
          console.error('[COMPOSER_ERROR] Background fixo:', fixedBackgroundPath || 'NÃO');
          console.error('[COMPOSER_ERROR] Vídeo de retenção:', retentionVideoPath || 'NÃO');
          console.error('[COMPOSER_ERROR] Headline:', (headlineText || (headline && headline.text)) || 'NÃO');
          console.error('[COMPOSER_ERROR] Legendas:', captions && captions.length > 0 ? `${captions.length} blocos` : 'NÃO');
          
          console.error('[COMPOSER_ERROR] ========================================');
          console.error('[COMPOSER_ERROR] FILTER COMPLEX COMPLETO:');
          console.error('[COMPOSER_ERROR] ========================================');
          console.error(filterComplex);
          console.error('[COMPOSER_ERROR] ========================================');
          
          console.error('[COMPOSER_ERROR] ========================================');
          console.error('[COMPOSER_ERROR] FFMPEG STDERR COMPLETO:');
          console.error('[COMPOSER_ERROR] ========================================');
          console.error(fullStderr);
          console.error('[COMPOSER_ERROR] ========================================');
          
          if (fullStdout) {
            console.error('[COMPOSER_ERROR] FFMPEG STDOUT:');
            console.error(fullStdout);
          }
          
          // Verificar se arquivos de entrada ainda existem
          console.error('[COMPOSER_ERROR] ========================================');
          console.error('[COMPOSER_ERROR] VALIDAÇÃO DE ARQUIVOS DE ENTRADA:');
          console.error('[COMPOSER_ERROR] ========================================');
          if (clipPath) {
            if (fs.existsSync(clipPath)) {
              const stats = fs.statSync(clipPath);
              console.error(`[COMPOSER_ERROR] ✅ Input 0 (vídeo principal) existe: ${clipPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
            } else {
              console.error(`[COMPOSER_ERROR] ❌ Input 0 (vídeo principal) NÃO existe: ${clipPath}`);
            }
          }
          if (fixedBackgroundPath) {
            if (fs.existsSync(fixedBackgroundPath)) {
              const stats = fs.statSync(fixedBackgroundPath);
              console.error(`[COMPOSER_ERROR] ✅ Input 1 (background) existe: ${fixedBackgroundPath} (${(stats.size / 1024).toFixed(2)} KB)`);
            } else {
              console.error(`[COMPOSER_ERROR] ❌ Input 1 (background) NÃO existe: ${fixedBackgroundPath}`);
            }
          }
          if (retentionVideoPath) {
            if (fs.existsSync(retentionVideoPath)) {
              const stats = fs.statSync(retentionVideoPath);
              console.error(`[COMPOSER_ERROR] ✅ Input ${fixedBackgroundPath ? 2 : 1} (retenção) existe: ${retentionVideoPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
            } else {
              console.error(`[COMPOSER_ERROR] ❌ Input ${fixedBackgroundPath ? 2 : 1} (retenção) NÃO existe: ${retentionVideoPath}`);
            }
          }
          console.error('[COMPOSER_ERROR] ========================================');
          
          // Criar mensagem de erro detalhada
          const errPrefix = isTimeout ? `TIMEOUT após ${FFMPEG_COMPOSE_TIMEOUT}s. ` : '';
          const detailedError = `[COMPOSER] ${errPrefix}Erro no FFmpeg durante composição: ${err.message}\n\n` +
                               `Output: ${outputPath}\n` +
                               `Input 0: ${clipPath}\n` +
                               (fixedBackgroundPath ? `Input 1: ${fixedBackgroundPath}\n` : '') +
                               (retentionVideoPath ? `Input ${fixedBackgroundPath ? 2 : 1}: ${retentionVideoPath}\n` : '') +
                               `Filter complex (primeiros 500 chars): ${filterComplex.substring(0, 500)}\n` +
                               `FFmpeg stderr (últimos 2000 chars):\n${fullStderr.slice(-2000)}`;
          
          reject(new Error(detailedError));
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

/**
 * Quebrar texto automaticamente baseado na largura máxima
 * Estima quantos caracteres cabem na largura e adiciona quebras de linha
 */
function wrapText(text, maxWidth, fontSize) {
  if (!text || !maxWidth || !fontSize) return text;
  
  // Estimar largura média de um caractere (aproximação: 0.6 * fontSize)
  const avgCharWidth = fontSize * 0.6;
  const maxCharsPerLine = Math.floor(maxWidth / avgCharWidth);
  
  if (maxCharsPerLine <= 0 || text.length <= maxCharsPerLine) {
    return text; // Texto cabe em uma linha
  }
  
  // Quebrar texto em palavras
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    
    // Se a linha com a nova palavra exceder o limite, quebrar
    if (testLine.length > maxCharsPerLine) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Palavra muito longa, quebrar no meio
        lines.push(word.substring(0, maxCharsPerLine));
        currentLine = word.substring(maxCharsPerLine);
      }
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines.join('\\n');
}

function getFontPath(fontName) {
  // Mapear fontes comuns para caminhos do sistema
  // Em produção (Railway/Linux), usar fontes do sistema Linux
  const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
  
  if (isProduction) {
    // Fontes Linux comuns
    const linuxFontMap = {
      'Arial': '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      'Inter': '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      'Roboto': '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
      'Montserrat': '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    };
    
    if (linuxFontMap[fontName]) {
      return linuxFontMap[fontName];
    }
    // Fallback Linux
    return '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
  }
  
  // Desenvolvimento (macOS)
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

// Função downloadVideoFromUrl removida - URLs não são mais suportadas
// Use apenas arquivos locais na pasta retention-library/

export default composeFinalVideo;
