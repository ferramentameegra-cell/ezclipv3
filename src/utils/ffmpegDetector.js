/**
 * DETECTOR E CONFIGURADOR DE FFMPEG
 * Detecta o ffmpeg disponível no sistema e configura o fluent-ffmpeg
 */

import { spawn } from 'child_process';
import ffmpegLib from 'fluent-ffmpeg';
import { platform } from 'os';

// Cache do caminho do ffmpeg detectado
let ffmpegPathCache = null;
let ffprobePathCache = null;

/**
 * Detecta o caminho do executável ffmpeg no sistema
 */
export async function detectFfmpegPath() {
  // Se já foi detectado, usar cache
  if (ffmpegPathCache) {
    return ffmpegPathCache;
  }

  const isWindows = platform() === 'win32';
  const executable = isWindows ? 'ffmpeg.exe' : 'ffmpeg';
  
  // Possíveis caminhos para verificar
  const possiblePaths = [
    // No PATH
    executable,
    // macOS Homebrew
    '/opt/homebrew/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    // Linux comum
    '/usr/bin/ffmpeg',
    '/bin/ffmpeg',
    // Windows comum
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe'
  ];

  for (const testPath of possiblePaths) {
    const available = await new Promise((resolve) => {
      try {
        const proc = spawn(testPath, ['-version'], { stdio: 'pipe' });
        let output = '';
        
        proc.stdout.on('data', (data) => { 
          output += data.toString(); 
        });
        
        proc.stderr.on('data', (data) => { 
          output += data.toString(); 
        });
        
        proc.on('close', (code) => {
          // ffmpeg -version retorna 0 e output contém "ffmpeg version"
          resolve(code === 0 && output.includes('ffmpeg version'));
        });
        
        proc.on('error', () => resolve(false));
        
        setTimeout(() => {
          if (!proc.killed) proc.kill();
          resolve(false);
        }, 3000);
      } catch {
        resolve(false);
      }
    });

    if (available) {
      ffmpegPathCache = testPath;
      console.log(`[FFMPEG] ✅ ffmpeg detectado: ${ffmpegPathCache}`);
      return ffmpegPathCache;
    }
  }

  console.error('[FFMPEG] ❌ ffmpeg não encontrado');
  console.error('[FFMPEG] Por favor, instale o ffmpeg:');
  console.error('[FFMPEG]   - macOS: brew install ffmpeg');
  console.error('[FFMPEG]   - Linux: apt-get install ffmpeg (ou yum install ffmpeg)');
  console.error('[FFMPEG]   - Windows: baixe de https://ffmpeg.org/download.html');
  
  ffmpegPathCache = executable; // Fallback para tentar no PATH mesmo assim
  return ffmpegPathCache;
}

/**
 * Detecta o caminho do executável ffprobe no sistema
 */
export async function detectFfprobePath() {
  // Se já foi detectado, usar cache
  if (ffprobePathCache) {
    return ffprobePathCache;
  }

  const isWindows = platform() === 'win32';
  const executable = isWindows ? 'ffprobe.exe' : 'ffprobe';
  
  // Possíveis caminhos para verificar
  const possiblePaths = [
    // No PATH
    executable,
    // macOS Homebrew
    '/opt/homebrew/bin/ffprobe',
    '/usr/local/bin/ffprobe',
    // Linux comum
    '/usr/bin/ffprobe',
    '/bin/ffprobe',
    // Windows comum
    'C:\\ffmpeg\\bin\\ffprobe.exe',
    'C:\\Program Files\\ffmpeg\\bin\\ffprobe.exe'
  ];

  for (const testPath of possiblePaths) {
    const available = await new Promise((resolve) => {
      try {
        const proc = spawn(testPath, ['-version'], { stdio: 'pipe' });
        let output = '';
        
        proc.stdout.on('data', (data) => { 
          output += data.toString(); 
        });
        
        proc.stderr.on('data', (data) => { 
          output += data.toString(); 
        });
        
        proc.on('close', (code) => {
          resolve(code === 0 && output.includes('ffprobe version'));
        });
        
        proc.on('error', () => resolve(false));
        
        setTimeout(() => {
          if (!proc.killed) proc.kill();
          resolve(false);
        }, 3000);
      } catch {
        resolve(false);
      }
    });

    if (available) {
      ffprobePathCache = testPath;
      console.log(`[FFPROBE] ✅ ffprobe detectado: ${ffprobePathCache}`);
      return ffprobePathCache;
    }
  }

  console.error('[FFPROBE] ❌ ffprobe não encontrado');
  
  ffprobePathCache = executable; // Fallback para tentar no PATH mesmo assim
  return ffprobePathCache;
}

