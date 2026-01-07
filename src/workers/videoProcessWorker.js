import path from 'path';
import fs from 'fs';
import { videoProcessQueue } from '../queue/queue.js';
import { splitVideoIntoClips, trimVideo } from '../services/videoTrimmer.js';

const BASE_TMP_DIR = '/tmp/uploads';
const SERIES_DIR = path.join(BASE_TMP_DIR, 'series');

videoProcessQueue.process('generate-video-series', async job => {
  const {
    seriesId,
    videoPath,
    trimStart,
    trimEnd,
    cutDuration
  } = job.data;

  if (!fs.existsSync(videoPath)) {
    throw new Error(`Arquivo não encontrado: ${videoPath}`);
  }

  const seriesPath = path.join(SERIES_DIR, seriesId);
  fs.mkdirSync(seriesPath, { recursive: true });

  await job.progress(10);

  let processedPath = videoPath;

  if (trimStart > 0 || trimEnd) {
    processedPath = path.join(BASE_TMP_DIR, `${seriesId}_trim.mp4`);
    await trimVideo(videoPath, processedPath, trimStart, trimEnd);
  }

  await job.progress(40);

  const clips = await splitVideoIntoClips(
    processedPath,
    seriesPath,
    cutDuration
  );

  for (let i = 0; i < clips.length; i++) {
    await job.progress(40 + Math.round(((i + 1) / clips.length) * 60));
  }

  return {
    status: 'completed',
    clipsCount: clips.length
  };
});

