import { spawn } from 'child_process';
import fs from 'fs';

/**
 * Faz download do vídeo do YouTube usando yt-dlp
 */
export function downloadYouTubeVideo(youtubeVideoId, outputPath, onProgress) {
  return new Promise((resolve, reject) => {
    const url = `https://www.youtube.com/watch?v=${youtubeVideoId}`;

    const args = [
      '--js-runtimes', 'node',
      '--extractor-args', 'youtube:player_client=web',
      '-f', 'bv*+ba/b',
      '--merge-output-format', 'mp4',
      '--newline',
      url,
      '-o', outputPath
    ];

    console.log('[yt-dlp] Executando:', args.join(' '));

    const ytdlp = spawn('yt-dlp', args);

    ytdlp.stdout.on('data', (data) => {
      const line = data.toString();
      process.stdout.write(line);

      // Progresso (%)
      const match = line.match(/(\d{1,3}\.\d)%/);
      if (match && onProgress) {
        onProgress(parseFloat(match[1]));
      }
    });

    ytdlp.stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });

    ytdlp.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error('yt-dlp finalizou com erro'));
      }

      if (!fs.existsSync(outputPath)) {
        return reject(new Error('Arquivo final não existe'));
      }

      const stats = fs.statSync(outputPath);
      if (!stats || stats.size === 0) {
        return reject(new Error('Arquivo final está vazio'));
      }

      resolve(outputPath);
    });
  });
}

/**
 * ✅ FUNÇÃO QUE ESTAVA FALTANDO
 * Verifica se o vídeo já foi baixado
 */
export function isVideoDownloaded(videoPath) {
  try {
    if (!fs.existsSync(videoPath)) return false;
    const stats = fs.statSync(videoPath);
    return stats.size > 0;
  } catch {
    return false;
  }
}
