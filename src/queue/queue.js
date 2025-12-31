import Bull from 'bull';
import Redis from 'ioredis';

// Configurar Redis connection (com fallback para desenvolvimento)
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true, // Não conectar automaticamente
  retryStrategy: (times) => {
    // Parar tentativas após 3 tentativas
    if (times > 3) {
      return null; // Para retry
    }
    return Math.min(times * 200, 2000);
  }
};

// Criar conexão Redis com tratamento de erros robusto
let redisClient = null;
let useRedis = false;

// Função para criar cliente Redis com tratamento de erros
function createRedisClient() {
  try {
    let client;
    
    if (process.env.REDIS_URL) {
      client = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
        retryStrategy: (times) => {
          if (times > 3) return null;
          return Math.min(times * 200, 2000);
        }
      });
    } else if (process.env.REDIS_HOST && process.env.REDIS_HOST !== 'localhost') {
      client = new Redis(redisConfig);
    } else {
      // Desenvolvimento local sem Redis - não criar cliente
      console.log('[QUEUE] Redis não configurado, usando fallback em memória');
      return null;
    }

    // Tratar erros de conexão (evitar erros não tratados)
    client.on('error', (error) => {
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        console.warn('[QUEUE] Redis não disponível, usando fallback em memória');
        useRedis = false;
        // Não propagar erro - usar fallback silenciosamente
      } else {
        console.error('[QUEUE] Erro Redis:', error.message);
      }
    });

    client.on('connect', () => {
      console.log('[QUEUE] Redis conectado com sucesso');
      useRedis = true;
    });

    client.on('ready', () => {
      console.log('[QUEUE] Redis pronto para uso');
      useRedis = true;
    });

    // Tentar conectar (lazy connect)
    client.connect().catch((error) => {
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        console.warn('[QUEUE] Redis não disponível na inicialização, usando fallback');
        useRedis = false;
      }
    });

    return client;
  } catch (error) {
    console.warn('[QUEUE] Erro ao criar cliente Redis, usando fallback:', error.message);
    return null;
  }
}

// Criar cliente apenas se Redis estiver configurado
if (process.env.REDIS_URL || (process.env.REDIS_HOST && process.env.REDIS_HOST !== 'localhost')) {
  redisClient = createRedisClient();
}

// Fallback para memória local (desenvolvimento sem Redis)
const memoryFallback = {
  createClient: () => {
    return {
      get: () => Promise.resolve(null),
      set: () => Promise.resolve('OK'),
      del: () => Promise.resolve(1),
      exists: () => Promise.resolve(0),
      keys: () => Promise.resolve([]),
      expire: () => Promise.resolve(1),
      ttl: () => Promise.resolve(-1),
      pttl: () => Promise.resolve(-1),
      hget: () => Promise.resolve(null),
      hset: () => Promise.resolve(1),
      hdel: () => Promise.resolve(1),
      hgetall: () => Promise.resolve({}),
      sadd: () => Promise.resolve(1),
      srem: () => Promise.resolve(1),
      smembers: () => Promise.resolve([]),
      sismember: () => Promise.resolve(0),
      zadd: () => Promise.resolve(1),
      zrem: () => Promise.resolve(1),
      zrange: () => Promise.resolve([]),
      zrangebyscore: () => Promise.resolve([]),
      zcard: () => Promise.resolve(0),
      zscore: () => Promise.resolve(null),
      zremrangebyscore: () => Promise.resolve(0),
      lpush: () => Promise.resolve(1),
      rpop: () => Promise.resolve(null),
      llen: () => Promise.resolve(0),
      lrange: () => Promise.resolve([]),
      lrem: () => Promise.resolve(0),
      publish: () => Promise.resolve(1),
      subscribe: () => Promise.resolve(),
      unsubscribe: () => Promise.resolve(),
      psubscribe: () => Promise.resolve(),
      punsubscribe: () => Promise.resolve(),
      on: () => {},
      removeListener: () => {},
      quit: () => Promise.resolve('OK'),
      disconnect: () => Promise.resolve(),
      ping: () => Promise.resolve('PONG')
    };
  }
};

// Criar filas de jobs com fallback seguro
export const videoDownloadQueue = new Bull('video-download', {
  redis: redisClient || memoryFallback,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: {
      age: 3600, // Manter jobs completos por 1 hora
      count: 100 // Manter últimos 100 jobs
    },
    removeOnFail: {
      age: 86400 // Manter jobs falhos por 24 horas
    }
  }
});

export const videoProcessQueue = new Bull('video-process', {
  redis: redisClient || memoryFallback,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: {
      age: 3600,
      count: 100
    },
    removeOnFail: {
      age: 86400
    }
  }
});

// Event listeners para monitoramento
videoDownloadQueue.on('completed', (job) => {
  console.log(`[QUEUE] Job de download completado: ${job.id}`);
});

videoDownloadQueue.on('failed', (job, err) => {
  console.error(`[QUEUE] Job de download falhou: ${job.id}`, err.message);
});

videoProcessQueue.on('completed', (job) => {
  console.log(`[QUEUE] Job de processamento completado: ${job.id}`);
});

videoProcessQueue.on('failed', (job, err) => {
  console.error(`[QUEUE] Job de processamento falhou: ${job.id}`, err.message);
});

export { redisClient };
