import ytdl from '@distube/ytdl-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Baixa vídeo do YouTube para processamento local
 * @param {string} videoId - ID do vídeo do YouTube
 * @param {string} outputPath - Caminho onde salvar o vídeo
 * @returns {Promise<string>} - Caminho do arquivo baixado
 */
export async function downloadYouTubeVideo(videoId, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      // Garantir que o diretório existe
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Baixar vídeo com melhor qualidade disponível
      const videoStream = ytdl(videoId, {
        quality: 'highestvideo',
        filter: 'videoandaudio',
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          }
        }
      });

      const writeStream = fs.createWriteStream(outputPath);

      videoStream.pipe(writeStream);

      videoStream.on('error', (error) => {
        reject(new Error(`Erro ao baixar vídeo: ${error.message}`));
      });

      writeStream.on('error', (error) => {
        reject(new Error(`Erro ao salvar vídeo: ${error.message}`));
      });

      writeStream.on('finish', () => {
        if (fs.existsSync(outputPath)) {
          resolve(outputPath);
        } else {
          reject(new Error('Arquivo não foi salvo corretamente'));
        }
      });

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Verifica se o vídeo já foi baixado
 * @param {string} filePath - Caminho do arquivo
 * @returns {boolean}
 */
export function isVideoDownloaded(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
}

