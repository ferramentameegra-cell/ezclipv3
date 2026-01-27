import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

/** Timeout em segundos para operações de trim (evitar travamento indefinido) */
const FFMPEG_TRIM_TIMEOUT = parseInt(process.env.FFMPEG_TRIM_TIMEOUT || '300', 10);

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
    const command = ffmpeg(inputPath, { timeout: FFMPEG_TRIM_TIMEOUT })
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
    let ffmpegStderr = '';
    let ffmpegStdout = '';

    command
      .on('start', cmd => {
        console.log('[FFMPEG_COMMAND] Trim iniciado (mantendo proporção original do vídeo)');
        console.log('[FFMPEG_COMMAND] Comando completo:', cmd);
        console.log('[FFMPEG_COMMAND] Input:', inputPath);
        console.log('[FFMPEG_COMMAND] Output:', outputPath);
        console.log('[FFMPEG_COMMAND] Intervalo:', `${startTime}s - ${endTime}s (duração: ${duration.toFixed(2)}s)`);
        console.log('[FFMPEG] ✅ Vídeo principal manterá proporção original (16:9) - formato 1080x1920 será aplicado na composição');
      })
      .on('stderr', (stderrLine) => {
        // Capturar stderr do FFmpeg (contém warnings e erros)
        ffmpegStderr += stderrLine + '\n';
        // Log warnings importantes
        if (stderrLine.includes('error') || stderrLine.includes('Error') || stderrLine.includes('ERROR')) {
          console.error('[FFMPEG_ERROR] stderr:', stderrLine);
        }
      })
      .on('stdout', (stdoutLine) => {
        // Capturar stdout do FFmpeg
        ffmpegStdout += stdoutLine + '\n';
      })
      .on('end', () => {
        if (hasResolved) return;
        hasResolved = true;

        console.log('[FFMPEG] Comando FFmpeg finalizado (end event)');
        
        // Aguardar um pouco para garantir que o arquivo foi escrito completamente
        setTimeout(() => {
          // VALIDAR arquivo de saída ANTES de continuar
          if (!fs.existsSync(outputPath)) {
            console.error('[FFMPEG_ERROR] Arquivo de saída não foi criado:', outputPath);
            console.error('[FFMPEG_ERROR] FFmpeg stderr completo:', ffmpegStderr);
            console.error('[FFMPEG_ERROR] FFmpeg stdout completo:', ffmpegStdout);
            return reject(new Error(`Arquivo de saída não foi criado: ${outputPath}. FFmpeg stderr: ${ffmpegStderr.slice(-500)}`));
          }

          try {
            const stats = fs.statSync(outputPath);
            if (stats.size === 0) {
              console.error('[FFMPEG_ERROR] Arquivo de saída está vazio:', outputPath);
              console.error('[FFMPEG_ERROR] FFmpeg stderr completo:', ffmpegStderr);
              return reject(new Error(`Arquivo de saída está vazio: ${outputPath}. FFmpeg stderr: ${ffmpegStderr.slice(-500)}`));
            }

            console.log(`[FFMPEG] ✅ Arquivo de saída validado: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

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
              } else if (err) {
                console.warn('[FFMPEG] ⚠️ Erro ao validar resolução do vídeo trimado:', err.message);
              }
            });

            console.log(`[FFMPEG] ✅ Trim concluído com sucesso: ${outputPath}`);
            resolve(outputPath);
          } catch (statError) {
            console.error('[FFMPEG_ERROR] Erro ao verificar arquivo de saída:', statError.message);
            console.error('[FFMPEG_ERROR] Stack:', statError.stack);
            reject(new Error(`Erro ao verificar arquivo de saída: ${statError.message}. FFmpeg stderr: ${ffmpegStderr.slice(-500)}`));
          }
        }, 500); // Aguardar 500ms para garantir escrita completa
      })
      .on('error', (err, stdout, stderr) => {
        if (hasResolved) return;
        hasResolved = true;

        const isTimeout = err.message && (err.message.includes('timeout') || err.message.includes('ETIMEDOUT') || err.message.includes('SIGKILL'));
        if (isTimeout) {
          console.error(`[FFMPEG_ERROR] TIMEOUT no trim após ${FFMPEG_TRIM_TIMEOUT}s. Aumente FFMPEG_TRIM_TIMEOUT ou verifique o vídeo.`);
        }

        console.error('[FFMPEG_ERROR] ========================================');
        console.error('[FFMPEG_ERROR] ERRO CRÍTICO NO FFMPEG TRIM');
        console.error('[FFMPEG_ERROR] ========================================');
        console.error('[FFMPEG_ERROR] Mensagem:', err.message);
        console.error('[FFMPEG_ERROR] Código:', err.code);
        console.error('[FFMPEG_ERROR] Signal:', err.signal);
        console.error('[FFMPEG_ERROR] Stack:', err.stack);
        console.error('[FFMPEG_ERROR] Input path:', inputPath);
        console.error('[FFMPEG_ERROR] Output path:', outputPath);
        console.error('[FFMPEG_ERROR] Intervalo:', `${startTime}s - ${endTime}s`);
        
        // Capturar stderr completo
        const fullStderr = stderr || ffmpegStderr || '';
        const fullStdout = stdout || ffmpegStdout || '';
        
        console.error('[FFMPEG_ERROR] ========================================');
        console.error('[FFMPEG_ERROR] FFMPEG STDERR COMPLETO:');
        console.error('[FFMPEG_ERROR] ========================================');
        console.error(fullStderr);
        console.error('[FFMPEG_ERROR] ========================================');
        
        if (fullStdout) {
          console.error('[FFMPEG_ERROR] FFMPEG STDOUT:');
          console.error(fullStdout);
        }
        
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
          console.error(`[FFMPEG_ERROR] ${errorMsg}`);
          return reject(new Error(`${errorMsg}\n\nFFmpeg stderr: ${fullStderr.slice(-500)}`));
        }
        
        // Criar mensagem de erro detalhada
        const detailedError = `Erro no FFmpeg durante trim: ${err.message}\n\n` +
                             `Input: ${inputPath}\n` +
                             `Output: ${outputPath}\n` +
                             `Intervalo: ${startTime}s - ${endTime}s\n` +
                             `FFmpeg stderr (últimos 1000 chars):\n${fullStderr.slice(-1000)}`;
        
        reject(new Error(detailedError));
      })
      .on('progress', (progress) => {
        // Log progresso para debugging
        if (progress.percent) {
          console.log(`[FFMPEG] Progresso trim: ${progress.percent.toFixed(1)}%`);
        }
        if (progress.timemark) {
          console.log(`[FFMPEG] Timemark: ${progress.timemark}`);
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
  endTime = null,
  progressCallback = null // Callback para atualizar progresso no frontend
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

  console.log(`[CLIP] ========================================`);
  console.log(`[CLIP] INICIANDO GERAÇÃO DE CLIPES`);
  console.log(`[CLIP] ========================================`);
  console.log(`[CLIP] Input: ${inputPath}`);
  console.log(`[CLIP] Output dir: ${outputDir}`);
  console.log(`[CLIP] Intervalo: ${startTime}s - ${endTime}s (duração total: ${totalDuration.toFixed(2)}s)`);
  console.log(`[CLIP] Duração por clip: ${clipDuration.toFixed(2)}s`);
  console.log(`[CLIP] Número de clipes a gerar: ${numberOfClips}`);
  
  // VALIDAR arquivo de entrada ANTES de começar
  if (!fs.existsSync(inputPath)) {
    const error = `[CLIP_ERROR] Arquivo de entrada não existe: ${inputPath}`;
    console.error(error);
    throw new Error(error);
  }
  
  const inputStats = fs.statSync(inputPath);
  if (inputStats.size === 0) {
    const error = `[CLIP_ERROR] Arquivo de entrada está vazio: ${inputPath}`;
    console.error(error);
    throw new Error(error);
  }
  
  console.log(`[CLIP] ✅ Arquivo de entrada validado: ${(inputStats.size / 1024 / 1024).toFixed(2)} MB`);
  
  // VALIDAR diretório de saída
  if (!fs.existsSync(outputDir)) {
    console.log(`[CLIP] Criando diretório de saída: ${outputDir}`);
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Verificar permissões de escrita
  try {
    const testFile = path.join(outputDir, '.write_test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log(`[CLIP] ✅ Permissões de escrita validadas no diretório: ${outputDir}`);
  } catch (writeError) {
    const error = `[CLIP_ERROR] Sem permissão de escrita no diretório: ${outputDir}. Erro: ${writeError.message}`;
    console.error(error);
    throw new Error(error);
  }

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

    console.log(`[CLIP] ========================================`);
    console.log(`[CLIP] Gerando clip ${i + 1}/${numberOfClips}`);
    console.log(`[CLIP] Intervalo: ${clipStart.toFixed(2)}s - ${clipEnd.toFixed(2)}s`);
    console.log(`[CLIP] Output path: ${clipPath}`);

    // Atualizar progresso no frontend antes de gerar o clip
    if (progressCallback) {
      progressCallback({
        currentClip: i + 1,
        totalClips: numberOfClips,
        message: `Gerando clip ${i + 1} de ${numberOfClips} com FFmpeg...`
      });
    }

    try {
      // VALIDAR arquivo de entrada novamente antes de cada clip (pode ter sido deletado)
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Arquivo de entrada foi removido durante processamento: ${inputPath}`);
      }
      
      console.log(`[CLIP] Chamando trimVideo para clip ${i + 1}...`);
      await trimVideo(inputPath, clipPath, clipStart, clipEnd);
      
      // VALIDAR que o clip foi criado corretamente
      if (!fs.existsSync(clipPath)) {
        const error = `[CLIP_ERROR] Clip ${i + 1} não foi criado: ${clipPath}`;
        console.error(error);
        throw new Error(error);
      }

      const clipStats = fs.statSync(clipPath);
      if (clipStats.size === 0) {
        const error = `[CLIP_ERROR] Clip ${i + 1} está vazio: ${clipPath}`;
        console.error(error);
        // Tentar remover arquivo vazio
        try {
          fs.unlinkSync(clipPath);
        } catch (unlinkError) {
          console.warn(`[CLIP] Erro ao remover clip vazio: ${unlinkError.message}`);
        }
        throw new Error(error);
      }

      clips.push(clipPath);
      console.log(`[CLIP] ✅ Clip ${i + 1}/${numberOfClips} concluído: ${(clipStats.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`[CLIP] ✅ Clip validado e adicionado ao array (total: ${clips.length})`);
      
      // Atualizar progresso no frontend após clip gerado
      if (progressCallback) {
        progressCallback({
          currentClip: i + 1,
          totalClips: numberOfClips,
          message: `Clip ${i + 1} de ${numberOfClips} gerado com sucesso!`
        });
      }
    } catch (clipError) {
      console.error(`[CLIP_ERROR] ========================================`);
      console.error(`[CLIP_ERROR] ERRO ao gerar clip ${i + 1}/${numberOfClips}`);
      console.error(`[CLIP_ERROR] ========================================`);
      console.error(`[CLIP_ERROR] Mensagem: ${clipError.message}`);
      console.error(`[CLIP_ERROR] Stack: ${clipError.stack}`);
      console.error(`[CLIP_ERROR] Input: ${inputPath}`);
      console.error(`[CLIP_ERROR] Output: ${clipPath}`);
      console.error(`[CLIP_ERROR] Intervalo: ${clipStart.toFixed(2)}s - ${clipEnd.toFixed(2)}s`);
      console.error(`[CLIP_ERROR] ========================================`);
      
      // Criar erro detalhado
      const detailedError = new Error(`Falha ao gerar clip ${i + 1}/${numberOfClips}: ${clipError.message}\n` +
                                     `Input: ${inputPath}\n` +
                                     `Output: ${clipPath}\n` +
                                     `Intervalo: ${clipStart.toFixed(2)}s - ${clipEnd.toFixed(2)}s`);
      detailedError.stack = clipError.stack;
      throw detailedError;
    }
  }

  console.log(`[CLIP] ========================================`);
  console.log(`[CLIP] ✅ GERAÇÃO DE CLIPES CONCLUÍDA`);
  console.log(`[CLIP] ========================================`);
  console.log(`[CLIP] Total de clipes gerados: ${clips.length}`);
  console.log(`[CLIP] Clipes criados:`);
  clips.forEach((clip, index) => {
    const stats = fs.statSync(clip);
    console.log(`[CLIP]   ${index + 1}. ${clip} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  });
  console.log(`[CLIP] ========================================`);
  
  // VALIDAÇÃO FINAL: garantir que pelo menos um clip foi gerado
  if (clips.length === 0) {
    const error = `[CLIP_ERROR] Nenhum clip foi gerado! Esperado: ${numberOfClips} clipes`;
    console.error(error);
    throw new Error(error);
  }
  
  if (clips.length !== numberOfClips) {
    console.warn(`[CLIP] ⚠️ Aviso: Esperado ${numberOfClips} clipes, mas apenas ${clips.length} foram gerados`);
  }
  
  return clips;
}
