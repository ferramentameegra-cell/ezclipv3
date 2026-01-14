import { redisStore } from './redisService.js';

/**
 * Sistema de quotas/limites por usuário
 */
export class UserQuotaService {
  /**
   * Verifica se usuário pode processar vídeo
   */
  static async checkVideoProcessingQuota(userId, plan = 'free') {
    const quotas = {
      free: {
        videosPerDay: 10,
        videosPerHour: 3,
        maxVideoSize: 500 * 1024 * 1024, // 500MB
        concurrentProcessing: 1
      },
      premium: {
        videosPerDay: 100,
        videosPerHour: 20,
        maxVideoSize: 2 * 1024 * 1024 * 1024, // 2GB
        concurrentProcessing: 3
      },
      enterprise: {
        videosPerDay: 1000,
        videosPerHour: 100,
        maxVideoSize: 5 * 1024 * 1024 * 1024, // 5GB
        concurrentProcessing: 10
      }
    };

    const quota = quotas[plan] || quotas.free;

    // Verificar limite diário
    const dailyKey = `quota:${userId}:videos:day:${new Date().toISOString().split('T')[0]}`;
    const dailyCount = await redisStore.increment(dailyKey, 86400); // 24 horas
    if (dailyCount > quota.videosPerDay) {
      return {
        allowed: false,
        reason: 'Limite diário atingido',
        limit: quota.videosPerDay,
        used: dailyCount
      };
    }

    // Verificar limite por hora
    const hourlyKey = `quota:${userId}:videos:hour:${new Date().toISOString().substring(0, 13)}`;
    const hourlyCount = await redisStore.increment(hourlyKey, 3600); // 1 hora
    if (hourlyCount > quota.videosPerHour) {
      return {
        allowed: false,
        reason: 'Limite por hora atingido',
        limit: quota.videosPerHour,
        used: hourlyCount
      };
    }

    // Verificar processamentos simultâneos
    const concurrentKey = `quota:${userId}:processing:concurrent`;
    const concurrentCount = await redisStore.increment(concurrentKey, 3600);
    if (concurrentCount > quota.concurrentProcessing) {
      return {
        allowed: false,
        reason: 'Muitos processamentos simultâneos',
        limit: quota.concurrentProcessing,
        used: concurrentCount
      };
    }

    return {
      allowed: true,
      quota: {
        daily: { limit: quota.videosPerDay, used: dailyCount },
        hourly: { limit: quota.videosPerHour, used: hourlyCount },
        concurrent: { limit: quota.concurrentProcessing, used: concurrentCount },
        maxVideoSize: quota.maxVideoSize
      }
    };
  }

  /**
   * Libera slot de processamento simultâneo
   */
  static async releaseConcurrentSlot(userId) {
    const concurrentKey = `quota:${userId}:processing:concurrent`;
    const current = await redisStore.get(concurrentKey) || 0;
    if (current > 0) {
      await redisStore.set(concurrentKey, current - 1, 3600);
    }
  }

  /**
   * Obtém estatísticas de uso do usuário
   */
  static async getUserQuotaStats(userId, plan = 'free') {
    const quotas = {
      free: { videosPerDay: 10, videosPerHour: 3 },
      premium: { videosPerDay: 100, videosPerHour: 20 },
      enterprise: { videosPerDay: 1000, videosPerHour: 100 }
    };

    const quota = quotas[plan] || quotas.free;

    const dailyKey = `quota:${userId}:videos:day:${new Date().toISOString().split('T')[0]}`;
    const hourlyKey = `quota:${userId}:videos:hour:${new Date().toISOString().substring(0, 13)}`;

    const dailyUsed = (await redisStore.get(dailyKey)) || 0;
    const hourlyUsed = (await redisStore.get(hourlyKey)) || 0;

    return {
      plan,
      daily: {
        limit: quota.videosPerDay,
        used: dailyUsed,
        remaining: Math.max(0, quota.videosPerDay - dailyUsed)
      },
      hourly: {
        limit: quota.videosPerHour,
        used: hourlyUsed,
        remaining: Math.max(0, quota.videosPerHour - hourlyUsed)
      }
    };
  }
}
