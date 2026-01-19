/**
 * SERVIÇO DE VÍDEOS PROCESSADOS
 * Gerencia consumo e controle de vídeos processados
 */

import { getUserById, canProcessVideo, incrementVideosUsed, getUserVideoInfo, isAdmin } from '../models/users.js';
import { getPlanById } from '../models/plans.js';
import { createVideoLog, hasUserProcessedVideo, countUserVideos } from '../models/videoLogs.js';

/**
 * Verificar se usuário pode processar um novo vídeo
 * Retorna true se:
 * - É admin
 * - Tem plano unlimited
 * - Ainda não atingiu o limite de vídeos
 * - Este vídeo específico já foi processado antes (cortes ilimitados por vídeo)
 */
export function canUserProcessVideo(userId, videoId) {
  const user = getUserById(userId);
  if (!user) {
    return {
      allowed: false,
      reason: 'Usuário não encontrado'
    };
  }

  // Admin sempre pode processar
  if (isAdmin(userId)) {
    return {
      allowed: true,
      isAdmin: true,
      isUnlimited: true
    };
  }

  // Se o vídeo já foi processado antes, pode gerar cortes ilimitados
  if (hasUserProcessedVideo(userId, videoId)) {
    return {
      allowed: true,
      isExistingVideo: true,
      message: 'Este vídeo já foi processado. Você pode gerar cortes ilimitados.'
    };
  }

  // Verificar se pode processar novo vídeo
  if (!canProcessVideo(userId)) {
    const videoInfo = getUserVideoInfo(userId);
    const plan = getPlanById(user.plan_id);
    
    return {
      allowed: false,
      reason: `Limite de vídeos atingido. Você já processou ${videoInfo.videos_used} de ${videoInfo.videos_limit} vídeos permitidos no seu plano.`,
      videos_used: videoInfo.videos_used,
      videos_limit: videoInfo.videos_limit,
      plan_name: plan?.name || 'seu plano atual',
      needsUpgrade: true
    };
  }

  return {
    allowed: true,
    videos_used: getUserVideoInfo(userId).videos_used,
    videos_limit: getUserVideoInfo(userId).videos_limit,
    videos_remaining: getUserVideoInfo(userId).videos_remaining
  };
}

/**
 * Registrar processamento de vídeo
 * Incrementa contador e cria log
 */
export function registerVideoProcessed(userId, videoId) {
  const user = getUserById(userId);
  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  // Se o vídeo já foi processado antes, não incrementar contador
  if (hasUserProcessedVideo(userId, videoId)) {
    console.log(`[VIDEOS] Vídeo ${videoId} já foi processado antes. Permitindo cortes ilimitados.`);
    return {
      isNewVideo: false,
      videos_used: user.videos_used ?? 0,
      videos_limit: user.videos_limit
    };
  }

  // Admin não incrementa contador
  if (isAdmin(userId)) {
    console.log(`[VIDEOS] Admin processando vídeo ${videoId} (sem incremento)`);
    createVideoLog({ userId, videoId, planId: user.plan_id });
    return {
      isNewVideo: true,
      isAdmin: true,
      videos_used: user.videos_used ?? 0,
      videos_limit: null
    };
  }

  // Incrementar contador de vídeos processados
  incrementVideosUsed(userId);

  // Criar log
  createVideoLog({ userId, videoId, planId: user.plan_id });

  const updatedUser = getUserById(userId);
  console.log(`[VIDEOS] Vídeo ${videoId} registrado. Total processado: ${updatedUser.videos_used}/${updatedUser.videos_limit || 'ilimitado'}`);

  return {
    isNewVideo: true,
    videos_used: updatedUser.videos_used,
    videos_limit: updatedUser.videos_limit,
    videos_remaining: updatedUser.videos_limit ? updatedUser.videos_limit - updatedUser.videos_used : null
  };
}

/**
 * Obter informações de vídeos do usuário
 */
export function getUserVideoStats(userId) {
  const user = getUserById(userId);
  if (!user) {
    return {
      videos_used: 0,
      videos_limit: null,
      videos_remaining: null,
      is_unlimited: false,
      plan_name: null
    };
  }

  const plan = getPlanById(user.plan_id);
  const videoInfo = getUserVideoInfo(userId);

  return {
    ...videoInfo,
    plan_name: plan?.name || 'Sem plano',
    plan_id: user.plan_id,
    total_videos_processed: countUserVideos(userId)
  };
}
