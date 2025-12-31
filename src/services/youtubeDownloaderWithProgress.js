import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Download de vídeo do YouTube com progresso em tempo real usando yt-dlp
 * @param {string} videoUrl - URL do vídeo do YouTube
 * @param {string} outputPath - Caminho onde salvar o vídeo
 * @param {Function} onProgress - Callback para progresso (percent: number, downloaded: number, total: number, status: string)
 * @returns {Promise<string>} - Caminho do arquivo baixado
 */
export async function downloadYouTubeVideoWithProgress(videoUrl, outputPath, onProgress) {
  return new Promise((resolve, reject) => {
    // Garantir diretório existe
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Remover arquivo existente se houver
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    // Comando yt-dlp com --newline e --progress para output parseável
    const args = [
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--no-playlist',
      '--newline',
      '--progress',
      '--console-title',
      '-o', outputPath,
      videoUrl
    ];

    console.log(`[DOWNLOAD-PROGRESS] Executando: yt-dlp ${args.join(' ')}`);

    const process = spawn('yt-dlp', args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let lastPercent = 0;
    let downloadedBytes = 0;
    let totalBytes = 0;
    let errorOutput = '';
    let isDownloading = false;

    process.stdout.on('data', (data) => {
      const output = data.toString();
      const lines = output.split('\n').filter(line => line.trim());

      lines.forEach(line => {
        // Parsear progresso: "[download]  45.2% of 123.45MiB at 1.23MiB/s ETA 00:42"
        // ou: "[download] 100% of 123.45MiB in 00:42"
        const progressMatch = line.match(/\[download\]\s+(\d+\.?\d*)%\s+of\s+([\d.]+)(\w+)/i);
        if (progressMatch) {
          isDownloading = true;
          const percent = Math.min(100, Math.max(0, parseFloat(progressMatch[1])));
          const size = parseFloat(progressMatch[2]);
          const unit = progressMatch[3].toUpperCase();

          // Converter para bytes
          let sizeBytes = size;
          if (unit === 'KB') sizeBytes = size * 1024;
          else if (unit === 'MB') sizeBytes = size * 1024 * 1024;
          else if (unit === 'GB') sizeBytes = size * 1024 * 1024 * 1024;

          totalBytes = sizeBytes / (percent / 100);
          downloadedBytes = sizeBytes;

          if (percent > lastPercent) {
            lastPercent = percent;
            if (onProgress) {
              onProgress(percent, downloadedBytes, totalBytes, 'downloading');
            }
          }
        }

        // Parsear conclusão: "[download] 100% of 123.45MiB in 00:42"
        const completeMatch = line.match(/\[download\]\s+100%\s+of\s+([\d.]+)(\w+)/i);
        if (completeMatch && isDownloading) {
          const size = parseFloat(completeMatch[1]);
          const unit = completeMatch[2].toUpperCase();
          let sizeBytes = size;
          if (unit === 'KB') sizeBytes = size * 1024;
          else if (unit === 'MB') sizeBytes = size * 1024 * 1024;
          else if (unit === 'GB') sizeBytes = size * 1024 * 1024 * 1024;

          totalBytes = sizeBytes;
          downloadedBytes = sizeBytes;

          if (onProgress) {
            onProgress(100, downloadedBytes, totalBytes, 'finished');
          }
        }

        // Parsear erro comum
        if (line.includes('ERROR') || line.includes('error')) {
          errorOutput += line + '\n';
        }
      });
    });

    process.stderr.on('data', (data) => {
      const output = data.toString();
      errorOutput += output;

      // yt-dlp às vezes envia progresso no stderr também
      const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%\s+of\s+([\d.]+)(\w+)/i);
      if (progressMatch) {
        isDownloading = true;
        const percent = Math.min(100, Math.max(0, parseFloat(progressMatch[1])));
        const size = parseFloat(progressMatch[2]);
        const unit = progressMatch[3].toUpperCase();

        let sizeBytes = size;
        if (unit === 'KB') sizeBytes = size * 1024;
        else if (unit === 'MB') sizeBytes = size * 1024 * 1024;
        else if (unit === 'GB') sizeBytes = size * 1024 * 1024 * 1024;

        totalBytes = sizeBytes / (percent / 100);
        downloadedBytes = sizeBytes;

        if (percent > lastPercent) {
          lastPercent = percent;
          if (onProgress) {
            onProgress(percent, downloadedBytes, totalBytes, 'downloading');
          }
        }
      }
    });

    process.on('close', (code) => {
      if (code !== 0) {
        console.error(`[DOWNLOAD-PROGRESS] yt-dlp falhou com código ${code}`);
        console.error(`[DOWNLOAD-PROGRESS] Erro: ${errorOutput}`);
        
        // Verificar se arquivo foi criado mesmo com código de erro
        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          if (stats.size > 0) {
            console.log(`[DOWNLOAD-PROGRESS] Arquivo criado mesmo com erro, usando...`);
            if (onProgress) {
              onProgress(100, stats.size, stats.size, 'finished');
            }
            resolve(outputPath);
            return;
          }
        }

        reject(new Error(`yt-dlp falhou: ${errorOutput || `Código de saída ${code}`}`));
        return;
      }

      // Validar que o arquivo foi criado
      if (!fs.existsSync(outputPath)) {
        // yt-dlp pode adicionar extensão ou mudar nome
        const dir = path.dirname(outputPath);
        const baseName = path.basename(outputPath, path.extname(outputPath));
        const files = fs.readdirSync(dir);
        const matchingFile = files.find(f => f.startsWith(baseName) && f.endsWith('.mp4'));

        if (matchingFile) {
          const foundPath = path.join(dir, matchingFile);
          if (foundPath !== outputPath) {
            fs.renameSync(foundPath, outputPath);
          }
        } else {
          reject(new Error('Arquivo não foi criado após download'));
          return;
        }
      }

      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        fs.unlinkSync(outputPath);
        reject(new Error('Arquivo baixado está vazio'));
        return;
      }

      // Garantir 100% no final
      if (onProgress && lastPercent < 100) {
        onProgress(100, stats.size, stats.size, 'finished');
      }

      console.log(`[DOWNLOAD-PROGRESS] Download concluído: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      resolve(outputPath);
    });

    process.on('error', (error) => {
      console.error(`[DOWNLOAD-PROGRESS] Erro ao executar yt-dlp: ${error.message}`);
      
      // Verificar se yt-dlp está instalado
      if (error.code === 'ENOENT') {
        reject(new Error('yt-dlp não encontrado. Por favor, instale yt-dlp no sistema.'));
      } else {
        reject(new Error(`Erro ao executar yt-dlp: ${error.message}`));
      }
    });
  });
}
