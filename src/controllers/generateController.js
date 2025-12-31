import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import archiver from 'archiver';
import { videoStore } from './videoController.js';
import { videoProcessQueue } from '../queue/queue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Armazenar status de jobs (stateless - pode usar Redis em produção)
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

    // ENFILEIRAR PROCESSAMENTO ASSÍNCRONO (Arquitetura Escalável)
    console.log(`[API] Enfileirando processamento de série: ${seriesId}`);
    
    const processJob = await videoProcessQueue.add('generate-video-series', {
      jobId,
      seriesId,
      videoId,
      nicheId,
      retentionVideoId: retentionVideoId || 'random',
      numberOfCuts,
      headlineStyle: headlineStyle || 'bold',
      font: font || 'Inter',
      trimStart: trimStart || 0,
      trimEnd: trimEnd || null,
      cutDuration: req.body.cutDuration || 60
    }, {
      jobId: `process-${jobId}`,
      priority: 1
    });

    console.log(`[API] Processamento enfileirado: Job ${processJob.id}`);

    // Monitorar progresso do job
    processJob.on('progress', (progress) => {
      job.progress = progress;
      jobs.set(jobId, job);
    });

    processJob.on('completed', (result) => {
      job.status = 'completed';
      job.progress = 100;
      job.completedAt = new Date();
      job.clipsCount = result.clipsCount;
      jobs.set(jobId, job);
    });

    processJob.on('failed', (error) => {
      job.status = 'error';
      job.error = error.message;
      jobs.set(jobId, job);
    });

    res.json({
      jobId,
      seriesId,
      message: 'Geração de série iniciada (processamento assíncrono)',
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

    // Verificar se há clips na série
    const files = fs.readdirSync(seriesPath).filter(file => file.endsWith('.mp4'));
    if (files.length === 0) {
      return res.status(404).json({ error: 'Nenhum clip encontrado na série' });
    }

    // Configurar headers para download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="ez-clips-series-${seriesId}.zip"`);

    // Criar ZIP usando archiver
    const archive = archiver('zip', {
      zlib: { level: 9 } // Máxima compressão
    });

    archive.on('error', (err) => {
      console.error('Erro ao criar ZIP:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erro ao criar arquivo ZIP' });
      }
    });

    archive.pipe(res);

    // Adicionar todos os clips ao ZIP
    files.forEach(file => {
      const filePath = path.join(seriesPath, file);
      archive.file(filePath, { name: file });
    });

    archive.finalize();
  } catch (error) {
    console.error('Erro no download:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
};

