/**
 * CONTROLLER DE STATUS DO WORKER
 * Retorna informações sobre disponibilidade do yt-dlp e cookies
 */

import { checkAvailability } from '../workers/youtubeDownloadWorker.js';

export async function getWorkerStatus(req, res) {
  try {
    const status = await checkAvailability();
    
    return res.json({
      success: true,
      ...status,
      message: status.ytDlpAvailable 
        ? 'Worker está pronto para downloads'
        : 'yt-dlp não está disponível',
      recommendations: {
        ...(status.cookiesAvailable 
          ? {} 
          : { 
              cookies: 'Considere adicionar cookies.txt para melhorar taxa de sucesso. Veja COOKIES_SETUP.md'
            }
        )
      }
    });
  } catch (error) {
    console.error('[WORKER-STATUS] Erro:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
