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
    
    // VALIDAR: Se o vídeo é do YouTube, GARANTIR que está baixado ANTES de processar
    if (video.youtubeVideoId) {
      const needsDownload = !sourceVideoPath || !isVideoDownloaded(sourceVideoPath);
      
      if (needsDownload) {
        job.progress = 5;
        if (jobsMap) jobsMap.set(job.id, job);
        
        const downloadPath = path.join(__dirname, '../../uploads', `${videoId}_downloaded.mp4`);
        
        console.log(`[PROCESSING] Verificando status do download: ${video.youtubeVideoId}`);
        
        // Se há um job de download em andamento, aguardar conclusão
        if (video.downloadJobId) {
          console.log(`[PROCESSING] Download em andamento (Job: ${video.downloadJobId}), aguardando conclusão...`);
          
          // Aguardar até 5 minutos pelo download
          const maxWaitTime = 300000; // 5 minutos
          const checkInterval = 2000; // Verificar a cada 2 segundos
          const startTime = Date.now();
          
          while (!isVideoDownloaded(downloadPath) && (Date.now() - startTime) < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            
            // Verificar se download foi completado
            if (fs.existsSync(downloadPath)) {
              const stats = fs.statSync(downloadPath);
              if (stats.size > 0) {
                console.log(`[PROCESSING] Download completado durante espera: ${downloadPath}`);
                break; // Download completo
              }
            }
            
            // Atualizar progresso
            const elapsed = Date.now() - startTime;
            job.progress = 5 + Math.floor((elapsed / maxWaitTime) * 15);
            if (jobsMap) jobsMap.set(job.id, job);
          }
        }
        
        // Se ainda não baixado, baixar agora (fallback)
        if (!isVideoDownloaded(downloadPath)) {
          console.log(`[PROCESSING] Iniciando download direto: ${video.youtubeVideoId}`);
          try {
            await downloadYouTubeVideo(video.youtubeVideoId, downloadPath);
          } catch (downloadError) {
            console.error('[PROCESSING] Erro ao baixar vídeo:', downloadError);
            throw new Error(`Falha ao baixar vídeo do YouTube: ${downloadError.message}`);
          }
        }
        
        // VALIDAR download completo ANTES de continuar
        if (!fs.existsSync(downloadPath)) {
          throw new Error('Arquivo não foi criado após download. Download deve completar antes de processar.');
        }
        
        const stats = fs.statSync(downloadPath);
        if (stats.size === 0) {
          throw new Error('Arquivo baixado está vazio. Download deve completar antes de processar.');
        }
        
        console.log(`[PROCESSING] Vídeo baixado e validado: ${downloadPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        
        // Atualizar caminho no videoStore
        video.path = downloadPath;
        video.downloaded = true;
        video.downloadCompletedAt = new Date();
        video.fileSize = stats.size;
        videoStore.set(videoId, video);
        sourceVideoPath = downloadPath;
        
        job.progress = 20;
        if (jobsMap) jobsMap.set(job.id, job);
      } else {
        console.log(`[PROCESSING] Vídeo já baixado e validado: ${sourceVideoPath}`);
      }
    }

    // VALIDAR: Arquivo deve existir e ter tamanho > 0
    if (!sourceVideoPath) {
      throw new Error('Caminho do vídeo não definido');
    }
    
    if (!fs.existsSync(sourceVideoPath)) {
      throw new Error(`Arquivo de vídeo não encontrado: ${sourceVideoPath}`);
    }
    
    const stats = fs.statSync(sourceVideoPath);
    if (stats.size === 0) {
      throw new Error(`Arquivo de vídeo está vazio: ${sourceVideoPath}`);
    }
    
    console.log(`[PROCESSING] Usando vídeo local: ${sourceVideoPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

    // Determinar tempos de trim - VALIDAR valores
    const videoDuration = video.duration || 0;
    const startTime = Math.max(0, Math.floor(trimStart || 0));
    const endTime = trimEnd && trimEnd > 0 ? Math.min(Math.floor(trimEnd), videoDuration || Infinity) : (videoDuration || Infinity);

    // VALIDAR: Tempos de trim devem ser válidos
    if (endTime <= startTime) {
      throw new Error(`Tempo final (${endTime}s) deve ser maior que tempo inicial (${startTime}s)`);
    }
    
    if (startTime < 0) {
      throw new Error(`Tempo inicial não pode ser negativo: ${startTime}`);
    }
    
    const trimmedDuration = endTime - startTime;
    console.log(`[PROCESSING] Trim configurado: ${startTime}s - ${endTime}s (duração: ${trimmedDuration}s)`);
    
    // VALIDAR: Duração do trim deve ser suficiente para pelo menos 1 clip
    if (trimmedDuration < cutDuration) {
      throw new Error(`Duração do trim (${trimmedDuration}s) é menor que duração do clip (${cutDuration}s)`);
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

