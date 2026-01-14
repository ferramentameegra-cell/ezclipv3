import { videoProcessQueue } from '../queue/queue.js';
import { generateVideoSeries, setVideoStore } from '../services/videoProcessor.js';

// VideoStore será injetado quando o servidor iniciar
let videoStoreInstance = null;

// Exportar função para configurar o videoStore
export function configureWorker(videoStore) {
  videoStoreInstance = videoStore;
  setVideoStore(videoStore);
  console.log('[WORKER] VideoStore configurado no worker');
}

// Criar um jobsMap para armazenar progresso dos jobs
const jobsMap = new Map();

// Concurrency: 10 (processar 10 vídeos simultaneamente)
// Otimizado para 1000+ usuários simultâneos
// Ajustar conforme recursos: 10-20 para produção SaaS
const CONCURRENCY = parseInt(process.env.VIDEO_PROCESS_CONCURRENCY || '10');

videoProcessQueue.process('generate-video-series', CONCURRENCY, async (job) => {
  try {
    console.log(`[WORKER] Processando job ${job.id}: generate-video-series`);
    
    // Verificar se videoStore foi configurado
    if (!videoStoreInstance) {
      throw new Error('VideoStore não foi configurado no worker. Certifique-se de que o servidor inicializou corretamente.');
    }
    
    // Atualizar job no jobsMap para acompanhamento de progresso
    jobsMap.set(job.id, job);
    
    // Usar o videoProcessor que tem toda a lógica correta
    const result = await generateVideoSeries(job.data, jobsMap);
    
    console.log(`[WORKER] Job ${job.id} concluído com sucesso: ${result.clipsCount} clips gerados`);
    
    return {
      status: 'completed',
      clipsCount: result.clipsCount || result.clips?.length || 0,
      seriesId: result.seriesId
    };
  } catch (error) {
    console.error(`[WORKER] Erro ao processar job ${job.id}:`, error);
    job.failedReason = error.message;
    throw error;
  } finally {
    jobsMap.delete(job.id);
  }
});

