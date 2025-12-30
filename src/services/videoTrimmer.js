import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Aplica trim em um vídeo (corta do início ao fim especificado)
 * @param {string} inputPath - Caminho do vídeo original
 * @param {string} outputPath - Caminho onde salvar o vídeo cortado
 * @param {number} startTime - Tempo inicial em segundos
 * @param {number} endTime - Tempo final em segundos
 * @returns {Promise<string>} - Caminho do arquivo cortado
 */
export async function trimVideo(inputPath, outputPath, startTime, endTime) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputPath)) {
      return reject(new Error(`Arquivo de entrada não encontrado: ${inputPath}`));
    }

    // Garantir que o diretório de saída existe
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const duration = endTime - startTime;

    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .output(outputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-preset fast',
        '-crf 23',
        '-movflags +faststart'
      ])
      .on('start', (commandLine) => {
        console.log('FFmpeg iniciado:', commandLine);
      })
      .on('progress', (progress) => {
        console.log(`Trim progress: ${Math.round(progress.percent || 0)}%`);
      })
      .on('end', () => {
        if (fs.existsSync(outputPath)) {
          console.log(`Vídeo cortado salvo em: ${outputPath}`);
          resolve(outputPath);
        } else {
          reject(new Error('Arquivo de saída não foi criado'));
        }
      })
      .on('error', (error) => {
        console.error('Erro no FFmpeg:', error);
        reject(new Error(`Erro ao cortar vídeo: ${error.message}`));
      })
      .run();
  });
}

/**
 * Divide um vídeo em múltiplos clips sequenciais
 * @param {string} inputPath - Caminho do vídeo original (já pode estar cortado)
 * @param {string} outputDir - Diretório onde salvar os clips
 * @param {number} clipDuration - Duração de cada clip em segundos
 * @param {number} startTime - Tempo inicial em segundos (geralmente 0 se já cortado)
 * @param {number} endTime - Tempo final em segundos (duração total do vídeo)
 * @returns {Promise<Array<string>>} - Array com caminhos dos clips gerados
 */
export async function splitVideoIntoClips(inputPath, outputDir, clipDuration, startTime, endTime) {
  return new Promise(async (resolve, reject) => {
    if (!fs.existsSync(inputPath)) {
      return reject(new Error(`Arquivo de entrada não encontrado: ${inputPath}`));
    }

    // Garantir que o diretório de saída existe
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const clips = [];
    const totalDuration = endTime - startTime;
    const numberOfClips = Math.floor(totalDuration / clipDuration);
    
    if (numberOfClips === 0) {
      return reject(new Error('Duração do clip maior que o intervalo selecionado'));
    }

    // Processar clips sequencialmente para evitar sobrecarga de memória
    for (let i = 0; i < numberOfClips; i++) {
      const clipStartTime = startTime + (i * clipDuration);
      const clipEndTime = Math.min(clipStartTime + clipDuration, endTime);
      const clipPath = path.join(outputDir, `clip_${String(i + 1).padStart(3, '0')}.mp4`);

      try {
        await trimVideo(inputPath, clipPath, clipStartTime, clipEndTime);
        clips.push(clipPath);
        console.log(`Clip ${i + 1}/${numberOfClips} gerado: ${clipPath}`);
      } catch (error) {
        return reject(new Error(`Erro ao gerar clip ${i + 1}: ${error.message}`));
      }
    }

    resolve(clips);
  });
}

