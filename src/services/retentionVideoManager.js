/**
 * GERENCIADOR DE VÍDEOS DE RETENÇÃO
 * Resolve caminhos de arquivos e gerencia a biblioteca de vídeos de retenção
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { RETENTION_VIDEOS, NICHES } from '../models/niches.js';
import { convertStreamableToDirectUrl, isStreamableUrl } from '../utils/streamableUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Diretório para armazenar vídeos de retenção
// Em produção: usar /tmp/retention-library/ (Railway)
// Em desenvolvimento: usar retention-library/ na raiz do projeto
const RETENTION_LIBRARY_DIR = process.env.RETENTION_LIBRARY_DIR || 
  (process.env.NODE_ENV === 'production' 
    ? '/tmp/retention-library' 
    : path.join(__dirname, '../../retention-library'));

// Garantir que o diretório existe
if (!fs.existsSync(RETENTION_LIBRARY_DIR)) {
  fs.mkdirSync(RETENTION_LIBRARY_DIR, { recursive: true });
  console.log(`[RETENTION] Diretório criado: ${RETENTION_LIBRARY_DIR}`);
}

/**
 * Obter caminho ou URL do vídeo de retenção a partir do ID
 * 
 * @param {string} retentionVideoId - ID do vídeo de retenção (ex: 'hydraulic-press')
 * @returns {string|null} - Caminho absoluto do arquivo, URL externa, ou null se não encontrado
 */
export function getRetentionVideoPath(retentionVideoId) {
  if (!retentionVideoId || retentionVideoId === 'random') {
    return null;
  }

  // Verificar se o vídeo existe no modelo
  const videoMeta = RETENTION_VIDEOS[retentionVideoId];
  if (!videoMeta) {
    console.warn(`[RETENTION] Vídeo de retenção não encontrado no modelo: ${retentionVideoId}`);
    return null;
  }

  // Sistema agora usa apenas links do YouTube - não buscar arquivos locais
  // Retornar null silenciosamente (sem logs)
  return null;
}

/**
 * Obter vídeo de retenção aleatório de uma lista de IDs
 * 
 * @param {string[]} retentionVideoIds - Array de IDs de vídeos de retenção
 * @returns {string|null} - Caminho do arquivo ou null se nenhum encontrado
 */
export function getRandomRetentionVideoPath(retentionVideoIds) {
  if (!retentionVideoIds || retentionVideoIds.length === 0) {
    return null;
  }

  // Filtrar apenas vídeos que existem
  const availableVideos = retentionVideoIds
    .map(id => ({ id, path: getRetentionVideoPath(id) }))
    .filter(v => v.path !== null);

  if (availableVideos.length === 0) {
    console.warn('[RETENTION] Nenhum vídeo de retenção disponível na lista fornecida');
    return null;
  }

  // Selecionar aleatoriamente
  const randomIndex = Math.floor(Math.random() * availableVideos.length);
  return availableVideos[randomIndex].path;
}

/**
 * Obter todos os vídeos de retenção disponíveis (com arquivos existentes)
 * Sistema agora usa apenas YouTube - retornar apenas vídeos que realmente existem (sem logs)
 * 
 * @returns {Array} - Array de objetos { id, name, path, exists }
 */
export function getAvailableRetentionVideos() {
  // Sistema agora usa apenas links do YouTube - não buscar arquivos locais
  // Retornar lista vazia para evitar logs desnecessários
  return [];
}

/**
 * Salvar vídeo de retenção (usado pelo upload)
 * 
 * @param {string} retentionVideoId - ID do vídeo de retenção
 * @param {string} sourceFilePath - Caminho do arquivo temporário enviado
 * @returns {Promise<string>} - Caminho final do arquivo salvo
 */
export async function saveRetentionVideo(retentionVideoId, sourceFilePath) {
  if (!retentionVideoId) {
    throw new Error('ID do vídeo de retenção não fornecido');
  }

  if (!fs.existsSync(sourceFilePath)) {
    throw new Error(`Arquivo fonte não encontrado: ${sourceFilePath}`);
  }

  // Verificar se o vídeo existe no modelo
  const videoMeta = RETENTION_VIDEOS[retentionVideoId];
  if (!videoMeta) {
    throw new Error(`Vídeo de retenção não encontrado no modelo: ${retentionVideoId}. Adicione-o primeiro em src/models/niches.js`);
  }

  // Nome do arquivo final (sempre .mp4 para consistência)
  const finalFileName = `${retentionVideoId}.mp4`;
  const finalPath = path.join(RETENTION_LIBRARY_DIR, finalFileName);

  // Copiar arquivo (ou mover se estiver no mesmo sistema de arquivos)
  fs.copyFileSync(sourceFilePath, finalPath);

  console.log(`[RETENTION] Vídeo salvo: ${retentionVideoId} -> ${finalPath}`);

  return finalPath;
}

/**
 * Obter diretório da biblioteca de retenção
 * 
 * @returns {string} - Caminho do diretório
 */
export function getRetentionLibraryDir() {
  return RETENTION_LIBRARY_DIR;
}

/**
 * Verificar se um vídeo de retenção existe
 * 
 * @param {string} retentionVideoId - ID do vídeo
 * @returns {boolean} - true se existe, false caso contrário
 */
