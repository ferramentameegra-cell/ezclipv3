import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define o diretório base dependendo do ambiente
const BASE_DIR = process.env.NODE_ENV === 'production' 
  ? '/tmp' 
  : path.join(__dirname, '../../');

export const STORAGE_CONFIG = {
  // Diretórios principais
  UPLOADS_DIR: path.join(BASE_DIR, 'uploads'),
  SERIES_DIR: path.join(BASE_DIR, 'uploads', 'series'),
  RETENTION_DIR: path.join(BASE_DIR, 'retention-library'),
  CAPTIONS_DIR: path.join(BASE_DIR, 'captions'),

  // Funções Helper para obter caminhos dinâmicos
  getVideoPath: (videoId) => path.join(BASE_DIR, 'uploads', `${videoId}.mp4`),
  getTrimmedVideoPath: (videoId) => path.join(BASE_DIR, 'uploads', `${videoId}_trimmed.mp4`),
  getDownloadedVideoPath: (videoId) => path.join(BASE_DIR, 'uploads', `${videoId}_downloaded.mp4`),
  getSeriesPath: (seriesId) => path.join(BASE_DIR, 'uploads', 'series', seriesId),
  getClipPath: (seriesId, clipIndex) => path.join(BASE_DIR, 'uploads', 'series', seriesId, `clip_${String(clipIndex).padStart(3, '0')}.mp4`),
  getFinalClipPath: (seriesId, clipIndex) => path.join(BASE_DIR, 'uploads', 'series', seriesId, `clip_${String(clipIndex).padStart(3, '0')}_final.mp4`),
};

// Garante que os diretórios existam ao iniciar
Object.values(STORAGE_CONFIG).forEach(dir => {
  if (typeof dir === 'string' && !dir.includes('(') && !fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`[STORAGE_CONFIG] ✅ Diretório criado: ${dir}`);
    } catch (error) {
      console.warn(`[STORAGE_CONFIG] ⚠️ Erro ao criar diretório ${dir}: ${error.message}`);
    }
  }
});

console.log(`[STORAGE_CONFIG] Configuração inicializada. BASE_DIR: ${BASE_DIR}`);
console.log(`[STORAGE_CONFIG] UPLOADS_DIR: ${STORAGE_CONFIG.UPLOADS_DIR}`);
console.log(`[STORAGE_CONFIG] SERIES_DIR: ${STORAGE_CONFIG.SERIES_DIR}`);
console.log(`[STORAGE_CONFIG] RETENTION_DIR: ${STORAGE_CONFIG.RETENTION_DIR}`);
