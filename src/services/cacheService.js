import { redisStore } from './redisService.js';

/**
 * Sistema de cache inteligente para metadados, legendas, etc.
 */
export class CacheService {
  /**
   * Cache de metadados de vídeos do YouTube
   */
  static async getYouTubeMetadata(videoId) {
    const key = `cache:youtube:metadata:${videoId}`;
    return await redisStore.get(key);
  }

  static async setYouTubeMetadata(videoId, metadata, ttlSeconds = 3600) {
    const key = `cache:youtube:metadata:${videoId}`;
    await redisStore.set(key, metadata, ttlSeconds);
  }

  /**
   * Cache de legendas geradas
   */
  static async getCaptions(videoId) {
    const key = `cache:captions:${videoId}`;
    return await redisStore.get(key);
  }

  static async setCaptions(videoId, captions, ttlSeconds = 86400) {
    const key = `cache:captions:${videoId}`;
    await redisStore.set(key, captions, ttlSeconds);
  }

  /**
   * Cache de informações de processamento
   */
  static async getProcessingInfo(jobId) {
    const key = `cache:processing:${jobId}`;
    return await redisStore.get(key);
  }

  static async setProcessingInfo(jobId, info, ttlSeconds = 3600) {
    const key = `cache:processing:${jobId}`;
    await redisStore.set(key, info, ttlSeconds);
  }

  /**
   * Invalidar cache específico
   */
  static async invalidate(pattern) {
    const keys = await redisStore.keys(`cache:${pattern}*`);
    for (const key of keys) {
      await redisStore.del(key);
    }
    return keys.length;
  }

  /**
   * Cache de resultados de API externa
   */
  static async getApiCache(endpoint, params) {
    const key = `cache:api:${endpoint}:${JSON.stringify(params)}`;
    return await redisStore.get(key);
  }

  static async setApiCache(endpoint, params, data, ttlSeconds = 1800) {
    const key = `cache:api:${endpoint}:${JSON.stringify(params)}`;
    await redisStore.set(key, data, ttlSeconds);
  }
}
