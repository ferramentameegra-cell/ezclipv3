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
  format = '9:16', // FORMATO FIXO: Sempre 9:16 (1080x1920) vertical
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
  
  // FORMATO FIXO: Sempre 9:16 (1080x1920) vertical para todos os vídeos gerados
  // Garantir que o formato seja sempre 9:16, independente do parâmetro recebido
  const finalFormat = '9:16';
  const { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT } = getFormatDimensions(finalFormat);
  const safeZones = getSafeZones(finalFormat, platforms, safeMargins);
  
  console.log(`[COMPOSER] ⚠️ Formato forçado para 9:16 (1080x1920) - formato recebido: ${format} foi ignorado`);
  
  // POSIÇÕES FIXAS E VALIDADAS (1080x1920):
  // - Margem superior: 230px (vídeo principal começa aqui)
  // - Margem inferior: 230px (vídeo de retenção termina aqui)
  // - Vídeo principal: y=230px (topo fixo)
  // - Vídeo de retenção: base a 230px da margem inferior (y=1920-230-RETENTION_HEIGHT)
  const TOP_MARGIN = 230; // Margem superior fixa
  const BOTTOM_MARGIN = 230; // Margem inferior fixa
  
  // Calcular alturas baseadas nas posições fixas
  // RETENTION_HEIGHT: altura fixa do vídeo de retenção (240px padrão)
  const RETENTION_HEIGHT = 240; // Altura fixa do vídeo de retenção
  
  // MAIN_VIDEO_HEIGHT: altura disponível para vídeo principal
  // Espaço total: 1920px
  // Menos margens: 1920 - 230 (topo) - 230 (base) = 1460px
  // Menos retenção: 1460 - 240 = 1220px disponível para vídeo principal
  // Mas vamos usar o espaço até o início do vídeo de retenção
  const retentionStartY = OUTPUT_HEIGHT - BOTTOM_MARGIN - RETENTION_HEIGHT; // 1920 - 230 - 240 = 1450px
  const MAIN_VIDEO_HEIGHT = retentionStartY - TOP_MARGIN; // 1450 - 230 = 1220px
  
  // VALIDAÇÃO: Garantir que não há overflow
  if (MAIN_VIDEO_HEIGHT <= 0) {
    throw new Error(`[COMPOSER] ❌ Altura do vídeo principal inválida: ${MAIN_VIDEO_HEIGHT}px. Ajuste as margens.`);
  }
  if (retentionStartY + RETENTION_HEIGHT > OUTPUT_HEIGHT) {
    throw new Error(`[COMPOSER] ❌ Vídeo de retenção ultrapassa limite: y=${retentionStartY}, altura=${RETENTION_HEIGHT}, total=${retentionStartY + RETENTION_HEIGHT}px > ${OUTPUT_HEIGHT}px`);
  }
  
  console.log(`[COMPOSER] Layout vertical 9:16: ${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}`);
  console.log(`[COMPOSER] ✅ Posições fixas: Topo=${TOP_MARGIN}px, Base=${BOTTOM_MARGIN}px`);
  console.log(`[COMPOSER] Vídeo principal: ${OUTPUT_WIDTH}x${MAIN_VIDEO_HEIGHT} (y=${TOP_MARGIN}px - topo fixo)`);
  console.log(`[COMPOSER] Vídeo retenção: ${OUTPUT_WIDTH}x${RETENTION_HEIGHT} (y=${retentionStartY}px, base a ${BOTTOM_MARGIN}px da margem inferior)`);

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
        filterParts.push(`[${backgroundInputIndex}:v]scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:force_original_aspect_ratio=increase[bg_scaled]`);
        filterParts.push(`[bg_scaled]crop=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}[bg_fixed]`);
        console.log(`[COMPOSER] Background fixo aplicado como layer 0`);
      } else {
        // Fallback: criar background sólido se imagem não existir
        filterParts.push(`color=c=${backgroundColor.replace('#', '')}:s=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:d=${videoDuration}[bg_fixed]`);
        console.log(`[COMPOSER] Usando background sólido (fallback)`);
      }

      // 2. Redimensionar vídeo principal para altura fixa (sem padding, sem distorção)
      // force_original_aspect_ratio=decrease garante que não distorça
      // Vídeo será redimensionado para caber exatamente em MAIN_VIDEO_HEIGHT
      filterParts.push(`${currentLabel}scale=${OUTPUT_WIDTH}:${MAIN_VIDEO_HEIGHT}:force_original_aspect_ratio=decrease[main_scaled]`);
      currentLabel = '[main_scaled]';

      // 3. Sobrepor vídeo principal no background (POSIÇÃO FIXA: y=230px)
      // Vídeo fica acima do background (layer 1)
      // IMPORTANTE: overlay preserva dimensões do primeiro input ([bg_fixed] = 1080x1920)
      // Posição FIXA: x=(W-w)/2 (centralizado horizontalmente), y=230px (margem superior fixa)
      // VALIDAÇÃO: Posição fixa, sem variação automática, sem scaling dinâmico, sem overflow
      const MAIN_VIDEO_Y = TOP_MARGIN; // 230px fixo
      filterParts.push(`[bg_fixed]${currentLabel}overlay=(W-w)/2:${MAIN_VIDEO_Y}[composed]`);
      currentLabel = '[composed]';
      console.log(`[COMPOSER] ✅ Vídeo principal posicionado em y=${MAIN_VIDEO_Y}px (posição fixa, sem variação, sem scaling dinâmico)`);
      console.log(`[COMPOSER] Overlay preserva dimensões do background: ${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}`);

      // 4. Adicionar vídeo de retenção (se houver) - POSIÇÃO FIXA INFERIOR
      // IMPORTANTE: Ajustar índice do input baseado na presença do background
      if (retentionVideoPath) {
        // Se background existe, retention é input 2, senão é input 1
        const retentionInputIndex = fixedBackgroundPath ? 2 : 1;
        
        // Redimensionar vídeo de retenção para altura FIXA (240px) SEM CORTES
        // force_original_aspect_ratio=decrease garante que a imagem completa seja visível
        // Sem crop para evitar cortes - a imagem completa será exibida
        // Pad será aplicado se necessário para centralizar
        filterParts.push(`[${retentionInputIndex}:v]scale=${OUTPUT_WIDTH}:${RETENTION_HEIGHT}:force_original_aspect_ratio=decrease[retention_scaled]`);
        // Aplicar pad para garantir dimensões exatas e centralizar (sem cortes)
        // Pad com cor transparente (0x00000000) para manter background visível nas bordas
        filterParts.push(`[retention_scaled]pad=${OUTPUT_WIDTH}:${RETENTION_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=0x00000000[retention_padded]`);
        
        // POSIÇÃO FIXA: Base do vídeo de retenção a 230px da margem inferior
        // y = OUTPUT_HEIGHT - BOTTOM_MARGIN - RETENTION_HEIGHT
        // y = 1920 - 230 - 240 = 1450px
        // VALIDAÇÃO: Garantir que vídeo está 100% visível, SEM CORTES, IMAGEM COMPLETA
        const retentionY = OUTPUT_HEIGHT - BOTTOM_MARGIN - RETENTION_HEIGHT; // 1450px fixo
        
        // Validar que não ultrapassa limite inferior do frame
        if (retentionY + RETENTION_HEIGHT > OUTPUT_HEIGHT) {
          throw new Error(`[COMPOSER] ❌ Vídeo de retenção ultrapassa limite: y=${retentionY}, altura=${RETENTION_HEIGHT}, total=${retentionY + RETENTION_HEIGHT}px > ${OUTPUT_HEIGHT}px`);
        }
        if (retentionY < 0) {
          throw new Error(`[COMPOSER] ❌ Vídeo de retenção com posição inválida: y=${retentionY}px < 0`);
        }
        
        // Centralizar horizontalmente: x = (W-w)/2
        // IMPORTANTE: overlay preserva dimensões do primeiro input ([composed] = 1080x1920)
        // Nenhuma parte pode ultrapassar o limite inferior do frame
        filterParts.push(`${currentLabel}[retention_padded]overlay=(W-w)/2:${retentionY}[with_retention]`);
        currentLabel = '[with_retention]';
        console.log(`[COMPOSER] ✅ Vídeo de retenção posicionado em y=${retentionY}px (base a ${BOTTOM_MARGIN}px da margem inferior, posição fixa)`);
        console.log(`[COMPOSER] ✅ Vídeo de retenção 100% visível: ${OUTPUT_WIDTH}x${RETENTION_HEIGHT}px, SEM CORTES, IMAGEM COMPLETA`);
        console.log(`[COMPOSER] ✅ Nenhuma parte ultrapassa o limite inferior do frame`);
        console.log(`[COMPOSER] Overlay preserva dimensões: ${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}`);
      }

      // 5. Adicionar headline PRIMEIRO (CENTRO VERTICAL do frame)
      // Headline fica acima de tudo (exceto legendas que ficam na parte inferior)
      const hasHeadline = headlineText || (headline && headline.text);
      console.log(`[COMPOSER] Verificando headline: headlineText="${headlineText}", headline.text="${headline?.text}", hasHeadline=${hasHeadline}`);
      
      if (hasHeadline) {
        const headlineTextValue = headlineText || headline.text;
        const font = headlineStyle.font || headlineStyle.fontFamily || 'Arial';
        const fontSize = headlineStyle.fontSize || 72;
        const color = headlineStyle.color || '#FFFFFF';
        // HEADLINE SEMPRE VISÍVEL: Do primeiro ao último frame (100% da duração)
        // Removido startTime e endTime - headline permanece visível sempre
        const startTime = 0;
        const endTime = videoDuration; // Até o final do vídeo

        // Posição Y: centro vertical exato - meio do frame (960px em 1920px)
        // Usar (h-text_h)/2 para centralizar verticalmente considerando altura do texto
        // Centralizar horizontalmente: x=(w-text_w)/2
        
        // QUEBRA DE TEXTO AUTOMÁTICA: Usar box com largura limitada
        // Margens laterais de 10% (108px de cada lado) = largura máxima de 864px (80% da largura)
        // Isso garante que o texto não ultrapasse as margens do vídeo 1080x1920
        const maxTextWidth = Math.round(OUTPUT_WIDTH * 0.8); // 80% da largura (864px)
        const marginX = Math.round((OUTPUT_WIDTH - maxTextWidth) / 2); // Margem lateral (108px)
        
        const yPos = `(h-text_h)/2`;
        
        // drawtext com quebra de texto automática usando box:
        // - box=1: habilita caixa de texto (necessário para quebra automática)
        // - boxw: largura máxima da caixa (força quebra de texto)
        // - boxcolor: cor da caixa (transparente para não aparecer)
        // - text_align: alinhamento do texto dentro da caixa (centro)
        // - x: centralizado (w-text_w)/2 garante centralização
        // - fix_bounds=1: garante que o texto não ultrapasse os limites
        // - line_spacing: espaçamento entre linhas (10% do tamanho da fonte)
        const lineSpacing = Math.round(fontSize * 0.1);
        
        // Usar box transparente para forçar quebra de texto automática
        // box=1 habilita caixa, boxw limita largura (força quebra), boxcolor transparente
        // x=(w-text_w)/2 centraliza horizontalmente, y=(h-text_h)/2 centraliza verticalmente
        const boxBorderWidth = 0;
        const boxColor = '0x00000000'; // Transparente
        
        // Obter caminho da fonte e validar
        const fontPath = getFontPath(font);
        
        // Quebrar texto automaticamente baseado na largura máxima
        const wrappedText = wrapText(headlineTextValue, maxTextWidth, fontSize);
        const escapedText = escapeText(wrappedText);
        
        // Validar se a fonte existe (em produção pode não existir)
        // Se não existir, usar fonte padrão do sistema
        let finalFontPath = fontPath;
        const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
        if (fs.existsSync && !fs.existsSync(fontPath)) {
          console.warn(`[COMPOSER] ⚠️ Fonte não encontrada: ${fontPath}, usando fallback`);
          finalFontPath = isProduction 
            ? '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
            : '/System/Library/Fonts/Helvetica.ttc';
        }
        
        // Construir filter de headline
        // NOTA: boxw só disponível no FFmpeg 6.x, então usamos quebra manual via wrapText
        // box=1 com boxcolor transparente para melhor renderização (opcional)
        // HEADLINE SEMPRE VISÍVEL: Removido enable para aparecer em todos os frames
        // Se necessário, usar enable='gte(t,0)' para garantir do início ao fim
        const headlineFilter = `${currentLabel}drawtext=fontfile='${finalFontPath}':text='${escapedText}':fontsize=${fontSize}:fontcolor=${color}:box=1:boxcolor=${boxColor}:boxborderw=${boxBorderWidth}:x=(w-text_w)/2:y=${yPos}[with_headline]`;
        filterParts.push(headlineFilter);
        currentLabel = '[with_headline]';
        console.log(`[COMPOSER] ✅ Headline adicionada: "${headlineTextValue}"`);
        console.log(`[COMPOSER] Headline quebrada automaticamente: "${wrappedText}"`);
        console.log(`[COMPOSER] Headline configurada: tamanho=${fontSize}px, cor=${color}, largura máxima=${maxTextWidth}px`);
        console.log(`[COMPOSER] Headline posicionada no centro vertical (y=(h-text_h)/2), centralizada horizontalmente`);
        console.log(`[COMPOSER] Fonte usada: ${finalFontPath}`);
      } else {
        console.log(`[COMPOSER] ⚠️ Headline não será adicionada (headlineText e headline.text estão vazios)`);
      }

      // 6. Adicionar legendas (burn-in) - PARTE INFERIOR
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
      
      // 7. GARANTIR resolução final 1080x1920 (FORÇAR) - SEMPRE CRIAR [final]
      // O background já tem 1080x1920, mas garantimos que [final] também tenha
      // Isso garante que o output seja sempre 1080x1920 vertical
      // IMPORTANTE: Sempre criar [final] a partir do currentLabel atual
      // O currentLabel já tem 1080x1920 (do background via overlay), mas garantimos com scale+pad
      // Usar scale com force_original_aspect_ratio=decrease para não distorcer, depois pad para garantir dimensões
      filterParts.push(`${currentLabel}scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease[final_scaled]`);
      // Pad para garantir dimensões exatas 1080x1920 (mesmo que já esteja correto)
      const padColor = backgroundColor.replace('#', '');
      filterParts.push(`[final_scaled]pad=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=${padColor}[final]`);
      console.log(`[COMPOSER] ✅ Forçando resolução final para ${OUTPUT_WIDTH}x${OUTPUT_HEIGHT} (9:16 vertical)`);
      
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
        if (filterComplex.indexOf(`[${label}]`) < filterComplex.indexOf(`=${label}]`)) {
          // Label usado antes de ser definido
          usedLabels.add(label);
        } else {
          // Label definido
          definedLabels.add(label);
        }
      }
      
      // Log completo do filter (limitado a 1000 chars para debug)
      console.log('[COMPOSER] Filter complex (primeiros 1000 chars):', filterComplex.substring(0, 1000));
      console.log('[COMPOSER] Total de filtros:', filterParts.length);
      console.log('[COMPOSER] Labels definidos:', Array.from(definedLabels));
      console.log('[COMPOSER] Labels usados:', Array.from(usedLabels));
      
      // Log completo do filter para debug de erros
      if (filterComplex.length > 1000) {
        console.log('[COMPOSER] Filter complex (restante):', filterComplex.substring(1000));
      }
      
      try {
        command.complexFilter(filterComplex);
      } catch (filterError) {
        console.error('[COMPOSER] ❌ Erro ao aplicar filter_complex:', filterError);
        console.error('[COMPOSER] Filter complex completo:', filterComplex);
        return reject(new Error(`Erro ao criar filter_complex: ${filterError.message}`));
      }

      // Mapear saída e configurar codecs
      // FORÇAR resolução 1080x1920 explicitamente (formato vertical 9:16)
      // [final] sempre existe após a etapa 6 e já tem as dimensões corretas
      // NÃO usar -vf aqui pois já temos complexFilter que força as dimensões
      const outputOptions = [
        '-map', '[final]',
        '-s', `${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}`, // FORÇAR 1080x1920
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-aspect', '9:16' // FORÇAR aspect ratio 9:16
      ];
      
      console.log(`[COMPOSER] ✅ Forçando resolução de saída: ${OUTPUT_WIDTH}x${OUTPUT_HEIGHT} (9:16 vertical)`);
      console.log(`[COMPOSER] Usando label final: [final]`);
      console.log(`[COMPOSER] Background fixo: ${fixedBackgroundPath ? 'SIM' : 'NÃO'}`);
      console.log(`[COMPOSER] Headline: ${(headlineText || (headline && headline.text)) ? 'SIM' : 'NÃO'}`);

      // Adicionar áudio se existir
      if (hasAudio) {
        outputOptions.push('-map', '0:a?', '-c:a', 'aac', '-b:a', '128k');
      }

      // Shortest para garantir que termine quando o vídeo mais curto terminar
      if (retentionVideoPath) {
        outputOptions.push('-shortest');
      }

      command.outputOptions(outputOptions);

      // Configurar saída - FORÇAR 1080x1920 vertical
      // IMPORTANTE: Não usar .size() e .aspect() quando já temos complexFilter
      // O complexFilter já força as dimensões através do [final] que tem 1080x1920
      command
        .on('start', (cmdline) => {
          console.log('[COMPOSER] Comando iniciado');
          console.log(`[COMPOSER] Saída FORÇADA: ${OUTPUT_WIDTH}x${OUTPUT_HEIGHT} (9:16 vertical)`);
          console.log(`[COMPOSER] Aspect ratio FORÇADO: 9:16`);
          console.log(`[COMPOSER] Background fixo: ${fixedBackgroundPath ? 'SIM ✅' : 'NÃO ❌'}`);
          console.log(`[COMPOSER] Headline: ${(headlineText || (headline && headline.text)) ? 'SIM ✅' : 'NÃO ❌'}`);
          console.log(`[COMPOSER] Safe zones: topo ${safeZones.top}px, rodapé ${safeZones.bottom}px`);
          console.log(`[COMPOSER] Comando FFmpeg: ${cmdline}`);
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
          
          // VALIDAR resolução final do vídeo gerado
          ffmpeg.ffprobe(outputPath, (err, metadata) => {
            if (!err && metadata?.streams) {
              const videoStream = metadata.streams.find(s => s.codec_type === 'video');
              if (videoStream) {
                const actualWidth = videoStream.width;
                const actualHeight = videoStream.height;
                console.log(`[COMPOSER] ✅ Resolução de saída: ${actualWidth}x${actualHeight}`);
                if (actualWidth !== OUTPUT_WIDTH || actualHeight !== OUTPUT_HEIGHT) {
                  console.warn(`[COMPOSER] ⚠️ ATENÇÃO: Resolução esperada ${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}, mas obteve ${actualWidth}x${actualHeight}`);
                } else {
                  console.log(`[COMPOSER] ✅ Resolução correta: ${OUTPUT_WIDTH}x${OUTPUT_HEIGHT} (9:16)`);
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

export default composeFinalVideo;
