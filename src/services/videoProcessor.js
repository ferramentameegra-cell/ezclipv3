import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { splitVideoIntoClips, trimVideo } from './videoTrimmer.js';
import { getVideoState, VIDEO_STATES } from './videoStateManager.js';
import { validateVideoWithFfprobe } from './videoValidator.js';
import { composeFinalVideo } from './videoComposer.js';
import { updateProgressEvent } from '../controllers/progressEvents.js';
import { STORAGE_CONFIG } from '../config/storage.config.js';

/** Timeout (s) para FFmpeg de fallback na composição */
const FFMPEG_FALLBACK_TIMEOUT = parseInt(process.env.FFMPEG_COMPOSE_TIMEOUT || process.env.FFMPEG_TRIM_TIMEOUT || '300', 10);

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
    // Atualizar progresso inicial (1%)
    console.log('[PROCESSING] Iniciando geração de série...');
    if (typeof job.progress === 'function') {
      await job.progress(1);
    } else {
      job.progress = 1;
    }
    if (jobsMap) jobsMap.set(job.id, job);
    
    // Atualizar evento de progresso para o frontend
    updateProgressEvent(job.id, {
      status: 'processing',
      progress: 1,
      message: 'Iniciando processamento...',
      totalClips: 0,
      currentClip: 0
    });
    
    // Extrair dados do job (pode estar em job.data ou diretamente em job)
    const jobData = job.data || job;
    
    const {
      videoId,
      numberOfCuts,
      seriesId,
      trimStart = 0,
      trimEnd = null,
      cutDuration = 60,
      nicheId,
      retentionVideoId = 'random',
      headlineStyle = 'bold',
      headlineText = null,
      headlineSize = 72,
      headlineColor = '#FFFFFF',
      headlineStrokeColor = '#000000',
      headlineFontSize = 'medium',
      headlineTitlePosition = 'center',
      headlineTarjaSuperiorSize = null,
      headlineTarjaInferiorSize = null,
      headlineTarjaCentralSize = null,
      headlineTarjaSuperiorColor = null,
      headlineTarjaInferiorColor = null,
      headlineTarjaCentralColor = null,
      font = 'Inter',
      backgroundColor = '#000000',
      // CONFIGURAÇÕES DE VÍDEO
      format = '9:16',
      platforms = { tiktok: true, reels: true, shorts: true },
      captionLanguage = 'pt',
      captionStyle = 'modern',
      clipsQuantity = null,
      safeMargins = 10
    } = jobData;

    if (!videoStore) {
      throw new Error('VideoStore não foi configurado');
    }

    let video = videoStore.get(videoId);
    
    // Se vídeo não está no store, tentar aguardar download ou baixar
    if (!video) {
      console.log(`[PROCESSING] ⚠️ Vídeo ${videoId} não encontrado no videoStore, verificando download...`);
      
      // Verificar se há arquivo baixado mesmo sem estar no store
      // Usar STORAGE_CONFIG para caminhos centralizados
      const possiblePaths = [
        STORAGE_CONFIG.getVideoPath(videoId), // Caminho padrão
        STORAGE_CONFIG.getDownloadedVideoPath(videoId), // Nome alternativo
        STORAGE_CONFIG.getTrimmedVideoPath(videoId), // Vídeo trimado
      ];
      
      // Logs de debug
      console.log(`[SEARCH_DEBUG] Procurando vídeo ${videoId} nos seguintes caminhos:`);
      possiblePaths.forEach(p => {
        const exists = fs.existsSync(p);
        const size = exists ? fs.statSync(p).size : 0;
        console.log(`[SEARCH_DEBUG]   - ${p} (existe: ${exists}, tamanho: ${(size / 1024 / 1024).toFixed(2)} MB)`);
      });
      console.log(`[SEARCH_DEBUG] STORAGE_CONFIG.UPLOADS_DIR: ${STORAGE_CONFIG.UPLOADS_DIR}`);
      console.log(`[SEARCH_DEBUG] NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
      
      // Tentar encontrar arquivo existente
      let foundPath = null;
      for (const possiblePath of possiblePaths) {
        try {
          if (fs.existsSync(possiblePath)) {
            const stats = fs.statSync(possiblePath);
            if (stats.size > 0) {
              foundPath = possiblePath;
              console.log(`[PROCESSING] ✅ Arquivo encontrado em: ${foundPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
              break;
            }
          }
        } catch (err) {
          // Continuar procurando em outros caminhos
          continue;
        }
      }
      
      // Se encontrou arquivo, criar entrada no videoStore
      if (foundPath) {
        video = {
          id: videoId,
          path: foundPath,
          downloaded: true,
          fileSize: fs.statSync(foundPath).size
        };
        videoStore.set(videoId, video);
        console.log(`[PROCESSING] ✅ Vídeo adicionado ao videoStore: ${videoId}`);
      } else {
        // Se não encontrou arquivo, verificar se há youtubeVideoId no jobData para baixar
        const youtubeVideoId = jobData.youtubeVideoId;
        if (youtubeVideoId) {
          console.log(`[PROCESSING] ⬇️ Vídeo não encontrado, iniciando download do YouTube: ${youtubeVideoId}`);
          // O download será feito abaixo na seção de download do YouTube
          // Criar entrada temporária no videoStore
          video = {
            id: videoId,
            youtubeVideoId: youtubeVideoId,
            path: null,
            downloaded: false
          };
          videoStore.set(videoId, video);
        } else {
          throw new Error(`Vídeo ${videoId} não encontrado no videoStore e nenhum arquivo encontrado. Verifique se o download foi concluído.`);
        }
      }
    }

    // Verificar estado do vídeo (se existir)
    const videoState = getVideoState(videoId);
    if (videoState && videoState.state === VIDEO_STATES.DOWNLOADING) {
      console.log(`[PROCESSING] ⏳ Vídeo está sendo baixado, aguardando conclusão...`);
      // Aguardar até 60 segundos pelo download
      let waitCount = 0;
      const maxWait = 60; // 60 tentativas de 1 segundo = 60 segundos
      while (waitCount < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Aguardar 1 segundo
        const currentState = getVideoState(videoId);
        const currentVideo = videoStore.get(videoId);
        
        if (currentState?.state === VIDEO_STATES.READY && currentVideo?.path && fs.existsSync(currentVideo.path)) {
          video = currentVideo;
          console.log(`[PROCESSING] ✅ Download concluído após ${waitCount + 1} segundos`);
          break;
        }
        
        waitCount++;
        if (waitCount % 10 === 0) {
          console.log(`[PROCESSING] ⏳ Aguardando download... (${waitCount}s/${maxWait}s)`);
        }
      }
      
      // Verificar novamente após aguardar
      if (!video.path || !fs.existsSync(video.path)) {
        throw new Error(`Vídeo ${videoId} ainda não está pronto após aguardar ${maxWait} segundos. Estado: ${getVideoState(videoId)?.state || 'unknown'}`);
      }
    } else if (videoState && videoState.state !== VIDEO_STATES.READY && videoState.state !== VIDEO_STATES.IDLE) {
      console.warn(`[PROCESSING] ⚠️ Estado do vídeo: ${videoState.state} (esperado: READY ou IDLE)`);
      // Continuar mesmo assim se o arquivo existir
    }

    // ===============================
    // PREPARAR DIRETÓRIO DA SÉRIE
    // ===============================
    const seriesPath = STORAGE_CONFIG.getSeriesPath(seriesId);

    if (!fs.existsSync(seriesPath)) {
      fs.mkdirSync(seriesPath, { recursive: true });
    }

    // ===============================
    // DEFINIR VÍDEO FONTE
    // ===============================
    // Tentar obter videoPath do jobData primeiro, depois do video.path
    let sourceVideoPath = jobData.videoPath || video.path;

    // ===============================
    // DOWNLOAD YOUTUBE (SE NECESSÁRIO)
    // ===============================
    // Verificar se precisa baixar (vídeo do YouTube sem arquivo local)
    const youtubeVideoId = video.youtubeVideoId || jobData.youtubeVideoId;
    if (youtubeVideoId && (!video.path || !fs.existsSync(video.path) || (fs.existsSync(video.path) && fs.statSync(video.path).size === 0))) {
      const downloadPath = STORAGE_CONFIG.getDownloadedVideoPath(videoId);

      console.log(`[PROCESSING] Baixando vídeo do YouTube: ${youtubeVideoId}`);

      // Atualizar progresso usando função do BullMQ
      if (typeof job.progress === 'function') {
        await job.progress(5);
      } else {
        job.progress = 5;
      }
      if (jobsMap) jobsMap.set(job.id, job);
      
      // Atualizar evento de progresso para o frontend
      updateProgressEvent(job.id, {
        status: 'processing',
        progress: 5,
        message: 'Baixando vídeo do YouTube...',
        totalClips: 0,
        currentClip: 0
      });

      // Usar robustDownloader para download à prova de falhas
      const { downloadWithRetries } = await import('./robustDownloader.js');
      
      // Callback de progresso que atualiza o frontend via SSE
      const onProgress = (progressData) => {
        // Mapear progresso do download (0-100) para o progresso geral do job (5-20%)
        const downloadProgressPercent = 5 + (progressData.progress * 0.15); // 5% a 20%
        
        // Atualizar progresso do job
        if (typeof job.progress === 'function') {
          job.progress(Math.round(downloadProgressPercent));
        } else {
          job.progress = Math.round(downloadProgressPercent);
        }
        if (jobsMap) jobsMap.set(job.id, job);
        
        // Atualizar evento de progresso para o frontend
        updateProgressEvent(job.id, {
          status: progressData.status === 'downloading' ? 'processing' : progressData.status,
          progress: Math.round(downloadProgressPercent),
          message: progressData.message || 'Baixando vídeo do YouTube...',
          totalClips: 0,
          currentClip: 0,
          downloadProgress: progressData.progress, // Progresso específico do download
          downloadStatus: progressData.status // Status específico do download
        });
        
        console.log(`[PROCESSING] Download progress: ${progressData.progress.toFixed(1)}% - ${progressData.message || ''}`);
      };
      
      const downloadedPath = await downloadWithRetries(youtubeVideoId, videoId, onProgress);
      
      // Se o caminho retornado for diferente do esperado, usar o retornado
      if (downloadedPath && downloadedPath !== downloadPath) {
        console.log(`[PROCESSING] Download retornou caminho diferente: ${downloadedPath}`);
        downloadPath = downloadedPath;
      }

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

      // Atualizar progresso usando função do BullMQ
      if (typeof job.progress === 'function') {
        await job.progress(20);
      } else {
        job.progress = 20;
      }
      if (jobsMap) jobsMap.set(job.id, job);
      
      // Atualizar evento de progresso para o frontend
      updateProgressEvent(job.id, {
        status: 'processing',
        progress: 20,
        message: 'Download concluído, validando...',
        totalClips: 0,
        currentClip: 0
      });
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
    // SEMPRE obter duração via ffprobe (fonte única de verdade)
    // TESTE 2: Validar Obtenção de Duração
    let videoDuration = 0;
    try {
      console.log(`[DURATION_TEST] Testando duração para: ${sourceVideoPath}`);
      const videoValidation = await validateVideoWithFfprobe(sourceVideoPath);
      videoDuration = Math.floor(videoValidation.durationFloat || videoValidation.duration || 0);
      
      if (!videoDuration || videoDuration <= 0 || isNaN(videoDuration)) {
        throw new Error(`Duração inválida retornada pelo ffprobe: ${videoDuration}s`);
      }
      
      console.log(`[DURATION_TEST] ✅ Duração obtida: ${videoDuration}s`);
      console.log(`[PROCESSING] ✅ Duração obtida via ffprobe: ${videoDuration}s`);
      
      // Atualizar no store para referência futura
      video.duration = videoDuration;
      videoStore.set(videoId, video);
    } catch (validationError) {
      console.error(`[DURATION_TEST] ❌ Erro ao obter duração: ${validationError.message}`);
      throw new Error(`Não foi possível obter a duração do vídeo via ffprobe: ${validationError.message}`);
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
      // Atualizar progresso usando função do BullMQ
      if (typeof job.progress === 'function') {
        await job.progress(30);
      } else {
        job.progress = 30;
      }
      if (jobsMap) jobsMap.set(job.id, job);
      
      // Atualizar evento de progresso para o frontend
      updateProgressEvent(job.id, {
        status: 'processing',
        progress: 30,
        message: 'Aplicando trim ao vídeo...',
        totalClips: 0,
        currentClip: 0
      });

      const trimmedPath = STORAGE_CONFIG.getTrimmedVideoPath(videoId);

      console.log(`[PROCESSING] Aplicando trim: ${startTime}s - ${endTime}s`);

      processedVideoPath = await trimVideo(
        sourceVideoPath,
        trimmedPath,
        startTime,
        endTime
      );

      // ===============================
      // VALIDAÇÃO PÓS-TRIM (CRÍTICO)
      // ===============================
      const expectedTrimDuration = endTime - startTime;
      
      // Validar que o arquivo trimado foi criado corretamente
      if (!fs.existsSync(trimmedPath)) {
        throw new Error(`Erro de Trim: o arquivo de vídeo trimado não foi criado: ${trimmedPath}`);
      }
      
      const trimmedStats = fs.statSync(trimmedPath);
      if (trimmedStats.size === 0) {
        throw new Error('Erro de Trim: o arquivo de vídeo trimado está vazio.');
      }
      
      // Validar duração do arquivo trimado usando ffprobe
      const trimmedMetadata = await validateVideoWithFfprobe(trimmedPath);
      const actualTrimmedDuration = Math.floor(trimmedMetadata.durationFloat || 0);
      
      // Permite uma pequena tolerância (ex: 2 segundos) para a duração
      if (Math.abs(actualTrimmedDuration - expectedTrimDuration) > 2) {
        throw new Error(`Erro de Trim: a duração do vídeo trimado não corresponde ao esperado. Esperado: ${expectedTrimDuration}s, Obtido: ${actualTrimmedDuration}s`);
      }
      
      // TESTE 3: Validar Trim e Validação Pós-Trim
      console.log(`[TRIM_VALIDATION] ========================================`);
      console.log(`[TRIM_VALIDATION] ✅ Trim validado com sucesso`);
      console.log(`[TRIM_VALIDATION]   Arquivo: ${trimmedPath}`);
      console.log(`[TRIM_VALIDATION]   Duração esperada: ${expectedTrimDuration}s`);
      console.log(`[TRIM_VALIDATION]   Duração obtida: ${actualTrimmedDuration}s`);
      console.log(`[TRIM_VALIDATION]   Diferença: ${Math.abs(actualTrimmedDuration - expectedTrimDuration)}s`);
      console.log(`[TRIM_VALIDATION] ========================================`);
      console.log(`[PROCESSING] ✅ Trim validado com sucesso. Duração: ${actualTrimmedDuration}s (esperado: ${expectedTrimDuration}s)`);

      // Após o trim, o vídeo processado começa em 0 e termina em trimmedDuration
      actualStartTime = 0;
      actualEndTime = trimmedDuration;
      
      console.log(`[PROCESSING] Trim aplicado - actualStartTime: ${actualStartTime}s, actualEndTime: ${actualEndTime}s (trimmedDuration: ${trimmedDuration}s)`);

      // Atualizar progresso usando função do BullMQ
      if (typeof job.progress === 'function') {
        await job.progress(50);
      } else {
        job.progress = 50;
      }
      if (jobsMap) jobsMap.set(job.id, job);
      
      // Atualizar evento de progresso para o frontend
      updateProgressEvent(job.id, {
        status: 'processing',
        progress: 50,
        message: 'Trim aplicado, preparando clipes...',
        totalClips: 0,
        currentClip: 0
      });
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
    // VERIFICAR FFMPEG ANTES DE GERAR CLIPS
    // ===============================
    try {
      const { configureFfmpeg } = await import('../utils/ffmpegDetector.js');
      const ffmpegConfigured = await configureFfmpeg();
      if (!ffmpegConfigured) {
        console.warn('[PROCESSING] ⚠️ FFmpeg pode não estar configurado corretamente, mas continuando...');
      }
    } catch (ffmpegError) {
      console.warn('[PROCESSING] ⚠️ Erro ao verificar FFmpeg:', ffmpegError.message);
      // Continuar mesmo assim - pode estar no PATH
    }

    // ===============================
    // GERAR CLIPS
    // ===============================
    console.log(`[PROCESSING] ========================================`);
    console.log(`[PROCESSING] INICIANDO GERAÇÃO DE CLIPS`);
    console.log(`[PROCESSING] ========================================`);
    console.log(`[PROCESSING] Parâmetros para splitVideoIntoClips:`);
    console.log(`[PROCESSING]   - processedVideoPath: ${processedVideoPath}`);
    console.log(`[PROCESSING]   - seriesPath: ${seriesPath}`);
    console.log(`[PROCESSING]   - cutDuration: ${cutDuration}s`);
    console.log(`[PROCESSING]   - actualStartTime: ${actualStartTime}s`);
    console.log(`[PROCESSING]   - actualEndTime: ${actualEndTime}s`);
    console.log(`[PROCESSING]   - Duração total: ${actualEndTime - actualStartTime}s`);

    // Validar que o arquivo de vídeo existe antes de gerar clipes
    if (!fs.existsSync(processedVideoPath)) {
      throw new Error(`Vídeo processado não encontrado: ${processedVideoPath}`);
    }

    const processedVideoStats = fs.statSync(processedVideoPath);
    if (processedVideoStats.size === 0) {
      throw new Error(`Vídeo processado está vazio: ${processedVideoPath}`);
    }

    console.log(`[PROCESSING] ✅ Vídeo processado validado: ${(processedVideoStats.size / 1024 / 1024).toFixed(2)} MB`);

    // Se clipsQuantity foi especificado, ajustar cutDuration para gerar exatamente essa quantidade
    let finalCutDuration = cutDuration;
    let finalNumberOfCuts = numberOfCuts;
    
    if (clipsQuantity && clipsQuantity > 0) {
      // Calcular cutDuration necessário para gerar exatamente clipsQuantity clipes
      const totalDuration = actualEndTime - actualStartTime;
      finalCutDuration = totalDuration / clipsQuantity;
      finalNumberOfCuts = clipsQuantity;
      console.log(`[PROCESSING] Quantidade de clipes especificada: ${clipsQuantity}`);
      console.log(`[PROCESSING] Duração ajustada por clip: ${finalCutDuration.toFixed(2)}s`);
    }
    
    console.log(`[PROCESSING] ========================================`);
    console.log(`[PROCESSING] CHAMANDO splitVideoIntoClips`);
    console.log(`[PROCESSING] ========================================`);
    console.log(`[PROCESSING] Parâmetros:`);
    console.log(`[PROCESSING]   - processedVideoPath: ${processedVideoPath}`);
    console.log(`[PROCESSING]   - seriesPath: ${seriesPath}`);
    console.log(`[PROCESSING]   - finalCutDuration: ${finalCutDuration}s`);
    console.log(`[PROCESSING]   - actualStartTime: ${actualStartTime}s`);
    console.log(`[PROCESSING]   - actualEndTime: ${actualEndTime}s`);
    console.log(`[PROCESSING]   - Duração total: ${actualEndTime - actualStartTime}s`);
    console.log(`[PROCESSING]   - Número esperado de clipes: ${finalNumberOfCuts || 'automático'}`);
    
    // VALIDAR arquivo de vídeo processado ANTES de chamar splitVideoIntoClips
    if (!fs.existsSync(processedVideoPath)) {
      const error = `[PROCESSING_ERROR] Vídeo processado não encontrado antes de split: ${processedVideoPath}`;
      console.error(error);
      throw new Error(error);
    }
    
    const processedStats = fs.statSync(processedVideoPath);
    if (processedStats.size === 0) {
      const error = `[PROCESSING_ERROR] Vídeo processado está vazio antes de split: ${processedVideoPath}`;
      console.error(error);
      throw new Error(error);
    }
    
    console.log(`[PROCESSING] ✅ Vídeo processado validado antes de split: ${(processedStats.size / 1024 / 1024).toFixed(2)} MB`);
    
    // Atualizar progresso antes de começar a gerar clipes
    updateProgressEvent(job.id, {
      status: 'processing',
      progress: 55,
      message: `Iniciando geração de ${finalNumberOfCuts || 'clipes'} com FFmpeg...`,
      totalClips: finalNumberOfCuts || 0,
      currentClip: 0
    });
    
    // Callback para atualizar progresso durante geração de clipes
    const progressCallback = (clipProgress) => {
      const clipProgressPercent = 55 + Math.floor((clipProgress.currentClip / (clipProgress.totalClips || 1)) * 5); // 55% a 60%
      updateProgressEvent(job.id, {
        status: 'processing',
        progress: clipProgressPercent,
        message: clipProgress.message,
        totalClips: clipProgress.totalClips,
        currentClip: clipProgress.currentClip
      });
    };
    
    let clips = [];
    try {
      console.log(`[PROCESSING] Executando splitVideoIntoClips...`);
      clips = await splitVideoIntoClips(
        processedVideoPath,
        seriesPath,
        finalCutDuration,
        actualStartTime,
        actualEndTime,
        progressCallback
      );
      console.log(`[PROCESSING] ✅ splitVideoIntoClips retornou ${clips.length} clipe(s)`);
      
      // VALIDAR que clipes foram gerados
      if (!clips || clips.length === 0) {
        const error = `[PROCESSING_ERROR] splitVideoIntoClips retornou array vazio! Esperado: ${finalNumberOfCuts || 'pelo menos 1'} clipe(s)`;
        console.error(error);
        throw new Error(error);
      }
      
      // VALIDAR que cada clip existe e não está vazio
      console.log(`[PROCESSING] Validando ${clips.length} clipe(s) gerados...`);
      for (let i = 0; i < clips.length; i++) {
        const clipPath = clips[i];
        if (!fs.existsSync(clipPath)) {
          const error = `[PROCESSING_ERROR] Clip ${i + 1} não existe: ${clipPath}`;
          console.error(error);
          throw new Error(error);
        }
        const clipStats = fs.statSync(clipPath);
        if (clipStats.size === 0) {
          const error = `[PROCESSING_ERROR] Clip ${i + 1} está vazio: ${clipPath}`;
          console.error(error);
          throw new Error(error);
        }
        console.log(`[PROCESSING] ✅ Clip ${i + 1} validado: ${clipPath} (${(clipStats.size / 1024 / 1024).toFixed(2)} MB)`);
      }
      console.log(`[PROCESSING] ✅ Todos os ${clips.length} clipe(s) foram validados com sucesso`);
    } catch (splitError) {
      console.error(`[PROCESSING_ERROR] ========================================`);
      console.error(`[PROCESSING_ERROR] ERRO ao executar splitVideoIntoClips`);
      console.error(`[PROCESSING_ERROR] ========================================`);
      console.error(`[PROCESSING_ERROR] Mensagem: ${splitError.message}`);
      console.error(`[PROCESSING_ERROR] Stack: ${splitError.stack}`);
      console.error(`[PROCESSING_ERROR] Input: ${processedVideoPath}`);
      console.error(`[PROCESSING_ERROR] Output dir: ${seriesPath}`);
      console.error(`[PROCESSING_ERROR] ========================================`);
      throw splitError; // Re-lançar erro para ser capturado pelo catch principal
    }
    
    // Limitar número de clipes se necessário
    const finalClips = clipsQuantity && clipsQuantity > 0 
      ? clips.slice(0, clipsQuantity)
      : clips;
    
    console.log(`[PROCESSING] ========================================`);
    console.log(`[PROCESSING] CLIPES GERADOS COM SUCESSO`);
    console.log(`[PROCESSING] ========================================`);
    console.log(`[PROCESSING] Total de clipes gerados: ${finalClips.length}`);
    console.log(`[PROCESSING] Solicitado: ${finalNumberOfCuts || 'automático'}`);
    console.log(`[PROCESSING] Clipes criados:`);
    finalClips.forEach((clip, index) => {
      const stats = fs.statSync(clip);
      console.log(`[PROCESSING]   ${index + 1}. ${clip} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    });
    console.log(`[PROCESSING] ========================================`);
    
    // VALIDAÇÃO FINAL: garantir que pelo menos um clip foi gerado
    if (finalClips.length === 0) {
      const error = `[PROCESSING_ERROR] Nenhum clip foi gerado! splitVideoIntoClips retornou array vazio.`;
      console.error(error);
      throw new Error(error);
    }

    // ===============================
    // GERAR CLIPES DE RETENÇÃO AUTOMATICAMENTE
    // ===============================
    let retentionClips = [];
    let retentionVideoPath = null;
    
    // Obter vídeo de retenção se especificado
    if (retentionVideoId && retentionVideoId !== 'none') {
      try {
        // Sistema antigo de retenção removido - usar apenas retentionManager
        // Este código é mantido apenas para compatibilidade, mas não deve ser usado
        console.warn(`[PROCESSING] ⚠️ retentionVideoId=${retentionVideoId} não é mais suportado. Use apenas o sistema de retenção por nicho.`);
        
        if (retentionVideoPath && fs.existsSync(retentionVideoPath)) {
          const stats = fs.statSync(retentionVideoPath);
          if (stats.size > 0) {
            console.log(`[PROCESSING] ✅ Vídeo de retenção encontrado: ${retentionVideoPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
            console.log(`[PROCESSING] 🎬 Gerando clipes de retenção com os mesmos intervalos do vídeo principal...`);
            
            // Criar diretório para clipes de retenção
            const retentionClipsDir = path.join(seriesPath, 'retention-clips');
            if (!fs.existsSync(retentionClipsDir)) {
              fs.mkdirSync(retentionClipsDir, { recursive: true });
            }
            
            // Gerar clipes de retenção com os mesmos intervalos
            // Calcular intervalos dos clipes principais
            const clipIntervals = [];
            for (let i = 0; i < finalClips.length; i++) {
              const clipStart = actualStartTime + (i * finalCutDuration);
              const clipEnd = clipStart + finalCutDuration;
              clipIntervals.push({ start: clipStart, end: clipEnd, index: i });
            }
            
            console.log(`[PROCESSING] Gerando ${clipIntervals.length} clipes de retenção com intervalos:`, clipIntervals.map(ci => `${ci.start.toFixed(2)}s-${ci.end.toFixed(2)}s`).join(', '));
            
            // OTIMIZAÇÃO 2: Paralelizar geração de clipes de retenção
            console.log(`[PROCESSING] ⚡ Gerando ${clipIntervals.length} clipes de retenção em PARALELO...`);
            const retentionStartTime = Date.now();
            
            const retentionPromises = clipIntervals.map(async (interval) => {
              const retentionClipPath = path.join(
                retentionClipsDir,
                `retention_clip_${String(interval.index + 1).padStart(3, '0')}.mp4`
              );
              
              console.log(`[PROCESSING] [PARALLEL] Gerando clip de retenção ${interval.index + 1}/${clipIntervals.length}: ${interval.start.toFixed(2)}s - ${interval.end.toFixed(2)}s`);
              
              try {
                await trimVideo(retentionVideoPath, retentionClipPath, interval.start, interval.end);
                
                // Validar clip gerado
                if (fs.existsSync(retentionClipPath)) {
                  const clipStats = fs.statSync(retentionClipPath);
                  if (clipStats.size > 0) {
                    console.log(`[PROCESSING] ✅ Clip de retenção ${interval.index + 1} gerado: ${(clipStats.size / 1024 / 1024).toFixed(2)} MB`);
                    return retentionClipPath;
                  } else {
                    console.warn(`[PROCESSING] ⚠️ Clip de retenção ${interval.index + 1} está vazio`);
                    return null;
                  }
                } else {
                  console.warn(`[PROCESSING] ⚠️ Clip de retenção ${interval.index + 1} não foi criado`);
                  return null;
                }
              } catch (clipError) {
                console.error(`[PROCESSING] ❌ Erro ao gerar clip de retenção ${interval.index + 1}: ${clipError.message}`);
                // Continuar mesmo se um clip falhar
                return null;
              }
            });
            
            // Aguardar todos os clipes de retenção em paralelo
            const retentionResults = await Promise.all(retentionPromises);
            retentionClips = retentionResults.filter(path => path !== null);
            
            const retentionDuration = ((Date.now() - retentionStartTime) / 1000).toFixed(2);
            console.log(`[PROCESSING] ⚡ ${retentionClips.length}/${clipIntervals.length} clipes de retenção gerados em PARALELO em ${retentionDuration}s`);
            
            console.log(`[PROCESSING] ✅ ${retentionClips.length}/${clipIntervals.length} clipes de retenção gerados com sucesso`);
          } else {
            console.warn(`[PROCESSING] ⚠️ Vídeo de retenção está vazio, pulando geração de clipes`);
          }
        } else {
          console.warn(`[PROCESSING] ⚠️ Vídeo de retenção não encontrado, pulando geração de clipes`);
        }
      } catch (retentionError) {
        console.error(`[PROCESSING] ❌ Erro ao gerar clipes de retenção: ${retentionError.message}`);
        // Continuar mesmo se houver erro na geração de clipes de retenção
      }
    }

    // Atualizar progresso após gerar clipes
    if (typeof job.progress === 'function') {
      await job.progress(60);
    } else {
      job.progress = 60;
    }
    if (jobsMap) jobsMap.set(job.id, job);
    
    // Atualizar evento de progresso para o frontend
    updateProgressEvent(job.id, {
      status: 'processing',
      progress: 60,
      message: `${finalClips.length} clipe(s) gerado(s)${retentionClips.length > 0 ? ` + ${retentionClips.length} clipe(s) de retenção` : ''}, iniciando composição...`,
      totalClips: finalClips.length,
      currentClip: 0
    });

    // ===============================
    // APLICAR COMPOSIÇÃO FINAL EM CADA CLIP
    // ===============================
    console.log(`[PROCESSING] Aplicando composição final em ${finalClips.length} clips...`);

    // Obter legendas do vídeo (se houver)
    let captions = video.captions?.edited || video.captions?.raw || [];
    
    console.log(`[PROCESSING] Legendas encontradas no vídeo: ${captions.length} (edited: ${video.captions?.edited?.length || 0}, raw: ${video.captions?.raw?.length || 0})`);
    
    // FORÇAR geração automática de legendas se não houver legendas
    if (captions.length === 0) {
      console.log(`[PROCESSING] ⚠️ Nenhuma legenda encontrada. Gerando legendas automaticamente...`);
      
      try {
        // Importar serviço de legendas
        const { generateCaptions } = await import('./captionService.js');
        
        // Usar o vídeo processado (já trimado se necessário) para gerar legendas
        // O generateCaptions já lida com trimStart e trimEnd internamente
        const videoForCaptions = processedVideoPath || sourceVideoPath;
        
        if (!fs.existsSync(videoForCaptions)) {
          throw new Error(`Vídeo não encontrado para geração de legendas: ${videoForCaptions}`);
        }
        
        console.log(`[PROCESSING] Iniciando geração automática de legendas para: ${videoForCaptions}`);
        console.log(`[PROCESSING] Intervalo: ${actualStartTime}s - ${actualEndTime}s`);
        
        const captionResult = await generateCaptions(videoForCaptions, {
          trimStart: actualStartTime,
          trimEnd: actualEndTime,
          language: captionLanguage || 'pt',
          maxCharsPerLine: 30, // Formato vertical 9:16
          maxLinesPerBlock: 2
        });
        
        if (captionResult && captionResult.captions && captionResult.captions.length > 0) {
          captions = captionResult.captions;
          console.log(`[PROCESSING] ✅ Legendas geradas automaticamente: ${captions.length} blocos`);
          
          // Log das primeiras legendas
          const firstCaption = captions[0];
          const lastCaption = captions[captions.length - 1];
          console.log(`[PROCESSING] Primeira legenda gerada: "${firstCaption.text || firstCaption.lines?.join(' ')}" [${firstCaption.start}s - ${firstCaption.end}s]`);
          console.log(`[PROCESSING] Última legenda gerada: "${lastCaption.text || lastCaption.lines?.join(' ')}" [${lastCaption.start}s - ${lastCaption.end}s]`);
        } else {
          console.warn(`[PROCESSING] ⚠️ Geração automática de legendas não retornou resultados. Continuando sem legendas.`);
        }
      } catch (captionError) {
        console.error(`[PROCESSING] ❌ Erro ao gerar legendas automaticamente:`, captionError.message);
        console.error(`[PROCESSING] Stack trace:`, captionError.stack);
        console.warn(`[PROCESSING] ⚠️ Continuando sem legendas devido ao erro na geração automática.`);
        // Continuar sem legendas se houver erro (não bloquear geração)
      }
    } else {
      console.log(`[PROCESSING] ✅ Legendas disponíveis: ${captions.length} blocos de legenda`);
      // Log das primeiras legendas para debug
      if (captions.length > 0) {
        const firstCaption = captions[0];
        const lastCaption = captions[captions.length - 1];
        console.log(`[PROCESSING] Primeira legenda: "${firstCaption.text || firstCaption.lines?.join(' ')}" [${firstCaption.start}s - ${firstCaption.end}s]`);
        console.log(`[PROCESSING] Última legenda: "${lastCaption.text || lastCaption.lines?.join(' ')}" [${lastCaption.start}s - ${lastCaption.end}s]`);
      }
    }
    
    // IMPORTANTE: Ajustar timestamps das legendas se houver trim
    // As legendas vêm com timestamps do vídeo original, precisamos ajustar para o vídeo trimado
    if (startTime > 0 && captions.length > 0) {
      const originalCount = captions.length;
      console.log(`[PROCESSING] Ajustando timestamps das legendas: subtraindo ${startTime}s (trimStart)`);
      
      captions = captions.map(cap => ({
        ...cap,
        start: Math.max(0, cap.start - startTime), // Subtrair trimStart e garantir >= 0
        end: Math.max(0, cap.end - startTime) // Subtrair trimStart e garantir >= 0
      })).filter(cap => cap.end > 0); // Remover legendas que ficaram com end <= 0
      
      // Também remover legendas que estão completamente fora do intervalo trimado
      const trimmedDuration = actualEndTime - actualStartTime;
      captions = captions.filter(cap => cap.start < trimmedDuration);
      
      // Ajustar end para não ultrapassar a duração do vídeo trimado
      captions = captions.map(cap => ({
        ...cap,
        end: Math.min(cap.end, trimmedDuration)
      }));
      
      const removedCount = originalCount - captions.length;
      if (removedCount > 0) {
        console.log(`[PROCESSING] ${removedCount} legendas removidas (fora do intervalo trimado)`);
      }
      
      console.log(`[PROCESSING] ✅ Legendas ajustadas: ${captions.length} legendas dentro do intervalo trimado (${actualStartTime}s - ${actualEndTime}s)`);
    }
    
    // Aplicar estilo de legendas baseado na configuração
    const captionStyleConfig = getCaptionStyleConfig(captionStyle, font);
    const captionStyleObj = {
      font: captionStyleConfig.font,
      fontSize: captionStyleConfig.fontSize,
      color: captionStyleConfig.color,
      strokeColor: captionStyleConfig.strokeColor,
      strokeWidth: captionStyleConfig.strokeWidth
    };

    // Estilo da headline (tamanho por preset ou numérico)
    const HEADLINE_FONT_SIZE_MAP = { xs: 36, small: 48, medium: 72, large: 96, xl: 120 };
    const resolvedHeadlineSize = (headlineFontSize && HEADLINE_FONT_SIZE_MAP[headlineFontSize]) ? HEADLINE_FONT_SIZE_MAP[headlineFontSize] : (headlineSize || 72);
    const headlineStyleObj = {
      font: font || 'Inter',
      fontSize: resolvedHeadlineSize,
      color: headlineColor || '#FFFFFF',
      strokeColor: headlineStrokeColor || '#000000',
      fontStyle: headlineStyle || 'bold'
    };

    // finalClips já foi declarado acima (linha 324)
    const compositionProgress = 60; // Começar em 60% (após split)
    const compositionRange = 40; // 40% para composição
    
    // OTIMIZAÇÃO 1: Limite de concorrência para composição paralela
    const COMPOSITION_BATCH_SIZE = parseInt(process.env.COMPOSITION_BATCH_SIZE || '2', 10);
    console.log(`[PROCESSING] ⚡ Composição paralela ativada (batch size: ${COMPOSITION_BATCH_SIZE})`);
    
    // Inicializar evento de progresso
    updateProgressEvent(job.id, {
      status: 'processing',
      totalClips: finalClips.length,
      currentClip: 0,
      progress: compositionProgress,
      message: `Iniciando composição paralela de ${finalClips.length} clipes...`
    });

    // Usar clipes de retenção gerados automaticamente se disponíveis
    // Se não houver clipes de retenção, usar vídeo completo (fallback)
    console.log(`[PROCESSING] Clipes de retenção disponíveis: ${retentionClips.length}/${finalClips.length}`);

    // OTIMIZAÇÃO 1: Processar composição em batches paralelos
    const compositionStartTime = Date.now();
    const finalClipsPaths = [];
    
    for (let i = 0; i < finalClips.length; i += COMPOSITION_BATCH_SIZE) {
      const batch = finalClips.slice(i, i + COMPOSITION_BATCH_SIZE);
      const batchStartIndex = i;
      
      console.log(`[PROCESSING] ⚡ Processando batch de composição: clipes ${i + 1} a ${Math.min(i + COMPOSITION_BATCH_SIZE, finalClips.length)} (${batch.length} clipes em paralelo)`);
      
      // Criar promises para o batch atual
      const batchPromises = batch.map(async (clipPath, batchIndex) => {
        const clipIndex = batchStartIndex + batchIndex + 1;

        console.log(`[PROCESSING] ========================================`);
        console.log(`[PROCESSING] [PARALLEL] COMPONDO CLIP ${clipIndex}/${finalClips.length}`);
        console.log(`[PROCESSING] ========================================`);
        console.log(`[PROCESSING] Clip path: ${clipPath}`);
        
        // VALIDAR clip antes de compor
        if (!fs.existsSync(clipPath)) {
          const error = `[PROCESSING_ERROR] Clip ${clipIndex} não existe antes de composição: ${clipPath}`;
          console.error(error);
          throw new Error(error);
        }
        
        const clipStatsBefore = fs.statSync(clipPath);
        if (clipStatsBefore.size === 0) {
          const error = `[PROCESSING_ERROR] Clip ${clipIndex} está vazio antes de composição: ${clipPath}`;
          console.error(error);
          throw new Error(error);
        }
        
        console.log(`[PROCESSING] ✅ Clip ${clipIndex} validado antes de composição: ${(clipStatsBefore.size / 1024 / 1024).toFixed(2)} MB`);
        
        // Emitir evento: iniciando clipe
        updateProgressEvent(job.id, {
          status: 'processing',
          totalClips: finalClips.length,
          currentClip: clipIndex,
          progress: Math.round(compositionProgress + (compositionRange * ((clipIndex - 1) / finalClips.length))),
          message: `[PARALLEL] Gerando clipe ${clipIndex} de ${finalClips.length}`
        });

        // Criar caminho para clip final composto
        const finalClipPath = STORAGE_CONFIG.getFinalClipPath(seriesId, clipIndex);
        
        console.log(`[PROCESSING] Output path (final): ${finalClipPath}`);

        // Usar clip de retenção correspondente se disponível, senão usar vídeo completo
        let currentRetentionVideoPath = null;
        const retentionIndex = clipIndex - 1; // Converter para 0-based
        if (retentionClips.length > retentionIndex && retentionClips[retentionIndex] && fs.existsSync(retentionClips[retentionIndex])) {
          currentRetentionVideoPath = retentionClips[retentionIndex];
          console.log(`[PROCESSING] ✅ Usando clip de retenção ${clipIndex}: ${currentRetentionVideoPath}`);
        } else if (retentionVideoPath && fs.existsSync(retentionVideoPath)) {
          // Fallback: usar vídeo completo se clip não estiver disponível
          currentRetentionVideoPath = retentionVideoPath;
          console.log(`[PROCESSING] ⚠️ Clip de retenção ${clipIndex} não disponível, usando vídeo completo como fallback`);
        }

        try {
          // VALIDAR clip novamente antes de compor (pode ter sido deletado)
          if (!fs.existsSync(clipPath)) {
            throw new Error(`Clip ${clipIndex} foi removido durante processamento: ${clipPath}`);
          }
          
          // Filtrar legendas para este clip específico
          // IMPORTANTE: Usar overlap ao invés de "contém completamente"
          // Uma legenda deve aparecer se há qualquer overlap com o intervalo do clip
          const clipStartTime = retentionIndex * finalCutDuration;
          const clipEndTime = (retentionIndex + 1) * finalCutDuration;
          
          console.log(`[PROCESSING] Intervalo do clip ${clipIndex}: ${clipStartTime.toFixed(2)}s - ${clipEndTime.toFixed(2)}s`);
          
          // Filtrar legendas que têm overlap com o intervalo do clip
          // Overlap ocorre quando: cap.start < clipEndTime && cap.end > clipStartTime
          const clipCaptions = captions.filter(
            cap => cap.start < clipEndTime && cap.end > clipStartTime
          ).map(cap => ({
            ...cap,
            // Ajustar timestamps para serem relativos ao início do clip (0-based)
            start: Math.max(0, cap.start - clipStartTime), // Não permitir negativo
            end: Math.min(finalCutDuration, cap.end - clipStartTime) // Não ultrapassar duração do clip
          })).filter(cap => cap.end > cap.start); // Remover legendas inválidas (end <= start)
          
          console.log(`[PROCESSING] Clip ${clipIndex}: ${clipCaptions.length} legendas no intervalo [${clipStartTime.toFixed(2)}s - ${clipEndTime.toFixed(2)}s]`);

          // Headline para este clip (se houver)
          // HEADLINE SEMPRE VISÍVEL: Do primeiro ao último frame (100% da duração)
          const clipHeadline = headlineText ? {
            text: headlineText,
            startTime: 0,
            endTime: finalCutDuration // Até o final do clip, não apenas 5 segundos
          } : null;

          console.log(`[PROCESSING] Chamando composeFinalVideo para clip ${clipIndex}...`);
          console.log(`[PROCESSING] Parâmetros de composição:`);
          console.log(`[PROCESSING]   - clipPath: ${clipPath}`);
          console.log(`[PROCESSING]   - outputPath: ${finalClipPath}`);
          console.log(`[PROCESSING]   - legendas: ${clipCaptions.length} blocos`);
          console.log(`[PROCESSING]   - headline: ${clipHeadline ? 'SIM' : 'NÃO'}`);
          console.log(`[PROCESSING]   - retenção: ${currentRetentionVideoPath ? 'SIM' : 'NÃO'}`);
          
          // Aplicar composição final
          // FORMATO FIXO: Sempre 9:16 (1080x1920) vertical - OBRIGATÓRIO
          await composeFinalVideo({
          clipPath,
          outputPath: finalClipPath,
          captions: clipCaptions,
          captionStyle: captionStyleObj, // Usar objeto de estilo ao invés de string
          headline: clipHeadline,
          headlineStyle: headlineStyleObj,
          headlineText: headlineText,
          headlineStrokeColor: headlineStrokeColor || '#000000',
          headlineFontSize: headlineFontSize || 'medium',
          headlineTitlePosition: headlineTitlePosition || 'center',
          headlineTarjaSuperiorSize: headlineTarjaSuperiorSize ?? null,
          headlineTarjaInferiorSize: headlineTarjaInferiorSize ?? null,
          headlineTarjaCentralSize: headlineTarjaCentralSize ?? null,
          headlineTarjaSuperiorColor: headlineTarjaSuperiorColor || null,
          headlineTarjaInferiorColor: headlineTarjaInferiorColor || null,
          headlineTarjaCentralColor: headlineTarjaCentralColor || null,
          retentionVideoId,
          retentionVideoPath: currentRetentionVideoPath, // Passar caminho explícito
          nicheId,
          backgroundColor,
          format: '9:16', // FORÇAR formato vertical 9:16 (1080x1920)
          platforms: { tiktok: true, reels: true, shorts: true },
          safeMargins: 10,
          clipNumber: clipIndex, // Número do clipe atual (1-based)
          totalClips: finalClips.length, // Total de clipes gerados
          onProgress: async (progress) => {
            const percent = progress && typeof progress.percent === 'number' ? progress.percent : 0;
            const safePercent = Math.min(100, Math.max(0, percent));
            const clipProgress = compositionProgress + (compositionRange * (i / finalClips.length)) + (compositionRange * (safePercent / 100) / finalClips.length);
            const finalProgress = Math.min(100, Math.max(compositionProgress, Math.round(clipProgress)));
            // Atualizar progresso no BullMQ
            if (typeof job.progress === 'function') {
              await job.progress(finalProgress);
            } else {
              job.progress = finalProgress;
            }
            if (jobsMap) jobsMap.set(job.id, job);
            // Enviar progresso ao frontend via SSE para evitar tela “presa” em 60%
            updateProgressEvent(job.id, {
              status: 'processing',
              totalClips: finalClips.length,
              currentClip: clipIndex,
              progress: finalProgress,
              message: `Compondo clipe ${clipIndex} de ${finalClips.length}: ${Math.round(safePercent)}%`
            });
            console.log(`[PROCESSING] Progresso clip ${clipIndex}: ${safePercent}% -> Progresso geral: ${finalProgress}%`);
          }
          });

          // VALIDAR clip final ANTES de substituir
          if (!fs.existsSync(finalClipPath)) {
            throw new Error(`Clip final ${clipIndex} não foi criado: ${finalClipPath}`);
          }
          
          const finalClipStats = fs.statSync(finalClipPath);
          if (finalClipStats.size === 0) {
            throw new Error(`Clip final ${clipIndex} está vazio: ${finalClipPath}`);
          }
          
          console.log(`[PROCESSING] ✅ Clip final ${clipIndex} validado: ${(finalClipStats.size / 1024 / 1024).toFixed(2)} MB`);
          
          // Remover clip original (economizar espaço)
          if (fs.existsSync(clipPath) && clipPath !== finalClipPath) {
            try {
              fs.unlinkSync(clipPath);
              console.log(`[PROCESSING] ✅ Clip original removido: ${clipPath}`);
            } catch (unlinkError) {
              console.warn(`[PROCESSING] ⚠️ Erro ao remover clip original: ${unlinkError.message}`);
            }
          }

          console.log(`[PROCESSING] ✅ Clip ${clipIndex}/${finalClips.length} composto com sucesso`);
          console.log(`[PROCESSING] ✅ Clip final salvo em: ${finalClipPath}`);
          
          // Emitir evento: clipe concluído
          const clipProgress = Math.round(compositionProgress + (compositionRange * (clipIndex / finalClips.length)));
          updateProgressEvent(job.id, {
            status: 'processing',
            totalClips: finalClips.length,
            currentClip: clipIndex,
            progress: clipProgress,
            message: `[PARALLEL] Clipe ${clipIndex} de ${finalClips.length} concluído`
          });

          return finalClipPath;
      } catch (compositionError) {
        console.error(`[PROCESSING_ERROR] ========================================`);
        console.error(`[PROCESSING_ERROR] ERRO ao compor clip ${clipIndex}/${finalClips.length}`);
        console.error(`[PROCESSING_ERROR] ========================================`);
        console.error(`[PROCESSING_ERROR] Mensagem: ${compositionError.message}`);
        console.error(`[PROCESSING_ERROR] Stack trace: ${compositionError.stack}`);
        console.error(`[PROCESSING_ERROR] Clip path: ${clipPath}`);
        console.error(`[PROCESSING_ERROR] Output path: ${finalClipPath}`);
        console.error(`[PROCESSING_ERROR] ========================================`);
        console.error(`[PROCESSING] ⚠️ Tentando novamente a composição com tratamento de erro melhorado...`);
        
        // CORREÇÃO CRÍTICA: Garantir que clipCaptions esteja definida no escopo do catch
        // Se o erro ocorreu antes da definição de clipCaptions, definir como array vazio
        let retryClipCaptions = [];
        try {
          // Tentar recriar clipCaptions se captions estiver disponível
          if (captions && Array.isArray(captions)) {
            const clipStartTime = retentionIndex * finalCutDuration;
            const clipEndTime = (retentionIndex + 1) * finalCutDuration;
            
            retryClipCaptions = captions.filter(
              cap => cap.start < clipEndTime && cap.end > clipStartTime
            ).map(cap => ({
              ...cap,
              start: Math.max(0, cap.start - clipStartTime),
              end: Math.min(finalCutDuration, cap.end - clipStartTime)
            })).filter(cap => cap.end > cap.start);
            
            console.log(`[PROCESSING] ✅ clipCaptions recriada para recuperação: ${retryClipCaptions.length} legendas`);
          } else {
            console.warn(`[PROCESSING] ⚠️ captions não disponível, usando array vazio para recuperação`);
            retryClipCaptions = [];
          }
        } catch (captionsError) {
          console.warn(`[PROCESSING] ⚠️ Erro ao recriar clipCaptions: ${captionsError.message}, usando array vazio`);
          retryClipCaptions = [];
        }
        
        // Tentar composição novamente com tratamento de erro mais robusto
        try {
          console.log(`[PROCESSING] 🔄 Tentativa de recuperação: recompondo clip ${clipIndex}...`);
          
          // Recriar clipHeadline no escopo do catch para garantir que esteja definida
          const retryClipHeadline = headlineText ? {
            text: headlineText,
            startTime: 0,
            endTime: finalCutDuration
          } : null;
          
          // Usar currentRetentionVideoPath que já foi definido antes do loop
          // Se não estiver disponível, continuar sem vídeo de retenção (não bloquear)
          const retryComposition = await composeFinalVideo({
            clipPath: clipPath,
            outputPath: finalClipPath,
            retentionVideoId: retentionVideoId,
            retentionVideoPath: currentRetentionVideoPath,
            headline: retryClipHeadline,
            headlineStyle: headlineStyleObj,
            headlineText: headlineText,
            headlineStrokeColor: headlineStrokeColor || '#000000',
            headlineFontSize: headlineFontSize || 'medium',
            headlineTitlePosition: headlineTitlePosition || 'center',
            headlineTarjaSuperiorSize: headlineTarjaSuperiorSize ?? null,
            headlineTarjaInferiorSize: headlineTarjaInferiorSize ?? null,
            headlineTarjaCentralSize: headlineTarjaCentralSize ?? null,
            headlineTarjaSuperiorColor: headlineTarjaSuperiorColor || null,
            headlineTarjaInferiorColor: headlineTarjaInferiorColor || null,
            headlineTarjaCentralColor: headlineTarjaCentralColor || null,
            captions: retryClipCaptions,
            captionStyle: captionStyleObj,
            backgroundColor: backgroundColor,
            format: '9:16',
            platforms: { tiktok: true, reels: true, shorts: true },
            safeMargins: 10,
            clipNumber: clipIndex,
            totalClips: finalClips.length,
            onProgress: async (progress) => {
              const percent = progress && typeof progress.percent === 'number' ? progress.percent : 0;
              const safePercent = Math.min(100, Math.max(0, percent));
              const clipProgress = compositionProgress + (compositionRange * (i / finalClips.length)) + (compositionRange * (safePercent / 100) / finalClips.length);
              const finalProgress = Math.min(100, Math.max(compositionProgress, Math.round(clipProgress)));
              if (typeof job.progress === 'function') await job.progress(finalProgress);
              else job.progress = finalProgress;
              if (jobsMap) jobsMap.set(job.id, job);
              updateProgressEvent(job.id, {
                status: 'processing',
                totalClips: finalClips.length,
                currentClip: clipIndex,
                progress: finalProgress,
                message: `Compondo clipe ${clipIndex} de ${finalClips.length}: ${Math.round(safePercent)}%`
              });
            }
          });
          
          if (retryComposition && fs.existsSync(retryComposition) && fs.statSync(retryComposition).size > 0) {
            console.log(`[PROCESSING] ✅ Recuperação bem-sucedida: clip ${clipIndex} recompondo com sucesso`);
            return retryComposition;
          } else {
            throw new Error('Composição de recuperação falhou ou arquivo inválido');
          }
        } catch (retryError) {
          console.error(`[PROCESSING] ❌ Recuperação falhou: ${retryError.message}`);
          console.log(`[PROCESSING] ⚠️ Usando fallback simplificado para clip ${clipIndex}...`);
          
          // FALLBACK: Layout 9:16 forçado (igual ao composer)
          // Background + vídeo principal (topo) + headline (centro) + vídeo retenção (base)
          try {
            const fallbackClipPath = STORAGE_CONFIG.getFinalClipPath(seriesId, clipIndex);
            const hasRetention = currentRetentionVideoPath && fs.existsSync(currentRetentionVideoPath) && fs.statSync(currentRetentionVideoPath).size > 0;
            const hasHeadline = headlineText && typeof headlineText === 'string' && headlineText.trim().length > 0;
            const headlineEscaped = hasHeadline ? headlineText.trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'") : '';

            await new Promise((resolve, reject) => {
              // Layout fixo 9:16 (1080x1920) - mesmo do videoComposer
              const CANVAS_W = 1080;
              const CANVAS_H = 1920;
              const VIDEO_W = 1080;
              const VIDEO_H = 608;
              const VIDEO_Y_TOP = 180;
              const VIDEO_Y_BOTTOM = 1172;
              const HEADLINE_Y = 960;

              const parts = [];
              // 1. Background
              parts.push(`color=c=black:s=${CANVAS_W}x${CANVAS_H}:d=60[bg_fixed]`);
              // 2. Vídeo principal (input 0) no topo
              parts.push(`[0:v]scale=${VIDEO_W}:${VIDEO_H}[main_scaled]`);
              parts.push(`[bg_fixed][main_scaled]overlay=(W-w)/2:${VIDEO_Y_TOP}[composed]`);

              let currentLabel = '[composed]';
              // 3. Headline no centro (se existir)
              if (hasHeadline && headlineEscaped) {
                parts.push(`[composed]drawtext=fontfile='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf':text='${headlineEscaped}':fontsize=72:fontcolor=#FFFFFF:x=(w-text_w)/2:y=${HEADLINE_Y}[with_headline]`);
                currentLabel = '[with_headline]';
              }
              // 4. Vídeo de retenção na base (se existir)
              if (hasRetention) {
                parts.push(`[1:v]scale=${VIDEO_W}:${VIDEO_H}[retention_scaled]`);
                parts.push(`${currentLabel}[retention_scaled]overlay=(W-w)/2:${VIDEO_Y_BOTTOM}:shortest=1[with_retention]`);
                currentLabel = '[with_retention]';
              }
              // 5. Garantir label [final]
              parts.push(`${currentLabel}copy[final]`);

              const filterComplex = parts.join(';');
              // Validar que [final] existe (FFmpeg usa "label[final]", não "= [final]")
              if (!filterComplex.includes('[final]')) {
                return reject(new Error('Filter complex do fallback não contém [final]'));
              }

              const cmd = ffmpeg(clipPath, { timeout: FFMPEG_FALLBACK_TIMEOUT });
              if (hasRetention) {
                cmd.input(currentRetentionVideoPath).inputOptions(['-stream_loop', '-1']);
              }
              cmd
                .complexFilter(filterComplex)
                .outputOptions([
                  '-map', '[final]',
                  '-s', '1080x1920',
                  '-aspect', '9:16',
                  '-c:v', 'libx264',
                  '-preset', 'medium',
                  '-crf', '23',
                  '-pix_fmt', 'yuv420p',
                  '-movflags', '+faststart'
                ])
                .output(fallbackClipPath)
                .on('start', (runCmd) => {
                  console.log(`[PROCESSING] Criando fallback 1080x1920 (layout completo): ${runCmd}`);
                })
                .on('end', () => {
                  if (!fs.existsSync(fallbackClipPath)) {
                    return reject(new Error('Arquivo fallback não foi criado'));
                  }
                  const stats = fs.statSync(fallbackClipPath);
                  if (stats.size === 0) {
                    return reject(new Error('Arquivo fallback está vazio'));
                  }
                  console.log(`[PROCESSING] ✅ Clip fallback criado: 1080x1920 (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
                  resolve(fallbackClipPath);
                })
                .on('error', (err) => {
                  const isTimeout = err.message && (err.message.includes('timeout') || err.message.includes('ETIMEDOUT') || err.message.includes('SIGKILL'));
                  if (isTimeout) {
                    console.error(`[PROCESSING] ❌ Timeout no fallback após ${FFMPEG_FALLBACK_TIMEOUT}s`);
                  }
                  console.error(`[PROCESSING] ❌ Erro ao criar fallback: ${err.message}`);
                  console.error(`[PROCESSING] ❌ Filter complex do fallback: ${filterComplex}`);
                  reject(err);
                })
                .run();
            });
            
            console.warn(`[PROCESSING] ⚠️ Usando clip fallback simplificado 1080x1920 para clip ${clipIndex}`);
            return fallbackClipPath;
          } catch (fallbackError) {
            console.error(`[PROCESSING] ❌ ERRO CRÍTICO: Falha no fallback: ${fallbackError.message}`);
            console.error(`[PROCESSING] ❌ ATENÇÃO: Clip ${clipIndex} pode não estar no formato 1080x1920!`);
            console.warn(`[PROCESSING] Usando clip original para clip ${clipIndex} (formato pode estar incorreto)`);
            // Retornar clip original como último recurso (mesmo que formato possa estar incorreto)
            return clipPath;
          }
        }
      }
      });
      
      // Aguardar todos os clipes do batch em paralelo
      const batchResults = await Promise.all(batchPromises);
      
      // Atualizar array finalClips com os resultados
      batchResults.forEach((resultPath, batchIndex) => {
        const clipIndex = batchStartIndex + batchIndex;
        if (resultPath) {
          finalClips[clipIndex] = resultPath;
        }
      });
      
      // Atualizar progresso após cada batch
      const batchProgress = Math.min(99, Math.round(compositionProgress + (compositionRange * ((i + COMPOSITION_BATCH_SIZE) / finalClips.length))));
      updateProgressEvent(job.id, {
        status: 'processing',
        totalClips: finalClips.length,
        currentClip: Math.min(i + COMPOSITION_BATCH_SIZE, finalClips.length),
        progress: batchProgress,
        message: `[PARALLEL] Batch concluído: ${batchResults.length} clipes compostos`
      });
      
      if (typeof job.progress === 'function') {
        await job.progress(batchProgress);
      } else {
        job.progress = batchProgress;
      }
      if (jobsMap) jobsMap.set(job.id, job);
      
      console.log(`[PROCESSING] ⚡ Batch ${Math.floor(i / COMPOSITION_BATCH_SIZE) + 1} concluído: ${batchResults.length} clipes compostos em paralelo`);
    }
    
    const compositionDuration = ((Date.now() - compositionStartTime) / 1000).toFixed(2);
    console.log(`[PROCESSING] ⚡ Composição paralela concluída em ${compositionDuration}s`);

    console.log(`[PROCESSING] ✅ Composição final concluída: ${finalClips.length} clips finais`);
    
    // Emitir evento: finalizando
    updateProgressEvent(job.id, {
      status: 'processing',
      totalClips: finalClips.length,
      currentClip: finalClips.length,
      progress: 99,
      message: 'Finalizando arquivos para download...'
    });

    // ===============================
    // FINALIZAR JOB
    // ===============================
    // Atualizar progresso usando função do BullMQ - GARANTIR 100%
    if (typeof job.progress === 'function') {
      await job.progress(100);
      console.log(`[PROCESSING] Progresso atualizado para 100% via função`);
    } else {
      job.progress = 100;
      console.log(`[PROCESSING] Progresso atualizado para 100% via atributo`);
    }
    
    // Garantir que o job está marcado como completed
    if (job.update) {
      try {
        await job.update({ status: 'completed' });
      } catch (e) {
        console.warn(`[PROCESSING] Não foi possível atualizar status do job:`, e.message);
      }
    }
    
    job.status = 'completed';
    job.completedAt = new Date();
    job.clips = finalClips;
    job.clipsCount = finalClips.length;

    if (jobsMap) jobsMap.set(job.id, job);
    
    // Emitir evento: concluído
    updateProgressEvent(job.id, {
      status: 'completed',
      totalClips: finalClips.length,
      currentClip: finalClips.length,
      progress: 100,
      message: 'Todos os clipes foram gerados com sucesso!',
      seriesId: seriesId
    });

    console.log(`[PROCESSING] ========================================`);
    console.log(`[PROCESSING] ✅ SÉRIE FINALIZADA COM SUCESSO`);
    console.log(`[PROCESSING] ========================================`);
    console.log(`[PROCESSING] SeriesId: ${seriesId}`);
    console.log(`[PROCESSING] ClipsCount: ${finalClips.length}`);
    console.log(`[PROCESSING] Clipes finais criados:`);
    
    // VALIDAR todos os clipes finais antes de retornar
    for (let i = 0; i < finalClips.length; i++) {
      const finalClip = finalClips[i];
      if (!fs.existsSync(finalClip)) {
        const error = `[PROCESSING_ERROR] Clip final ${i + 1} não existe: ${finalClip}`;
        console.error(error);
        throw new Error(error);
      }
      const stats = fs.statSync(finalClip);
      if (stats.size === 0) {
        const error = `[PROCESSING_ERROR] Clip final ${i + 1} está vazio: ${finalClip}`;
        console.error(error);
        throw new Error(error);
      }
      console.log(`[PROCESSING]   ${i + 1}. ${finalClip} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    }
    
    console.log(`[PROCESSING] ========================================`);

    const result = {
      seriesId,
      clips: finalClips,
      clipsCount: finalClips.length,
      status: 'completed',
      format,
      platforms,
      captionStyle,
      safeMargins
    };
    
    console.log(`[PROCESSING] Retornando resultado para BullMQ:`, JSON.stringify({ ...result, clips: `[${finalClips.length} clips]` }));
    console.log(`[PROCESSING] ========================================`);
    
    return result;

  } catch (error) {
    console.error('[PROCESSING_ERROR] ========================================');
    console.error('[PROCESSING_ERROR] ERRO FATAL NA GERAÇÃO DE SÉRIE');
    console.error('[PROCESSING_ERROR] ========================================');
    console.error('[PROCESSING_ERROR] Mensagem:', error.message);
    console.error('[PROCESSING_ERROR] Stack trace completo:', error.stack);
    console.error('[PROCESSING_ERROR] Job ID:', job.id);
    console.error('[PROCESSING_ERROR] Series ID:', jobData.seriesId);
    console.error('[PROCESSING_ERROR] Video ID:', jobData.videoId);
    console.error('[PROCESSING_ERROR] ========================================');
    
    // Log detalhes adicionais se disponíveis
    if (error.code) {
      console.error('[PROCESSING_ERROR] Código de erro:', error.code);
    }
    if (error.signal) {
      console.error('[PROCESSING_ERROR] Signal:', error.signal);
    }

    job.status = 'error';
    job.error = error.message;
    job.failedAt = new Date();

    if (jobsMap) jobsMap.set(job.id, job);
    
    // Emitir evento: erro
    updateProgressEvent(job.id, {
      status: 'error',
      totalClips: 0,
      currentClip: 0,
      progress: 0,
      message: `Erro na geração: ${error.message}`,
      error: error.message
    });
    
    // Criar erro detalhado para o BullMQ
    const detailedError = new Error(`Erro ao gerar série de vídeo: ${error.message}\n\n` +
                                   `Job ID: ${job.id}\n` +
                                   `Series ID: ${jobData.seriesId}\n` +
                                   `Video ID: ${jobData.videoId}\n` +
                                   `Stack trace: ${error.stack}`);
    detailedError.stack = error.stack;
    
    throw detailedError;
  }
};

// ===============================
// HELPER: Estilo de Legendas
// ===============================
function getCaptionStyleConfig(styleName, defaultFont) {
  const styles = {
    modern: {
      font: defaultFont || 'Inter',
      fontSize: 48,
      color: '#FFFFFF',
      strokeColor: '#000000',
      strokeWidth: 2
    },
    classic: {
      font: defaultFont || 'Arial',
      fontSize: 44,
      color: '#FFFFFF',
      strokeColor: '#000000',
      strokeWidth: 3
    },
    bold: {
      font: defaultFont || 'Inter',
      fontSize: 52,
      color: '#FFFFFF',
      strokeColor: '#000000',
      strokeWidth: 4
    },
    minimal: {
      font: defaultFont || 'Inter',
      fontSize: 40,
      color: '#FFFFFF',
      strokeColor: 'transparent',
      strokeWidth: 0
    }
  };
  
  return styles[styleName] || styles.modern;
}
