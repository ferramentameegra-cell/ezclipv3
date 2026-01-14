import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { videoProcessQueue } from '../queue/queue.js';
import { UserQuotaService } from '../services/userQuotaService.js';

const BASE_TMP_DIR = '/tmp/uploads';
const SERIES_DIR = path.join(BASE_TMP_DIR, 'series');

export const generateSeries = async (req, res) => {
  try {
    // Verificar quota do usuário (se autenticado)
    if (req.user) {
      const plan = req.user.plan || 'free';
      const quotaCheck = await UserQuotaService.checkVideoProcessingQuota(req.user.id, plan);
      
      if (!quotaCheck.allowed) {
        return res.status(429).json({
          error: quotaCheck.reason,
          quota: quotaCheck,
          retryAfter: 3600 // 1 hora
        });
      }
    }

    const {
      videoId,
      nicheId,
      retentionVideoId,
      numberOfCuts,
      headlineStyle,
      headlineText,
      font,
      trimStart,
      trimEnd,
      cutDuration,
      backgroundColor,
      // CONFIGURAÇÕES DE VÍDEO
      format = '9:16',
      platforms = { tiktok: true, reels: true, shorts: true },
      captionLanguage = 'pt',
      captionStyle = 'modern',
      clipsQuantity = null,
      safeMargins = 10
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

    // Obter posição na fila antes de adicionar
    const waitingCount = await videoProcessQueue.getWaitingCount ? await videoProcessQueue.getWaitingCount() : 0;
    
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
        headlineText: headlineText || null,
        font: font || 'Inter',
        trimStart: trimStart || 0,
        trimEnd: trimEnd || null,
        cutDuration: cutDuration || 60,
        backgroundColor: backgroundColor || '#000000',
        // CONFIGURAÇÕES DE VÍDEO
        format,
        platforms,
        captionLanguage,
        captionStyle,
        clipsQuantity,
        safeMargins,
        userId: req.user?.id || null
      },
      {
        removeOnComplete: false,
        removeOnFail: false,
        priority: req.user?.plan === 'premium' ? 1 : 5 // Premium tem prioridade
      }
    );

    await job.progress(1);

    res.json({
      jobId: job.id,
      seriesId,
      status: 'processing',
      queuePosition: waitingCount + 1,
      estimatedWaitTime: Math.ceil((waitingCount + 1) / 10 * 3) // ~3 min por vídeo, 10 simultâneos
    });
  } catch (error) {
    console.error('[GENERATE] Erro:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getSeriesStatus = async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const job = await videoProcessQueue.getJob(jobId);

    if (!job) {
      console.warn(`[GENERATE-STATUS] Job ${jobId} não encontrado na fila`);
      return res.status(404).json({ 
        error: 'Job não encontrado',
        jobId: jobId,
        status: 'not_found'
      });
    }

    const state = typeof job.getState === 'function' ? await job.getState() : job._state || 'unknown';
    const progress = typeof job.progress === 'function' ? (job.progress() || 0) : (job._progress || 0);
    
    // Tentar obter returnvalue (pode estar em diferentes formatos)
    let returnValue = null;
    try {
      returnValue = job.returnvalue || job.returnValue || (await job.finished()) || null;
    } catch (e) {
      // Job ainda não terminou, returnvalue não disponível
    }
    
    // Log para debug (mais detalhado)
    console.log(`[GENERATE-STATUS] Job ${job.id}: state=${state}, progress=${progress}, returnvalue=${!!returnValue}, failedReason=${job.failedReason || 'none'}`);
    if (returnValue) {
      console.log(`[GENERATE-STATUS] ReturnValue:`, JSON.stringify(returnValue));
    }
    
    // PRIORIDADE 1: Se job tem returnvalue (resultado), considerar como completed
    let finalStatus = state;
    if (returnValue && !job.failedReason) {
      finalStatus = 'completed';
      console.log(`[GENERATE-STATUS] Job tem returnvalue, marcando como completed`);
    }
    // PRIORIDADE 2: Se progresso chegou a 100%, garantir que status seja 'completed'
    else if (progress >= 100 && state !== 'failed' && state !== 'error') {
      finalStatus = 'completed';
      console.log(`[GENERATE-STATUS] Progresso 100%, marcando como completed`);
    }
    // PRIORIDADE 3: Se estado é 'completed' ou 'finished', usar isso
    else if (state === 'completed' || state === 'finished') {
      finalStatus = state;
      console.log(`[GENERATE-STATUS] Estado já é ${state}`);
    }
    
    // Extrair seriesId e clipsCount de forma mais robusta
    let seriesId = job.data?.seriesId || null;
    let clipsCount = null;
    
    // Tentar obter clipsCount do returnvalue primeiro
    if (returnValue) {
      clipsCount = returnValue.clipsCount || returnValue.clips?.length || null;
      // Se não encontrou clipsCount mas encontrou seriesId no returnvalue
      if (!seriesId && returnValue.seriesId) {
        seriesId = returnValue.seriesId;
      }
    }
    
    // Se não encontrou no returnvalue, tentar no data
    if (!clipsCount) {
      clipsCount = job.data?.numberOfCuts || null;
    }
    
    // Se ainda não encontrou seriesId, tentar gerar baseado no jobId ou data
    if (!seriesId && job.data) {
      // Tentar encontrar seriesId em job.data
      seriesId = job.data.seriesId || job.data.series_id || null;
    }

    const response = {
      jobId: job.id,
      status: finalStatus,
      progress: Math.min(100, Math.max(0, progress)),
      failedReason: job.failedReason || null,
      clipsCount: clipsCount,
      seriesId: seriesId
    };
    
    console.log(`[GENERATE-STATUS] Retornando:`, JSON.stringify(response));
    
    res.json(response);
  } catch (error) {
    console.error('[GENERATE-STATUS] Erro ao buscar status:', error);
    console.error('[GENERATE-STATUS] Stack:', error.stack);
    res.status(500).json({ 
      error: error.message,
      jobId: req.params.jobId,
      status: 'error'
    });
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

  // Buscar apenas arquivos finais (_final.mp4)
  const files = fs.readdirSync(seriesPath)
    .filter(f => f.endsWith('_final.mp4') || f.endsWith('.mp4'))
    .sort(); // Ordenar para garantir ordem consistente

  if (files.length === 0) {
    return res.status(404).json({ error: 'Nenhum clip encontrado na série' });
  }

  files.forEach(file => {
    archive.file(path.join(seriesPath, file), { name: file });
  });

  archive.on('error', (err) => {
    console.error('[DOWNLOAD] Erro ao criar arquivo ZIP:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erro ao criar arquivo ZIP' });
    }
  });

  archive.finalize();
};
