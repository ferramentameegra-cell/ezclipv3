import { exec } from 'child_process';

/**
 * Baixa vídeo do YouTube usando yt-dlp (MP4 garantido)
 * @param {string} videoId
 * @param {string} outputPath
 */
export function downloadYouTubeVideo(videoId, outputPath) {
  return new Promise((resolve, reject) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    const cmd = [
      'yt-dlp',
      '-f "bv*[ext=mp4]+ba[ext=m4a]/mp4"',
      '--merge-output-format mp4',
      `-o "${outputPath}"`,
      `"${url}"`
    ].join(' ');

    console.log('[YT-DLP] Download:', cmd);

    exec(cmd, { maxBuffer: 1024 * 1024 * 100 }, (error, stdout, stderr) => {
      if (error) {
        console.error('[YT-DLP] ERRO FATAL:', error);
        return reject(error);
      }

      // stderr NÃO indica erro no yt-dlp
      console.log('[YT-DLP] Download concluído');
      resolve(true);
    });
  });
}
