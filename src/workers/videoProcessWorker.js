import fs from 'fs';
import path from 'path';
import { videoProcessQueue } from '../queue/queue.js';
import { splitVideoIntoClips, trimVideo } from '../services/videoTrimmer.js';

const BASE_TMP_DIR = '/tmp/uploads';
const SERIES_DIR = path.join(BASE_TMP_DIR, 'series');

// garantir diretórios
if (!fs.existsSync(BASE_TMP_DIR)) {
  fs.mkdirSync(BASE_TMP_DIR, { recursive: true });
}
if (!fs.existsSync(SERIES_DIR)) {
  fs.mkdirSync(SERIES_DIR, { recursive: true });
}

/**
 * Worker principal
 */
videoProcessQueue.process('generate-video-series', async (job) => {
  const {
    seriesId,
    videoPath,
    numberOfCuts,
    trimStart = 0,
    trimEnd = null,
    cutDuration = 60
  } = job.data;

  console.log(`[WORKER] Iniciando série ${seriesId}`);

  try {
    // 🔥 FONTE DA VERDADE = ARQUIVO
    if (!videoPath || !fs.existsSync(videoPath)) {
      throw new Error(`Arquivo de vídeo não encontrado: ${videoPath}`);
    }

    await job.progress(10);

    // preparar pasta da série
    const seriesPath = path.join(SERIES_DIR, seriesId);
    if (!fs.existsSync(seriesPath)) {
      fs.mkdirSync(seriesPath, { recursive: true });
    }

    let processedVideoPath = videoPath;

    // aplicar trim se necessário
    if (trimEnd && trimEnd > trimStart) {
      const trimmedPath = path.join(BASE_TMP_DIR, `${seriesId}_trimmed.mp4`);
      processedVideoPath = await trimVideo(
        videoPath,
        trimmedPath,
        trimStart,
        trimEnd
      );
    }

    await job.progress(40);

    // gerar clips
    const clips = await splitVideoIntoClips(
      processedVideoPath,
      seriesPath,
      cutDuration,
      0,
      null
    );

    // progresso incremental
    for (let i = 0; i < clips.length; i++) {
      const percent = 40 + Math.round(((i + 1) / clips.length) * 60);
      await job.progress(percent);
    }

    await job.progress(100);

    console.log(`[WORKER] Série finalizada (${clips.length} clips)`);

    return {
      success: true,
      seriesId,
      clipsCount: clips.length
    };
  } catch (error) {
    console.error('[WORKER] Erro:', error);
    throw error;
  }
});

console.log('[WORKER] VideoProcessWorker ativo');
