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
 * Tenta diferentes caminhos possíveis
 */
async function checkYtDlpAvailable() {
  const possibleCommands = [
    { cmd: 'yt-dlp', args: ['--version'] },
    { cmd: '/usr/local/bin/yt-dlp', args: ['--version'] },
    { cmd: '/usr/bin/yt-dlp', args: ['--version'] },
    { cmd: 'python3', args: ['-m', 'yt_dlp', '--version'] },
    { cmd: 'python', args: ['-m', 'yt_dlp', '--version'] }
  ];

  for (const { cmd, args } of possibleCommands) {
    const available = await new Promise((resolve) => {
      try {
        const proc = spawn(cmd, args, { stdio: 'pipe' });
        let output = '';
        
        proc.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        proc.stderr.on('data', (data) => {
          output += data.toString();
        });
        
        proc.on('close', (code) => {
          if (code === 0 || output.includes('yt-dlp')) {
            const fullCmd = args.includes('-m') ? `${cmd} -m yt_dlp` : cmd;
            console.log(`[YT-DLP] ✅ Encontrado: ${fullCmd}`);
            resolve(true);
          } else {
            resolve(false);
          }
        });
        
        proc.on('error', (error) => {
          resolve(false);
        });
        
        setTimeout(() => {
          if (!proc.killed) {
            proc.kill();
            resolve(false);
          }
        }, 3000);
      } catch (error) {
        resolve(false);
      }
    });

    if (available) {
      // Retornar comando completo para uso posterior
      if (args.includes('-m')) {
        return { available: true, command: `${cmd} -m yt_dlp` };
      } else {
        return { available: true, command: cmd };
      }
    }
  }

  console.error('[YT-DLP] ❌ Não encontrado em nenhum dos caminhos testados');
  return { available: false, command: 'yt-dlp' };
}

/**
 * Obtém metadata do vídeo usando yt-dlp CLI com JSON output
 */
// Variável global para cache do comando yt-dlp
let ytDlpCommand = 'yt-dlp';

export async function getYouTubeVideoInfo(url) {
  const videoId = validateYouTubeUrl(url);
  console.log(`[YT-DLP] Obtendo info para: ${videoId}`);

  // Verificar disponibilidade e cachear comando
  const checkResult = await checkYtDlpAvailable();
  if (!checkResult.available) {
    throw new Error('yt-dlp não está disponível no sistema. Verifique a instalação.');
  }
  ytDlpCommand = checkResult.command;

  return new Promise((resolve, reject) => {
    // Preparar comando e argumentos baseado no tipo de comando
    let executable, args;
    if (ytDlpCommand.includes('python') && ytDlpCommand.includes('-m')) {
      // Formato: "python3 -m yt_dlp"
      const parts = ytDlpCommand.split(' ');
      executable = parts[0]; // python3
      args = parts.slice(1).concat([  // ['-m', 'yt_dlp'] + outros args
        '--dump-json',
        '--no-warnings',
        '--no-playlist',
        url
      ]);
    } else {
      // Formato: "yt-dlp" (binário direto)
      executable = ytDlpCommand;
      args = [
        '--dump-json',
        '--no-warnings',
        '--no-playlist',
        url
      ];
    }

    console.log(`[YT-DLP] Executando: ${executable} ${args.join(' ')}`);
    const process = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    
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

  // Verificar disponibilidade e cachear comando se necessário
  const checkResult = await checkYtDlpAvailable();
  if (!checkResult.available) {
    throw new Error('yt-dlp não está disponível no sistema. Verifique a instalação.');
  }
  if (checkResult.command) {
    ytDlpCommand = checkResult.command;
  }

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
    // Preparar comando e argumentos baseado no tipo de comando
    let executable, args;
    const baseArgs = [
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--no-playlist',
      '--no-warnings',
      '-o', outputPath,
      url
    ];

    if (ytDlpCommand.includes('python') && ytDlpCommand.includes('-m')) {
      // Formato: "python3 -m yt_dlp"
      const parts = ytDlpCommand.split(' ');
      executable = parts[0]; // python3
      args = parts.slice(1).concat(baseArgs); // ['-m', 'yt_dlp'] + baseArgs
    } else {
      // Formato: "yt-dlp" (binário direto)
      executable = ytDlpCommand;
      args = baseArgs;
    }

    console.log(`[YT-DLP] Executando download: ${executable} ${args.join(' ')}`);
    const process = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'] });

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

