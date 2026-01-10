import Queue from 'bull';

// Para desenvolvimento local, criar filas mock se Redis não estiver disponível
let videoProcessQueue, videoDownloadQueue;

if (process.env.REDIS_URL) {
  const redisOptions = {
    redis: {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 10000,
    },
  };

  videoProcessQueue = new Queue(
    'video-process',
    process.env.REDIS_URL,
    redisOptions
  );

  videoDownloadQueue = new Queue(
    'video-download',
    process.env.REDIS_URL,
    redisOptions
  );

  console.log('[QUEUE] Filas configuradas com Redis');
} else {
  // Mock para desenvolvimento sem Redis
  console.warn('[QUEUE] REDIS_URL não definida. Usando filas mock (desenvolvimento)');
  
  const createMockQueue = (name) => ({
    async add(jobName, data, options) {
      console.log(`[QUEUE-MOCK] Job adicionado: ${jobName}`, data);
      return {
        id: `mock-${Date.now()}`,
        async progress(value) {
          console.log(`[QUEUE-MOCK] Progresso: ${value}%`);
        },
        async getState() {
          return 'completed';
        },
        progress() {
          return 100;
        },
        failedReason: null
      };
    },
    async getJob(jobId) {
      return null;
    }
  });

  videoProcessQueue = createMockQueue('video-process');
  videoDownloadQueue = createMockQueue('video-download');
}

export { videoProcessQueue, videoDownloadQueue };
