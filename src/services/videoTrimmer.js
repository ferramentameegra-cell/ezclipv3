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

    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .output(outputPath)
      .outputOptions([
        '-preset veryfast',
        '-movflags +faststart',
        '-pix_fmt yuv420p'
      ])
      .videoCodec('libx264')
      .audioCodec('aac')
      .on('start', cmd => {
        console.log('[FFMPEG] Trim iniciado');
      })
      .on('end', () => {
        if (!fs.existsSync(outputPath)) {
          return reject(new Error('Arquivo de saída não foi criado'));
        }

        const stats = fs.statSync(outputPath);
        if (stats.size === 0) {
          return reject(new Error('Arquivo de saída vazio'));
        }

        resolve(outputPath);
      })
      .on('error', err => {
        console.error('[FFMPEG] Erro no trim:', err.message);
        reject(err);
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

  for (let i = 0; i < numberOfClips; i++) {
    const clipStart = startTime + i * clipDuration;
    const clipEnd = clipStart + clipDuration;

    const clipPath = path.join(
      outputDir,
      `clip_${String(i + 1).padStart(3, '0')}.mp4`
    );

    await trimVideo(inputPath, clipPath, clipStart, clipEnd);
    clips.push(clipPath);

    console.log(`[CLIP] ${i + 1}/${numberOfClips} gerado`);
  }

  return clips;
}
