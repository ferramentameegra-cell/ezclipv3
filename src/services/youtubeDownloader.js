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

      // Remover arquivo existente se houver (para garantir download limpo)
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }

      console.log(`[DOWNLOAD] Iniciando download: ${videoId} -> ${outputPath}`);

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
      let bytesDownloaded = 0;
      let lastProgress = 0;

      // Monitorar progresso do download
      videoStream.on('info', (info) => {
        console.log(`[DOWNLOAD] Informações do vídeo: ${info.videoDetails.title}`);
      });

      videoStream.on('progress', (chunkLength, downloaded, total) => {
        bytesDownloaded = downloaded;
        const percent = total > 0 ? ((downloaded / total) * 100).toFixed(1) : '?';
        if (percent !== lastProgress) {
          console.log(`[DOWNLOAD] Progresso: ${percent}% (${(downloaded / 1024 / 1024).toFixed(2)} MB)`);
          lastProgress = percent;
        }
      });

      videoStream.pipe(writeStream);

      videoStream.on('error', (error) => {
        console.error('[DOWNLOAD] Erro no stream:', error);
        writeStream.destroy();
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath).catch(() => {});
        }
        reject(new Error(`Erro ao baixar vídeo: ${error.message}`));
      });

      writeStream.on('error', (error) => {
        console.error('[DOWNLOAD] Erro ao escrever arquivo:', error);
        videoStream.destroy();
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath).catch(() => {});
        }
        reject(new Error(`Erro ao salvar vídeo: ${error.message}`));
      });

      writeStream.on('finish', () => {
        // VALIDAR: Arquivo deve existir e ter tamanho > 0
        setTimeout(() => {
          if (fs.existsSync(outputPath)) {
            const stats = fs.statSync(outputPath);
            if (stats.size > 0) {
              console.log(`[DOWNLOAD] Download concluído: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
              resolve(outputPath);
            } else {
              reject(new Error('Arquivo baixado está vazio'));
            }
          } else {
            reject(new Error('Arquivo não foi salvo corretamente'));
          }
        }, 500); // Pequeno delay para garantir que o sistema de arquivos atualizou
      });

    } catch (error) {
      console.error('[DOWNLOAD] Erro geral:', error);
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

