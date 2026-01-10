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
  // Mock para desenvolvimento sem Redis com processamento direto
  console.warn('[QUEUE] REDIS_URL não definida. Usando filas mock com processamento direto (desenvolvimento)');
  
  // Armazenar handlers e jobs (compartilhados entre filas)
  const processors = new Map();
  const jobs = new Map();
  
  const createMockQueue = (name) => {
    const queue = {
      async add(jobName, data, options) {
      const jobId = `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const job = {
        id: jobId,
        name: jobName,
        data: data,
        _progress: 0,
        _state: 'waiting',
        async progress(value) {
          this._progress = value;
          console.log(`[QUEUE-MOCK:${name}] Job ${jobId} progresso: ${value}%`);
          // Atualizar job no map
          jobs.set(jobId, this);
        },
        async getState() {
          return this._state;
        },
        progress() {
          return this._progress || 0;
        },
        failedReason: null
      };
      
      jobs.set(jobId, job);
      console.log(`[QUEUE-MOCK:${name}] Job adicionado: ${jobName} (${jobId})`, data);
      
      // Processar imediatamente se houver handler
      const handler = processors.get(`${name}:${jobName}`);
      if (handler) {
        // Processar de forma assíncrona para não bloquear
        setImmediate(async () => {
          try {
            job._state = 'active';
            console.log(`[QUEUE-MOCK:${name}] Processando job ${jobId}...`);
            await handler(job);
            job._state = 'completed';
            job._progress = 100;
            console.log(`[QUEUE-MOCK:${name}] Job ${jobId} concluído`);
          } catch (error) {
            job._state = 'failed';
            job.failedReason = error.message;
            console.error(`[QUEUE-MOCK:${name}] Job ${jobId} falhou:`, error.message);
          }
          jobs.set(jobId, job);
        });
      } else {
        console.warn(`[QUEUE-MOCK:${name}] Nenhum handler registrado para ${jobName}`);
      }
      
      return job;
    },
    async getJob(jobId) {
      return jobs.get(jobId) || null;
    },
    process(jobName, concurrency, handler) {
      const key = `${name}:${jobName}`;
      if (typeof concurrency === 'function') {
        handler = concurrency;
        concurrency = 1;
      }
      processors.set(key, handler);
      console.log(`[QUEUE-MOCK:${name}] ✅ Handler registrado para ${jobName} (concurrency: ${concurrency})`);
      return queue; // Retornar a própria fila
    }
    };
    return queue;
  };

  videoProcessQueue = createMockQueue('video-process');
  videoDownloadQueue = createMockQueue('video-download');
}

export { videoProcessQueue, videoDownloadQueue };
