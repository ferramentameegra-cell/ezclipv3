import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { splitVideoIntoClips, trimVideo } from './videoTrimmer.js';
import { getVideoState, VIDEO_STATES } from './videoStateManager.js';
import { validateVideoWithFfprobe } from './videoValidator.js';
import { composeFinalVideo } from './videoComposer.js';

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
    // Atualizar progresso inicial (0% -> 1%)
    console.log('[PROCESSING] Iniciando geração de série...');
    if (typeof job.progress === 'function') {
      await job.progress(1);
    } else {
      job.progress = 1;
    }
    if (jobsMap) jobsMap.set(job.id, job);
    
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
    // Tentar obter videoPath do jobData primeiro, depois do video.path
    let sourceVideoPath = jobData.videoPath || video.path;

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

        // Atualizar progresso usando função do BullMQ
        if (typeof job.progress === 'function') {
          await job.progress(5);
        } else {
          job.progress = 5;
        }
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

        // Atualizar progresso usando função do BullMQ
        if (typeof job.progress === 'function') {
          await job.progress(20);
        } else {
          job.progress = 20;
        }
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
      // Atualizar progresso usando função do BullMQ
      if (typeof job.progress === 'function') {
        await job.progress(30);
      } else {
        job.progress = 30;
      }
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

      // Atualizar progresso usando função do BullMQ
      if (typeof job.progress === 'function') {
        await job.progress(50);
      } else {
        job.progress = 50;
      }
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
    
    const clips = await splitVideoIntoClips(
      processedVideoPath,
      seriesPath,
      finalCutDuration,
      actualStartTime,
      actualEndTime
    );
    
    // Limitar número de clipes se necessário
    const finalClips = clipsQuantity && clipsQuantity > 0 
      ? clips.slice(0, clipsQuantity)
      : clips;
    
    console.log(`[PROCESSING] Clipes gerados: ${finalClips.length} (solicitado: ${finalNumberOfCuts || 'automático'})`);

    // ===============================
    // APLICAR COMPOSIÇÃO FINAL EM CADA CLIP
    // ===============================
    console.log(`[PROCESSING] Aplicando composição final em ${finalClips.length} clips...`);

    // Obter legendas do vídeo (se houver)
    let captions = video.captions?.edited || video.captions?.raw || [];
    
    console.log(`[PROCESSING] Legendas encontradas no vídeo: ${captions.length} (edited: ${video.captions?.edited?.length || 0}, raw: ${video.captions?.raw?.length || 0})`);
    
    if (captions.length === 0) {
      console.warn(`[PROCESSING] ⚠️ Nenhuma legenda encontrada para o vídeo ${videoId}. O vídeo será gerado sem legendas.`);
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

    // Estilo da headline
    const headlineStyleObj = {
      font: font || 'Inter',
      fontSize: headlineSize || 72,
      color: headlineColor || '#FFFFFF',
      fontStyle: headlineStyle || 'bold'
    };

    // finalClips já foi declarado acima (linha 324)
    const compositionProgress = 60; // Começar em 60% (após split)
    const compositionRange = 40; // 40% para composição

    for (let i = 0; i < finalClips.length; i++) {
      const clipPath = finalClips[i];
      const clipIndex = i + 1;

      console.log(`[PROCESSING] Compondo clip ${clipIndex}/${finalClips.length}...`);

      // Criar caminho para clip final composto
      const finalClipPath = path.join(
        seriesPath,
        `clip_${String(clipIndex).padStart(3, '0')}_final.mp4`
      );

      try {
        // Filtrar legendas para este clip específico
        // IMPORTANTE: Usar overlap ao invés de "contém completamente"
        // Uma legenda deve aparecer se há qualquer overlap com o intervalo do clip
        const clipStartTime = i * finalCutDuration;
        const clipEndTime = (i + 1) * finalCutDuration;
        
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
        
        console.log(`[PROCESSING] Clip ${clipIndex}: ${clipCaptions.length} legendas no intervalo [${clipStartTime}s - ${clipEndTime}s]`);

        // Headline para este clip (se houver)
        // HEADLINE SEMPRE VISÍVEL: Do primeiro ao último frame (100% da duração)
        const clipHeadline = headlineText ? {
          text: headlineText,
          startTime: 0,
          endTime: finalCutDuration // Até o final do clip, não apenas 5 segundos
        } : null;

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
          retentionVideoId,
          nicheId,
          backgroundColor,
          format: '9:16', // FORÇAR formato vertical 9:16 (1080x1920)
          platforms: { tiktok: true, reels: true, shorts: true },
          safeMargins: 10,
          onProgress: async (percent) => {
            // Progresso individual do clip
            // Garantir que percent está entre 0 e 100
            const safePercent = Math.min(100, Math.max(0, percent));
            const clipProgress = compositionProgress + (compositionRange * (i / finalClips.length)) + (compositionRange * (safePercent / 100) / finalClips.length);
            const finalProgress = Math.min(100, Math.max(compositionProgress, Math.round(clipProgress)));
            // Atualizar progresso usando função do BullMQ
            if (typeof job.progress === 'function') {
              await job.progress(finalProgress);
            } else {
              job.progress = finalProgress;
            }
            if (jobsMap) jobsMap.set(job.id, job);
            console.log(`[PROCESSING] Progresso clip ${clipIndex}: ${safePercent}% -> Progresso geral: ${finalProgress}%`);
          }
        });

        // Substituir clip original pelo clip final no array
        finalClips[i] = finalClipPath;
        
        // Remover clip original (economizar espaço)
        if (fs.existsSync(clipPath) && clipPath !== finalClipPath) {
          try {
            fs.unlinkSync(clipPath);
          } catch (unlinkError) {
            console.warn(`[PROCESSING] Erro ao remover clip original: ${unlinkError.message}`);
          }
        }

        console.log(`[PROCESSING] ✅ Clip ${clipIndex}/${finalClips.length} composto com sucesso`);

      } catch (compositionError) {
        console.error(`[PROCESSING] Erro ao compor clip ${clipIndex}:`, compositionError);
        // Se composição falhar, manter clip original (já está em finalClips[i])
        console.warn(`[PROCESSING] Usando clip original para clip ${clipIndex} devido a erro na composição`);
      }

      // Atualizar progresso geral após cada clip
      const overallProgress = Math.min(99, Math.round(compositionProgress + (compositionRange * ((i + 1) / finalClips.length))));
      // Atualizar progresso usando função do BullMQ
      if (typeof job.progress === 'function') {
        await job.progress(overallProgress);
      } else {
        job.progress = overallProgress;
      }
      if (jobsMap) jobsMap.set(job.id, job);
      console.log(`[PROCESSING] Progresso geral após clip ${clipIndex}: ${overallProgress}%`);
    }

    console.log(`[PROCESSING] ✅ Composição final concluída: ${finalClips.length} clips finais`);

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

    console.log(`[PROCESSING] ✅ Série finalizada: ${finalClips.length} clips com layout final aplicado`);
    console.log(`[PROCESSING] SeriesId: ${seriesId}`);
    console.log(`[PROCESSING] ClipsCount: ${finalClips.length}`);

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
    
    console.log(`[PROCESSING] Retornando resultado:`, JSON.stringify({ ...result, clips: `[${finalClips.length} clips]` }));
    
    return result;

  } catch (error) {
    console.error('❌ Erro ao gerar série:', error);

    job.status = 'error';
    job.error = error.message;

    if (jobsMap) jobsMap.set(job.id, job);
    throw error;
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
