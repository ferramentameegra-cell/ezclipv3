import Queue from 'bull';

if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL não definida no ambiente');
}

const redisOptions = {
  redis: {
    maxRetriesPerRequest: null, // 🔥 O QUE ESTAVA QUEBRANDO TUDO
    enableReadyCheck: false,    // 🔥 ESSENCIAL NO RAILWAY
    connectTimeout: 10000,
  },
};

export const videoProcessQueue = new Queue(
  'video-process',
  process.env.REDIS_URL,
  redisOptions
);

export const videoDownloadQueue = new Queue(
  'video-download',
  process.env.REDIS_URL,
  redisOptions
);

console.log('[QUEUE] Filas configuradas com Redis Railway');
