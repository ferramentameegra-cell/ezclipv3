import { v4 as uuidv4 } from 'uuid';
import ytdl from 'ytdl-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Armazenar informações dos vídeos processados
const videoStore = new Map();

export const uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const videoId = uuidv4();
    const videoInfo = {
      id: videoId,
      path: req.file.path,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadedAt: new Date()
    };

    videoStore.set(videoId, videoInfo);

    res.json({
      videoId,
      message: 'Vídeo enviado com sucesso',
      video: videoInfo
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const processVideo = async (req, res) => {
  try {
    const { youtubeUrl } = req.body;

    if (!youtubeUrl) {
      return res.status(400).json({ error: 'URL do YouTube não fornecida' });
    }

    if (!ytdl.validateURL(youtubeUrl)) {
      return res.status(400).json({ error: 'URL do YouTube inválida' });
    }

    const videoId = uuidv4();
    const info = await ytdl.getInfo(youtubeUrl);
    const videoPath = path.join(__dirname, '../../uploads', `${videoId}.mp4`);

    // Criar diretório se não existir
    const uploadDir = path.dirname(videoPath);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const videoInfo = {
      id: videoId,
      youtubeUrl,
      title: info.videoDetails.title,
      duration: parseInt(info.videoDetails.lengthSeconds),
      thumbnail: info.videoDetails.thumbnails[0]?.url,
      path: videoPath,
      processedAt: new Date()
    };

    videoStore.set(videoId, videoInfo);

    // Download do vídeo (em produção, fazer isso em background)
    res.json({
      videoId,
      message: 'Vídeo do YouTube processado',
      video: videoInfo
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getVideoInfo = (req, res) => {
  try {
    const { videoId } = req.params;
    const video = videoStore.get(videoId);

    if (!video) {
      return res.status(404).json({ error: 'Vídeo não encontrado' });
    }

    res.json({ video });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

