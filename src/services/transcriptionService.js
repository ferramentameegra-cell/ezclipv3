/**
 * TRANSCRIPTION SERVICE - OpenAI Whisper API
 * 
 * Transcreve áudio de vídeo local usando Whisper API
 * Retorna texto completo e segmentos com timestamps
 */

import FormData from 'form-data';
import fs from 'fs';
import { spawn } from 'child_process';
import path from 'path';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/audio/transcriptions';

/**
 * Extrai áudio do vídeo para formato compatível com Whisper
 * Whisper aceita: mp3, mp4, mpeg, mpga, m4a, wav, webm
 */
async function extractAudio(videoPath, audioOutputPath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(videoPath)) {
      return reject(new Error(`Vídeo não encontrado: ${videoPath}`));
    }

    // Extrair áudio como MP3 (formato mais compatível)
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-vn', // Sem vídeo
      '-acodec', 'libmp3lame', // Codec MP3
      '-ar', '16000', // Sample rate 16kHz (recomendado para Whisper)
      '-ac', '1', // Mono (reduz tamanho)
      '-f', 'mp3',
      '-y', // Sobrescrever se existir
      audioOutputPath
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffmpeg falhou (code ${code}): ${stderr.slice(-300)}`));
      }

      if (!fs.existsSync(audioOutputPath)) {
        return reject(new Error('Arquivo de áudio não foi criado'));
      }

      const stats = fs.statSync(audioOutputPath);
      if (stats.size === 0) {
        return reject(new Error('Arquivo de áudio está vazio'));
      }

      console.log(`[TRANSCRIPTION] Áudio extraído: ${audioOutputPath} (${(stats.size / 1024).toFixed(2)} KB)`);
      resolve(audioOutputPath);
    });

    ffmpeg.on('error', (error) => {
      reject(new Error(`Erro ao executar ffmpeg: ${error.message}`));
    });
  });
}

/**
 * Transcreve áudio usando Whisper API
 * @param {string} audioPath - Caminho do arquivo de áudio
 * @param {string} language - Código de idioma (opcional, 'pt' para português)
 * @returns {Promise<Object>} - { text, segments: [{ start, end, text }] }
 */
async function transcribeWithWhisper(audioPath, language = 'pt') {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY não configurada. Configure a variável de ambiente.');
  }

  if (!fs.existsSync(audioPath)) {
    throw new Error(`Arquivo de áudio não encontrado: ${audioPath}`);
  }

  console.log(`[TRANSCRIPTION] Enviando áudio para Whisper API: ${audioPath}`);

  const formData = new FormData();
  formData.append('file', fs.createReadStream(audioPath));
  formData.append('model', 'whisper-1');
  formData.append('language', language);
  formData.append('response_format', 'verbose_json'); // Para obter timestamps
  formData.append('timestamp_granularities[]', 'segment'); // Timestamps por segmento

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`[TRANSCRIPTION] Whisper API erro (${response.status}): ${errorData}`);
      
      if (response.status === 401) {
        throw new Error('API key inválida. Verifique OPENAI_API_KEY.');
      } else if (response.status === 429) {
        throw new Error('Rate limit excedido. Tente novamente em alguns instantes.');
      } else {
        throw new Error(`Whisper API falhou: ${errorData.slice(0, 200)}`);
      }
    }

    const data = await response.json();
    
    // Estruturar resposta
    const transcription = {
      text: data.text || '',
      segments: (data.segments || []).map(seg => ({
        start: Math.floor(seg.start),
        end: Math.floor(seg.end),
        text: seg.text.trim()
      }))
    };

    console.log(`[TRANSCRIPTION] Transcrição concluída: ${transcription.segments.length} segmentos`);
    return transcription;

  } catch (error) {
    if (error.message.includes('API key') || error.message.includes('Rate limit')) {
      throw error;
    }
    throw new Error(`Erro ao chamar Whisper API: ${error.message}`);
  }
}

/**
 * Transcreve vídeo completo
 * Extrai áudio e envia para Whisper API
 * 
 * @param {string} videoPath - Caminho do arquivo de vídeo
 * @param {string} language - Código de idioma (padrão: 'pt')
 * @returns {Promise<Object>} - { text, segments: [{ start, end, text }] }
 */
export async function transcribeVideo(videoPath, language = 'pt') {
  const audioPath = path.join(path.dirname(videoPath), `audio_${Date.now()}.mp3`);
  
  try {
    // Passo 1: Extrair áudio
    await extractAudio(videoPath, audioPath);
    
    // Passo 2: Transcrever com Whisper
    const transcription = await transcribeWithWhisper(audioPath, language);
    
    return transcription;

  } catch (error) {
    console.error(`[TRANSCRIPTION] Erro: ${error.message}`);
    throw error;
  } finally {
    // Limpar arquivo de áudio temporário
    if (fs.existsSync(audioPath)) {
      try {
        fs.unlinkSync(audioPath);
      } catch (unlinkError) {
        console.warn(`[TRANSCRIPTION] Não foi possível remover arquivo temporário: ${unlinkError.message}`);
      }
    }
  }
}

