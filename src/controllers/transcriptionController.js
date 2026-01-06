/**
 * TRANSCRIPTION CONTROLLER
 * 
 * Controller para transcrição de vídeos usando AssemblyAI
 */

import { transcribeVideo } from '../services/assemblyAIService.js';
import { videoStore } from './downloadProgressController.js';
import fs from 'fs';

/**
 * POST /api/transcription/:videoId
 * Transcreve vídeo baixado usando AssemblyAI
 */
export const transcribeVideoEndpoint = async (req, res) => {
  try {
    const { videoId } = req.params;
    const { language = 'pt' } = req.body;

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
        error: 'Vídeo não encontrado. Certifique-se de que o download foi concluído.'
      });
    }

    if (!fs.existsSync(video.path)) {
      return res.status(404).json({
        success: false,
        error: 'Arquivo de vídeo não existe no disco'
      });
    }

    console.log(`[TRANSCRIPTION] Iniciando transcrição: ${videoId}`);

    // Transcrever vídeo
    const transcription = await transcribeVideo(video.path, language);

    // Obter duração do vídeo
    const duration = video.duration || 0;

    return res.json({
      success: true,
      videoId: videoId,
      duration: duration,
      text: transcription.text,
      words: transcription.words
    });

  } catch (error) {
    console.error('[TRANSCRIPTION] Erro:', error);

    // Erros específicos
    if (error.message.includes('API key')) {
      return res.status(500).json({
        success: false,
        error: 'Configuração de API inválida. Verifique ASSEMBLYAI_API_KEY.'
      });
    }

    if (error.message.includes('Rate limit')) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit excedido. Aguarde alguns instantes e tente novamente.'
      });
    }

    if (error.message.includes('Timeout')) {
      return res.status(504).json({
        success: false,
        error: 'Transcrição demorou muito para concluir. Tente novamente.'
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao transcrever vídeo'
    });
  }
};

