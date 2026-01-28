/**
 * GERENCIADOR DE VÍDEOS DE RETENÇÃO POR NICHO
 *
 * Sistema completo para gerenciar vídeos de retenção pré-definidos:
 * - Download automático do YouTube (sem áudio)
 * - Geração de exatamente numClips clipes de 60s (aleatórios do vídeo de retenção)
 * - Cache inteligente (não re-baixa se já existe)
 * - Não processa o vídeo inteiro em clipes (evita lentidão)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRetentionVideosForNiche } from '../config/retention.config.js';
import { downloadYouTubeVideoNoAudio } from '../controllers/downloadProgressController.js';
import ffmpeg from 'fluent-ffmpeg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { STORAGE_CONFIG } from '../config/storage.config.js';

// Diretório base para armazenar vídeos de retenção
const RETENTION_LIBRARY_BASE = STORAGE_CONFIG.RETENTION_DIR;

// Duração padrão dos clipes de retenção (60 segundos)
const RETENTION_CLIP_DURATION = 60;

// Timeout para operações FFmpeg (5 minutos)
const FFMPEG_TIMEOUT = 300;

/**
 * Obter caminho do diretório para um nicho específico
 * 
 * @param {string} niche - ID do nicho
 * @returns {string} - Caminho do diretório
 */
function getNicheDir(niche) {
  return path.join(RETENTION_LIBRARY_BASE, niche);
}

/**
 * Obter caminho do diretório para um vídeo específico
 * 
 * @param {string} niche - ID do nicho
 * @param {string} videoId - ID do vídeo
 * @returns {string} - Caminho do diretório do vídeo
 */
function getVideoDir(niche, videoId) {
  return path.join(getNicheDir(niche), videoId);
}

/**
 * Obter caminho do vídeo completo baixado
 * 
 * @param {string} niche - ID do nicho
 * @param {string} videoId - ID do vídeo
 * @returns {string} - Caminho do arquivo de vídeo completo
 */
function getFullVideoPath(niche, videoId) {
  return path.join(getVideoDir(niche, videoId), 'full_video.mp4');
}

/**
 * Obter duração do vídeo usando ffprobe
 * 
 * @param {string} videoPath - Caminho do vídeo
 * @returns {Promise<number>} - Duração em segundos
 */
async function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        return reject(new Error(`Erro ao obter duração: ${err.message}`));
      }
      
      const duration = metadata?.format?.duration || 0;
      if (duration <= 0) {
        return reject(new Error('Duração do vídeo inválida ou zero'));
      }
      
      resolve(duration);
    });
  });
}

/**
 * Cortar um clipe aleatório de duração fixa do vídeo de retenção (SEM ÁUDIO)
 *
 * @param {string} videoPath - Caminho do vídeo de retenção
 * @param {number} durationSec - Duração do clipe em segundos (ex: 60)
 * @param {string} outputPath - Caminho de saída do clipe
 * @returns {Promise<string>} - Caminho do clipe gerado
 */
async function cutRandomClip(videoPath, durationSec, outputPath) {
  const duration = await getVideoDuration(videoPath);
  const maxStart = Math.max(0, duration - durationSec);
  const start = maxStart <= 0 ? 0 : Math.random() * maxStart;

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath, { timeout: FFMPEG_TIMEOUT })
      .seekInput(start)
      .output(outputPath)
      .outputOptions([
        '-t', String(durationSec),
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-an',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-y'
      ])
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(new Error(`cutRandomClip: ${err.message}`)))
      .run();
  });
}

/**
 * Baixar vídeo do YouTube SEM ÁUDIO
 * 
 * @param {string} youtubeUrl - URL do YouTube
 * @param {string} outputPath - Caminho de saída
 * @returns {Promise<string>} - Caminho do arquivo baixado
 */
