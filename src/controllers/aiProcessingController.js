/**
 * AI PROCESSING CONTROLLER
 * 
 * Integra serviços de IA para processar vídeos:
 * - Transcrição (Whisper)
 * - Decisão de clips (GPT-4)
 * - Corte de vídeo (FFmpeg)
 * - Overlay opcional (FFmpeg)
 */

import { transcribeVideo } from '../services/transcriptionService.js';
import { decideBestClips } from '../services/clipDecisionService.js';
import { trimVideo } from '../services/videoTrimmer.js';
import { addRetentionOverlaySimple } from '../services/videoOverlayService.js';
import { videoStore } from './downloadProgressController.js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const OUTPUT_DIR = '/tmp/uploads/clips';

/**
 * POST /api/ai/transcribe
 * Transcreve vídeo usando Whisper API
 */
export const transcribeVideoEndpoint = async (req, res) => {
  try {
    const { videoId } = req.body;

    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'videoId é obrigatório'
      });
    }

    // Buscar vídeo no store
    const video = videoStore.get(videoId);
    if (!video || !video.path) {
      return res.status(404).json({
        success: false,
        error: 'Vídeo não encontrado'
      });
    }

    if (!fs.existsSync(video.path)) {
      return res.status(404).json({
        success: false,
        error: 'Arquivo de vídeo não existe no disco'
      });
    }

    console.log(`[AI-TRANSCRIBE] Transcrevendo: ${video.path}`);

    const transcription = await transcribeVideo(video.path, req.body.language || 'pt');

    return res.json({
      success: true,
      videoId,
      transcription
    });

  } catch (error) {
    console.error('[AI-TRANSCRIBE] Erro:', error);
    
    // Erros específicos
    if (error.message.includes('API key')) {
      return res.status(500).json({
        success: false,
        error: 'Configuração de API inválida. Verifique OPENAI_API_KEY.'
      });
    }

    if (error.message.includes('Rate limit')) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit excedido. Aguarde alguns instantes e tente novamente.'
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/ai/generate-clips
 * Gera clips usando IA (transcrição + decisão + corte)
 */
export const generateClipsWithAI = async (req, res) => {
  try {
    const {
      videoId,
      nicheId,
      clipDuration = 60,
      numberOfClips,
      retentionVideoId = null,
      language = 'pt'
    } = req.body;

    // Validações
    if (!videoId || !nicheId) {
      return res.status(400).json({
        success: false,
        error: 'videoId e nicheId são obrigatórios'
      });
    }

    if (![60, 120].includes(clipDuration)) {
      return res.status(400).json({
        success: false,
        error: 'clipDuration deve ser 60 ou 120 segundos'
      });
    }

    if (!numberOfClips || numberOfClips <= 0) {
      return res.status(400).json({
        success: false,
        error: 'numberOfClips deve ser maior que zero'
      });
    }

    // Buscar vídeo
    const video = videoStore.get(videoId);
    if (!video || !video.path) {
      return res.status(404).json({
        success: false,
        error: 'Vídeo não encontrado'
      });
    }

    if (!fs.existsSync(video.path)) {
      return res.status(404).json({
        success: false,
        error: 'Arquivo de vídeo não existe'
      });
    }

    const videoDuration = video.duration || 0;
    if (videoDuration === 0) {
      return res.status(400).json({
        success: false,
        error: 'Duração do vídeo não disponível'
      });
    }

    console.log(`[AI-GENERATE] Iniciando geração de clips: ${videoId}, ${numberOfClips} clips de ${clipDuration}s`);

    // Passo 1: Transcrever
    console.log('[AI-GENERATE] Passo 1/4: Transcrevendo vídeo...');
    let transcription;
    try {
      transcription = await transcribeVideo(video.path, language);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: `Falha na transcrição: ${error.message}`
      });
    }

    if (!transcription.segments || transcription.segments.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Transcrição vazia. Não é possível gerar clips.'
      });
    }

    // Passo 2: Decidir melhores clips com IA
    console.log('[AI-GENERATE] Passo 2/4: Decidindo melhores momentos com IA...');
    let selectedClips;
    try {
      selectedClips = await decideBestClips(
        transcription.segments,
        clipDuration,
        nicheId,
        numberOfClips,
        videoDuration
      );
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: `Falha na decisão de clips: ${error.message}`
      });
    }

    if (selectedClips.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'IA não selecionou nenhum clip válido'
      });
    }

    // Passo 3: Cortar vídeos
    console.log('[AI-GENERATE] Passo 3/4: Cortando vídeos...');
    const seriesId = uuidv4();
    const clipsDir = path.join(OUTPUT_DIR, seriesId);
    
    if (!fs.existsSync(clipsDir)) {
      fs.mkdirSync(clipsDir, { recursive: true });
    }

    const generatedClips = [];
    
    for (let i = 0; i < selectedClips.length; i++) {
      const clip = selectedClips[i];
      const clipOutputPath = path.join(clipsDir, `clip_${String(i + 1).padStart(3, '0')}.mp4`);

      try {
        await trimVideo(video.path, clipOutputPath, clip.start, clip.end);
        generatedClips.push({
          index: i + 1,
          start: clip.start,
          end: clip.end,
          duration: clip.end - clip.start,
          headline: clip.headline,
          path: clipOutputPath,
          url: `/api/ai/clip/${seriesId}/${i + 1}`
        });
      } catch (error) {
        console.error(`[AI-GENERATE] Erro ao cortar clip ${i + 1}: ${error.message}`);
        // Continuar com os outros clips
      }
    }

    if (generatedClips.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Nenhum clip foi gerado com sucesso'
      });
    }

    // Passo 4: Adicionar overlay opcional
    if (retentionVideoId) {
      console.log('[AI-GENERATE] Passo 4/4: Adicionando overlay de retenção...');
      // TODO: Buscar vídeo de retenção e aplicar overlay
      // Por enquanto, retornar sem overlay
      console.log('[AI-GENERATE] Overlay de retenção ainda não implementado');
    }

    console.log(`[AI-GENERATE] Geração concluída: ${generatedClips.length} clips gerados`);

    return res.json({
      success: true,
      seriesId,
      clips: generatedClips,
      transcription: {
        text: transcription.text,
        segmentsCount: transcription.segments.length
      }
    });

  } catch (error) {
    console.error('[AI-GENERATE] Erro:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/ai/clip/:seriesId/:index
 * Servir clip gerado
 */
export const serveClip = (req, res) => {
  try {
    const { seriesId, index } = req.params;
    const clipPath = path.join(OUTPUT_DIR, seriesId, `clip_${String(index).padStart(3, '0')}.mp4`);

    if (!fs.existsSync(clipPath)) {
      return res.status(404).json({
        error: 'Clip não encontrado'
      });
    }

    const stat = fs.statSync(clipPath);
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

      fs.createReadStream(clipPath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4'
      });
      fs.createReadStream(clipPath).pipe(res);
    }
  } catch (error) {
    console.error('[AI-SERVE] Erro:', error);
    res.status(500).json({ error: error.message });
  }
};

