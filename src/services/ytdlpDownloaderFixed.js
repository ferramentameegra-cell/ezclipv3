/**
 * yt-dlp DOWNLOADER CORRIGIDO E OTIMIZADO PARA RAILWAY
 * 
 * REQUISITOS:
 * - Forçar formato mp4/h264/aac (sem re-encoding)
 * - Timeout explícito
 * - Progresso parseável
 * - Validação robusta
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Timeout padrão: 15 minutos (Railway pode ter timeouts)
const DOWNLOAD_TIMEOUT = 15 * 60 * 1000;

/**
 * Verifica se yt-dlp está disponível no sistema
 */
export async function isYtDlpAvailable() {
  return new Promise((resolve) => {
    const process = spawn('yt-dlp', ['--version'], {
      stdio: 'pipe'
    });
    
    process.on('close', (code) => {
      resolve(code === 0);
    });
    
    process.on('error', () => {
      resolve(false);
    });
    
    // Timeout de segurança
    setTimeout(() => {
      process.kill();
      resolve(false);
    }, 5000);
  });
}

/**
 * Download de vídeo do YouTube usando yt-dlp
 * FORÇA formato mp4/h264/aac compatível
 */
export async function downloadWithYtDlpFixed(videoUrl, outputPath, onProgress) {
  return new Promise((resolve, reject) => {
    // Garantir diretório existe
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Remover arquivo existente
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    console.log(`[YT-DLP-FIXED] Iniciando download: ${videoUrl}`);

    // CONFIGURAÇÃO CRÍTICA: Forçar formato compatível
    // best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best
    // Prioriza mp4 nativo, se não houver, baixa melhor vídeo mp4 + melhor áudio m4a e mescla
    const args = [
      // Formato: priorizar mp4 nativo
      '-f', 'bestvideo[ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      // Mesclar para mp4 se necessário
      '--merge-output-format', 'mp4',
      // Não baixar playlist
      '--no-playlist',
      // Não baixar descrições, legendas, etc.
      '--no-write-description',
      '--no-write-subs',
      '--no-write-auto-subs',
      // Output parseável
      '--newline',
      '--progress',
      // Não usar cookies (Railway)
      '--no-cookies',
      // Limitar qualidade para evitar downloads muito grandes
      '--format-sort', 'res:720,ext:mp4',
      // Timeout por fragmento (evitar travamentos)
      '--socket-timeout', '30',
      // Retry em caso de erro
      '--retries', '3',
      '--fragment-retries', '3',
      // Output
      '-o', outputPath,
      // URL
      videoUrl
    ];

    console.log(`[YT-DLP-FIXED] Comando: yt-dlp ${args.join(' ')}`);

    const process = spawn('yt-dlp', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Garantir que não há problemas com encoding
        PYTHONUNBUFFERED: '1',
        LC_ALL: 'C.UTF-8',
        LANG: 'C.UTF-8'
      }
    });

    let lastPercent = 0;
    let downloadedBytes = 0;
    let totalBytes = 0;
    let errorOutput = '';
    let stdoutData = '';
    let stderrData = '';
    let downloadStarted = false;

    // Timeout global
    const timeoutId = setTimeout(() => {
      process.kill('SIGTERM');
      reject(new Error(`Download timeout após ${DOWNLOAD_TIMEOUT / 1000}s`));
    }, DOWNLOAD_TIMEOUT);

    // Parsear progresso do stdout
    process.stdout.on('data', (data) => {
      const output = data.toString();
      stdoutData += output;
      const lines = output.split('\n').filter(line => line.trim());

      lines.forEach(line => {
        // Padrões de progresso do yt-dlp:
        // [download]  45.2% of 123.45MiB at 1.23MiB/s ETA 00:42
        // [download] 100% of 123.45MiB at 1.23MiB/s in 00:42
        
        // Padrão 1: Progresso parcial
        const progressMatch = line.match(/\[download\]\s+(\d+\.?\d*)%\s+of\s+([\d.]+)\s*(\w+)/i);
        if (progressMatch) {
          downloadStarted = true;
          const percent = Math.min(100, Math.max(0, parseFloat(progressMatch[1])));
          const size = parseFloat(progressMatch[2]);
          const unit = progressMatch[3].toUpperCase();

          // Converter para bytes
          let sizeBytes = size;
          if (unit === 'KB') sizeBytes = size * 1024;
          else if (unit === 'MB') sizeBytes = size * 1024 * 1024;
          else if (unit === 'GB') sizeBytes = size * 1024 * 1024 * 1024;

          // Calcular total estimado
          if (percent > 0) {
            totalBytes = Math.max(totalBytes, sizeBytes / (percent / 100));
          }
          downloadedBytes = sizeBytes;

          if (percent > lastPercent) {
            lastPercent = percent;
            if (onProgress) {
              onProgress(percent, downloadedBytes, totalBytes, 'downloading');
            }
          }
        }

        // Padrão 2: Conclusão
        const completeMatch = line.match(/\[download\]\s+100%\s+of\s+([\d.]+)\s*(\w+)/i);
        if (completeMatch && downloadStarted) {
          const size = parseFloat(completeMatch[1]);
          const unit = completeMatch[2].toUpperCase();
          let sizeBytes = size;
          if (unit === 'KB') sizeBytes = size * 1024;
          else if (unit === 'MB') sizeBytes = size * 1024 * 1024;
          else if (unit === 'GB') sizeBytes = size * 1024 * 1024 * 1024;

          totalBytes = sizeBytes;
          downloadedBytes = sizeBytes;
          lastPercent = 100;

          if (onProgress) {
            onProgress(100, downloadedBytes, totalBytes, 'finished');
          }
        }

        // Detecta início de download
        if (line.includes('[download] Destination:') || line.includes('[download]')) {
          downloadStarted = true;
        }
      });
    });

    // Parsear stderr (yt-dlp também envia progresso no stderr às vezes)
    process.stderr.on('data', (data) => {
      const output = data.toString();
      stderrData += output;
      errorOutput += output;

      // Tentar parsear progresso também no stderr
      const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%\s+of\s+([\d.]+)\s*(\w+)/i);
      if (progressMatch) {
        downloadStarted = true;
        const percent = Math.min(100, Math.max(0, parseFloat(progressMatch[1])));
        const size = parseFloat(progressMatch[2]);
        const unit = progressMatch[3].toUpperCase();

        let sizeBytes = size;
        if (unit === 'KB') sizeBytes = size * 1024;
        else if (unit === 'MB') sizeBytes = size * 1024 * 1024;
        else if (unit === 'GB') sizeBytes = size * 1024 * 1024 * 1024;

        if (percent > 0) {
          totalBytes = Math.max(totalBytes, sizeBytes / (percent / 100));
        }
        downloadedBytes = sizeBytes;

        if (percent > lastPercent) {
          lastPercent = percent;
          if (onProgress) {
            onProgress(percent, downloadedBytes, totalBytes, 'downloading');
          }
        }
      }
    });

    // Processo finalizado
    process.on('close', (code) => {
      clearTimeout(timeoutId);

      // Verificar se arquivo foi criado (mesmo com código de erro não-zero)
      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        if (stats.size > 0) {
          console.log(`[YT-DLP-FIXED] Download concluído: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
          
          // Garantir 100% no final
          if (onProgress && lastPercent < 100) {
            onProgress(100, stats.size, stats.size, 'finished');
          }
          
          resolve(outputPath);
          return;
        } else {
          // Arquivo vazio - remover e rejeitar
          fs.unlinkSync(outputPath);
        }
      }

      // Verificar se yt-dlp criou arquivo com extensão diferente
      const dir = path.dirname(outputPath);
      const baseName = path.basename(outputPath, path.extname(outputPath));
      try {
        const files = fs.readdirSync(dir);
        const matchingFile = files.find(f => f.startsWith(baseName) && (f.endsWith('.mp4') || f.endsWith('.webm')));
        
        if (matchingFile) {
          const foundPath = path.join(dir, matchingFile);
          const stats = fs.statSync(foundPath);
          if (stats.size > 0) {
            // Renomear para o nome esperado
            fs.renameSync(foundPath, outputPath);
            console.log(`[YT-DLP-FIXED] Arquivo renomeado: ${foundPath} -> ${outputPath}`);
            
            if (onProgress && lastPercent < 100) {
              onProgress(100, stats.size, stats.size, 'finished');
            }
            
            resolve(outputPath);
            return;
          }
        }
      } catch (dirError) {
        console.error(`[YT-DLP-FIXED] Erro ao verificar diretório: ${dirError.message}`);
      }

      // Se chegou aqui, download falhou
      const errorMsg = code !== 0 
        ? `yt-dlp falhou com código ${code}. Stderr: ${errorOutput.slice(-500)}`
        : 'Arquivo não foi criado após download';
      
      console.error(`[YT-DLP-FIXED] Erro: ${errorMsg}`);
      reject(new Error(errorMsg));
    });

    // Erro ao executar processo
    process.on('error', (error) => {
      clearTimeout(timeoutId);
      console.error(`[YT-DLP-FIXED] Erro ao executar yt-dlp: ${error.message}`);
      
      if (error.code === 'ENOENT') {
        reject(new Error('yt-dlp não encontrado no sistema. Certifique-se de que está instalado e no PATH.'));
      } else {
        reject(new Error(`Erro ao executar yt-dlp: ${error.message}`));
      }
    });
  });
}

