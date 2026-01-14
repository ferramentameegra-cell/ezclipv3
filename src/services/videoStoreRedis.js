import { redisStore } from './redisService.js';
import { videoStore as memoryStore } from '../controllers/downloadProgressController.js';

/**
 * VideoStore com suporte a Redis e fallback em memória
 */
class VideoStoreService {
  constructor() {
    this.useRedis = false;
  }

  async init() {
    const { isRedisConnected } = await import('./redisService.js');
    this.useRedis = isRedisConnected();
    console.log(`[VIDEO_STORE] Usando ${this.useRedis ? 'Redis' : 'Memória'} para armazenamento`);
  }

  async get(videoId) {
    if (this.useRedis) {
      const key = `video:${videoId}`;
      return await redisStore.get(key);
    }
    return memoryStore.get(videoId);
  }

  async set(videoId, videoData) {
    if (this.useRedis) {
      const key = `video:${videoId}`;
      // TTL de 24 horas para vídeos
      await redisStore.set(key, videoData, 86400);
    } else {
      memoryStore.set(videoId, videoData);
    }
  }

  async delete(videoId) {
    if (this.useRedis) {
      const key = `video:${videoId}`;
      await redisStore.del(key);
    } else {
      memoryStore.delete(videoId);
    }
  }

  async has(videoId) {
    if (this.useRedis) {
      const key = `video:${videoId}`;
      return await redisStore.exists(key);
    }
    return memoryStore.has(videoId);
  }

  // Para compatibilidade com código existente
  get size() {
    if (this.useRedis) {
      // Redis não tem size direto, retornar aproximado
      return 0;
    }
    return memoryStore.size;
  }

  // Iterador para compatibilidade
  *[Symbol.iterator]() {
    if (!this.useRedis) {
      yield* memoryStore;
    }
    // Redis iteration seria mais complexo, retornar vazio por enquanto
  }

  forEach(callback) {
    if (!this.useRedis) {
      memoryStore.forEach(callback);
    }
  }
}

export const videoStoreRedis = new VideoStoreService();
