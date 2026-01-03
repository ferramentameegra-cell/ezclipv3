import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { videoProcessQueue } from '../queue/queue.js';

const BASE_TMP_DIR = '/tmp/uploads';
const SERIES_DIR = path.join(BASE_TMP_DIR, 'series');

export const generateSeries = async (req, res) => {
  try {
    const {
      videoId,
      nicheId,
      retentionVideoId,
      numberOfCuts,
      headlineStyle,
      font,
      trimStart,
      trimEnd,
      cutDuration
    } = req.body;

    if (!videoId || !nicheId || !numberOfCuts) {
      return res.status(400).json({
        error: 'Campos obrigatórios: videoId, nicheId, numberOfCuts'
      });
    }

    const videoPath = path.join(BASE_TMP_DIR, `${videoId}.mp4`);

    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({
        error: `Vídeo não encontrado em ${videoPath}`
      });
    }

    const seriesId = uuidv4();

    const job = await videoProcessQueue.add(
      'generate-video-series',
      {
        seriesId,
        videoId,
        videoPath,
        nicheId,
        retentionVideoId: retentionVideoId || 'random',
        numberOfCuts,
        headlineStyle: headlineStyle || 'bold',
        font: font || 'Inter',
        trimStart: trimStart || 0,
        trimEnd: trimEnd || null,
        cutDuration: cutDuration || 60
      },
      {
        removeOnComplete: false,
        removeOnFail: false
      }
    );

    await job.progress(1);

    res.json({
      jobId: job.id,
      seriesId,
      status: 'processing'
    });
  } catch (error) {
    console.error('[GENERATE] Erro:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getSeriesStatus = async (req, res) => {
  try {
    const job = await videoProcessQueue.getJob(req.params.jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job não encontrado' });
    }

    res.json({
      jobId: job.id,
      status: await job.getState(),
      progress: job.progress() || 0,
      failedReason: job.failedReason || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const downloadSeries = async (req, res) => {
  const seriesPath = path.join(SERIES_DIR, req.params.seriesId);

  if (!fs.existsSync(seriesPath)) {
    return res.status(404).json({ error: 'Série não encontrada' });
  }

  const archive = archiver('zip', { zlib: { level: 9 } });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="ezclips-${req.params.seriesId}.zip"`
  );

  archive.pipe(res);

  fs.readdirSync(seriesPath)
    .filter(f => f.endsWith('.mp4'))
    .forEach(file => {
      archive.file(path.join(seriesPath, file), { name: file });
    });

  archive.finalize();
};
