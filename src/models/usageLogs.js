/**
 * LOGS DE USO DE CRÉDITOS
 * Registra cada uso de créditos para auditoria
 */

import { v4 as uuidv4 } from 'uuid';

// Store de logs (simula banco de dados)
export const usageLogStore = new Map();

/**
 * Criar log de uso
 */
export function createUsageLog({ userId, creditsUsed, type, clipCount, seriesId }) {
  const log = {
    id: uuidv4(),
    user_id: userId,
    credits_used: creditsUsed,
    type: type, // 'free_trial' ou 'paid'
    clip_count: clipCount || 1,
    series_id: seriesId || null,
    created_at: new Date()
  };

  usageLogStore.set(log.id, log);

  return log;
}

/**
 * Obter logs de uso de um usuário
 */
export function getUserUsageLogs(userId, limit = 50) {
  const logs = Array.from(usageLogStore.values())
    .filter(log => log.user_id === userId)
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, limit);

  return logs;
}

/**
 * Obter estatísticas de uso de um usuário
 */
export function getUserUsageStats(userId) {
  const logs = Array.from(usageLogStore.values()).filter(log => log.user_id === userId);

  const totalCreditsUsed = logs.reduce((sum, log) => sum + log.credits_used, 0);
  const freeTrialCreditsUsed = logs
    .filter(log => log.type === 'free_trial')
    .reduce((sum, log) => sum + log.credits_used, 0);
  const paidCreditsUsed = logs
    .filter(log => log.type === 'paid')
    .reduce((sum, log) => sum + log.credits_used, 0);

  return {
    totalCreditsUsed,
    freeTrialCreditsUsed,
    paidCreditsUsed,
    totalUsageLogs: logs.length
  };
}
