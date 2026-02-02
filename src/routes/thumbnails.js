/**
 * Rotas para Gerador de Thumbnails 9x16
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { STORAGE_CONFIG } from '../config/storage.config.js';
import {
  extractFrames,
  getFramePath,
  generateThumbnail,
  generateVariations
} from '../services/thumbnailService.js';

const router = express.Router();

function resolveVideoPath(videoId) {
  if (!videoId || typeof videoId !== 'string') return null;
  const trimmed = STORAGE_CONFIG.getTrimmedVideoPath(videoId);
  const downloaded = STORAGE_CONFIG.getDownloadedVideoPath(videoId);
  if (fs.existsSync(trimmed) && fs.statSync(trimmed).size > 0) return trimmed;
  if (fs.existsSync(downloaded) && fs.statSync(downloaded).size > 0) return downloaded;
  const plain = STORAGE_CONFIG.getVideoPath(videoId);
  if (fs.existsSync(plain) && fs.statSync(plain).size > 0) return plain;
  return null;
}

/**
 * POST /api/thumbnails/extract-frames
 * Body: { videoId, maxFrames?: 8 }
 * Retorna: { frameToken, count }
 */
router.post('/extract-frames', async (req, res) => {
  try {
    const { videoId, maxFrames = 8 } = req.body || {};
    const videoPath = resolveVideoPath(videoId);
    if (!videoPath) {
      return res.status(404).json({ error: 'Vídeo não encontrado. Processe o vídeo primeiro.' });
    }
    const result = await extractFrames(videoPath, { maxFrames: Math.min(Number(maxFrames) || 8, 10) });
    res.json(result);
  } catch (err) {
    console.error('[THUMBNAILS] extract-frames:', err.message);
    res.status(500).json({ error: err.message || 'Erro ao extrair frames' });
  }
});

/**
 * GET /api/thumbnails/frame/:frameToken/:index
 * Serve a imagem do frame (para preview).
 */
router.get('/frame/:frameToken/:index', (req, res) => {
  const { frameToken, index } = req.params;
  const i = parseInt(index, 10);
  if (!frameToken || isNaN(i) || i < 0 || i > 20) {
    return res.status(400).send('Invalid token or index');
  }
  const framePath = getFramePath(frameToken, i);
  if (!framePath || !fs.existsSync(framePath)) {
    return res.status(404).send('Frame not found');
  }
  res.type('png').sendFile(path.resolve(framePath));
});

/**
 * POST /api/thumbnails/generate
 * Body: { videoId, frameTimeSec, title, template, contrast, tarjaSuperior, tarjaInferior, textColor, strokeColor, fontSize, titlePosition }
 * titlePosition: 'top' | 'center' | 'bottom'. fontSize: número ou preset (xs, small, medium, large, xl)
 * Retorna: imagem JPEG (binary)
 */
router.post('/generate', async (req, res) => {
  try {
    const { videoId, frameTimeSec = 1, title, template, contrast, tarjaSuperiorSize, tarjaInferiorSize, tarjaSuperiorColor, tarjaInferiorColor, textColor, strokeColor, fontSize, titlePosition } = req.body || {};
    const videoPath = resolveVideoPath(videoId);
    if (!videoPath) {
      return res.status(404).json({ error: 'Vídeo não encontrado' });
    }
    const buffer = await generateThumbnail({
      videoPath,
      frameTimeSec: Number(frameTimeSec) || 1,
      title: title ? String(title).slice(0, 500) : '',
      template: template || 'generico',
      contrast: Math.min(1, Math.max(0, Number(contrast) || 0)),
      tarjaSuperiorSize: tarjaSuperiorSize != null ? Number(tarjaSuperiorSize) : null,
      tarjaInferiorSize: tarjaInferiorSize != null ? Number(tarjaInferiorSize) : null,
      tarjaSuperiorColor: tarjaSuperiorColor ? String(tarjaSuperiorColor).trim() : null,
      tarjaInferiorColor: tarjaInferiorColor ? String(tarjaInferiorColor).trim() : null,
      textColor: textColor ? String(textColor).trim() : undefined,
      strokeColor: strokeColor ? String(strokeColor).trim() : undefined,
      fontSize: fontSize != null ? fontSize : undefined,
      titlePosition: titlePosition ? String(titlePosition).trim() : undefined
    });
    res.type('image/jpeg').send(buffer);
  } catch (err) {
    console.error('[THUMBNAILS] generate:', err.message);
    res.status(500).json({ error: err.message || 'Erro ao gerar thumbnail' });
  }
});

/**
 * POST /api/thumbnails/variations
 * Body: { videoId, frameTimeSec, title, template, tarjaSuperior, tarjaInferior, fontSize, titlePosition }
 * Retorna: { variations: [ base64, base64, base64 ] }
 */
router.post('/variations', async (req, res) => {
  try {
    const { videoId, frameTimeSec = 1, title, template, tarjaSuperiorSize, tarjaInferiorSize, tarjaSuperiorColor, tarjaInferiorColor, fontSize, titlePosition } = req.body || {};
    const videoPath = resolveVideoPath(videoId);
    if (!videoPath) {
      return res.status(404).json({ error: 'Vídeo não encontrado' });
    }
    const buffers = await generateVariations({
      videoPath,
      frameTimeSec: Number(frameTimeSec) || 1,
      title: title ? String(title).slice(0, 500) : '',
      template: template || 'generico',
      tarjaSuperiorSize: tarjaSuperiorSize != null ? Number(tarjaSuperiorSize) : null,
      tarjaInferiorSize: tarjaInferiorSize != null ? Number(tarjaInferiorSize) : null,
      tarjaSuperiorColor: tarjaSuperiorColor ? String(tarjaSuperiorColor).trim() : null,
      tarjaInferiorColor: tarjaInferiorColor ? String(tarjaInferiorColor).trim() : null,
      fontSize: fontSize != null ? fontSize : undefined,
      titlePosition: titlePosition ? String(titlePosition).trim() : undefined
    });
    const variations = buffers.map(b => b.toString('base64'));
    res.json({ variations });
  } catch (err) {
    console.error('[THUMBNAILS] variations:', err.message);
    res.status(500).json({ error: err.message || 'Erro ao gerar variações' });
  }
});

export default router;
