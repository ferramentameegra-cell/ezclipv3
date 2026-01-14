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
    console.log(`[WORKER] Job data:`, JSON.stringify({ ...job.data, videoPath: '[path]' }));
    
    // Verificar se videoStore foi configurado
    if (!videoStoreInstance) {
      throw new Error('VideoStore não foi configurado no worker. Certifique-se de que o servidor inicializou corretamente.');
    }
    
    // Atualizar job no jobsMap para acompanhamento de progresso
    jobsMap.set(job.id, job);
    
    // Passar o job completo para o videoProcessor (não apenas job.data)
    // O videoProcessor precisa do job para atualizar progresso
    const result = await generateVideoSeries(job, jobsMap);
    
    console.log(`[WORKER] Job ${job.id} concluído com sucesso: ${result.clipsCount} clips gerados`);
    console.log(`[WORKER] Resultado:`, JSON.stringify({ ...result, clips: `[${result.clips?.length || 0} clips]` }));
    
    // Retornar resultado que será armazenado em job.returnvalue
    const returnValue = {
      status: 'completed',
      clipsCount: result.clipsCount || result.clips?.length || 0,
      seriesId: result.seriesId || job.data?.seriesId
    };
    
    console.log(`[WORKER] Retornando:`, JSON.stringify(returnValue));
    
    return returnValue;
  } catch (error) {
    console.error(`[WORKER] Erro ao processar job ${job.id}:`, error);
    console.error(`[WORKER] Stack:`, error.stack);
    job.failedReason = error.message;
    throw error;
  } finally {
    jobsMap.delete(job.id);
  }
});

