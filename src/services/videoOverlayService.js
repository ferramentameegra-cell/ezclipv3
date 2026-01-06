/**
 * VIDEO OVERLAY SERVICE
 * 
 * Adiciona overlay de vídeo de retenção ao clip
 * Mantém formato 9:16 (vertical) para redes sociais
 */

import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';

/**
 * Adiciona overlay de vídeo de retenção ao clip
 * 
 * @param {string} clipPath - Caminho do clip principal
 * @param {string} retentionVideoPath - Caminho do vídeo de retenção
 * @param {string} outputPath - Caminho de saída
 * @returns {Promise<string>} - Caminho do arquivo processado
 */
export async function addRetentionOverlay(clipPath, retentionVideoPath, outputPath) {
  if (!fs.existsSync(clipPath)) {
    throw new Error(`Clip não encontrado: ${clipPath}`);
  }

  if (!fs.existsSync(retentionVideoPath)) {
    throw new Error(`Vídeo de retenção não encontrado: ${retentionVideoPath}`);
  }

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    // Estratégia: Redimensionar ambos para 9:16 e sobrepor
    // Clip principal ocupa topo (80% altura)
    // Vídeo de retenção ocupa parte inferior (20% altura)
    
    // Resolução 9:16 típica: 1080x1920
    const width = 1080;
    const height = 1920;
    const mainHeight = Math.floor(height * 0.8); // 80% do topo
    const retentionHeight = Math.floor(height * 0.2); // 20% da parte inferior

    ffmpeg()
      // Input 1: Clip principal (redimensionado e posicionado no topo)
      .input(clipPath)
      .inputOptions([
        '-vf', `scale=${width}:${mainHeight}:force_original_aspect_ratio=decrease,pad=${width}:${mainHeight}:(ow-iw)/2:(oh-ih)/2`
      ])
      // Input 2: Vídeo de retenção (redimensionado e posicionado na parte inferior)
      .input(retentionVideoPath)
      .inputOptions([
        '-vf', `scale=${width}:${retentionHeight}:force_original_aspect_ratio=increase,crop=${width}:${retentionHeight}`
      ])
      // Filtros complexos para sobrepor
      .complexFilter([
        // Criar base preta
        {
          filter: 'color',
          options: {
            c: 'black',
            s: `${width}x${height}`
          },
          outputs: 'base'
        },
        // Sobrepor clip principal no topo
        {
          filter: 'overlay',
          options: {
            x: 0,
            y: 0
          },
          inputs: ['base', '[0:v]'],
          outputs: 'combined'
        },
        // Sobrepor vídeo de retenção na parte inferior
        {
          filter: 'overlay',
          options: {
            x: 0,
            y: mainHeight
          },
          inputs: ['combined', '[1:v]'],
          outputs: 'final'
        }
      ])
      .outputOptions([
        '-map', '[final]',
        '-map', '0:a?', // Áudio do clip principal (se existir)
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'veryfast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-shortest' // Terminar quando o vídeo mais curto terminar
      ])
      .output(outputPath)
      .on('start', (cmd) => {
        console.log(`[OVERLAY] Iniciando overlay: ${cmd}`);
      })
      .on('end', () => {
        if (!fs.existsSync(outputPath)) {
          return reject(new Error('Arquivo de saída não foi criado'));
        }

        const stats = fs.statSync(outputPath);
        if (stats.size === 0) {
          return reject(new Error('Arquivo de saída está vazio'));
        }

        console.log(`[OVERLAY] Overlay concluído: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error(`[OVERLAY] Erro: ${err.message}`);
        reject(err);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`[OVERLAY] Progresso: ${progress.percent.toFixed(1)}%`);
        }
      })
      .run();
  });
}

/**
 * Versão simplificada: overlay usando scale2ref (mais confiável)
 * Se a versão complexa falhar, use esta
 */
export async function addRetentionOverlaySimple(clipPath, retentionVideoPath, outputPath) {
  if (!fs.existsSync(clipPath)) {
    throw new Error(`Clip não encontrado: ${clipPath}`);
  }

  if (!fs.existsSync(retentionVideoPath)) {
    throw new Error(`Vídeo de retenção não encontrado: ${retentionVideoPath}`);
  }

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    // Redimensionar clip principal para 9:16 mantendo aspecto
    // Redimensionar vídeo de retenção para caber no bottom
    // Usar scale2ref para garantir que ambos tenham a mesma largura

    ffmpeg()
      .input(clipPath)
      .input(retentionVideoPath)
      .outputOptions([
        '-filter_complex', `[1:v]scale=1080:240[v1];[0:v]scale=1080:1680[v0];[v0][v1]vstack=inputs=2[v]`,
        '-map', '[v]',
        '-map', '0:a?',
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'veryfast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-shortest'
      ])
      .output(outputPath)
      .on('start', (cmd) => {
        console.log(`[OVERLAY-SIMPLE] Iniciando: ${cmd}`);
      })
      .on('end', () => {
        if (!fs.existsSync(outputPath)) {
          return reject(new Error('Arquivo de saída não foi criado'));
        }
        console.log(`[OVERLAY-SIMPLE] Concluído: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error(`[OVERLAY-SIMPLE] Erro: ${err.message}`);
        reject(err);
      })
      .run();
  });
}

