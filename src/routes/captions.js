/**
 * ROTAS DE LEGENDAS
 */

import express from 'express';
import {
  generateCaptionsForVideo,
  updateCaptions,
  getCaptions,
  renderVideoWithCaptionsEndpoint,
  downloadRenderedVideo
} from '../controllers/captionController.js';
import { getPresets } from '../models/captionPresets.js';

const router = express.Router();

// Gerar legendas automaticamente
router.post('/generate', generateCaptionsForVideo);

// Atualizar legendas editadas
router.post('/update', updateCaptions);

// Obter legendas de um vídeo
router.get('/:videoId', getCaptions);

// Renderizar vídeo com legendas
router.post('/render', renderVideoWithCaptionsEndpoint);

// Download do vídeo renderizado
router.get('/download/:videoId', downloadRenderedVideo);

// Obter presets disponíveis
router.get('/presets/list', (req, res) => {
  try {
    const presets = getPresets();
    return res.json({
      success: true,
      ...presets
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
