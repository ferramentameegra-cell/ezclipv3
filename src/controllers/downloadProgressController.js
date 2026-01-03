import fs from 'fs';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

/**
 * GET /api/download/progress?url=
 * Download com progresso via SSE
 * Salva em: /tmp/uploads/{videoId}/source.mp4
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

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  console.log('[DOWNLOAD] Iniciando:', url);
  console.log('[DOWNLOAD] Salvando em:', outputPath);

  const yt = spawn('yt-dlp', [
    '--js-runtimes', 'node:/usr/bin/node',
    '--extractor-args', 'youtube:player_client=web',
    '-f', 'bv*+ba/b',
    '--merge-output-format', 'mp4',
    '--newline',
    '-o',
    outputPath,
    url
  ]);

  yt.stdout.on('data', (data) => {
    const text = data.toString();
    const match = text.match(/(\d+(\.\d+)?)%/);

    if (match) {
      const percent = parseFloat(match[1]);
      res.write(`data: ${JSON.stringify({
        progress: percent,
        status: 'downloading'
      })}\n\n`);
    }
  });

  yt.stderr.on('data', (data) => {
    console.warn('[yt-dlp]', data.toString());
  });

  yt.on('close', (code) => {
    if (code !== 0 || !fs.existsSync(outputPath)) {
      res.write(`data: ${JSON.stringify({
        status: 'error',
        error: 'Erro ao baixar vídeo'
      })}\n\n`);
      return res.end();
    }

    res.write(`data: ${JSON.stringify({
      status: 'ready',
      completed: true,
      videoId,
      videoPath: outputPath,
      playableUrl: `/api/videos/play/${videoId}`
    })}\n\n`);

    res.end();
  });
};
