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
    ffmpeg(inputPath)
      .seekInput(startTime) // Seeking antes do input é mais preciso
      .output(outputPath)
      .outputOptions([
        '-t', duration.toString(), // Duração exata
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
        console.log('[FFMPEG] Trim iniciado:', cmd);
      })
      .on('end', () => {
        if (!fs.existsSync(outputPath)) {
          return reject(new Error('Arquivo de saída não foi criado'));
        }

        const stats = fs.statSync(outputPath);
        if (stats.size === 0) {
          return reject(new Error('Arquivo de saída vazio'));
        }

        console.log(`[FFMPEG] Trim concluído: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        resolve(outputPath);
      })
      .on('error', err => {
        console.error('[FFMPEG] Erro no trim:', err.message);
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

  const totalDuration = endTime - startTime;
  if (!totalDuration || totalDuration <= 0) {
    throw new Error('Duração total inválida para corte');
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