async function downloadVideo(youtubeUrl, outputPath) {
  console.log(`[RETENTION-MANAGER] 📥 Baixando vídeo do YouTube: ${youtubeUrl}`);
  console.log(`[RETENTION-MANAGER] Saída: ${outputPath}`);
  
  // Criar diretório se não existir
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Baixar usando função existente (já remove áudio)
  await downloadYouTubeVideoNoAudio(youtubeUrl, outputPath);
  
  // Validar arquivo baixado
  if (!fs.existsSync(outputPath)) {
    throw new Error('Arquivo não foi criado após download');
  }
  
  const stats = fs.statSync(outputPath);
  if (stats.size === 0) {
    throw new Error('Arquivo baixado está vazio');
  }
  
  console.log(`[RETENTION-MANAGER] ✅ Download concluído: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  return outputPath;
}

/**
 * Garantir que o vídeo de retenção do nicho exista (baixar se necessário).
 *
 * @param {string} niche - ID do nicho
 * @returns {Promise<{ fullVideoPath: string }|null>} - Caminho do vídeo completo ou null
 */
async function ensureFullRetentionVideo(niche) {
  const videos = getRetentionVideosForNiche(niche);
  if (!videos || videos.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * videos.length);
  const { id: videoId, url: youtubeUrl } = videos[randomIndex];
  const fullVideoPath = getFullVideoPath(niche, videoId);

  let exists = false;
  if (fs.existsSync(fullVideoPath)) {
    try {
      if (fs.statSync(fullVideoPath).size > 0) exists = true;
    } catch (_) {}
  }
  if (!exists) {
    try {
      await downloadVideo(youtubeUrl, fullVideoPath);
    } catch (e) {
      console.error(`[RETENTION-MANAGER] ❌ Erro ao baixar vídeo: ${e.message}`);
      return null;
    }
  }
  return { fullVideoPath };
}

/**
 * Gerar exatamente numClips clipes de retenção (60s cada), aleatórios do vídeo de retenção.
 * Não processa o vídeo inteiro — apenas cortes sob demanda (rápido).
 *
 * @param {string} nicheId - ID do nicho (ex: 'podcast', 'default')
 * @param {number} numClips - Número de clipes a gerar (igual ao de clipes principais)
 * @param {string} outputDir - Diretório de saída (ex: seriesPath/retention-clips)
 * @returns {Promise<string[]>} - Array de caminhos dos clipes gerados
 */
export async function getRetentionClips(nicheId, numClips, outputDir) {
  try {
    const niche = !nicheId || typeof nicheId !== 'string' ? 'default' : nicheId.replace(/^niche-/, '');
    if (numClips == null || numClips < 1) {
      console.warn('[RETENTION-MANAGER] ⚠️ numClips inválido, usando 1');
      numClips = 1;
    }

    const meta = await ensureFullRetentionVideo(niche);
    if (!meta) return [];

    const { fullVideoPath } = meta;
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const retentionClips = [];
    for (let i = 0; i < numClips; i++) {
      const outPath = path.join(outputDir, `retention_clip_${String(i + 1).padStart(3, '0')}.mp4`);
      try {
        await cutRandomClip(fullVideoPath, RETENTION_CLIP_DURATION, outPath);
        if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
          retentionClips.push(outPath);
          console.log(`[RETENTION-MANAGER] ✅ Clipe de retenção ${i + 1}/${numClips}: ${path.basename(outPath)}`);
        }
      } catch (e) {
        console.error(`[RETENTION-MANAGER] ❌ Erro ao gerar clipe ${i + 1}/${numClips}: ${e.message}`);
      }
    }

    console.log(`[RETENTION-MANAGER] ✅ ${retentionClips.length}/${numClips} clipes de retenção gerados`);
    return retentionClips;
  } catch (error) {
    console.error(`[RETENTION-MANAGER] ❌ Erro em getRetentionClips: ${error.message}`);
    return [];
  }
}

/**
 * Obter um único clipe de retenção (compatibilidade).
 * Usa getRetentionClips(nicheId, 1) em diretório temporário.
 *
 * @param {string} niche - ID do nicho
 * @returns {Promise<string|null>} - Caminho de um clipe aleatório de 60s ou null
 */
export async function getRetentionClip(niche) {
  const base = path.join(RETENTION_LIBRARY_BASE, '_temp');
  const dir = path.join(base, (niche || 'default').replace(/^niche-/, ''));
  const clips = await getRetentionClips(niche, 1, dir);
  return clips.length ? clips[0] : null;
}
