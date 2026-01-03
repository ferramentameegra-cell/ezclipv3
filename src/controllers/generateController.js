import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { videoProcessQueue } from '../queue/queue.js';

const BASE_TMP_DIR = '/tmp/uploads';
const SERIES_DIR = path.join(BASE_TMP_DIR, 'series');

/**
 * POST /api/generate/series
 */
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

    const seriesId = uuidv4();

    // 🔥 Enfileirar job no Bull
    const job = await videoProcessQueue.add(
      'generate-video-series',
      {
        seriesId,
        videoId,
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

    // 👉 progresso inicial REAL (não 0)
    await job.progress(1);

    console.log(`[API] Série enfileirada | job=${job.id} | series=${seriesId}`);

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

/**
 * GET /api/generate/status/:jobId
 * 🔥 CORREÇÃO DO 0%
 * Retorna exatamente o formato que o frontend espera
 */
export const getSeriesStatus = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await videoProcessQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job não encontrado' });
    }

    const progress = await job.progress(); // 🔥 FIX REAL
    const state = await job.getState();

    res.json({
      job: {
        id: job.id,
        status:
          state === 'completed'
            ? 'completed'
            : state === 'failed'
            ? 'error'
            : 'processing',
        progress: typeof progress === 'number' ? progress : 0,
        error: job.failedReason || null
      }
    });
  } catch (error) {
    console.error('[STATUS] Erro:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/generate/download/:seriesId
 */
export const downloadSeries = async (req, res) => {
  try {
    const { seriesId } = req.params;
    const seriesPath = path.join(SERIES_DIR, seriesId);

    if (!fs.existsSync(seriesPath)) {
      return res.status(404).json({ error: 'Série não encontrada' });
    }

    const files = fs.readdirSync(seriesPath).filter(f => f.endsWith('.mp4'));

    if (files.length === 0) {
      return res.status(404).json({ error: 'Nenhum clip encontrado' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ez-clips-series-${seriesId}.zip"`
    );

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', err => {
      console.error('[ZIP] Erro:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erro ao gerar ZIP' });
      }
    });

    archive.pipe(res);

    for (const file of files) {
      archive.file(path.join(seriesPath, file), { name: file });
    }

    await archive.finalize();
  } catch (error) {
    console.error('[DOWNLOAD] Erro:', error);
    res.status(500).json({ error: error.message });
  }
};
