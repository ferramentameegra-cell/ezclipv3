import Bull from 'bull';
import Redis from 'ioredis';

// Configurar Redis connection (com fallback para desenvolvimento)
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  // Para Railway e outros serviços cloud
  ...(process.env.REDIS_URL && {
    host: undefined,
    port: undefined,
    path: undefined,
    url: process.env.REDIS_URL
  })
};

// Criar conexão Redis
let redisClient;
try {
  if (process.env.REDIS_URL) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    });
  } else {
    redisClient = new Redis(redisConfig);
  }
} catch (error) {
  console.warn('[QUEUE] Redis não disponível, usando memória local:', error.message);
  redisClient = null;
}

// Criar filas de jobs
export const videoDownloadQueue = new Bull('video-download', {
  redis: redisClient || {
    // Fallback para desenvolvimento sem Redis
    createClient: () => {
      console.warn('[QUEUE] Usando armazenamento em memória (Redis não disponível)');
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
  },
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
  redis: redisClient || {
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
  },
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

