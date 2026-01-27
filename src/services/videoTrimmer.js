import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

/**
 * Aplica trim em um vídeo
 */
export async function trimVideo(inputPath, outputPath, startTime, endTime) {
  return new Promise((resolve, reject) => {
    // Validações iniciais
    if (!inputPath || !outputPath) {
      return reject(new Error('Caminhos de entrada e saída são obrigatórios'));
    }

    if (!fs.existsSync(inputPath)) {
      return reject(new Error(`Arquivo não encontrado: ${inputPath}`));
    }

    // Validar que o arquivo não está vazio
    try {
      const inputStats = fs.statSync(inputPath);
      if (inputStats.size === 0) {
        return reject(new Error(`Arquivo de entrada está vazio: ${inputPath}`));
      }
    } catch (statError) {
      return reject(new Error(`Erro ao verificar arquivo de entrada: ${statError.message}`));
    }

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Validar parâmetros de tempo
    if (isNaN(startTime) || isNaN(endTime)) {
      return reject(new Error(`Tempos inválidos: startTime=${startTime}, endTime=${endTime}`));
    }

    if (startTime < 0) {
      return reject(new Error(`startTime não pode ser negativo: ${startTime}`));
    }

    if (endTime <= startTime) {
      return reject(new Error(`endTime (${endTime}s) deve ser maior que startTime (${startTime}s)`));
    }

    const duration = endTime - startTime;
    if (duration <= 0 || isNaN(duration)) {
      return reject(new Error(`Duração inválida para trim: ${duration}s (startTime: ${startTime}s, endTime: ${endTime}s)`));
    }

    console.log(`[FFMPEG] Iniciando trim: ${inputPath} -> ${outputPath}`);
    console.log(`[FFMPEG] Intervalo: ${startTime}s - ${endTime}s (duração: ${duration.toFixed(2)}s)`);

    // Frame-accurate cutting para clips sequenciais
    // Usar -ss antes de -i para seeking preciso (mais rápido)
    // Usar -t para duração exata
    // IMPORTANTE: NÃO forçar formato aqui - vídeo principal mantém proporção original (16:9)
    // O formato 1080x1920 será forçado apenas na composição final
    const command = ffmpeg(inputPath)
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
        '-fflags', '+genpts', // Regenerar timestamps precisos
        '-y' // Sobrescrever arquivo de saída se existir
      ]);

    let hasResolved = false;

    command
      .on('start', cmd => {
        console.log('[FFMPEG] Trim iniciado (mantendo proporção original do vídeo)');
        console.log('[FFMPEG] Comando:', cmd);
        console.log('[FFMPEG] ✅ Vídeo principal manterá proporção original (16:9) - formato 1080x1920 será aplicado na composição');
      })
      .on('end', () => {
        if (hasResolved) return;
        hasResolved = true;

        // Aguardar um pouco para garantir que o arquivo foi escrito completamente
        setTimeout(() => {
          if (!fs.existsSync(outputPath)) {
            return reject(new Error('Arquivo de saída não foi criado'));
          }

          try {
            const stats = fs.statSync(outputPath);
            if (stats.size === 0) {
              return reject(new Error('Arquivo de saída vazio'));
            }

            // Validar resolução (apenas para log - não forçar formato aqui)
            ffmpeg.ffprobe(outputPath, (err, metadata) => {
              if (!err && metadata?.streams) {
                const videoStream = metadata.streams.find(s => s.codec_type === 'video');
                if (videoStream) {
                  const actualWidth = videoStream.width;
                  const actualHeight = videoStream.height;
                  console.log(`[FFMPEG] ✅ Trim concluído: ${actualWidth}x${actualHeight} (proporção original mantida)`);
                  console.log(`[FFMPEG] ✅ Formato 1080x1920 será aplicado na composição final`);
                }
              }
            });

            console.log(`[FFMPEG] ✅ Trim concluído: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
            resolve(outputPath);
          } catch (statError) {
            reject(new Error(`Erro ao verificar arquivo de saída: ${statError.message}`));
          }
        }, 500); // Aguardar 500ms para garantir escrita completa
      })
      .on('error', err => {
        if (hasResolved) return;
        hasResolved = true;

        console.error('[FFMPEG] Erro no trim:', err.message);
        console.error('[FFMPEG] Stack:', err.stack);
        
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
        
        reject(new Error(`Erro no FFmpeg: ${err.message}`));
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
  // Validações iniciais
  if (!inputPath) {
    throw new Error('inputPath é obrigatório');
  }

  if (!outputDir) {
    throw new Error('outputDir é obrigatório');
  }

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Arquivo não encontrado: ${inputPath}`);
  }

  // Validar que o arquivo não está vazio
  try {
    const inputStats = fs.statSync(inputPath);
    if (inputStats.size === 0) {
      throw new Error(`Arquivo de entrada está vazio: ${inputPath}`);
    }
  } catch (statError) {
    throw new Error(`Erro ao verificar arquivo de entrada: ${statError.message}`);
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

  if (startTime < 0) {
    throw new Error(`startTime não pode ser negativo: ${startTime}`);
  }

  if (endTime <= startTime) {
    throw new Error(`endTime (${endTime}s) deve ser maior que startTime (${startTime}s)`);
  }

  if (!clipDuration || isNaN(clipDuration) || clipDuration <= 0) {
    throw new Error(`clipDuration inválido: ${clipDuration}s`);
  }

  const totalDuration = endTime - startTime;
  
  if (isNaN(totalDuration) || !totalDuration || totalDuration <= 0) {
    throw new Error(`Duração total inválida para corte: startTime=${startTime}s, endTime=${endTime}s, duração=${totalDuration}s`);
  }

  if (clipDuration > totalDuration) {
    throw new Error(`clipDuration (${clipDuration}s) não pode ser maior que a duração total (${totalDuration}s)`);
  }

  const numberOfClips = Math.floor(totalDuration / clipDuration);
  if (numberOfClips <= 0) {
    throw new Error(`Tempo insuficiente para gerar clips. Duração total: ${totalDuration}s, Duração por clip: ${clipDuration}s`);
  }

  console.log(`[CLIP] Iniciando geração de ${numberOfClips} clipe(s)`);
  console.log(`[CLIP] Parâmetros: inputPath=${inputPath}, outputDir=${outputDir}`);
  console.log(`[CLIP] Intervalo: ${startTime}s - ${endTime}s (duração total: ${totalDuration.toFixed(2)}s)`);
  console.log(`[CLIP] Duração por clip: ${clipDuration.toFixed(2)}s`);

  const clips = [];

  // Sequencial frame-accurate: cada clip começa exatamente onde o anterior termina
  // Garante que não há gaps ou overlaps
  for (let i = 0; i < numberOfClips; i++) {
    const clipStart = startTime + (i * clipDuration);
    // Não usar clipEnd - usar apenas clipStart + clipDuration para garantir precisão
    const clipDurationExact = clipDuration;
    const clipEnd = clipStart + clipDurationExact;

    const clipPath = path.join(
      outputDir,
      `clip_${String(i + 1).padStart(3, '0')}.mp4`
    );

    console.log(`[CLIP] Gerando clip ${i + 1}/${numberOfClips}: ${clipStart.toFixed(2)}s - ${clipEnd.toFixed(2)}s`);

    try {
      await trimVideo(inputPath, clipPath, clipStart, clipEnd);
      
      // Validar que o clip foi criado corretamente
      if (!fs.existsSync(clipPath)) {
        throw new Error(`Clip ${i + 1} não foi criado: ${clipPath}`);
      }

      const clipStats = fs.statSync(clipPath);
      if (clipStats.size === 0) {
        throw new Error(`Clip ${i + 1} está vazio: ${clipPath}`);
      }

      clips.push(clipPath);
      console.log(`[CLIP] ✅ Clip ${i + 1}/${numberOfClips} concluído: ${(clipStats.size / 1024 / 1024).toFixed(2)} MB`);
    } catch (clipError) {
      console.error(`[CLIP] ❌ Erro ao gerar clip ${i + 1}/${numberOfClips}: ${clipError.message}`);
      throw new Error(`Falha ao gerar clip ${i + 1}/${numberOfClips}: ${clipError.message}`);
    }
  }

  console.log(`[CLIP] ✅ Todos os ${clips.length} clipe(s) gerados com sucesso!`);
  return clips;
}
