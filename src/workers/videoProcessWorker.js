import { videoProcessQueue } from '../queue/queue.js';
import { generateVideoSeries, setVideoStore } from '../services/videoProcessor.js';
import { videoStore } from '../controllers/videoController.js';

// Configurar videoStore no processador
setVideoStore(videoStore);

// 📁 Diretório base seguro para Railway
const BASE_UPLOAD_DIR = '/tmp/uploads';

/**
 * Worker para processar geração de séries de vídeos
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
      progress: 0,

      // 🔑 MUITO IMPORTANTE
      baseDir: BASE_UPLOAD_DIR
    };

    const jobsMap = new Map();
    jobsMap.set(jobId, jobData);

    // Atualizar progresso no Bull
    const originalSet = jobsMap.set.bind(jobsMap);
    jobsMap.set = (key, value) => {
      originalSet(key, value);
      if (key === jobId && value.progress !== undefined) {
        job.progress(value.progress).catch(console.error);
      }
    };

    // 🚀 Processa a série
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
