import Redis from 'ioredis';

let redisClient = null;
let isRedisAvailable = false;

/**
 * Inicializa conexão com Redis
 */
export async function initRedis() {
  if (process.env.REDIS_URL) {
    try {
      redisClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        connectTimeout: 10000,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        }
      });

      redisClient.on('connect', () => {
        console.log('[REDIS] ✅ Conectado ao Redis');
        isRedisAvailable = true;
      });

      redisClient.on('error', (err) => {
        console.error('[REDIS] ❌ Erro na conexão:', err.message);
        isRedisAvailable = false;
      });

      // Testar conexão
      await redisClient.ping();
      isRedisAvailable = true;
      console.log('[REDIS] ✅ Redis disponível e funcionando');
      return true;
    } catch (error) {
      console.warn('[REDIS] ⚠️ Redis não disponível, usando fallback em memória:', error.message);
      isRedisAvailable = false;
      return false;
    }
  } else {
    console.warn('[REDIS] ⚠️ REDIS_URL não configurada, usando fallback em memória');
    isRedisAvailable = false;
    return false;
  }
}

/**
 * Verifica se Redis está disponível
 */
export function isRedisConnected() {
  return isRedisAvailable && redisClient && redisClient.status === 'ready';
}

/**
 * Obtém cliente Redis (ou null se não disponível)
 */
export function getRedisClient() {
  return isRedisConnected() ? redisClient : null;
}

/**
 * Wrapper para operações Redis com fallback em memória
 */
class RedisStore {
  constructor() {
    this.memoryStore = new Map();
  }

  async get(key) {
    if (isRedisConnected()) {
      try {
        const value = await redisClient.get(key);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        console.error(`[REDIS] Erro ao obter ${key}:`, error.message);
        return this.memoryStore.get(key) || null;
      }
    }
    return this.memoryStore.get(key) || null;
  }

  async set(key, value, ttlSeconds = null) {
    if (isRedisConnected()) {
      try {
        const serialized = JSON.stringify(value);
        if (ttlSeconds) {
          await redisClient.setex(key, ttlSeconds, serialized);
        } else {
          await redisClient.set(key, serialized);
        }
        return true;
      } catch (error) {
        console.error(`[REDIS] Erro ao salvar ${key}:`, error.message);
        // Fallback para memória
        this.memoryStore.set(key, value);
        return false;
      }
    }
    this.memoryStore.set(key, value);
    return true;
  }

  async del(key) {
    if (isRedisConnected()) {
      try {
        await redisClient.del(key);
      } catch (error) {
        console.error(`[REDIS] Erro ao deletar ${key}:`, error.message);
      }
    }
    this.memoryStore.delete(key);
  }

  async exists(key) {
    if (isRedisConnected()) {
      try {
        return await redisClient.exists(key) === 1;
      } catch (error) {
        console.error(`[REDIS] Erro ao verificar ${key}:`, error.message);
        return this.memoryStore.has(key);
      }
    }
    return this.memoryStore.has(key);
  }

  async keys(pattern) {
    if (isRedisConnected()) {
      try {
        return await redisClient.keys(pattern);
      } catch (error) {
        console.error(`[REDIS] Erro ao buscar keys ${pattern}:`, error.message);
        // Fallback: buscar em memória
        const regex = new RegExp(pattern.replace('*', '.*'));
        return Array.from(this.memoryStore.keys()).filter(k => regex.test(k));
      }
    }
    const regex = new RegExp(pattern.replace('*', '.*'));
    return Array.from(this.memoryStore.keys()).filter(k => regex.test(k));
  }

  async increment(key, ttlSeconds = null) {
    if (isRedisConnected()) {
      try {
        const value = await redisClient.incr(key);
        if (ttlSeconds && value === 1) {
          await redisClient.expire(key, ttlSeconds);
        }
        return value;
      } catch (error) {
        console.error(`[REDIS] Erro ao incrementar ${key}:`, error.message);
        const current = this.memoryStore.get(key) || 0;
        const newValue = current + 1;
        this.memoryStore.set(key, newValue);
        return newValue;
      }
    }
    const current = this.memoryStore.get(key) || 0;
    const newValue = current + 1;
    this.memoryStore.set(key, newValue);
    return newValue;
  }

  async expire(key, seconds) {
    if (isRedisConnected()) {
      try {
        await redisClient.expire(key, seconds);
      } catch (error) {
        console.error(`[REDIS] Erro ao definir TTL ${key}:`, error.message);
      }
    }
  }
}

export const redisStore = new RedisStore();
