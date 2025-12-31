import { videoDownloadQueue } from '../queue/queue.js';
import { downloadYouTubeVideo } from '../services/youtubeDownloader.js';
import { videoStore } from '../controllers/videoController.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Worker para processar downloads de vídeos do YouTube
 * Executa de forma assíncrona e escalável
 */
videoDownloadQueue.process('download-youtube-video', async (job) => {
  const { videoId, youtubeVideoId, videoPath } = job.data;
  
  console.log(`[WORKER] Iniciando download: ${youtubeVideoId} -> ${videoPath}`);
  
  try {
    // Garantir que o diretório existe
    const dir = path.dirname(videoPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Atualizar progresso
    await job.progress(10);

    // Baixar vídeo
    await downloadYouTubeVideo(youtubeVideoId, videoPath);
    
    // Atualizar progresso
    await job.progress(50);

    // Validar download
    if (!fs.existsSync(videoPath)) {
      throw new Error('Arquivo não foi criado após download');
    }

    const stats = fs.statSync(videoPath);
    if (stats.size === 0) {
      throw new Error('Arquivo baixado está vazio');
    }

    // Atualizar videoStore
    const video = videoStore.get(videoId);
    if (video) {
      video.downloaded = true;
      video.path = videoPath;
      video.downloadError = null;
      videoStore.set(videoId, video);
    }

    await job.progress(100);

    console.log(`[WORKER] Download concluído: ${videoPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

    return {
      success: true,
      videoPath,
      fileSize: stats.size
    };
  } catch (error) {
    console.error(`[WORKER] Erro no download:`, error);
    
    // Limpar arquivo corrompido se existir
    if (fs.existsSync(videoPath)) {
      try {
        fs.unlinkSync(videoPath);
      } catch (unlinkError) {
        console.error('[WORKER] Erro ao remover arquivo corrompido:', unlinkError);
      }
    }

    // Atualizar videoStore com erro
    const video = videoStore.get(videoId);
    if (video) {
      video.downloaded = false;
      video.downloadError = error.message;
      videoStore.set(videoId, video);
    }

    throw error;
  }
});

console.log('[WORKER] Video Download Worker iniciado');

