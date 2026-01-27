import { videoDownloadQueue } from '../queue/queue.js';
import { downloadYouTubeVideo } from '../services/youtubeDownloader.js';
import { videoStore } from '../controllers/downloadProgressController.js';
import fs from 'fs';
import path from 'path';

/**
 * Diretório TEMPORÁRIO seguro no Railway
 */
const TMP_UPLOADS_DIR = '/tmp/uploads';

/**
 * Worker para processar downloads de vídeos do YouTube
 */
videoDownloadQueue.process('download-youtube-video', async (job) => {
  const { videoId, youtubeVideoId } = job.data;

  const videoPath = path.join(TMP_UPLOADS_DIR, `${videoId}.mp4`);

  console.log(`[WORKER] Download iniciado: ${youtubeVideoId}`);
  console.log(`[WORKER] Salvando em: ${videoPath}`);

  try {
    // Garantir diretório
    if (!fs.existsSync(TMP_UPLOADS_DIR)) {
      fs.mkdirSync(TMP_UPLOADS_DIR, { recursive: true });
    }

    await job.progress(5);

    /**
     * DOWNLOAD
     * Aqui o yt-dlp já será chamado com:
     * --js-runtimes node
     * --extractor-args youtube:player_client=web
     * -f bv*+ba/b
     */
    await downloadYouTubeVideo(youtubeVideoId, videoPath, (percent) => {
      if (percent && percent > 5 && percent < 90) {
        job.progress(Math.floor(percent));
      }
    });

    await job.progress(80);

    /**
     * VALIDAÇÃO CRÍTICA
     */
    if (!fs.existsSync(videoPath)) {
      throw new Error('Arquivo não foi criado após download');
    }

    const stats = fs.statSync(videoPath);
    if (!stats || stats.size === 0) {
      throw new Error('Arquivo baixado está vazio');
    }

    /**
     * Atualizar videoStore
     */
    const video = videoStore.get(videoId);
    if (video) {
      video.downloaded = true;
      video.path = videoPath;
      video.fileSize = stats.size;
      video.downloadError = null;
      video.downloadCompletedAt = new Date();
      videoStore.set(videoId, video);
    }

    await job.progress(100);

    console.log(
      `[WORKER] Download concluído: ${(stats.size / 1024 / 1024).toFixed(2)} MB`
    );

    return {
      success: true,
      videoPath,
      fileSize: stats.size
    };

  } catch (error) {
    console.error('[WORKER] Erro no download:', error.message);

    // Limpeza de arquivo corrompido
    if (fs.existsSync(videoPath)) {
      try {
        fs.unlinkSync(videoPath);
      } catch {}
    }

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
