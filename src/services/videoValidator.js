/**
 * VALIDADOR DE VÍDEO COM FFPROBE
 * Valida que o vídeo existe, não está vazio, e tem duração válida
 */

import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';

/**
 * Valida vídeo usando ffprobe
 * Retorna metadata completo ou lança erro
 */
export async function validateVideoWithFfprobe(videoPath) {
  return new Promise((resolve, reject) => {
    // Verificar existência básica
    if (!fs.existsSync(videoPath)) {
      return reject(new Error(`Arquivo de vídeo não existe: ${videoPath}`));
    }

    const stats = fs.statSync(videoPath);
    if (stats.size === 0) {
      return reject(new Error(`Arquivo de vídeo está vazio: ${videoPath}`));
    }

    // Validar com ffprobe
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        return reject(new Error(`Erro ao validar vídeo com ffprobe: ${err.message}`));
      }

      // Verificar se tem informações de formato
      if (!metadata || !metadata.format) {
        return reject(new Error('Vídeo não contém informações de formato válidas'));
      }

      // Verificar duração
      const duration = metadata.format.duration;
      if (!duration || isNaN(duration) || duration <= 0) {
        return reject(new Error('Vídeo não tem duração válida'));
      }

      // Verificar se tem streams de vídeo e áudio
      const videoStreams = metadata.streams?.filter(s => s.codec_type === 'video') || [];
      const audioStreams = metadata.streams?.filter(s => s.codec_type === 'audio') || [];

      if (videoStreams.length === 0) {
        return reject(new Error('Vídeo não contém stream de vídeo'));
      }

      // Metadata completo
      const result = {
        path: videoPath,
        size: stats.size,
        duration: Math.floor(duration),
        durationFloat: duration,
        format: metadata.format.format_name,
        bitrate: metadata.format.bit_rate,
        hasVideo: videoStreams.length > 0,
        hasAudio: audioStreams.length > 0,
        videoCodec: videoStreams[0]?.codec_name || null,
        audioCodec: audioStreams[0]?.codec_name || null,
        width: videoStreams[0]?.width || null,
        height: videoStreams[0]?.height || null,
        fps: parseFloat(videoStreams[0]?.r_frame_rate?.split('/')[0]) / parseFloat(videoStreams[0]?.r_frame_rate?.split('/')[1]) || null,
        metadata: metadata
      };

      console.log(`[VALIDATOR] Vídeo validado: ${videoPath}`);
      console.log(`[VALIDATOR] Duração: ${result.duration}s, Tamanho: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`[VALIDATOR] Codec: ${result.videoCodec}/${result.audioCodec}, Resolução: ${result.width}x${result.height}`);

      resolve(result);
    });
  });
}


