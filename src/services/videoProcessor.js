import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { splitVideoIntoClips, trimVideo } from './videoTrimmer.js';
import { getVideoState, VIDEO_STATES } from './videoStateManager.js';
import { validateVideoWithFfprobe } from './videoValidator.js';

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

    // Verificar estado do vídeo
    const videoState = getVideoState(videoId);
    if (!videoState || videoState.state !== VIDEO_STATES.READY) {
      throw new Error(`Vídeo não está pronto para processamento. Estado: ${videoState?.state || 'unknown'}`);
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
        !sourceVideoPath || !fs.existsSync(sourceVideoPath) || (fs.existsSync(sourceVideoPath) && fs.statSync(sourceVideoPath).size === 0);

      if (needsDownload) {
        console.log(`[PROCESSING] Baixando vídeo do YouTube: ${video.youtubeVideoId}`);

        job.progress = 5;
        if (jobsMap) jobsMap.set(job.id, job);

        // Importar downloadYouTubeVideo dinamicamente se necessário
        const { downloadYouTubeVideo } = await import('./youtubeDownloader.js');
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

    // Validar vídeo com ffprobe (garantir que é válido)
    try {
      await validateVideoWithFfprobe(sourceVideoPath);
    } catch (validationError) {
      throw new Error(`Vídeo inválido: ${validationError.message}`);
    }

    console.log(`[PROCESSING] Vídeo validado: ${sourceVideoPath}`);

    // ===============================
    // CALCULAR TRIM
    // ===============================
    let videoDuration = video.duration || 0;
    
    // Se a duração do vídeo não está disponível ou é inválida, tentar obter via ffprobe
    if (!videoDuration || videoDuration <= 0 || isNaN(videoDuration)) {
      console.log(`[PROCESSING] Duração do vídeo inválida no store (${videoDuration}), obtendo via ffprobe...`);
      try {
        const videoValidation = await validateVideoWithFfprobe(sourceVideoPath);
        videoDuration = Math.floor(videoValidation.durationFloat || videoValidation.duration || 0);
        console.log(`[PROCESSING] Duração obtida via ffprobe: ${videoDuration}s`);
        
        // Atualizar no store
        video.duration = videoDuration;
        videoStore.set(videoId, video);
      } catch (validationError) {
        throw new Error(`Não foi possível obter a duração do vídeo. Duração no store: ${video.duration}s. Erro: ${validationError.message}`);
      }
    }
    
    if (videoDuration <= 0 || isNaN(videoDuration)) {
      throw new Error(`Duração do vídeo inválida: ${videoDuration}s`);
    }
    
    const startTime = Math.max(0, Math.floor(trimStart || 0));
    const endTime =
      trimEnd && trimEnd > 0
        ? Math.min(Math.floor(trimEnd), videoDuration)
        : videoDuration;

    if (endTime <= startTime) {
      throw new Error(`Tempo final (${endTime}s) deve ser maior que o inicial (${startTime}s)`);
    }

    const trimmedDuration = endTime - startTime;
    if (trimmedDuration <= 0 || isNaN(trimmedDuration)) {
      throw new Error(`Duração do trim inválida: ${trimmedDuration}s (startTime: ${startTime}s, endTime: ${endTime}s)`);
    }
    
    if (trimmedDuration < cutDuration) {
      throw new Error(`Duração do trim (${trimmedDuration}s) menor que a duração do corte (${cutDuration}s)`);
    }
    
    console.log(`[PROCESSING] Trim calculado: ${startTime}s - ${endTime}s (duração: ${trimmedDuration}s, vídeo total: ${videoDuration}s)`);

    // ===============================
    // APLICAR TRIM (SE NECESSÁRIO)
    // ===============================
    let processedVideoPath = sourceVideoPath;
    let actualStartTime = 0;
    let actualEndTime = null; // Inicializar como null para forçar definição

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

      // Após o trim, o vídeo processado começa em 0 e termina em trimmedDuration
      actualStartTime = 0;
      actualEndTime = trimmedDuration;
      
      console.log(`[PROCESSING] Trim aplicado - actualStartTime: ${actualStartTime}s, actualEndTime: ${actualEndTime}s (trimmedDuration: ${trimmedDuration}s)`);

      job.progress = 50;
      if (jobsMap) jobsMap.set(job.id, job);
    } else {
      // Quando não há trim físico aplicado, obter a duração real do vídeo
      // porque a duração pode ser diferente da esperada
      try {
        const videoValidation = await validateVideoWithFfprobe(processedVideoPath);
        const realVideoDuration = Math.floor(videoValidation.durationFloat || videoValidation.duration || 0);
        
        if (!realVideoDuration || realVideoDuration <= 0 || isNaN(realVideoDuration)) {
          throw new Error(`Duração obtida via ffprobe é inválida: ${realVideoDuration}s`);
        }
        
        // Sem trim físico, usar o vídeo completo (0 até duração real)
        actualStartTime = 0;
        actualEndTime = realVideoDuration;
        
        console.log(`[PROCESSING] Sem trim físico - usando vídeo completo: ${actualStartTime}s - ${actualEndTime}s (duração real: ${realVideoDuration}s)`);
      } catch (validationError) {
        console.error(`[PROCESSING] Erro ao validar vídeo para obter duração: ${validationError.message}`);
        
        // Fallback: usar trimmedDuration que já foi calculado anteriormente
        // Se trimmedDuration também for inválido, usar videoDuration validado anteriormente
        if (trimmedDuration && trimmedDuration > 0 && !isNaN(trimmedDuration)) {
          actualStartTime = 0;
          actualEndTime = trimmedDuration;
          console.log(`[PROCESSING] Usando trimmedDuration como fallback: ${actualStartTime}s - ${actualEndTime}s (duração: ${trimmedDuration}s)`);
        } else if (videoDuration && videoDuration > 0 && !isNaN(videoDuration)) {
          actualStartTime = 0;
          actualEndTime = videoDuration;
          console.log(`[PROCESSING] Usando videoDuration como fallback: ${actualStartTime}s - ${actualEndTime}s (duração: ${videoDuration}s)`);
        } else {
          throw new Error(`Não foi possível determinar a duração do vídeo. trimmedDuration: ${trimmedDuration}s, videoDuration: ${videoDuration}s. Erro na validação: ${validationError.message}`);
        }
      }
    }
    
    // Validação final obrigatória: garantir que actualEndTime foi definido corretamente
    if (actualEndTime === null || actualEndTime === undefined || isNaN(actualEndTime) || actualEndTime <= 0) {
      throw new Error(`actualEndTime inválido: ${actualEndTime}. actualStartTime: ${actualStartTime}, trimmedDuration: ${trimmedDuration}, videoDuration: ${videoDuration}`);
    }
    
    if (actualStartTime === null || actualStartTime === undefined || isNaN(actualStartTime) || actualStartTime < 0) {
      throw new Error(`actualStartTime inválido: ${actualStartTime}`);
    }
    
    const finalTotalDuration = actualEndTime - actualStartTime;
    if (!finalTotalDuration || finalTotalDuration <= 0 || isNaN(finalTotalDuration)) {
      throw new Error(`Duração total final inválida: ${finalTotalDuration}s (actualStartTime: ${actualStartTime}s, actualEndTime: ${actualEndTime}s)`);
    }
    
    console.log(`[PROCESSING] Validação final: actualStartTime=${actualStartTime}s, actualEndTime=${actualEndTime}s, duração total=${finalTotalDuration}s`);

    // ===============================
    // GERAR CLIPS
    // ===============================
    console.log(`[PROCESSING] Gerando clips`);
    console.log(`[PROCESSING] Parâmetros para splitVideoIntoClips:`);
    console.log(`[PROCESSING]   - processedVideoPath: ${processedVideoPath}`);
    console.log(`[PROCESSING]   - seriesPath: ${seriesPath}`);
    console.log(`[PROCESSING]   - cutDuration: ${cutDuration}s`);
    console.log(`[PROCESSING]   - actualStartTime: ${actualStartTime}s`);
    console.log(`[PROCESSING]   - actualEndTime: ${actualEndTime}s`);
    console.log(`[PROCESSING]   - Duração total: ${actualEndTime - actualStartTime}s`);

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
