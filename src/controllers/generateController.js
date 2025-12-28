import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { generateVideoSeries } from '../services/videoProcessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jobs = new Map();

// Exportar jobs para uso no service
export { jobs };

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
      trimEnd
    } = req.body;

    if (!videoId || !nicheId || !numberOfCuts) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios: videoId, nicheId, numberOfCuts' 
      });
    }

    const jobId = uuidv4();
    const seriesId = uuidv4();

    const job = {
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
      status: 'processing',
      createdAt: new Date(),
      progress: 0
    };

    jobs.set(jobId, job);

    // Processar em background
    generateVideoSeries(job, jobs).catch(error => {
      job.status = 'error';
      job.error = error.message;
      jobs.set(jobId, job);
    });

    res.json({
      jobId,
      seriesId,
      message: 'Geração de série iniciada',
      status: 'processing'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getSeriesStatus = (req, res) => {
  try {
    const { jobId } = req.params;
    const job = jobs.get(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job não encontrado' });
    }

    res.json({ job });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const downloadSeries = (req, res) => {
  try {
    const { seriesId } = req.params;
    const seriesPath = path.join(__dirname, '../../uploads/series', seriesId);

    if (!fs.existsSync(seriesPath)) {
      return res.status(404).json({ error: 'Série não encontrada' });
    }

    // Criar ZIP da série
    res.json({
      downloadUrl: `/api/series/${seriesId}/download`,
      message: 'Série pronta para download'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

