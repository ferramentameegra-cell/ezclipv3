import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

/**
 * GET /api/download/progress?url=
 * Faz download do YouTube com progresso via SSE
 * Salva SEMPRE em: /tmp/uploads/{videoId}/source.mp4
 */
export const downloadWithProgress = async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL do YouTube é obrigatória' });
  }

  const videoId = uuidv4();
  const baseDir = `/tmp/uploads/${videoId}`;
  const outputPath = `${baseDir}/source.mp4`;

  fs.mkdirSync(baseDir, { recursive: true });

  // Headers SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  console.log('[DOWNLOAD] Iniciando:', url);
  console.log('[DOWNLOAD] Salvando em:', outputPath);

  const yt = spawn('yt-dlp', [
    '-f',
    'mp4/best',
    '--newline',
    '-o',
    outputPath,
    url
  ]);

  yt.stdout.on('data', data => {
    const text = data.toString();

    // Exemplo: [download]  42.3% of 12.34MiB at 1.23MiB/s ETA 00:12
    const match = text.match(/(\d+(\.\d+)?)%/);
    if (match) {
      const percent = parseFloat(match[1]);
      res.write(
        `data: ${JSON.stringify({
          progress: percent,
          message: 'Baixando vídeo...'
        })}\n\n`
      );
    }
  });

  yt.stderr.on('data', data => {
    console.warn('[yt-dlp]', data.toString());
  });

  yt.on('close', code => {
    if (code !== 0 || !fs.existsSync(outputPath)) {
      console.error('[DOWNLOAD] Falhou');
      res.write(
        `data: ${JSON.stringify({
          error: 'Erro ao baixar vídeo'
        })}\n\n`
      );
      return res.end();
    }

    console.log('[DOWNLOAD] Concluído com sucesso');

    res.write(
      `data: ${JSON.stringify({
        completed: true,
        videoId,
        videoPath: outputPath,
        playableUrl: `/api/videos/${videoId}`
      })}\n\n`
    );

    res.end();
  });
};
