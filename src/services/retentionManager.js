/**
 * GERENCIADOR DE VÍDEOS DE RETENÇÃO POR NICHO
 * 
 * Sistema completo para gerenciar vídeos de retenção pré-definidos:
 * - Download automático do YouTube (sem áudio)
 * - Processamento em clipes de 60 segundos
 * - Cache inteligente (não re-baixa se já existe)
 * - Seleção aleatória de clipes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { retentionVideosByNiche, getRetentionVideosForNiche } from '../config/retention.config.js';
import { downloadYouTubeVideoNoAudio } from '../controllers/downloadProgressController.js';
import { splitVideoIntoClips } from './videoTrimmer.js';
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
 * Obter caminho do diretório de clipes
 * 
 * @param {string} niche - ID do nicho
 * @param {string} videoId - ID do vídeo
 * @returns {string} - Caminho do diretório de clipes
 */
function getClipsDir(niche, videoId) {
  return path.join(getVideoDir(niche, videoId), 'clips');
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
 * Processar vídeo completo em clipes de 60 segundos (SEM ÁUDIO)
 * 
 * @param {string} fullVideoPath - Caminho do vídeo completo
 * @param {string} clipsDir - Diretório de saída dos clipes
 * @returns {Promise<string[]>} - Array de caminhos dos clipes gerados
 */
async function processVideoIntoClips(fullVideoPath, clipsDir) {
  console.log(`[RETENTION-MANAGER] Processando vídeo em clipes: ${fullVideoPath}`);
  
  // Obter duração do vídeo
  const duration = await getVideoDuration(fullVideoPath);
  console.log(`[RETENTION-MANAGER] Duração do vídeo: ${duration.toFixed(2)}s`);
  
  // Criar diretório de clipes se não existir
  if (!fs.existsSync(clipsDir)) {
    fs.mkdirSync(clipsDir, { recursive: true });
    console.log(`[RETENTION-MANAGER] Diretório de clipes criado: ${clipsDir}`);
  }
  
  // Verificar se já existem clipes
  const existingClips = fs.readdirSync(clipsDir)
    .filter(file => file.endsWith('.mp4'))
    .map(file => path.join(clipsDir, file))
    .filter(filePath => {
      try {
        const stats = fs.statSync(filePath);
        return stats.size > 0;
      } catch {
        return false;
      }
    });
  
  if (existingClips.length > 0) {
    console.log(`[RETENTION-MANAGER] ✅ Clipes já existem: ${existingClips.length} clipes encontrados`);
    return existingClips;
  }
  
  // Gerar clipes usando splitVideoIntoClips
  // IMPORTANTE: splitVideoIntoClips gera clipes com áudio, então precisamos remover depois
  console.log(`[RETENTION-MANAGER] Gerando clipes de ${RETENTION_CLIP_DURATION}s...`);
  
  const clips = await splitVideoIntoClips(
    fullVideoPath,
    clipsDir,
    RETENTION_CLIP_DURATION,
    0,
    duration
  );
  
  // Remover áudio de todos os clipes gerados usando FFmpeg
  console.log(`[RETENTION-MANAGER] Removendo áudio de ${clips.length} clipes...`);
  const clipsWithoutAudio = [];
  
  for (const clipPath of clips) {
    const clipWithoutAudioPath = clipPath.replace('.mp4', '_no_audio.mp4');
    
    await new Promise((resolve, reject) => {
      ffmpeg(clipPath, { timeout: FFMPEG_TIMEOUT })
        .outputOptions([
          '-c:v', 'copy', // Copiar vídeo sem re-encoding (rápido)
          '-an', // Remover áudio
          '-y' // Sobrescrever se existir
        ])
        .output(clipWithoutAudioPath)
        .on('end', () => {
          // Remover clip original com áudio
          try {
            if (fs.existsSync(clipPath)) {
              fs.unlinkSync(clipPath);
            }
          } catch (unlinkError) {
            console.warn(`[RETENTION-MANAGER] ⚠️ Erro ao remover clip original: ${unlinkError.message}`);
          }
          
          // Renomear clip sem áudio para nome original
          try {
            if (fs.existsSync(clipWithoutAudioPath)) {
              fs.renameSync(clipWithoutAudioPath, clipPath);
              clipsWithoutAudio.push(clipPath);
              console.log(`[RETENTION-MANAGER] ✅ Áudio removido: ${path.basename(clipPath)}`);
            } else {
              console.warn(`[RETENTION-MANAGER] ⚠️ Clip sem áudio não foi criado, usando original`);
              clipsWithoutAudio.push(clipPath);
            }
            resolve();
          } catch (renameError) {
            console.error(`[RETENTION-MANAGER] ❌ Erro ao renomear clip: ${renameError.message}`);
            // Se falhar, usar clip original (com áudio) como fallback
            clipsWithoutAudio.push(clipPath);
            resolve();
          }
        })
        .on('error', (err) => {
          console.error(`[RETENTION-MANAGER] ❌ Erro ao remover áudio: ${err.message}`);
          // Se falhar, usar clip original (com áudio) como fallback
          clipsWithoutAudio.push(clipPath);
          resolve();
        })
        .run();
    });
  }
  
  console.log(`[RETENTION-MANAGER] ✅ ${clipsWithoutAudio.length} clipes processados (sem áudio)`);
  return clipsWithoutAudio;
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
 * Função principal: Obter clipe de retenção para um nicho
 * 
 * Esta é a única função exportada e o ponto de entrada do serviço.
 * 
 * @param {string} niche - ID do nicho (ex: 'podcast', 'tech')
 * @returns {Promise<string|null>} - Caminho absoluto de um clipe aleatório ou null se erro
 */
export async function getRetentionClip(niche, totalClips = null) {
  try {
    // Validar nicho
    if (!niche || typeof niche !== 'string') {
      console.warn(`[RETENTION-MANAGER] ⚠️ Nicho inválido: ${niche}, usando 'default'`);
      niche = 'default';
    }
    
    // Obter lista de vídeos para o nicho (ou default se não existir)
    const videos = getRetentionVideosForNiche(niche);
    
    if (!videos || videos.length === 0) {
      console.warn(`[RETENTION-MANAGER] ⚠️ Nenhum vídeo de retenção configurado para nicho: ${niche}`);
      return null;
    }
    
    // Selecionar vídeo aleatório
    const randomIndex = Math.floor(Math.random() * videos.length);
    const selectedVideo = videos[randomIndex];
    
    console.log(`[RETENTION-MANAGER] 📋 Nicho: ${niche}`);
    console.log(`[RETENTION-MANAGER] 📋 Vídeo selecionado: ${selectedVideo.id} (${randomIndex + 1}/${videos.length})`);
    console.log(`[RETENTION-MANAGER] 📋 URL: ${selectedVideo.url}`);
    
    const { id: videoId, url: youtubeUrl } = selectedVideo;
    
    // Estrutura de diretórios: /retention_library/{niche}/{videoId}/
    const videoDir = getVideoDir(niche, videoId);
    const fullVideoPath = getFullVideoPath(niche, videoId);
    const clipsDir = getClipsDir(niche, videoId);
    
    // 1. Verificar se vídeo completo já foi baixado
    let fullVideoExists = false;
    if (fs.existsSync(fullVideoPath)) {
      try {
        const stats = fs.statSync(fullVideoPath);
        if (stats.size > 0) {
          fullVideoExists = true;
          console.log(`[RETENTION-MANAGER] ✅ Vídeo completo já existe: ${fullVideoPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        }
      } catch (statError) {
        console.warn(`[RETENTION-MANAGER] ⚠️ Erro ao verificar vídeo completo: ${statError.message}`);
      }
    }
    
    // 2. Baixar vídeo se não existir
    if (!fullVideoExists) {
      console.log(`[RETENTION-MANAGER] 📥 Vídeo não encontrado, iniciando download...`);
      try {
        await downloadVideo(youtubeUrl, fullVideoPath);
        fullVideoExists = true;
      } catch (downloadError) {
        console.error(`[RETENTION-MANAGER] ❌ Erro ao baixar vídeo: ${downloadError.message}`);
        return null;
      }
    }
    
    // 3. Verificar se clipes já foram gerados
    let clipsExist = false;
    let existingClips = [];
    
    if (fs.existsSync(clipsDir)) {
      existingClips = fs.readdirSync(clipsDir)
        .filter(file => file.endsWith('.mp4'))
        .map(file => path.join(clipsDir, file))
        .filter(filePath => {
          try {
            const stats = fs.statSync(filePath);
            return stats.size > 0;
          } catch {
            return false;
          }
        });
      
      if (existingClips.length > 0) {
        clipsExist = true;
        console.log(`[RETENTION-MANAGER] ✅ Clipes já existem: ${existingClips.length} clipes encontrados`);
      }
    }
    
    // 4. Gerar clipes se não existirem
    let allClips = existingClips;
    if (!clipsExist && fullVideoExists) {
      try {
        // Se totalClips foi fornecido, sincronizar com o vídeo principal
        if (totalClips && totalClips > 0) {
          console.log(`[RETENTION-MANAGER] 🔄 Sincronizando: gerando ${totalClips} clipes (mesmo que vídeo principal)`);
          
          // Obter duração do vídeo de retenção
          const retentionDuration = await getVideoDuration(fullVideoPath);
          const clipDurationForRetention = retentionDuration / totalClips;
          
          console.log(`[RETENTION-MANAGER] Duração total: ${retentionDuration.toFixed(2)}s`);
          console.log(`[RETENTION-MANAGER] Duração por clipe: ${clipDurationForRetention.toFixed(2)}s`);
          
          // Cortar o vídeo de retenção em exatamente `totalClips` partes
          allClips = await splitVideoIntoClips(
            fullVideoPath,
            clipsDir,
            clipDurationForRetention,
            0,
            retentionDuration
          );
          
          console.log(`[RETENTION-MANAGER] ✅ Gerados ${allClips.length} clipes sincronizados`);
        } else {
          // Fallback: usar o comportamento original (60s por clipe)
          console.log(`[RETENTION-MANAGER] ⚠️ totalClips não fornecido, usando fallback (60s por clipe)`);
          allClips = await processVideoIntoClips(fullVideoPath, clipsDir);
        }
      } catch (processError) {
        console.error(`[RETENTION-MANAGER] ❌ Erro ao processar vídeo em clipes: ${processError.message}`);
        return null;
      }
    }
    
    // 5. Seleção final: escolher clipe aleatório
    if (!allClips || allClips.length === 0) {
      console.error(`[RETENTION-MANAGER] ❌ Nenhum clipe disponível para vídeo ${videoId}`);
      return null;
    }
    
    const randomClipIndex = Math.floor(Math.random() * allClips.length);
    const selectedClip = allClips[randomClipIndex];
    
    console.log(`[RETENTION-MANAGER] ✅ Clipe selecionado: ${path.basename(selectedClip)} (${randomClipIndex + 1}/${allClips.length})`);
    console.log(`[RETENTION-MANAGER] ✅ Caminho completo: ${selectedClip}`);
    
    return selectedClip;
    
  } catch (error) {
    console.error(`[RETENTION-MANAGER] ❌ Erro geral ao obter clipe de retenção: ${error.message}`);
    console.error(`[RETENTION-MANAGER] Stack: ${error.stack}`);
    return null;
  }
}
