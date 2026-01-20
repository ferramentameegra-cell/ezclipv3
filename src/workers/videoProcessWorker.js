import { videoProcessQueue } from '../queue/queue.js';
import { generateVideoSeries, setVideoStore } from '../services/videoProcessor.js';
import { decrementCredits } from '../services/creditService.js';

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
    
    // DECREMENTAR 1 CRÉDITO após geração bem-sucedida
    // IMPORTANTE: Só decrementa se a geração foi bem-sucedida
    const userId = job.data?.userId;
    if (userId) {
      try {
        const creditResult = await decrementCredits(userId);
        if (creditResult.decremented) {
          console.log(`[WORKER] ✅ Crédito decrementado para usuário ${userId}. Créditos restantes: ${creditResult.creditos}`);
        } else {
          console.log(`[WORKER] ℹ️ Usuário ${userId} tem créditos ilimitados. Não decrementado.`);
        }
      } catch (creditError) {
        console.error(`[WORKER] ❌ Erro ao decrementar créditos:`, creditError);
        // Não falhar o job se houver erro ao decrementar créditos (já foi gerado)
        // Mas logar o erro para investigação
      }
    } else {
      console.warn(`[WORKER] ⚠️ userId não encontrado no job.data. Créditos não foram decrementados.`);
    }
    
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

