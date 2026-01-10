import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export async function downloadYouTubeVideoWithProgress(
  videoId,
  outputPath,
  onProgress
) {
  return new Promise((resolve, reject) => {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    const args = [
      '-f', 'bv*[ext=mp4]+ba[ext=m4a]/mp4',
      '--merge-output-format', 'mp4',
      '--no-playlist',
      '--newline',
      '--progress',
      '-o', outputPath,
      videoUrl
    ];

    const proc = spawn('yt-dlp', args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let lastPercent = 0;

    proc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        const match = line.match(/\[download\]\s+(\d+\.?\d*)%/);
        if (match) {
          const percent = Math.min(100, parseFloat(match[1]));
          if (percent > lastPercent) {
            lastPercent = percent;
            if (onProgress) onProgress(percent, null, null, 'downloading');
          }
        }
      }
    });

    proc.stderr.on('data', () => {});

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp saiu com código ${code}`));
        return;
      }

      if (!fs.existsSync(outputPath)) {
        reject(new Error('Arquivo não criado'));
        return;
      }

      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        fs.unlinkSync(outputPath);
        reject(new Error('Arquivo vazio'));
        return;
      }

      if (onProgress) onProgress(100, stats.size, stats.size, 'finished');
      resolve(outputPath);
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}
