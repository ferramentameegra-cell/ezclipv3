/**
 * GERENCIADOR DE VÍDEOS DE RETENÇÃO
 * Resolve caminhos de arquivos e gerencia a biblioteca de vídeos de retenção
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RETENTION_VIDEOS } from '../models/niches.js';
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

  // PRIORIDADE 1: Se o vídeo tem URL externa configurada, usar ela
  if (videoMeta.url && (videoMeta.url.startsWith('http://') || videoMeta.url.startsWith('https://'))) {
    // Se for URL do Streamable, converter para URL direta do vídeo
    if (isStreamableUrl(videoMeta.url)) {
      const directUrl = convertStreamableToDirectUrl(videoMeta.url);
      console.log(`[RETENTION] Usando URL do Streamable para ${retentionVideoId}: ${videoMeta.url} -> ${directUrl}`);
      return directUrl;
    }
    console.log(`[RETENTION] Usando URL externa para ${retentionVideoId}: ${videoMeta.url}`);
    return videoMeta.url;
  }

  // PRIORIDADE 2: Tentar encontrar arquivo local
  const possibleNames = [
    `${retentionVideoId}.mp4`,
    `${retentionVideoId}.webm`,
    `${retentionVideoId}.mov`,
    `retention-${retentionVideoId}.mp4`
  ];

  for (const fileName of possibleNames) {
    const filePath = path.join(RETENTION_LIBRARY_DIR, fileName);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  // Se não encontrou, retornar null (pode ser adicionado depois)
  console.warn(`[RETENTION] Arquivo não encontrado para ${retentionVideoId} em ${RETENTION_LIBRARY_DIR}`);
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
 * 
 * @returns {Array} - Array de objetos { id, name, path, exists }
 */
export function getAvailableRetentionVideos() {
  const videos = Object.values(RETENTION_VIDEOS).map(video => {
    const videoPath = getRetentionVideoPath(video.id);
    return {
      ...video,
      path: videoPath,
      exists: videoPath !== null && fs.existsSync(videoPath)
    };
  });

  return videos;
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
