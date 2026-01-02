import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { splitVideoIntoClips, trimVideo } from './videoTrimmer.js';
import { downloadYouTubeVideo, isVideoDownloaded } from './youtubeDownloader.js';

// ===============================
// CONFIGURAÇÃO RAILWAY (OBRIGATÓRIA)
// ===============================
const TMP_UPLOADS_DIR = '/tmp/uploads';
const SERIES_DIR = path.join(TMP_UPLOADS_DIR, 'series');

// Garantir diretórios
if (!fs.existsSync(TMP_UPLOADS_DIR)) {
  fs.mkdirSync(TMP_UPLOADS_DIR, { recursive: true });
}

if (!fs.existsSync(SERIES_DIR)) {
  fs.mkdirSync(SERIES_DIR, { recursive: true });
}

// ===============================
// VIDEO STORE (INJETADO)
// ===============================
let videoStore = null;

export function setVideoStore(store) {
  videoStore = store;
}

// ===============================
// PROCESSADOR PRINCIPAL
// ===============================
export const generateVideoSeries = async (job, jobsMap) => {
  try {
    const {
      videoId,
      numberOfCuts,
      seriesId,
      trimStart = 0,
      trimEnd = null,
      cutDuration = 60
    } = job;

    if (!videoStore) {
      throw new Error('VideoStore não foi configurado');
    }

    const video = videoStore.get(videoId);
    if (!video) {
      throw new Error(`Vídeo ${videoId} não encontrado`);
    }

    // ===============================
    // PREPARAR DIRETÓRIO DA SÉRIE
    // ===============================
    const seriesPath = path.join(SERIES_DIR, seriesId);

    if (!fs.existsSync(seriesPath)) {
      fs.mkdirSync(seriesPath, { recursive: true });
    }

    // ===============================
    // DEFINIR VÍDEO FONTE
    // ===============================
    let sourceVideoPath = video.path;

    // ===============================
    // DOWNLOAD YOUTUBE (SE NECESSÁRIO)
    // ===============================
    if (video.youtubeVideoId) {
      const downloadPath = path.join(
        TMP_UPLOADS_DIR,
        `${videoId}_downloaded.mp4`
      );

      const needsDownload =
        !sourceVideoPath || !isVideoDownloaded(sourceVideoPath);

      if (needsDownload) {
        console.log(`[PROCESSING] Baixando vídeo do YouTube: ${video.youtubeVideoId}`);

        job.progress = 5;
        if (jobsMap) jobsMap.set(job.id, job);

        await downloadYouTubeVideo(video.youtubeVideoId, downloadPath);

        // VALIDAR DOWNLOAD
        if (!fs.existsSync(downloadPath)) {
          throw new Error('Download não criou o arquivo');
        }

        const stats = fs.statSync(downloadPath);
        if (stats.size === 0) {
          throw new Error('Arquivo baixado está vazio');
        }

        // Atualizar store
        video.path = downloadPath;
        video.downloaded = true;
        video.fileSize = stats.size;
        video.downloadCompletedAt = new Date();
        videoStore.set(videoId, video);

        sourceVideoPath = downloadPath;

        job.progress = 20;
        if (jobsMap) jobsMap.set(job.id, job);
      }
    }

    // ===============================
    // VALIDAÇÕES FINAIS DO VÍDEO
    // ===============================
    if (!sourceVideoPath) {
      throw new Error('Caminho do vídeo não definido');
    }

    if (!fs.existsSync(sourceVideoPath)) {
      throw new Error(`Arquivo não encontrado: ${sourceVideoPath}`);
    }

    const sourceStats = fs.statSync(sourceVideoPath);
    if (sourceStats.size === 0) {
      throw new Error('Arquivo de vídeo está vazio');
    }

    console.log(`[PROCESSING] Vídeo validado: ${sourceVideoPath}`);

    // ===============================
    // CALCULAR TRIM
    // ===============================
    const videoDuration = video.duration || 0;
    const startTime = Math.max(0, Math.floor(trimStart));
    const endTime =
      trimEnd && trimEnd > 0
        ? Math.min(Math.floor(trimEnd), videoDuration)
        : videoDuration;

    if (endTime <= startTime) {
      throw new Error('Tempo final deve ser maior que o inicial');
    }

    const trimmedDuration = endTime - startTime;
    if (trimmedDuration < cutDuration) {
      throw new Error('Duração do trim menor que a duração do corte');
    }

    // ===============================
    // APLICAR TRIM (SE NECESSÁRIO)
    // ===============================
    let processedVideoPath = sourceVideoPath;
    let actualStartTime = 0;
    let actualEndTime = trimmedDuration;

    if (startTime > 0 || endTime < videoDuration) {
      job.progress = 30;
      if (jobsMap) jobsMap.set(job.id, job);

      const trimmedPath = path.join(
        TMP_UPLOADS_DIR,
        `${videoId}_trimmed.mp4`
      );

      console.log(`[PROCESSING] Aplicando trim: ${startTime}s - ${endTime}s`);

      processedVideoPath = await trimVideo(
        sourceVideoPath,
        trimmedPath,
        startTime,
        endTime
      );

      job.progress = 50;
      if (jobsMap) jobsMap.set(job.id, job);
    }

    // ===============================
    // GERAR CLIPS
    // ===============================
    console.log(`[PROCESSING] Gerando clips`);

    const clips = await splitVideoIntoClips(
      processedVideoPath,
      seriesPath,
      cutDuration,
      actualStartTime,
      actualEndTime
    );

    // Atualizar progresso progressivo
    for (let i = 0; i < clips.length; i++) {
      job.progress = Math.round(50 + ((i + 1) / clips.length) * 50);
      if (jobsMap) jobsMap.set(job.id, job);
    }

    // ===============================
    // FINALIZAR JOB
    // ===============================
    job.progress = 100;
    job.status = 'completed';
    job.completedAt = new Date();
    job.clips = clips;
    job.clipsCount = clips.length;

    if (jobsMap) jobsMap.set(job.id, job);

    console.log(`[PROCESSING] Série finalizada: ${clips.length} clips`);

    return {
      seriesId,
      clips,
      clipsCount: clips.length,
      status: 'completed'
    };

  } catch (error) {
    console.error('❌ Erro ao gerar série:', error);

    job.status = 'error';
    job.error = error.message;

    if (jobsMap) jobsMap.set(job.id, job);
    throw error;
  }
};