/**
 * Configura o fluent-ffmpeg com os caminhos detectados
 */
export async function configureFfmpeg() {
  try {
    const ffmpegPath = await detectFfmpegPath();
    const ffprobePath = await detectFfprobePath();
    
    // Configurar fluent-ffmpeg apenas se encontrou um caminho válido
    // Se não encontrou, o fluent-ffmpeg tentará usar o PATH do sistema
    if (ffmpegPath && !ffmpegPath.includes('.exe') && !ffmpegPath.includes('\\')) {
      // Se é um caminho absoluto, configurar explicitamente
      if (ffmpegPath.startsWith('/') || ffmpegPath.includes(':')) {
        ffmpegLib.setFfmpegPath(ffmpegPath);
        console.log(`[FFMPEG] Configurado para usar: ${ffmpegPath}`);
      }
    } else if (ffmpegPath && (ffmpegPath.includes('.exe') || ffmpegPath.includes('\\'))) {
      // Windows
      ffmpegLib.setFfmpegPath(ffmpegPath);
      console.log(`[FFMPEG] Configurado para usar: ${ffmpegPath}`);
    }
    
    if (ffprobePath && !ffprobePath.includes('.exe') && !ffprobePath.includes('\\')) {
      if (ffprobePath.startsWith('/') || ffprobePath.includes(':')) {
        ffmpegLib.setFfprobePath(ffprobePath);
        console.log(`[FFPROBE] Configurado para usar: ${ffprobePath}`);
      }
    } else if (ffprobePath && (ffprobePath.includes('.exe') || ffprobePath.includes('\\'))) {
      // Windows
      ffmpegLib.setFfprobePath(ffprobePath);
      console.log(`[FFPROBE] Configurado para usar: ${ffprobePath}`);
    }
    
    // Testar se o ffmpeg está realmente funcionando
    const testResult = await testFfmpeg();
    if (!testResult) {
      console.warn('[FFMPEG] ⚠️ ffmpeg não está funcionando corretamente. Algumas funcionalidades podem não funcionar.');
      console.warn('[FFMPEG] Por favor, instale o ffmpeg para usar todas as funcionalidades.');
      return false; // Não lançar erro, apenas avisar
    }
    
    console.log('[FFMPEG] ✅ ffmpeg está funcionando corretamente');
    return true;
  } catch (error) {
    console.warn('[FFMPEG] ⚠️ Aviso ao configurar ffmpeg:', error.message);
    return false; // Não lançar erro, apenas avisar
  }
}

/**
 * Testa se o ffmpeg está funcionando
 */
async function testFfmpeg() {
  return new Promise((resolve) => {
    try {
      const testPath = ffmpegPathCache || 'ffmpeg';
      const proc = spawn(testPath, ['-version'], { stdio: 'pipe' });
      
      let hasOutput = false;
      proc.stdout.on('data', () => { hasOutput = true; });
      proc.stderr.on('data', () => { hasOutput = true; });
      
      proc.on('close', (code) => {
        resolve(code === 0 && hasOutput);
      });
      
      proc.on('error', () => resolve(false));
      
      setTimeout(() => {
        if (!proc.killed) proc.kill();
        resolve(false);
      }, 3000);
    } catch {
      resolve(false);
    }
  });
}
