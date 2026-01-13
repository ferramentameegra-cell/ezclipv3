/**
 * CONTROLLER DE LEGENDAS
 * Gerencia geração, edição e renderização de legendas
 */

import { generateCaptions, validateCaptions } from '../services/captionService.js';
import { renderVideoWithCaptions } from '../services/captionRenderer.js';
import { videoStore } from './downloadProgressController.js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/captions/generate
 * Gera legendas automaticamente a partir de um vídeo
 */
export async function generateCaptionsForVideo(req, res) {
  try {
    const { videoId } = req.body;

    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'videoId é obrigatório'
      });
    }

    // Verificar se OpenAI API key está configurada
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'OpenAI API key não configurada. Configure OPENAI_API_KEY no ambiente.'
      });
    }

    // Buscar vídeo no store
    const video = videoStore.get(videoId);
    if (!video || !video.path || !fs.existsSync(video.path)) {
      return res.status(404).json({
        success: false,
        error: 'Vídeo não encontrado'
      });
    }

    const options = {
      maxLinesPerBlock: req.body.maxLinesPerBlock || 2,
      maxCharsPerLine: req.body.maxCharsPerLine || 40,
      highlightKeywords: req.body.highlightKeywords !== false
    };

    console.log(`[CAPTION] Gerando legendas para vídeo: ${videoId}`);
    console.log(`[CAPTION] OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✅ Configurada' : '❌ Não configurada'}`);

    // Gerar legendas
    const result = await generateCaptions(video.path, options);

    // Salvar legendas no store do vídeo
    if (!video.captions) {
      video.captions = {};
    }
    video.captions.raw = result.captions;
    video.captions.language = result.language;
    video.captions.totalDuration = result.totalDuration;
    videoStore.set(videoId, video);

    return res.json({
      success: true,
      captions: result.captions,
      language: result.language,
      totalDuration: result.totalDuration
    });
  } catch (error) {
    console.error('[CAPTION] Erro ao gerar legendas:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * POST /api/captions/update
 * Atualiza legendas editadas pelo usuário
 */
export async function updateCaptions(req, res) {
  try {
    const { videoId, captions } = req.body;

    if (!videoId || !captions) {
      return res.status(400).json({
        success: false,
        error: 'videoId e captions são obrigatórios'
      });
    }

    // Validar estrutura
    validateCaptions(captions);

    // Buscar vídeo
    const video = videoStore.get(videoId);
    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Vídeo não encontrado'
      });
    }

    // Atualizar legendas
    if (!video.captions) {
      video.captions = {};
    }
    video.captions.edited = captions;
    videoStore.set(videoId, video);

    return res.json({
      success: true,
      message: 'Legendas atualizadas com sucesso'
    });
  } catch (error) {
    console.error('[CAPTION] Erro ao atualizar legendas:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * GET /api/captions/:videoId
 * Retorna legendas de um vídeo
 */
export function getCaptions(req, res) {
  try {
    const { videoId } = req.params;

    const video = videoStore.get(videoId);
    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Vídeo não encontrado'
      });
    }

    const captions = video.captions?.edited || video.captions?.raw || [];

    return res.json({
      success: true,
      captions,
      language: video.captions?.language,
      totalDuration: video.captions?.totalDuration
    });
  } catch (error) {
    console.error('[CAPTION] Erro ao buscar legendas:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * POST /api/captions/render
 * Renderiza vídeo com legendas e headline
 */
export async function renderVideoWithCaptionsEndpoint(req, res) {
  try {
    const { videoId, style, headline } = req.body;

    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'videoId é obrigatório'
      });
    }

    // Buscar vídeo
    const video = videoStore.get(videoId);
    if (!video || !video.path || !fs.existsSync(video.path)) {
      return res.status(404).json({
        success: false,
        error: 'Vídeo não encontrado'
      });
    }

    // Obter legendas
    const captions = video.captions?.edited || video.captions?.raw || [];
    if (captions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhuma legenda encontrada. Gere legendas primeiro.'
      });
    }

    // Estilo padrão se não fornecido
    const defaultStyle = {
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
        opacity: 0.6,
        padding: 10,
        borderRadius: 8
      },
      position: 'bottom',
      animation: 'fade'
    };

    const finalStyle = { ...defaultStyle, ...style };

    // Criar arquivo de saída
    const outputId = uuidv4();
    const outputDir = path.join(process.cwd(), 'tmp', 'renders');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, `${outputId}.mp4`);

    console.log(`[CAPTION] Renderizando vídeo: ${videoId} -> ${outputId}`);

    // Renderizar
    await renderVideoWithCaptions(
      video.path,
      outputPath,
      captions,
      finalStyle,
      headline
    );

    // Salvar vídeo renderizado no store
    const renderedVideo = {
      id: outputId,
      originalVideoId: videoId,
      path: outputPath,
      style: finalStyle,
      headline,
      renderedAt: new Date()
    };

    videoStore.set(outputId, renderedVideo);

    return res.json({
      success: true,
      videoId: outputId,
      path: outputPath,
      downloadUrl: `/api/captions/download/${outputId}`
    });
  } catch (error) {
    console.error('[CAPTION] Erro ao renderizar:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * GET /api/captions/download/:videoId
 * Download do vídeo renderizado
 */
export function downloadRenderedVideo(req, res) {
  try {
    const { videoId } = req.params;

    const video = videoStore.get(videoId);
    if (!video || !video.path || !fs.existsSync(video.path)) {
      return res.status(404).json({
        success: false,
        error: 'Vídeo renderizado não encontrado'
      });
    }

    const stat = fs.statSync(video.path);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const [startStr, endStr] = range.replace('bytes=', '').split('-');
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : fileSize - 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': 'video/mp4'
      });

      fs.createReadStream(video.path, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4'
      });
      fs.createReadStream(video.path).pipe(res);
    }
  } catch (error) {
    console.error('[CAPTION] Erro ao fazer download:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
