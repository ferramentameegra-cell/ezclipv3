import { videoProcessQueue } from '../queue/queue.js';
import { generateVideoSeries, setVideoStore } from '../services/videoProcessor.js';
// incrementVideosUsed é chamado no generateController ao enviar o vídeo

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
  const startTime = Date.now();
  
  try {
    console.log(`[WORKER] ========================================`);
    console.log(`[WORKER] INICIANDO PROCESSAMENTO DE JOB`);
    console.log(`[WORKER] ========================================`);
    console.log(`[WORKER] Job ID: ${job.id}`);
    console.log(`[WORKER] Job name: generate-video-series`);
    console.log(`[WORKER] Concurrency: ${CONCURRENCY}`);
    console.log(`[WORKER] Job data:`, JSON.stringify({ ...job.data, videoPath: job.data?.videoPath ? '[path]' : 'undefined' }));
    
    // Verificar se videoStore foi configurado
    if (!videoStoreInstance) {
      const error = 'VideoStore não foi configurado no worker. Certifique-se de que o servidor inicializou corretamente.';
      console.error(`[WORKER_ERROR] ${error}`);
      throw new Error(error);
    }
    
    console.log(`[WORKER] ✅ VideoStore configurado`);
    
    // Atualizar job no jobsMap para acompanhamento de progresso
    jobsMap.set(job.id, job);
    
    // Passar o job completo para o videoProcessor (não apenas job.data)
    // O videoProcessor precisa do job para atualizar progresso
    console.log(`[WORKER] Chamando generateVideoSeries...`);
    const result = await generateVideoSeries(job, jobsMap);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[WORKER] ========================================`);
    console.log(`[WORKER] ✅ JOB CONCLUÍDO COM SUCESSO`);
    console.log(`[WORKER] ========================================`);
    console.log(`[WORKER] Job ID: ${job.id}`);
    console.log(`[WORKER] Duração: ${duration}s`);
    console.log(`[WORKER] Clips gerados: ${result.clipsCount || result.clips?.length || 0}`);
    console.log(`[WORKER] Series ID: ${result.seriesId || job.data?.seriesId}`);
    console.log(`[WORKER] Resultado:`, JSON.stringify({ ...result, clips: `[${result.clips?.length || 0} clips]` }));
    console.log(`[WORKER] ========================================`);
    
    // VALIDAR resultado antes de continuar
    if (!result || !result.clipsCount || result.clipsCount === 0) {
      const error = `[WORKER_ERROR] Resultado inválido: nenhum clip foi gerado. Result: ${JSON.stringify(result)}`;
      console.error(error);
      throw new Error(error);
    }
    
    // videos_used já foi incrementado no generateController ao enviar o vídeo
    
    // Retornar resultado que será armazenado em job.returnvalue
    const returnValue = {
      status: 'completed',
      clipsCount: result.clipsCount || result.clips?.length || 0,
      seriesId: result.seriesId || job.data?.seriesId
    };
    
    console.log(`[WORKER] Retornando resultado para BullMQ:`, JSON.stringify(returnValue));
    
    return returnValue;
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`[WORKER_ERROR] ========================================`);
    console.error(`[WORKER_ERROR] ERRO AO PROCESSAR JOB`);
    console.error(`[WORKER_ERROR] ========================================`);
    console.error(`[WORKER_ERROR] Job ID: ${job.id}`);
    console.error(`[WORKER_ERROR] Duração até erro: ${duration}s`);
    console.error(`[WORKER_ERROR] Mensagem: ${error.message}`);
    console.error(`[WORKER_ERROR] Stack trace completo:`);
    console.error(error.stack);
    console.error(`[WORKER_ERROR] ========================================`);
    
    // Garantir que o erro seja propagado corretamente para o BullMQ
    job.failedReason = error.message;
    job.failedAt = new Date();
    
    // Criar erro detalhado para o BullMQ
    const detailedError = new Error(`Erro ao processar job ${job.id}: ${error.message}\n\n` +
                                   `Job ID: ${job.id}\n` +
                                   `Job data: ${JSON.stringify({ ...job.data, videoPath: '[path]' })}\n` +
                                   `Duração até erro: ${duration}s\n` +
                                   `Stack trace: ${error.stack}`);
    detailedError.stack = error.stack;
    
    throw detailedError;
  } finally {
    jobsMap.delete(job.id);
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[WORKER] Job ${job.id} finalizado (duração total: ${totalDuration}s)`);
  }
});

