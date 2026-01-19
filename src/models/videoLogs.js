/**
 * LOGS DE VÍDEOS PROCESSADOS
 * Registra cada vídeo processado para controle de limite
 */

import { v4 as uuidv4 } from 'uuid';

// Store de logs (simula banco de dados)
export const videoLogStore = new Map();

/**
 * Criar log de vídeo processado
 */
export function createVideoLog({ userId, videoId, planId }) {
  const log = {
    id: uuidv4(),
    user_id: userId,
    video_id: videoId,
    plan_id: planId,
    created_at: new Date()
  };

  videoLogStore.set(log.id, log);

  return log;
}

/**
 * Obter logs de vídeos processados de um usuário
 */
export function getUserVideoLogs(userId, limit = 100) {
  const logs = Array.from(videoLogStore.values())
    .filter(log => log.user_id === userId)
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, limit);

  return logs;
}

/**
 * Contar vídeos processados por usuário
 */
export function countUserVideos(userId) {
  return Array.from(videoLogStore.values())
    .filter(log => log.user_id === userId)
    .length;
}

/**
 * Verificar se um vídeo já foi processado por um usuário
 */
export function hasUserProcessedVideo(userId, videoId) {
  return Array.from(videoLogStore.values())
    .some(log => log.user_id === userId && log.video_id === videoId);
}

/**
 * Limpar todos os logs de vídeos (apenas para inicialização)
 */
export function clearAllVideoLogs() {
  videoLogStore.clear();
  console.log('[VIDEO_LOGS] Todos os logs de vídeos foram removidos');
}
