import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

/**
 * Aplica trim em um vídeo
 */
export async function trimVideo(inputPath, outputPath, startTime, endTime) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputPath)) {
      return reject(new Error(`Arquivo não encontrado: ${inputPath}`));
    }

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const duration = endTime - startTime;
    if (duration <= 0) {
      return reject(new Error('Duração inválida para trim'));
    }

    // Frame-accurate cutting para clips sequenciais
    // Usar -ss antes de -i para seeking preciso (mais rápido)
    // Usar -t para duração exata
    // FORÇAR formato vertical 1080x1920 (9:16) OBRIGATORIAMENTE
    ffmpeg(inputPath)
      .seekInput(startTime) // Seeking antes do input é mais preciso
      .output(outputPath)
      .outputOptions([
        '-t', duration.toString(), // Duração exata
        '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920', // FORÇAR 1080x1920 vertical
        '-s', '1080x1920', // FORÇAR resolução 1080x1920
        '-aspect', '9:16', // FORÇAR aspect ratio 9:16 vertical
        '-c:v', 'libx264', // Forçar h264
        '-c:a', 'aac', // Forçar aac
        '-preset', 'veryfast', // Velocidade
        '-crf', '23', // Qualidade balanceada
        '-movflags', '+faststart', // Streaming otimizado
        '-pix_fmt', 'yuv420p', // Compatibilidade
        '-avoid_negative_ts', 'make_zero', // Evitar timestamps negativos
        '-fflags', '+genpts' // Regenerar timestamps precisos
      ])
      .on('start', cmd => {
        console.log('[FFMPEG] Trim iniciado (FORÇANDO 1080x1920 vertical):', cmd);
        console.log('[FFMPEG] ✅ Formato vertical 9:16 (1080x1920) OBRIGATÓRIO no trim');
      })
      .on('end', () => {
        if (!fs.existsSync(outputPath)) {
          return reject(new Error('Arquivo de saída não foi criado'));
        }

        const stats = fs.statSync(outputPath);
        if (stats.size === 0) {
          return reject(new Error('Arquivo de saída vazio'));
        }

        // VALIDAR que o formato é 1080x1920 (OBRIGATÓRIO)
        ffmpeg.ffprobe(outputPath, (err, metadata) => {
          if (!err && metadata?.streams) {
            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            if (videoStream) {
              const actualWidth = videoStream.width;
              const actualHeight = videoStream.height;
              if (actualWidth !== 1080 || actualHeight !== 1920) {
                console.error(`[FFMPEG] ❌ ERRO: Trim não resultou em 1080x1920! Obtido: ${actualWidth}x${actualHeight}`);
                console.error(`[FFMPEG] ❌ O vídeo NÃO está no formato vertical correto após trim!`);
              } else {
                console.log(`[FFMPEG] ✅ Validação: Trim resultou em 1080x1920 (formato vertical correto)`);
              }
            }
          }
        });

        console.log(`[FFMPEG] Trim concluído: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        console.log(`[FFMPEG] ✅ Formato vertical 1080x1920 FORÇADO no trim`);
        resolve(outputPath);
      })
      .on('error', err => {
        console.error('[FFMPEG] Erro no trim:', err.message);
        
        // Verificar se é erro de ffmpeg não encontrado
        if (err.message.includes('Cannot find ffmpeg') || 
            err.message.includes('ffmpeg not found') ||
            err.message.includes('ENOENT') ||
            err.message.includes('spawn ffmpeg')) {
          const errorMsg = 'ffmpeg não encontrado. Verifique se o ffmpeg está instalado corretamente e no PATH do sistema.\n' +
                          'Para instalar:\n' +
                          '  - macOS: brew install ffmpeg\n' +
                          '  - Linux: apt-get install ffmpeg (ou yum install ffmpeg)\n' +
                          '  - Windows: baixe de https://ffmpeg.org/download.html';
          console.error(`[FFMPEG] ${errorMsg}`);
          return reject(new Error(errorMsg));
        }
        
        reject(err);
      })
      .on('progress', (progress) => {
        // Log progresso para debugging
        if (progress.percent) {
          console.log(`[FFMPEG] Progresso trim: ${progress.percent.toFixed(1)}%`);
        }
      })
      .run();
  });
}

/**
 * Divide vídeo em clips sequenciais automaticamente
 * ⚠️ NÃO recebe mais numberOfClips
 */
export async function splitVideoIntoClips(
  inputPath,
  outputDir,
  clipDuration,
  startTime = 0,
  endTime = null
) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Arquivo não encontrado: ${inputPath}`);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Validar parâmetros
  if (endTime === null || endTime === undefined) {
    throw new Error(`endTime não pode ser null ou undefined. Recebido: ${endTime}`);
  }

  if (isNaN(startTime) || isNaN(endTime)) {
    throw new Error(`Valores inválidos: startTime=${startTime}, endTime=${endTime}`);
  }

  const totalDuration = endTime - startTime;
  
  if (isNaN(totalDuration) || !totalDuration || totalDuration <= 0) {
    throw new Error(`Duração total inválida para corte: startTime=${startTime}s, endTime=${endTime}s, duração=${totalDuration}s`);
  }

  const numberOfClips = Math.floor(totalDuration / clipDuration);
  if (numberOfClips <= 0) {
    throw new Error('Tempo insuficiente para gerar clips');
  }

  const clips = [];

  // Sequencial frame-accurate: cada clip começa exatamente onde o anterior termina
  // Garante que não há gaps ou overlaps
  for (let i = 0; i < numberOfClips; i++) {
    const clipStart = startTime + (i * clipDuration);
    // Não usar clipEnd - usar apenas clipStart + clipDuration para garantir precisão
    const clipDurationExact = clipDuration;

    const clipPath = path.join(
      outputDir,
      `clip_${String(i + 1).padStart(3, '0')}.mp4`
    );

    console.log(`[CLIP] Gerando clip ${i + 1}/${numberOfClips}: ${clipStart}s - ${clipStart + clipDurationExact}s`);

    await trimVideo(inputPath, clipPath, clipStart, clipStart + clipDurationExact);
    clips.push(clipPath);

    console.log(`[CLIP] Clip ${i + 1}/${numberOfClips} concluído`);
  }

  return clips;
}