export function retentionVideoExists(retentionVideoId) {
  const videoPath = getRetentionVideoPath(retentionVideoId);
  return videoPath !== null && fs.existsSync(videoPath);
}

/**
 * Obter vídeo de retenção do nicho (baixando do YouTube se necessário)
 * 
 * @param {string} nicheId - ID do nicho
 * @returns {Promise<string|null>} - Caminho do arquivo ou null se erro
 */
export async function getNicheRetentionVideo(nicheId) {
  try {
    const niche = NICHES[nicheId];
    
    if (!niche) {
      console.error(`[RETENTION] Nicho não encontrado: ${nicheId}`);
      return null;
    }
    
    // Verificar se nicho tem retentionYoutubeUrl
    if (!niche.retentionYoutubeUrl) {
      console.warn(`[RETENTION] Nicho ${nicheId} não tem retentionYoutubeUrl configurado`);
      return null;
    }
    
    // Extrair ID do vídeo do YouTube da URL
    const youtubeIdMatch = niche.retentionYoutubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    if (!youtubeIdMatch || !youtubeIdMatch[1]) {
      console.error(`[RETENTION] URL do YouTube inválida para nicho ${nicheId}: ${niche.retentionYoutubeUrl}`);
      return null;
    }
    
    const youtubeVideoId = youtubeIdMatch[1];
    const retentionVideoId = `niche-${nicheId}`;
    const retentionFilePath = path.join(RETENTION_LIBRARY_DIR, `${retentionVideoId}.mp4`);
    
    // Se arquivo já existe, retornar
    if (fs.existsSync(retentionFilePath)) {
      const stats = fs.statSync(retentionFilePath);
      if (stats.size > 0) {
        console.log(`[RETENTION] ✅ Vídeo de retenção já existe para nicho ${nicheId}: ${retentionFilePath}`);
        return retentionFilePath;
      }
    }
    
    // Baixar vídeo do YouTube SEM ÁUDIO
    console.log(`[RETENTION] 📥 Baixando vídeo de retenção do YouTube para nicho ${nicheId}...`);
    console.log(`[RETENTION] URL: ${niche.retentionYoutubeUrl}`);
    console.log(`[RETENTION] YouTube ID: ${youtubeVideoId}`);
    console.log(`[RETENTION] Caminho de saída: ${retentionFilePath}`);
    
    try {
      await downloadRetentionVideoFromYouTube(niche.retentionYoutubeUrl, retentionFilePath);
      
      // Verificar se download foi bem-sucedido
      if (fs.existsSync(retentionFilePath)) {
        const stats = fs.statSync(retentionFilePath);
        if (stats.size > 0) {
          console.log(`[RETENTION] ✅ Vídeo de retenção baixado com sucesso: ${retentionFilePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
          return retentionFilePath;
        } else {
          console.error(`[RETENTION] ❌ Arquivo baixado está vazio`);
          return null;
        }
      } else {
        console.error(`[RETENTION] ❌ Arquivo não foi criado após download`);
        return null;
      }
    } catch (downloadError) {
      console.error(`[RETENTION] ❌ Erro ao baixar vídeo de retenção: ${downloadError.message}`);
      return null;
    }
  } catch (error) {
    console.error(`[RETENTION] ❌ Erro ao obter vídeo de retenção do nicho ${nicheId}: ${error.message}`);
    return null;
  }
}

/**
 * Obter URL do YouTube do vídeo de retenção do nicho
 * 
 * @param {string} nicheId - ID do nicho
 * @returns {string|null} - URL do YouTube ou null
 */
export function getNicheRetentionYoutubeUrl(nicheId) {
  const niche = NICHES[nicheId];
  return niche?.retentionYoutubeUrl || null;
}

/**
 * Download de vídeo do YouTube SEM ÁUDIO (apenas vídeo)
 * Usado especificamente para vídeos de retenção
 * USA A MESMA LÓGICA DO VÍDEO PRINCIPAL
 * 
 * @param {string} youtubeUrl - URL do YouTube
 * @param {string} outputPath - Caminho de saída
 * @returns {Promise<string>} - Caminho do arquivo baixado
 */
async function downloadRetentionVideoFromYouTube(youtubeUrl, outputPath) {
  try {
    console.log(`[RETENTION-DOWNLOAD] Iniciando download usando mesma lógica do vídeo principal: ${youtubeUrl}`);
    
    // Criar diretório se não existir
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Importar função de download do vídeo principal
    const { downloadYouTubeVideoNoAudio } = await import('../controllers/downloadProgressController.js');
    
    // Usar a mesma função de download do vídeo principal
    await downloadYouTubeVideoNoAudio(youtubeUrl, outputPath);
    
    // Verificar se arquivo foi criado
    if (!fs.existsSync(outputPath)) {
      throw new Error('Arquivo não foi criado após download');
    }
    
    const stats = fs.statSync(outputPath);
    if (stats.size === 0) {
      throw new Error('Arquivo baixado está vazio');
    }
    
    console.log(`[RETENTION-DOWNLOAD] ✅ Download concluído: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    return outputPath;
  } catch (error) {
    console.error(`[RETENTION-DOWNLOAD] ❌ Erro ao baixar vídeo de retenção: ${error.message}`);
    throw error;
  }
}
