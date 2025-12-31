import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

/**
 * Baixa vídeo do YouTube usando yt-dlp (mais robusto que ytdl-core)
 * @param {string} videoUrl - URL completa do vídeo do YouTube
 * @param {string} outputPath - Caminho onde salvar o vídeo
 * @returns {Promise<string>} - Caminho do arquivo baixado
 */
export async function downloadWithYtDlp(videoUrl, outputPath) {
  try {
    // Garantir que o diretório existe
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Remover arquivo existente se houver
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    console.log(`[YT-DLP] Iniciando download: ${videoUrl} -> ${outputPath}`);

    // Verificar se yt-dlp está disponível
    let ytdlpCommand = 'yt-dlp';
    
    // Tentar diferentes comandos (yt-dlp, yt-dlp.exe, python -m yt_dlp)
    try {
      await execAsync('which yt-dlp || which yt-dlp.exe || echo "not-found"');
    } catch (error) {
      // Tentar usar python -m yt_dlp como fallback
      try {
        await execAsync('python3 -m yt_dlp --version');
        ytdlpCommand = 'python3 -m yt_dlp';
      } catch (pyError) {
        throw new Error('yt-dlp não encontrado. Instale: pip install yt-dlp ou brew install yt-dlp');
      }
    }

    // Comando yt-dlp para baixar vídeo
    // -f best: melhor qualidade disponível
    // -o: output path
    // --no-playlist: apenas o vídeo, não playlist
    // --merge-output-format mp4: garantir formato MP4
    const command = `${ytdlpCommand} -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 --no-playlist -o "${outputPath}" "${videoUrl}"`;

    console.log(`[YT-DLP] Executando: ${command}`);

    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 600000 // 10 minutos timeout
    });

    if (stderr && !stderr.includes('WARNING')) {
      console.warn('[YT-DLP] Avisos:', stderr);
    }

    // Validar que o arquivo foi criado
    if (!fs.existsSync(outputPath)) {
      throw new Error('Arquivo não foi criado após download');
    }

    const stats = fs.statSync(outputPath);
    if (stats.size === 0) {
      fs.unlinkSync(outputPath);
      throw new Error('Arquivo baixado está vazio');
    }

    console.log(`[YT-DLP] Download concluído: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

    return outputPath;
  } catch (error) {
    console.error('[YT-DLP] Erro no download:', error);
    
    // Limpar arquivo corrompido se existir
    if (fs.existsSync(outputPath)) {
      try {
        fs.unlinkSync(outputPath);
      } catch (unlinkError) {
        console.error('[YT-DLP] Erro ao remover arquivo corrompido:', unlinkError);
      }
    }

    throw new Error(`Erro ao baixar vídeo com yt-dlp: ${error.message}`);
  }
}

/**
 * Verifica se yt-dlp está disponível no sistema
 * @returns {Promise<boolean>}
 */
export async function isYtDlpAvailable() {
  try {
    await execAsync('yt-dlp --version || yt-dlp.exe --version || python3 -m yt_dlp --version');
    return true;
  } catch (error) {
    return false;
  }
}

