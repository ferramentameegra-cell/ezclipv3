import { exec } from 'child_process';

/**
 * Obtém informações do vídeo via yt-dlp
 * @param {string} videoId
 */
export function getYouTubeInfo(videoId) {
  return new Promise((resolve, reject) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    const cmd = `yt-dlp --dump-json --no-warnings --no-playlist "${url}"`;

    console.log('[YT-DLP] Info:', cmd);

    exec(cmd, { maxBuffer: 1024 * 1024 * 20 }, (error, stdout) => {
      if (error) {
        console.error('[YT-DLP] Erro info:', error);
        return reject(error);
      }

      try {
        const info = JSON.parse(stdout);
        resolve({
          title: info.title,
          duration: info.duration,
          thumbnail: info.thumbnail,
          uploader: info.uploader,
          viewCount: info.view_count
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}
