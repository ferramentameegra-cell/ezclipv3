import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export function downloadYouTubeVideo(youtubeVideoId, outputPath) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const url = `https://www.youtube.com/watch?v=${youtubeVideoId}`;

    const args = [
      '--no-playlist',
      '--extractor-args',
      'youtube:player_client=android',
      '-f',
      'bv*+ba/b',
      '--merge-output-format',
      'mp4',
      '-o',
      outputPath,
      url,
    ];

    console.log('[yt-dlp]', args.join(' '));

    const yt = spawn('yt-dlp', args);

    yt.stderr.on('data', data => {
      console.log('[yt-dlp]', data.toString());
    });

    yt.on('close', code => {
      if (code !== 0) {
        return reject(new Error(`yt-dlp exited with code ${code}`));
      }

      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
        return reject(new Error('Arquivo baixado está vazio'));
      }

      resolve(outputPath);
    });
  });
}
