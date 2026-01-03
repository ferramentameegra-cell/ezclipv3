import { videoProcessQueue } from '../queue/queue.js';
import { generateVideoSeries, setVideoStore } from '../services/videoProcessor.js';
import { videoStore } from '../controllers/videoController.js';

setVideoStore(videoStore);

videoProcessQueue.process('generate-video-series', async (job) => {
  const {
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

  console.log(`[WORKER] Processando série ${seriesId} | job ${job.id}`);

  try {
    const jobData = {
      id: job.id, // ✅ USAR job.id
      seriesId,
      videoId,
      nicheId,
      retentionVideoId,
      numberOfCuts,
      headlineStyle,
      font,
      trimStart,
      trimEnd,
      cutDuration,
      status: 'processing',
      progress: 0
    };

    const jobsMap = new Map();
    jobsMap.set(job.id, jobData);

    // 🔥 ponte correta de progresso
    const originalSet = jobsMap.set.bind(jobsMap);
    jobsMap.set = (key, value) => {
      originalSet(key, value);
      if (key === job.id && typeof value.progress === 'number') {
        job.progress(value.progress);
      }
    };

    await generateVideoSeries(jobData, jobsMap);

    await job.progress(100);

    return {
      success: true,
      seriesId,
      clipsCount: jobData.clipsCount
    };

  } catch (error) {
    console.error('[WORKER] Erro:', error);
    throw error;
  }
});

console.log('[WORKER] Video Process Worker iniciado');
