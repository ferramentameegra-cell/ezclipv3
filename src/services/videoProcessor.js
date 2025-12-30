import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { splitVideoIntoClips, trimVideo } from './videoTrimmer.js';
import { downloadYouTubeVideo, isVideoDownloaded } from './youtubeDownloader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Importar videoStore do controller (será passado como parâmetro)
let videoStore = null;

export function setVideoStore(store) {
  videoStore = store;
}

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

    const totalParts = numberOfCuts;
    const seriesPath = path.join(__dirname, '../../uploads/series', seriesId);
    
    if (!fs.existsSync(seriesPath)) {
      fs.mkdirSync(seriesPath, { recursive: true });
    }

    // Determinar caminho do vídeo fonte
    let sourceVideoPath = video.path;
    
    // Se o vídeo é do YouTube e ainda não foi baixado, baixar agora
    if (video.youtubeVideoId && (!sourceVideoPath || !isVideoDownloaded(sourceVideoPath))) {
      job.progress = 5;
      if (jobsMap) jobsMap.set(job.id, job);
      
      const downloadPath = path.join(__dirname, '../../uploads', `${videoId}_downloaded.mp4`);
      
      console.log(`Baixando vídeo do YouTube: ${video.youtubeVideoId}`);
      await downloadYouTubeVideo(video.youtubeVideoId, downloadPath);
      
      // Atualizar caminho no videoStore
      video.path = downloadPath;
      videoStore.set(videoId, video);
      sourceVideoPath = downloadPath;
      
      job.progress = 20;
      if (jobsMap) jobsMap.set(job.id, job);
    }

    if (!sourceVideoPath || !fs.existsSync(sourceVideoPath)) {
      throw new Error(`Arquivo de vídeo não encontrado: ${sourceVideoPath}`);
    }

    // Determinar tempos de trim
    const videoDuration = video.duration || 0;
    const startTime = Math.max(0, trimStart || 0);
    const endTime = trimEnd && trimEnd > 0 ? Math.min(trimEnd, videoDuration) : videoDuration;

    if (endTime <= startTime) {
      throw new Error('Tempo final deve ser maior que tempo inicial');
    }

    // Aplicar trim se necessário
    let trimmedVideoPath = sourceVideoPath;
    let actualStartTime = 0;
    let actualEndTime = endTime - startTime;
    
    if (startTime > 0 || endTime < videoDuration) {
      job.progress = 30;
      if (jobsMap) jobsMap.set(job.id, job);
      
      const trimmedPath = path.join(__dirname, '../../uploads', `${videoId}_trimmed.mp4`);
      
      console.log(`Aplicando trim: ${startTime}s - ${endTime}s`);
      trimmedVideoPath = await trimVideo(sourceVideoPath, trimmedPath, startTime, endTime);
      
      // Após trim, o vídeo começa em 0 e vai até (endTime - startTime)
      actualStartTime = 0;
      actualEndTime = endTime - startTime;
      
      job.progress = 50;
      if (jobsMap) jobsMap.set(job.id, job);
    } else {
      // Sem trim, usar tempos originais
      actualStartTime = startTime;
      actualEndTime = endTime;
    }

    // Dividir em clips
    console.log(`Dividindo vídeo em ${totalParts} clips de ${cutDuration}s cada`);
    const clips = await splitVideoIntoClips(
      trimmedVideoPath,
      seriesPath,
      cutDuration,
      actualStartTime,
      actualEndTime
    );

    // Atualizar progresso durante processamento
    const totalClips = clips.length;
    for (let i = 0; i < totalClips; i++) {
      job.progress = Math.round(50 + ((i + 1) / totalClips) * 50);
      if (jobsMap) {
        jobsMap.set(job.id, job);
      }
    }

    // Atualizar progresso final
    job.progress = 100;
    job.status = 'completed';
    job.completedAt = new Date();
    job.clips = clips;
    job.clipsCount = clips.length;
    
    if (jobsMap) {
      jobsMap.set(job.id, job);
    }

    console.log(`Série gerada com sucesso: ${clips.length} clips em ${seriesPath}`);

    return {
      seriesId,
      totalParts: clips.length,
      clips,
      status: 'completed'
    };
  } catch (error) {
    console.error('Erro ao gerar série:', error);
    job.status = 'error';
    job.error = error.message;
    if (jobsMap) {
      jobsMap.set(job.id, job);
    }
    throw error;
  }
};

