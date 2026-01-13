/**
 * SERVICE YOUTUBE ESTÁVEL - Usa yt-dlp CLI
 * NÃO usa bibliotecas npm, apenas yt-dlp binário do sistema
 * 
 * Melhorias:
 * - Cache de informações de vídeos para evitar requisições repetidas
 * - Usa worker isolado para downloads (preparado para proxy/VPS/API externa)
 * - Múltiplas estratégias com diferentes User-Agents (iOS, Android, Desktop)
 * - Retry logic com diferentes métodos quando ocorrer erro 403
 * - Suporte a cookies do navegador
 */

import fs from 'fs';
import path from 'path';
import { getVideoInfo, downloadVideo } from '../workers/youtubeDownloadWorker.js';

/**
 * Cache de informações de vídeos (em memória)
 * Estrutura: { videoId: { metadata, timestamp } }
 * Cache expira após 1 hora
 */
const videoInfoCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hora em milissegundos


/**
 * Valida URL do YouTube e extrai video ID
 */
function validateYouTubeUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL não fornecida ou inválida');
  }

  const trimmedUrl = url.trim();
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/.*[?&]v=([^&\n?#]+)/
  ];

  for (const pattern of patterns) {
    const match = trimmedUrl.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  throw new Error('URL do YouTube inválida');
}

/**
 * Obtém metadata do vídeo do cache se disponível
 */
function getCachedVideoInfo(videoId) {
  const cached = videoInfoCache.get(videoId);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    if (age < CACHE_TTL) {
      console.log(`[CACHE] Info encontrada no cache para: ${videoId} (idade: ${Math.floor(age / 1000)}s)`);
      return cached.metadata;
    } else {
      // Cache expirado, remover
      videoInfoCache.delete(videoId);
      console.log(`[CACHE] Cache expirado para: ${videoId}`);
    }
  }
  return null;
}

/**
 * Salva metadata do vídeo no cache
 */
function setCachedVideoInfo(videoId, metadata) {
  videoInfoCache.set(videoId, {
    metadata,
    timestamp: Date.now()
  });
  console.log(`[CACHE] Info salva no cache para: ${videoId}`);
}


/**
 * Obtém metadata do vídeo usando worker isolado
 * Implementa cache e múltiplas estratégias para evitar erro 403
 */
export async function getYouTubeVideoInfo(url) {
  const videoId = validateYouTubeUrl(url);
  console.log(`[YT-SERVICE] Obtendo info para: ${videoId}`);

  // Verificar cache primeiro
  const cached = getCachedVideoInfo(videoId);
  if (cached) {
    return cached;
  }

  try {
    // Usar worker isolado
    const result = await getVideoInfo(url);
    
    // Processar resultado
    const metadata = {
      videoId: result.videoId,
      title: result.title,
      duration: result.duration,
      thumbnail: result.thumbnail,
      author: result.author,
      viewCount: result.viewCount,
      description: result.description
    };

    console.log(`[YT-SERVICE] ✅ Info obtida com estratégia "${result.strategy}": ${metadata.title} (${metadata.duration}s)`);
    
    // Salvar no cache
    setCachedVideoInfo(videoId, metadata);
    
    return metadata;
  } catch (error) {
    console.error(`[YT-SERVICE] ❌ Erro ao obter info: ${error.message}`);
    throw error;
  }
}

/**
 * Download de vídeo usando worker isolado
 * Retorna caminho do arquivo baixado
 * Implementa múltiplas estratégias para evitar erro 403
 */
export async function downloadYouTubeVideo(url, outputPath, onProgress) {
  const videoId = validateYouTubeUrl(url);
  console.log(`[YT-SERVICE] Download: ${videoId} -> ${outputPath}`);

  try {
    // Usar worker isolado
    const result = await downloadVideo(url, outputPath, onProgress);
    
    console.log(`[YT-SERVICE] ✅ Download concluído com estratégia "${result.strategy}"`);
    return result.path;
  } catch (error) {
    console.error(`[YT-SERVICE] ❌ Erro no download: ${error.message}`);
    throw error;
  }
}

