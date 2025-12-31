import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Download de vídeo do YouTube com progresso em tempo real
 * Usa yt-dlp com --newline para obter progresso
 * @param {string} videoUrl - URL do vídeo do YouTube
 * @param {string} outputPath - Caminho onde salvar o vídeo
 * @param {Function} onProgress - Callback para progresso (percent: number)
 * @returns {Promise<string>} - Caminho do arquivo baixado
 */
export async function downloadYouTubeVideoWithProgress(videoUrl, outputPath, onProgress) {
  return new Promise((resolve, reject) => {
    // Verificar se yt-dlp está disponível
    const ytdlpCommand = 'yt-dlp';
    
    // Garantir diretório existe
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Remover arquivo existente se houver
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    // Comando yt-dlp com --newline para progresso
    const args = [
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--no-playlist',
      '--newline',
      '--progress',
      '-o', outputPath,
      videoUrl
    ];

    console.log(`[DOWNLOAD-PROGRESS] Iniciando download: ${videoUrl} -> ${outputPath}`);

    const process = spawn(ytdlpCommand, args);

    let lastPercent = 0;
    let errorOutput = '';

    process.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[YT-DLP] ${output.trim()}`);

      // Parsear progresso: "[download]  45.2% of 123.45MiB at 1.23MiB/s ETA 00:42"
      const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/);
      if (progressMatch) {
        const percent = Math.min(100, Math.max(0, parseFloat(progressMatch[1])));
        if (percent > lastPercent) {
          lastPercent = percent;
          if (onProgress) {
            onProgress(percent);
          }
        }
      }
    });

    process.stderr.on('data', (data) => {
      const output = data.toString();
      errorOutput += output;
      console.warn(`[YT-DLP] stderr: ${output.trim()}`);

      // Tentar parsear progresso também do stderr (algumas versões do yt-dlp)
      const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/);
      if (progressMatch) {
        const percent = Math.min(100, Math.max(0, parseFloat(progressMatch[1])));
        if (percent > lastPercent) {
          lastPercent = percent;
          if (onProgress) {
            onProgress(percent);
          }
        }
      }
    });

    process.on('close', (code) => {
      if (code !== 0) {
        console.error(`[DOWNLOAD-PROGRESS] yt-dlp falhou com código ${code}`);
        console.error(`[DOWNLOAD-PROGRESS] Erro: ${errorOutput}`);
        
        // Tentar fallback para ytdl-core se yt-dlp falhar
        reject(new Error(`yt-dlp falhou: ${errorOutput || 'Erro desconhecido'}`));
        return;
      }

      // Validar que o arquivo foi criado
      if (!fs.existsSync(outputPath)) {
        // yt-dlp pode adicionar extensão
        const possiblePaths = [
          outputPath,
          outputPath.replace('.mp4', ''),
          outputPath + '.mp4'
        ];

        let found = false;
        for (const possiblePath of possiblePaths) {
          if (fs.existsSync(possiblePath)) {
            fs.renameSync(possiblePath, outputPath);
            found = true;
            break;
          }
        }

        if (!found) {
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
        onProgress(100);
      }

      console.log(`[DOWNLOAD-PROGRESS] Download concluído: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      resolve(outputPath);
    });

    process.on('error', (error) => {
      console.error(`[DOWNLOAD-PROGRESS] Erro ao executar yt-dlp: ${error.message}`);
      reject(new Error(`yt-dlp não disponível: ${error.message}`));
    });
  });
}

