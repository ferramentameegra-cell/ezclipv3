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
// Imports https e http removidos - não são mais necessários (apenas arquivos locais)
import { getRetentionVideoPath, getRandomRetentionVideoPath, getNicheRetentionVideo, getNicheRetentionYoutubeUrl } from './retentionVideoManager.js';
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

  // Obter vídeo de retenção
  // PRIORIDADE: Se há nicheId e retentionVideoId é 'niche-default', usar vídeo de retenção do nicho (YouTube)
  let retentionVideoPath = null;
  
  if (nicheId && (retentionVideoId === 'niche-default' || retentionVideoId === 'random' || !retentionVideoId || retentionVideoId === 'none')) {
    // NOVO SISTEMA: Usar vídeo de retenção do nicho (YouTube, sem áudio)
    console.log(`[COMPOSER] 📥 Obtendo vídeo de retenção do nicho: ${nicheId}`);
    try {
      // getNicheRetentionVideo já faz o download automaticamente se necessário
      retentionVideoPath = await getNicheRetentionVideo(nicheId);
      if (retentionVideoPath && fs.existsSync(retentionVideoPath)) {
        const stats = fs.statSync(retentionVideoPath);
        if (stats.size > 0) {
          console.log(`[COMPOSER] ✅ Usando vídeo de retenção do nicho ${nicheId}: ${retentionVideoPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        } else {
          console.warn(`[COMPOSER] ⚠️ Vídeo de retenção do nicho está vazio, tentando fallback...`);
          retentionVideoPath = null;
        }
      } else {
        console.warn(`[COMPOSER] ⚠️ Não foi possível obter vídeo de retenção do nicho ${nicheId}, tentando fallback...`);
        retentionVideoPath = null;
      }
    } catch (error) {
      console.error(`[COMPOSER] ❌ Erro ao obter vídeo de retenção do nicho: ${error.message}`);
      retentionVideoPath = null; // Continuar sem vídeo de retenção
    }
  }
  
  // FALLBACK: Sistema antigo (se não há nicheId ou se falhou)
  if (!retentionVideoPath && retentionVideoId && retentionVideoId !== 'none') {
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
  
  // FORMATO FIXO: Sempre 9:16 (1080x1920) vertical para todos os vídeos gerados
  // Garantir que o formato seja sempre 9:16, independente do parâmetro recebido
  // HARDCODED: Sempre usar 1080x1920
  const finalFormat = '9:16';
  const OUTPUT_WIDTH = 1080; // HARDCODED - sempre 1080
  const OUTPUT_HEIGHT = 1920; // HARDCODED - sempre 1920
  const safeZones = getSafeZones(finalFormat, platforms, safeMargins);
  
  console.log(`[COMPOSER] ⚠️ FORMATO FORÇADO: 9:16 (1080x1920) - formato recebido: ${format} foi IGNORADO`);
  console.log(`[COMPOSER] ✅ Dimensões HARDCODED: ${OUTPUT_WIDTH}x${OUTPUT_HEIGHT} (vertical)`);
  
  // POSIÇÕES FIXAS E VALIDADAS (1080x1920):
  // - Margem superior: 180px (vídeo principal começa aqui)
  // - Margem inferior livre: 140px (área inferior deve permanecer sempre livre)
  // - Vídeo principal: y=180px (topo fixo)
  // - Vídeo de retenção: base a 140px acima da margem inferior
  //   O conteúdo será dimensionado para o maior tamanho possível mantendo proporção
  const TOP_MARGIN = 180; // Margem superior fixa
  const BOTTOM_FREE_SPACE = 140; // Área inferior livre (base do conteúdo de retenção deve ficar aqui)
  
  // O cálculo da altura e posição do vídeo de retenção será feito dinamicamente
  // após obter as dimensões originais do vídeo (dentro do ffprobe)

  console.log(`[COMPOSER] Formato: ${format} (IGNORADO - sempre 9:16)`);
  console.log(`[COMPOSER] Layout: 1080x1920 (HARDCODED - sempre vertical)`);
  console.log(`[COMPOSER] Safe zones: top=${safeZones.top}px, bottom=${safeZones.bottom}px`);
  console.log(`[COMPOSER] Background: ${backgroundColor}`);

  return new Promise(async (resolve, reject) => {
    console.log(`[COMPOSER] Iniciando composição final 9:16 (1080x1920)...`);
    console.log(`[COMPOSER] Layout: 1080x1920 (HARDCODED - sempre vertical)`);
    console.log(`[COMPOSER] Background: ${backgroundColor}`);

    // Obter dimensões do vídeo de retenção ANTES de construir os filtros
    let retentionOriginalWidth = 1080;
    let retentionOriginalHeight = 1920;
    
    if (retentionVideoPath) {
      // Verificar se é URL (não mais suportado - apenas arquivos locais)
      const isRetentionUrl = retentionVideoPath.startsWith('http://') || retentionVideoPath.startsWith('https://');
      
      if (isRetentionUrl) {
        console.warn(`[COMPOSER] ⚠️ URLs de vídeos de retenção não são mais suportadas. Use apenas arquivos locais na pasta retention-library/.`);
        console.warn(`[COMPOSER] ⚠️ URL recebida: ${retentionVideoPath}`);
        console.warn(`[COMPOSER] ⚠️ Continuando sem vídeo de retenção.`);
        retentionVideoPath = null; // Continuar sem vídeo de retenção
      }
      
      // Se for arquivo local, verificar se existe
      if (retentionVideoPath && !isRetentionUrl) {
        try {
          const retentionMetadata = await new Promise((retentionResolve, retentionReject) => {
            ffmpeg.ffprobe(retentionVideoPath, (retentionErr, retentionMetadata) => {
              if (retentionErr) {
                console.warn(`[COMPOSER] ⚠️ Erro ao obter metadados do vídeo de retenção: ${retentionErr.message}, usando dimensões padrão`);
                return retentionResolve(null);
              }
              retentionResolve(retentionMetadata);
            });
          });
          
          if (retentionMetadata?.streams) {
            const retentionStream = retentionMetadata.streams.find(s => s.codec_type === 'video');
            if (retentionStream) {
              retentionOriginalWidth = retentionStream.width || 1080;
              retentionOriginalHeight = retentionStream.height || 1920;
              console.log(`[COMPOSER] ✅ Dimensões originais do vídeo de retenção: ${retentionOriginalWidth}x${retentionOriginalHeight}`);
            }
          }
        } catch (retentionError) {
          console.warn(`[COMPOSER] ⚠️ Erro ao obter dimensões do vídeo de retenção: ${retentionError.message}, usando dimensões padrão`);
        }
      }
    }

    // Calcular dimensões do vídeo de retenção (se houver) para dimensionamento dinâmico
    // O conteúdo de retenção deve ser dimensionado para o maior tamanho possível
    // dentro das margens, mantendo proporção original, sem cortes
    let retentionHeight = 0;
    let retentionY = 0;
    let retentionWidth = 0;
    
    if (retentionVideoPath) {
      // Calcular proporção original
      const retentionAspectRatio = retentionOriginalWidth / retentionOriginalHeight;
      
      // Área disponível considerando que a base deve ficar a 140px da margem inferior
      // Primeiro, assumir que temos todo o espaço disponível até a margem superior
      // depois ajustaremos se necessário para não ultrapassar o vídeo principal
      // Altura máxima teórica = 1920 - TOP_MARGIN - BOTTOM_FREE_SPACE
      // HARDCODED: sempre 1920 de altura
      const maxAvailableHeight = 1920 - TOP_MARGIN - BOTTOM_FREE_SPACE; // 1920 - 180 - 140 = 1600px
      const maxAvailableWidth = 1080; // HARDCODED: sempre 1080px
      
      // Calcular dimensões escaladas mantendo proporção (force_original_aspect_ratio=decrease)
      // Dimensionar para o maior tamanho possível dentro dos limites
      // Se a largura for o limitador: largura = 1080px, altura = 1080 / aspectRatio
      // Se a altura for o limitador: altura = 1600px, largura = 1600 * aspectRatio
      const widthBasedHeight = maxAvailableWidth / retentionAspectRatio;
      const heightBasedWidth = maxAvailableHeight * retentionAspectRatio;
      
      // Escolher a dimensão que mantém a proporção e cabe no espaço disponível
      if (widthBasedHeight <= maxAvailableHeight) {
        // Largura é o limitador - usar largura máxima e calcular altura proporcional
        retentionWidth = maxAvailableWidth;
        retentionHeight = Math.round(widthBasedHeight);
      } else {
        // Altura é o limitador - usar altura máxima e calcular largura proporcional
        retentionHeight = maxAvailableHeight;
        retentionWidth = Math.round(heightBasedWidth);
      }
      
      // Calcular posição Y: base a 140px acima da margem inferior
      // y = 1920 - retentionHeight - BOTTOM_FREE_SPACE
      // HARDCODED: altura sempre 1920
      retentionY = 1920 - retentionHeight - BOTTOM_FREE_SPACE;
      
      // Validar que não ultrapassa margem superior
      // GARANTIR espaço mínimo para o vídeo principal (pelo menos 400px)
      const MIN_MAIN_VIDEO_HEIGHT = 400; // Altura mínima para o vídeo principal
      const maxRetentionHeight = 1920 - TOP_MARGIN - BOTTOM_FREE_SPACE - MIN_MAIN_VIDEO_HEIGHT; // 1920 - 180 - 140 - 400 = 1200px máximo
      
      // Se o vídeo de retenção for muito grande, reduzir para caber
      if (retentionHeight > maxRetentionHeight) {
        console.log(`[COMPOSER] ⚠️ Vídeo de retenção muito grande (${retentionHeight}px), reduzindo para ${maxRetentionHeight}px para garantir espaço para vídeo principal`);
        retentionHeight = maxRetentionHeight;
        retentionWidth = Math.round(retentionHeight * retentionAspectRatio);
        
        // Se a largura calculada ultrapassar, ajustar novamente
        if (retentionWidth > 1080) {
          retentionWidth = 1080;
          retentionHeight = Math.round(retentionWidth / retentionAspectRatio);
        }
      }
      
      // Recalcular posição Y com altura ajustada
      retentionY = 1920 - retentionHeight - BOTTOM_FREE_SPACE;
      
      // Validar que não ultrapassa margem superior
      if (retentionY < TOP_MARGIN) {
        // Se ainda ultrapassar, reduzir mais
        const maxAllowedHeight = 1920 - TOP_MARGIN - BOTTOM_FREE_SPACE - MIN_MAIN_VIDEO_HEIGHT;
        retentionHeight = Math.min(retentionHeight, maxAllowedHeight);
        retentionWidth = Math.round(retentionHeight * retentionAspectRatio);
        
        if (retentionWidth > 1080) {
          retentionWidth = 1080;
          retentionHeight = Math.round(retentionWidth / retentionAspectRatio);
        }
        
        retentionY = 1920 - retentionHeight - BOTTOM_FREE_SPACE;
      }
      
      // Validação final
      if (retentionY < TOP_MARGIN) {
        console.warn(`[COMPOSER] ⚠️ Vídeo de retenção ainda ultrapassa margem superior, desabilitando vídeo de retenção`);
        retentionVideoPath = null; // Desabilitar vídeo de retenção se não couber
        retentionHeight = 0;
        retentionWidth = 0;
        retentionY = 0;
      }
      
      if (retentionHeight <= 0 || retentionWidth <= 0) {
        console.warn(`[COMPOSER] ⚠️ Dimensões inválidas do vídeo de retenção, desabilitando`);
        retentionVideoPath = null;
        retentionHeight = 0;
        retentionWidth = 0;
        retentionY = 0;
      }
      
      console.log(`[COMPOSER] ✅ Vídeo de retenção: dimensões originais ${retentionOriginalWidth}x${retentionOriginalHeight} (aspect ratio: ${retentionAspectRatio.toFixed(2)})`);
      console.log(`[COMPOSER] ✅ Vídeo de retenção: dimensões calculadas ${retentionWidth}x${retentionHeight} (mantendo proporção original)`);
      console.log(`[COMPOSER] ✅ Vídeo de retenção: posição y=${retentionY}px`);
      console.log(`[COMPOSER] ✅ Base do vídeo de retenção: ${retentionY + retentionHeight}px (exatamente ${BOTTOM_FREE_SPACE}px acima da margem inferior)`);
    }
    
    // Calcular altura do vídeo principal baseada na posição do vídeo de retenção
    // Se houver vídeo de retenção, o vídeo principal termina onde o vídeo de retenção começa
    // Se não houver, o vídeo principal ocupa até a área livre inferior
    // GARANTIR altura mínima para o vídeo principal (400px)
    // HARDCODED: altura sempre 1920
    const MIN_MAIN_VIDEO_HEIGHT = 400; // Altura mínima garantida
    let MAIN_VIDEO_HEIGHT = retentionVideoPath && retentionY > TOP_MARGIN
      ? Math.max(MIN_MAIN_VIDEO_HEIGHT, retentionY - TOP_MARGIN) // Garantir mínimo
      : 1920 - TOP_MARGIN - BOTTOM_FREE_SPACE;
    
    // Se ainda assim a altura for inválida, usar altura mínima
    if (MAIN_VIDEO_HEIGHT <= 0) {
      console.warn(`[COMPOSER] ⚠️ Altura do vídeo principal inválida (${MAIN_VIDEO_HEIGHT}px), usando altura mínima (${MIN_MAIN_VIDEO_HEIGHT}px)`);
      MAIN_VIDEO_HEIGHT = MIN_MAIN_VIDEO_HEIGHT;
      // Se usar altura mínima, desabilitar vídeo de retenção
      if (retentionVideoPath) {
        console.warn(`[COMPOSER] ⚠️ Desabilitando vídeo de retenção para garantir espaço para vídeo principal`);
        retentionVideoPath = null;
        retentionHeight = 0;
        retentionWidth = 0;
        retentionY = 0;
      }
    }
    
    console.log(`[COMPOSER] Layout vertical 9:16: 1080x1920 (HARDCODED - sempre vertical)`);
    console.log(`[COMPOSER] ✅ Margem superior: ${TOP_MARGIN}px, Área livre inferior: ${BOTTOM_FREE_SPACE}px`);
    console.log(`[COMPOSER] ✅ Vídeo principal: 1080x${MAIN_VIDEO_HEIGHT} (y=${TOP_MARGIN}px)`);
    if (retentionVideoPath) {
      console.log(`[COMPOSER] ✅ Vídeo retenção: ${retentionWidth}x${retentionHeight} (y=${retentionY}px, base a ${BOTTOM_FREE_SPACE}px da margem inferior)`);
    }

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
      let currentLabel = '[0:v]'; // Input do vídeo principal (sempre tem colchetes)

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
        // HARDCODED: sempre 1080x1920
        filterParts.push(`[${backgroundInputIndex}:v]scale=1080:1920:force_original_aspect_ratio=increase[bg_scaled]`);
        filterParts.push(`[bg_scaled]crop=1080:1920[bg_fixed]`);
        console.log(`[COMPOSER] Background fixo aplicado como layer 0`);
      } else {
        // Fallback: criar background sólido se imagem não existir
        // HARDCODED: sempre 1080x1920
        filterParts.push(`color=c=${backgroundColor.replace('#', '')}:s=1080:1920:d=${videoDuration}[bg_fixed]`);
        console.log(`[COMPOSER] Usando background sólido (fallback) - 1080x1920 HARDCODED`);
      }

      // 2. Redimensionar vídeo principal mantendo proporção 16:9 (horizontal)
      // IMPORTANTE: Vídeo principal deve manter proporção 16:9, não ser esticado para vertical
      // Para vídeo 16:9 com largura 1080px: altura = 1080 * 9/16 = 607.5px
      // Usar force_original_aspect_ratio=decrease para manter proporção e não distorcer
      // Largura: 1080px (largura do frame vertical)
      // Altura: calculada automaticamente para manter 16:9 (será ~607px)
      // Limitar altura máxima ao espaço disponível (MAIN_VIDEO_HEIGHT)
      const mainVideoWidth = 1080; // Largura fixa: 1080px
      const mainVideoHeight16_9 = Math.round(mainVideoWidth * 9 / 16); // Altura para 16:9 = 607px
      const mainVideoHeightFinal = Math.min(mainVideoHeight16_9, MAIN_VIDEO_HEIGHT); // Não ultrapassar espaço disponível
      
      filterParts.push(`${currentLabel}scale=${mainVideoWidth}:${mainVideoHeightFinal}:force_original_aspect_ratio=decrease[main_scaled]`);
      currentLabel = '[main_scaled]';
      console.log(`[COMPOSER] ✅ Vídeo principal redimensionado mantendo proporção 16:9: ${mainVideoWidth}x${mainVideoHeightFinal}`);
      console.log(`[COMPOSER] ✅ Vídeo principal 16:9 posicionado dentro do frame vertical 1080x1920`);
      console.log(`[COMPOSER] ✅ Proporção 16:9 mantida: largura ${mainVideoWidth}px, altura ${mainVideoHeightFinal}px (9/16 = ${(mainVideoHeightFinal/mainVideoWidth).toFixed(3)})`);

      // 3. Sobrepor vídeo principal no background (POSIÇÃO FIXA: y=180px)
      // Vídeo fica acima do background (layer 1)
      // IMPORTANTE: overlay preserva dimensões do primeiro input ([bg_fixed] = 1080x1920)
      // Posição FIXA: x=(W-w)/2 (centralizado horizontalmente), y=180px (margem superior fixa)
      const MAIN_VIDEO_Y = TOP_MARGIN; // 180px fixo
      filterParts.push(`[bg_fixed]${currentLabel}overlay=(W-w)/2:${MAIN_VIDEO_Y}[composed]`);
      currentLabel = '[composed]';
      console.log(`[COMPOSER] ✅ Vídeo principal posicionado em y=${MAIN_VIDEO_Y}px`);
      console.log(`[COMPOSER] Overlay preserva dimensões do background: 1080x1920 (HARDCODED)`);

      // 4. Adicionar headline ANTES do vídeo de retenção (CENTRO VERTICAL)
      // Headline fica no centro, acima do vídeo de retenção
      const hasHeadline = headlineText || (headline && headline.text);
      console.log(`[COMPOSER] Verificando headline: headlineText="${headlineText}", headline.text="${headline?.text}", hasHeadline=${hasHeadline}`);
      
      if (hasHeadline) {
        const headlineTextValue = headlineText || headline.text;
        const font = headlineStyle.font || headlineStyle.fontFamily || 'Arial';
        const fontSize = headlineStyle.fontSize || 72;
        const color = headlineStyle.color || '#FFFFFF';
        const startTime = 0;
        const endTime = videoDuration;

        // Posição Y: centro vertical exato - meio do frame (960px em 1920px)
        const yPos = `(h-text_h)/2`;
        
        const HEADLINE_SAFE_MARGIN = 80;
        const maxTextWidth = 1080 - (HEADLINE_SAFE_MARGIN * 2);
        
        const lineSpacing = Math.round(fontSize * 0.1);
        const boxBorderWidth = 0;
        const boxColor = '0x00000000';
        
        const fontPath = getFontPath(font);
        const wrappedText = wrapText(headlineTextValue, maxTextWidth, fontSize);
        const escapedText = escapeText(wrappedText);
        
        let finalFontPath = fontPath;
        const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
        if (fs.existsSync && !fs.existsSync(fontPath)) {
          console.warn(`[COMPOSER] ⚠️ Fonte não encontrada: ${fontPath}, usando fallback`);
          finalFontPath = isProduction 
            ? '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
            : '/System/Library/Fonts/Helvetica.ttc';
        }
        
        const headlineFilter = `${currentLabel}drawtext=fontfile='${finalFontPath}':text='${escapedText}':fontsize=${fontSize}:fontcolor=${color}:box=1:boxcolor=${boxColor}:boxborderw=${boxBorderWidth}:x=(w-text_w)/2:y=${yPos}[with_headline]`;
        filterParts.push(headlineFilter);
        currentLabel = '[with_headline]';
        console.log(`[COMPOSER] ✅ Headline adicionada no centro: "${headlineTextValue}"`);
      } else {
        console.log(`[COMPOSER] ⚠️ Headline não será adicionada`);
      }

      // 5. Adicionar vídeo de retenção (OPCIONAL - não bloquear geração se não disponível)
      // IMPORTANTE: Ajustar índice do input baseado na presença do background
      // Se retentionVideoId foi especificado mas não há caminho, continuar sem vídeo de retenção (não bloquear)
      let retentionStats = null;
      
      if (retentionVideoId && retentionVideoId !== 'none' && !retentionVideoPath) {
        console.warn(`[COMPOSER] ⚠️ Vídeo de retenção especificado (${retentionVideoId}) mas não encontrado. Continuando sem vídeo de retenção.`);
        retentionVideoPath = null; // Continuar sem vídeo de retenção
      }
      
      if (retentionVideoPath) {
        // VALIDAR que o arquivo existe e não está vazio (se não existir, continuar sem vídeo de retenção)
        if (!fs.existsSync(retentionVideoPath)) {
          console.warn(`[COMPOSER] ⚠️ Arquivo de vídeo de retenção não existe: ${retentionVideoPath}. Continuando sem vídeo de retenção.`);
          retentionVideoPath = null; // Continuar sem vídeo de retenção
        } else {
          try {
            retentionStats = fs.statSync(retentionVideoPath);
            if (retentionStats.size === 0) {
              console.warn(`[COMPOSER] ⚠️ Arquivo de vídeo de retenção está vazio: ${retentionVideoPath}. Continuando sem vídeo de retenção.`);
              retentionVideoPath = null; // Continuar sem vídeo de retenção
              retentionStats = null;
            }
          } catch (error) {
            console.error(`[COMPOSER] ❌ Erro ao validar vídeo de retenção: ${error.message}. Continuando sem vídeo de retenção.`);
            retentionVideoPath = null;
            retentionStats = null;
          }
        }
      }
      
      if (retentionVideoPath && retentionStats) {
        console.log(`[COMPOSER] ✅ Vídeo de retenção validado: ${retentionVideoPath} (${(retentionStats.size / 1024 / 1024).toFixed(2)} MB)`);
        // Se background existe, retention é input 2, senão é input 1
        const retentionInputIndex = fixedBackgroundPath ? 2 : 1;
        
        // Redimensionar vídeo de retenção para dimensões calculadas SEM CORTES
        // force_original_aspect_ratio=decrease garante que a imagem completa seja visível
        // Sem crop para evitar cortes - a imagem completa será exibida
        // IMPORTANTE: O vídeo de retenção será loopado automaticamente pelo FFmpeg no overlay
        // se for mais curto que o vídeo principal (usando shortest=0 no overlay)
        filterParts.push(`[${retentionInputIndex}:v]scale=${retentionWidth}:${retentionHeight}:force_original_aspect_ratio=decrease[retention_scaled]`);
        
        // Aplicar pad para garantir dimensões exatas e centralizar (sem cortes)
        // Usar cor preta (0x000000) que será transparente no overlay
        filterParts.push(`[retention_scaled]pad=${retentionWidth}:${retentionHeight}:(ow-iw)/2:(oh-ih)/2:color=0x000000[retention_padded]`);
        
        // Validar que não ultrapassa limite inferior do frame
        // HARDCODED: altura sempre 1920
        if (retentionY + retentionHeight > 1920) {
          throw new Error(`[COMPOSER] ❌ Vídeo de retenção ultrapassa limite: y=${retentionY}, altura=${retentionHeight}, total=${retentionY + retentionHeight}px > 1920px`);
        }
        if (retentionY < 0) {
          throw new Error(`[COMPOSER] ❌ Vídeo de retenção com posição inválida: y=${retentionY}px < 0`);
        }
        
        // Centralizar horizontalmente: x = (W-w)/2
        // IMPORTANTE: overlay preserva dimensões do primeiro input ([composed] = 1080x1920)
        // Base do conteúdo deve ficar exatamente a 140px acima da margem inferior
        // O overlay usará o vídeo de retenção sobre o vídeo composto
        // O vídeo de retenção será loopado automaticamente se for mais curto que o vídeo principal
        // Usar shortest=0 no overlay para garantir que use a duração do primeiro input (vídeo principal)
        filterParts.push(`${currentLabel}[retention_padded]overlay=(W-w)/2:${retentionY}:shortest=0[with_retention]`);
        currentLabel = '[with_retention]';
        console.log(`[COMPOSER] ✅ Vídeo de retenção processado e posicionado em y=${retentionY}px`);
        console.log(`[COMPOSER] ✅ Vídeo de retenção 100% visível: ${retentionWidth}x${retentionHeight}px, SEM CORTES, mantendo proporção original`);
        console.log(`[COMPOSER] ✅ Base do vídeo de retenção: ${retentionY + retentionHeight}px (exatamente ${BOTTOM_FREE_SPACE}px acima da margem inferior)`);
        console.log(`[COMPOSER] ✅ Centralizado horizontalmente: x=(W-w)/2`);
        console.log(`[COMPOSER] ✅ Overlay configurado para exibir vídeo de retenção sobre o vídeo composto`);
        console.log(`[COMPOSER] ✅ Vídeo de retenção será loopado automaticamente se necessário (shortest=0)`);
        console.log(`[COMPOSER] ✅ Overlay preserva dimensões: 1080x1920 (HARDCODED)`);
        console.log(`[COMPOSER] ✅ OBRIGATÓRIO: Vídeo de retenção está presente e será incluído no arquivo final`);
      } else if (retentionVideoId && retentionVideoId !== 'none') {
        // Se retentionVideoId foi especificado mas não há caminho, continuar sem vídeo de retenção (não bloquear)
        console.warn(`[COMPOSER] ⚠️ Vídeo de retenção especificado (${retentionVideoId}) mas não foi encontrado. Continuando sem vídeo de retenção.`);
      }

      // 6. Adicionar numeração "Parte X/Y" - CANTO SUPERIOR DIREITO
      // Numeração obrigatória e sempre visível durante todo o vídeo
      if (clipNumber !== null && clipNumber !== undefined && totalClips !== null && totalClips !== undefined) {
        const partText = `Parte ${clipNumber}/${totalClips}`;
        const partFontSize = 48; // Tamanho legível mas não intrusivo
        const partColor = '#FFFFFF'; // Branco para boa visibilidade
        const partStrokeColor = '#000000'; // Contorno preto para legibilidade em fundos claros
        const partStrokeWidth = 3; // Contorno espesso para garantir legibilidade
        
        // Posição: canto superior direito, respeitando margens de segurança de 80px
        // x = (w - text_w - 80) (80px da margem direita)
        // y = 80 (80px da margem superior)
        const PART_MARGIN = 80; // Margem de segurança conforme especificação
        const partX = `(w-text_w-${PART_MARGIN})`; // Parênteses para garantir avaliação correta da expressão
        const partY = PART_MARGIN;
        
        // Obter caminho da fonte (usar fonte da headline ou fallback)
        const partFont = headlineStyle.font || headlineStyle.fontFamily || 'Inter';
        const partFontPath = getFontPath(partFont);
        
        // Validar se a fonte existe
        let finalPartFontPath = partFontPath;
        const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
        if (fs.existsSync && !fs.existsSync(partFontPath)) {
          console.warn(`[COMPOSER] ⚠️ Fonte não encontrada para numeração: ${partFontPath}, usando fallback`);
          finalPartFontPath = isProduction 
            ? '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
            : '/System/Library/Fonts/Helvetica.ttc';
        }
        
        // Numeração SEMPRE VISÍVEL: Do primeiro ao último frame (100% da duração)
        // Sem enable= para aparecer em todos os frames, ou usar enable='gte(t,0)' para garantir
        const partTextEscaped = escapeText(partText);
        const partFilter = `${currentLabel}drawtext=fontfile='${finalPartFontPath}':text='${partTextEscaped}':fontsize=${partFontSize}:fontcolor=${partColor}:borderw=${partStrokeWidth}:bordercolor=${partStrokeColor}:x=${partX}:y=${partY}[with_part_number]`;
        filterParts.push(partFilter);
        currentLabel = '[with_part_number]';
        console.log(`[COMPOSER] ✅ Numeração adicionada: "${partText}"`);
        console.log(`[COMPOSER] Numeração posicionada no canto superior direito (x=${partX}, y=${partY}px)`);
        console.log(`[COMPOSER] Numeração sempre visível durante todo o vídeo (sem fade-out)`);
        console.log(`[COMPOSER] Fonte usada para numeração: ${finalPartFontPath}`);
      } else {
        console.log(`[COMPOSER] ⚠️ Numeração não será adicionada (clipNumber=${clipNumber}, totalClips=${totalClips})`);
      }

      // 7. Adicionar legendas (burn-in) - PARTE INFERIOR
      if (captions && captions.length > 0) {
        console.log(`[COMPOSER] ✅ Adicionando ${captions.length} legendas ao vídeo`);
        console.log(`[COMPOSER] Estilo de legendas: font=${captionStyle.font || 'Arial'}, fontSize=${captionStyle.fontSize || 48}, color=${captionStyle.color || '#FFFFFF'}`);
        
        captions.forEach((caption, index) => {
          const text = (caption.lines && caption.lines.length > 0) 
            ? caption.lines.join('\\n') 
            : (caption.text || '');
          
          if (!text || text.trim() === '') {
            console.warn(`[COMPOSER] ⚠️ Legenda ${index} está vazia, pulando...`);
            return; // Pular legendas vazias
          }
          
          const font = captionStyle.font || 'Arial';
          const fontSize = captionStyle.fontSize || 48;
          const color = captionStyle.color || '#FFFFFF';
          const strokeColor = captionStyle.strokeColor || '#000000';
          const strokeWidth = captionStyle.strokeWidth || 2;
          
          // Validar timestamps
          if (!caption.start && caption.start !== 0) {
            console.warn(`[COMPOSER] ⚠️ Legenda ${index} sem timestamp start, pulando...`);
            return;
          }
          if (!caption.end && caption.end !== 0) {
            console.warn(`[COMPOSER] ⚠️ Legenda ${index} sem timestamp end, pulando...`);
            return;
          }
          if (caption.end <= caption.start) {
            console.warn(`[COMPOSER] ⚠️ Legenda ${index} com end <= start (${caption.start}s - ${caption.end}s), pulando...`);
            return;
          }
          
          // Posição Y: acima da safe zone inferior (respeitando margens configuradas)
          // HARDCODED: altura sempre 1920
          const yPos = 1920 - safeZones.bottom;

          const inputLabel = index === 0 ? currentLabel : `[caption_${index - 1}]`;
          const outputLabel = `[caption_${index}]`;
          
          filterParts.push(`${inputLabel}drawtext=fontfile='${getFontPath(font)}':text='${escapeText(text)}':fontsize=${fontSize}:fontcolor=${color}:borderw=${strokeWidth}:bordercolor=${strokeColor}:x=(w-text_w)/2:y=${yPos}:enable='between(t,${caption.start},${caption.end})'${outputLabel}`);
          
          currentLabel = outputLabel;
          
          console.log(`[COMPOSER] ✅ Legenda ${index + 1}/${captions.length}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" [${caption.start}s - ${caption.end}s]`);
        });
        
        console.log(`[COMPOSER] ✅ Todas as legendas adicionadas ao filter_complex`);
      } else {
        console.log(`[COMPOSER] ⚠️ Nenhuma legenda para adicionar (captions=${captions?.length || 0})`);
      }
      
      // 8. Garantir resolução final 1080x1920 (FORÇAR OBRIGATORIAMENTE) - SEMPRE CRIAR [final]
      // FORÇAR formato vertical 9:16 (1080x1920) em TODAS as etapas
      // O background já tem 1080x1920, mas garantimos que [final] também tenha
      // IMPORTANTE: Sempre criar [final] a partir do currentLabel atual
      // FORÇAR dimensões exatas: 1080x1920 (hardcoded para garantir formato vertical)
      // Validar que currentLabel está definido antes de criar [final]
      if (!currentLabel || currentLabel.trim() === '') {
        console.error('[COMPOSER] ❌ ERRO: currentLabel não está definido antes de criar [final]');
        console.error('[COMPOSER] Filter parts até agora:', filterParts);
        return reject(new Error('currentLabel não está definido - não é possível criar [final]'));
      }
      
      // Usar force_original_aspect_ratio=increase para garantir que preencha todo o espaço
      // Depois crop para garantir dimensões EXATAS 1080x1920 sem distorção
      filterParts.push(`${currentLabel}scale=1080:1920:force_original_aspect_ratio=increase[final_scaled]`);
      // Crop para garantir dimensões EXATAS 1080x1920 (sem distorção, sem margem)
      filterParts.push(`[final_scaled]crop=1080:1920:0:0[final]`);
      console.log(`[COMPOSER] ✅ FORÇANDO resolução final para 1080x1920 (9:16 vertical) - HARDCODED OBRIGATÓRIO`);
      console.log(`[COMPOSER] ✅ Formato vertical garantido: scale=1080:1920:force_original_aspect_ratio=increase + crop=1080:1920:0:0`);
      console.log(`[COMPOSER] ✅ Dimensões finais EXATAS: 1080x1920 (sem exceções)`);
      console.log(`[COMPOSER] ✅ Label [final] criado a partir de: ${currentLabel}`);
      
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
      
      // Construir comando FFmpeg
      const command = ffmpeg();
      
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

      // Input 2 (ou 1 se não houver background): vídeo de retenção (OBRIGATÓRIO se especificado)
      // O vídeo de retenção será loopado automaticamente se for mais curto que o vídeo principal
      if (retentionVideoPath) {
        // Verificar se é URL (não mais suportado - apenas arquivos locais)
        const isUrl = retentionVideoPath.startsWith('http://') || retentionVideoPath.startsWith('https://');
        if (isUrl) {
          console.warn(`[COMPOSER] ⚠️ Vídeo de retenção ainda é URL. URLs não são mais suportadas. Use apenas arquivos locais na pasta retention-library/.`);
          console.warn(`[COMPOSER] ⚠️ Continuando sem vídeo de retenção.`);
          retentionVideoPath = null; // Continuar sem vídeo de retenção
        }
        
        if (!fs.existsSync(retentionVideoPath)) {
          console.warn(`[COMPOSER] ⚠️ Arquivo de retenção não existe: ${retentionVideoPath}. Continuando sem vídeo de retenção.`);
          retentionVideoPath = null; // Continuar sem vídeo de retenção
        } else {
          // Validar tamanho do arquivo
          const retentionStats = fs.statSync(retentionVideoPath);
          if (retentionStats.size === 0) {
            console.warn(`[COMPOSER] ⚠️ Arquivo de vídeo de retenção está vazio: ${retentionVideoPath}. Continuando sem vídeo de retenção.`);
            retentionVideoPath = null; // Continuar sem vídeo de retenção
          }
        }
      }
      
      if (retentionVideoPath) {
        // Validar novamente antes de adicionar ao ffmpeg
        let retentionStats = null;
        try {
          if (!fs.existsSync(retentionVideoPath)) {
            console.warn(`[COMPOSER] ⚠️ Arquivo de vídeo de retenção não existe: ${retentionVideoPath}. Continuando sem vídeo de retenção.`);
            retentionVideoPath = null;
          } else {
            retentionStats = fs.statSync(retentionVideoPath);
            if (retentionStats.size === 0) {
              console.warn(`[COMPOSER] ⚠️ Arquivo de vídeo de retenção está vazio: ${retentionVideoPath}. Continuando sem vídeo de retenção.`);
              retentionVideoPath = null;
            }
          }
        } catch (error) {
          console.error(`[COMPOSER] ❌ Erro ao validar vídeo de retenção antes do ffmpeg: ${error.message}. Continuando sem vídeo de retenção.`);
          retentionVideoPath = null;
        }
        
        if (retentionVideoPath && retentionStats) {
          // VALIDAR vídeo de retenção ANTES de adicionar
          if (!fs.existsSync(retentionVideoPath)) {
            console.warn(`[COMPOSER] ⚠️ Vídeo de retenção não existe: ${retentionVideoPath}. Continuando sem vídeo de retenção.`);
            retentionVideoPath = null;
          } else {
            const retentionStatsCheck = fs.statSync(retentionVideoPath);
            if (retentionStatsCheck.size === 0) {
              console.warn(`[COMPOSER] ⚠️ Vídeo de retenção está vazio: ${retentionVideoPath}. Continuando sem vídeo de retenção.`);
              retentionVideoPath = null;
            } else {
              // Adicionar input do vídeo de retenção
              // O vídeo será loopado automaticamente pelo FFmpeg no overlay se for mais curto
              // usando shortest=0 no overlay (já configurado abaixo)
              // Configurar loop infinito ANTES de adicionar o input
              const retentionInput = command.input(retentionVideoPath);
              retentionInput.inputOptions(['-stream_loop', '-1']); // Loopar vídeo de retenção infinitamente
              console.log(`[COMPOSER] ✅ Vídeo de retenção validado e adicionado como input ${fixedBackgroundPath ? 2 : 1} com loop infinito: ${retentionVideoPath} (${(retentionStatsCheck.size / 1024 / 1024).toFixed(2)} MB)`);
              console.log(`[COMPOSER] ✅ Vídeo de retenção será loopado automaticamente durante toda a duração do vídeo principal`);
              console.log(`[COMPOSER] ✅ Vídeo de retenção será concatenado/sobreposto ao final da timeline durante todo o render`);
            }
          }
        }
      } else if (retentionVideoId && retentionVideoId !== 'none') {
        // Se retentionVideoId foi especificado mas não há caminho, continuar sem vídeo de retenção (não bloquear)
        console.warn(`[COMPOSER] ⚠️ Vídeo de retenção especificado (${retentionVideoId}) mas não foi encontrado. Continuando sem vídeo de retenção.`);
      }

      // Aplicar filter_complex como string
      const filterComplex = filterParts.join(';');
      
      // Validar filter_complex antes de aplicar
      if (!filterComplex || filterComplex.trim() === '') {
        return reject(new Error('Filter complex está vazio'));
      }
      
      // Verificar se [final] existe no filter
      if (!filterComplex.includes('[final]')) {
        console.error('[COMPOSER] ❌ Label [final] não encontrado no filter_complex');
        console.error('[COMPOSER] Filter parts:', filterParts);
        console.error('[COMPOSER] Current label:', currentLabel);
        return reject(new Error('Label [final] não encontrado no filter_complex'));
      }
      
      // Verificar se há referências a labels que não existem
      const labelPattern = /\[([^\]]+)\]/g;
      const usedLabels = new Set();
      const definedLabels = new Set();
      let match;
      
      while ((match = labelPattern.exec(filterComplex)) !== null) {
        const label = match[1];
        if (label.includes(':')) {
          // É um input como [0:v] ou [1:v], ignorar
          continue;
        }
        // Verificar se label foi definido antes de ser usado
        const labelDefIndex = filterComplex.indexOf(`=${label}]`);
        const labelUseIndex = filterComplex.indexOf(`[${label}]`);
        if (labelDefIndex !== -1 && labelUseIndex !== -1 && labelUseIndex < labelDefIndex) {
          // Label usado antes de ser definido - isso é um problema
          usedLabels.add(label);
        }
        if (labelDefIndex !== -1) {
          definedLabels.add(label);
        }
      }
      
      // Verificar se [final] foi definido
      if (!definedLabels.has('final')) {
        console.error('[COMPOSER] ❌ Label [final] não foi definido no filter_complex!');
        console.error('[COMPOSER] Filter parts:', filterParts);
        console.error('[COMPOSER] Current label:', currentLabel);
        return reject(new Error('Label [final] não foi definido no filter_complex'));
      }
      
      // Log completo do filter (limitado a 1000 chars para debug)
      console.log('[COMPOSER] Filter complex (primeiros 1000 chars):', filterComplex.substring(0, 1000));
      console.log('[COMPOSER] Total de filtros:', filterParts.length);
      console.log('[COMPOSER] Labels definidos:', Array.from(definedLabels));
      console.log('[COMPOSER] Labels usados antes de definição:', Array.from(usedLabels));
      
      // Log completo do filter para debug de erros
      if (filterComplex.length > 1000) {
        console.log('[COMPOSER] Filter complex (restante):', filterComplex.substring(1000));
      }
      
      // Validar que todos os inputs referenciados existem
      const inputPattern = /\[(\d+):[av]\]/g;
      const referencedInputs = new Set();
      while ((match = inputPattern.exec(filterComplex)) !== null) {
        referencedInputs.add(parseInt(match[1]));
      }
      
      // Verificar se todos os inputs referenciados foram adicionados
      const maxInputIndex = Math.max(...Array.from(referencedInputs), -1);
      if (maxInputIndex >= inputCount) {
        console.error(`[COMPOSER] ❌ Filter complex referencia input ${maxInputIndex} mas apenas ${inputCount} inputs foram adicionados`);
        return reject(new Error(`Filter complex referencia input ${maxInputIndex} mas apenas ${inputCount} inputs foram adicionados`));
      }
      
      try {
        command.complexFilter(filterComplex);
      } catch (filterError) {
        console.error('[COMPOSER] ❌ Erro ao aplicar filter_complex:', filterError);
        console.error('[COMPOSER] Filter complex completo:', filterComplex);
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
        '-preset', 'medium',
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
          if (progress.percent !== undefined && progress.percent !== null) {
            const percent = Math.min(100, Math.max(0, Math.round(progress.percent)));
            if (onProgress) {
              onProgress(percent);
            }
            console.log(`[COMPOSER] Progresso: ${percent}%`);
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
          // Capturar stderr completo
          const fullStderr = stderr || ffmpegStderr || '';
          const fullStdout = stdout || ffmpegStdout || '';
          
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
          const detailedError = `[COMPOSER] Erro no FFmpeg durante composição: ${err.message}\n\n` +
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
