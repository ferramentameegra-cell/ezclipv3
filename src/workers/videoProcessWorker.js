import { videoProcessQueue } from '../queue/queue.js';
import { generateVideoSeries, setVideoStore } from '../services/videoProcessor.js';
import { videoStore } from '../controllers/videoController.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurar videoStore no processador
setVideoStore(videoStore);

/**
 * Worker para processar geração de séries de vídeos
 * Executa de forma assíncrona e escalável
 */
videoProcessQueue.process('generate-video-series', async (job) => {
  const {
    jobId,
    videoId,
    nicheId,
    retentionVideoId,
    numberOfCuts,
    headlineStyle,
    font,
    trimStart,
    trimEnd,
    cutDuration,
    seriesId
  } = job.data;

  console.log(`[WORKER] Iniciando processamento de série: ${seriesId}`);

  try {
    // Criar objeto job compatível com videoProcessor
    const jobData = {
      id: jobId,
      seriesId,
      videoId,
      nicheId,
      retentionVideoId: retentionVideoId || 'random',
      numberOfCuts,
      headlineStyle: headlineStyle || 'bold',
      font: font || 'Inter',
      trimStart: trimStart || 0,
      trimEnd: trimEnd || null,
      cutDuration: cutDuration || 60,
      status: 'processing',
      createdAt: new Date(),
      progress: 0
    };

    // Map para armazenar progresso (compatível com videoProcessor)
    const jobsMap = new Map();
    jobsMap.set(jobId, jobData);

    // Função para atualizar progresso via job queue
    const updateProgress = async (progress) => {
      jobData.progress = progress;
      jobsMap.set(jobId, jobData);
      await job.progress(progress);
    };

    // Substituir atualização de progresso no videoProcessor
    const originalSet = jobsMap.set.bind(jobsMap);
    jobsMap.set = (key, value) => {
      originalSet(key, value);
      if (key === jobId && value.progress !== undefined) {
        job.progress(value.progress).catch(console.error);
      }
    };

    // Processar série
    await generateVideoSeries(jobData, jobsMap);

    console.log(`[WORKER] Série processada com sucesso: ${seriesId}`);

    return {
      success: true,
      seriesId,
      clipsCount: jobData.clipsCount || numberOfCuts,
      status: 'completed'
    };
  } catch (error) {
    console.error(`[WORKER] Erro no processamento:`, error);
    throw error;
  }
});

console.log('[WORKER] Video Process Worker iniciado');

