/**
 * SERVICE YOUTUBE ESTÁVEL - Usa yt-dlp CLI
 * NÃO usa bibliotecas npm, apenas yt-dlp binário do sistema
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Valida URL do YouTube e extrai video ID
 */
function validateYouTubeUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL não fornecida ou inválida');
  }

  const trimmedUrl = url.trim();
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/.*[?&]v=([^&\n?#]+)/
  ];

  for (const pattern of patterns) {
    const match = trimmedUrl.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  throw new Error('URL do YouTube inválida');
}

/**
 * Verifica se yt-dlp está disponível
 */
async function checkYtDlpAvailable() {
  return new Promise((resolve) => {
    const process = spawn('yt-dlp', ['--version'], { stdio: 'pipe' });
    process.on('close', (code) => resolve(code === 0));
    process.on('error', () => resolve(false));
    setTimeout(() => {
      process.kill();
      resolve(false);
    }, 3000);
  });
}

/**
 * Obtém metadata do vídeo usando yt-dlp CLI com JSON output
 */
export async function getYouTubeVideoInfo(url) {
  const videoId = validateYouTubeUrl(url);
  console.log(`[YT-DLP] Obtendo info para: ${videoId}`);

  // Verificar disponibilidade
  const available = await checkYtDlpAvailable();
  if (!available) {
    throw new Error('yt-dlp não está disponível no sistema. Verifique a instalação.');
  }

  return new Promise((resolve, reject) => {
    const args = [
      '--dump-json',
      '--no-warnings',
      '--no-playlist',
      url
    ];

    const process = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    
    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        console.error(`[YT-DLP] Erro (code ${code}): ${stderr}`);
        if (stderr.includes('Video unavailable')) {
          reject(new Error('Vídeo não disponível ou privado'));
        } else if (stderr.includes('Private video')) {
          reject(new Error('Vídeo privado'));
        } else {
          reject(new Error(`yt-dlp falhou: ${stderr.slice(0, 200)}`));
        }
        return;
      }

      try {
        const info = JSON.parse(stdout);
        
        const metadata = {
          videoId: info.id || videoId,
          title: info.title || 'Sem título',
          duration: Math.floor(info.duration || 0),
          thumbnail: info.thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          author: info.uploader || info.channel || 'Desconhecido',
          viewCount: info.view_count || 0,
          description: info.description || ''
        };

        console.log(`[YT-DLP] Info obtida: ${metadata.title} (${metadata.duration}s)`);
        resolve(metadata);
      } catch (parseError) {
        console.error(`[YT-DLP] Erro ao parsear JSON: ${parseError.message}`);
        reject(new Error('Resposta inválida do yt-dlp'));
      }
    });

    process.on('error', (error) => {
      console.error(`[YT-DLP] Erro ao executar: ${error.message}`);
      reject(new Error('yt-dlp não encontrado no sistema'));
    });
  });
}

/**
 * Download de vídeo usando yt-dlp CLI
 * Retorna caminho do arquivo baixado
 */
export async function downloadYouTubeVideo(url, outputPath) {
  const videoId = validateYouTubeUrl(url);
  console.log(`[YT-DLP] Download: ${videoId} -> ${outputPath}`);

  // Garantir diretório existe
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Remover arquivo existente
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }

  return new Promise((resolve, reject) => {
    const args = [
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--no-playlist',
      '--no-warnings',
      '-o', outputPath,
      url
    ];

    const process = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
      // Log progresso básico
      if (data.toString().includes('[download]')) {
        console.log(`[YT-DLP] ${data.toString().trim()}`);
      }
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
      // yt-dlp envia progresso no stderr também
      if (data.toString().includes('[download]')) {
        console.log(`[YT-DLP] ${data.toString().trim()}`);
      }
    });

    process.on('close', (code) => {
      if (code !== 0) {
        console.error(`[YT-DLP] Download falhou (code ${code}): ${stderr.slice(-500)}`);
        reject(new Error(`Download falhou: ${stderr.slice(-300)}`));
        return;
      }

      // Validar arquivo foi criado
      if (!fs.existsSync(outputPath)) {
        reject(new Error('Arquivo não foi criado após download'));
        return;
      }

      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        fs.unlinkSync(outputPath);
        reject(new Error('Arquivo baixado está vazio'));
        return;
      }

      console.log(`[YT-DLP] Download concluído: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      resolve(outputPath);
    });

    process.on('error', (error) => {
      console.error(`[YT-DLP] Erro ao executar: ${error.message}`);
      reject(new Error('yt-dlp não encontrado no sistema'));
    });
  });
}

