/**
 * ASSEMBLYAI TRANSCRIPTION SERVICE
 * 
 * Transcreve áudio usando AssemblyAI API
 * Extrai áudio do vídeo MP4 e envia para transcrição
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const ASSEMBLYAI_API_URL = 'https://api.assemblyai.com/v2';

/**
 * Extrai áudio do vídeo MP4 usando ffmpeg
 * Retorna caminho do arquivo de áudio
 */
async function extractAudio(videoPath, audioOutputPath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(videoPath)) {
      return reject(new Error(`Vídeo não encontrado: ${videoPath}`));
    }

    console.log(`[ASSEMBLYAI] Extraindo áudio: ${videoPath} -> ${audioOutputPath}`);

    // Extrair áudio como MP3 (formato compatível com AssemblyAI)
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-vn', // Sem vídeo
      '-acodec', 'libmp3lame', // Codec MP3
      '-ar', '44100', // Sample rate
      '-ac', '2', // Stereo
      '-b:a', '192k', // Bitrate
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

      console.log(`[ASSEMBLYAI] Áudio extraído: ${audioOutputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      resolve(audioOutputPath);
    });

    ffmpeg.on('error', (error) => {
      // Verificar se é erro de ffmpeg não encontrado
      if (error.code === 'ENOENT' || 
          error.message.includes('ENOENT') ||
          error.message.includes('spawn ffmpeg') ||
          error.message.includes('ffmpeg: command not found')) {
        const errorMsg = 'ffmpeg não encontrado. Verifique se o ffmpeg está instalado corretamente e no PATH do sistema.\n' +
                        'Para instalar:\n' +
                        '  - macOS: brew install ffmpeg\n' +
                        '  - Linux: apt-get install ffmpeg (ou yum install ffmpeg)\n' +
                        '  - Windows: baixe de https://ffmpeg.org/download.html';
        console.error(`[ASSEMBLYAI] ${errorMsg}`);
        return reject(new Error(errorMsg));
      }
      reject(new Error(`Erro ao executar ffmpeg: ${error.message}`));
    });
  });
}

/**
 * Faz upload do áudio para AssemblyAI
 * Retorna upload_url
 */
async function uploadAudio(audioPath) {
  if (!ASSEMBLYAI_API_KEY) {
    throw new Error('ASSEMBLYAI_API_KEY não configurada. Configure a variável de ambiente.');
  }

  console.log(`[ASSEMBLYAI] Fazendo upload do áudio: ${audioPath}`);

  const audioFile = fs.createReadStream(audioPath);
  const formData = new FormData();
  formData.append('file', audioFile, {
    filename: path.basename(audioPath),
    contentType: 'audio/mpeg'
  });

  try {
    const response = await fetch(`${ASSEMBLYAI_API_URL}/upload`, {
      method: 'POST',
      headers: {
        'authorization': ASSEMBLYAI_API_KEY
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ASSEMBLYAI] Upload erro (${response.status}): ${errorText}`);
      
      if (response.status === 401) {
        throw new Error('API key inválida. Verifique ASSEMBLYAI_API_KEY.');
      } else if (response.status === 429) {
        throw new Error('Rate limit excedido. Tente novamente em alguns instantes.');
      } else {
        throw new Error(`Upload falhou: ${errorText.slice(0, 200)}`);
      }
    }

    const data = await response.json();
    console.log(`[ASSEMBLYAI] Upload concluído: ${data.upload_url}`);
    return data.upload_url;

  } catch (error) {
    if (error.message.includes('API key') || error.message.includes('Rate limit')) {
      throw error;
    }
    throw new Error(`Erro ao fazer upload: ${error.message}`);
  }
}

/**
 * Inicia transcrição na AssemblyAI
 * Retorna transcript_id
 */
async function startTranscription(uploadUrl, languageCode = 'pt') {
  if (!ASSEMBLYAI_API_KEY) {
    throw new Error('ASSEMBLYAI_API_KEY não configurada.');
  }

  console.log(`[ASSEMBLYAI] Iniciando transcrição para: ${uploadUrl}`);

  try {
    const response = await fetch(`${ASSEMBLYAI_API_URL}/transcript`, {
      method: 'POST',
      headers: {
        'authorization': ASSEMBLYAI_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: uploadUrl,
        language_code: languageCode,
        word_timestamps: true, // Incluir timestamps de palavras
        punctuate: true,
        format_text: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ASSEMBLYAI] Transcrição erro (${response.status}): ${errorText}`);
      
      if (response.status === 401) {
        throw new Error('API key inválida. Verifique ASSEMBLYAI_API_KEY.');
      } else if (response.status === 429) {
        throw new Error('Rate limit excedido. Aguarde alguns instantes.');
      } else {
        throw new Error(`Iniciar transcrição falhou: ${errorText.slice(0, 200)}`);
      }
    }

    const data = await response.json();
    console.log(`[ASSEMBLYAI] Transcrição iniciada: ${data.id}`);
    return data.id;

  } catch (error) {
    if (error.message.includes('API key') || error.message.includes('Rate limit')) {
      throw error;
    }
    throw new Error(`Erro ao iniciar transcrição: ${error.message}`);
  }
}

/**
 * Polling para verificar status da transcrição
 * Retorna resultado quando completo
 */
async function pollTranscription(transcriptId, maxAttempts = 60, intervalMs = 3000) {
  if (!ASSEMBLYAI_API_KEY) {
    throw new Error('ASSEMBLYAI_API_KEY não configurada.');
  }

  console.log(`[ASSEMBLYAI] Aguardando transcrição: ${transcriptId}`);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`${ASSEMBLYAI_API_URL}/transcript/${transcriptId}`, {
        headers: {
          'authorization': ASSEMBLYAI_API_KEY
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Polling falhou: ${errorText.slice(0, 200)}`);
      }

      const data = await response.json();

      if (data.status === 'completed') {
        console.log(`[ASSEMBLYAI] Transcrição concluída após ${attempt + 1} tentativas`);
        return data;
      } else if (data.status === 'error') {
        throw new Error(`Transcrição falhou: ${data.error || 'Erro desconhecido'}`);
      }

      // Status: queued, processing
      if (attempt % 5 === 0) {
        console.log(`[ASSEMBLYAI] Aguardando... Status: ${data.status} (tentativa ${attempt + 1}/${maxAttempts})`);
      }

      // Aguardar antes de próxima tentativa
      await new Promise(resolve => setTimeout(resolve, intervalMs));

    } catch (error) {
      if (error.message.includes('falhou')) {
        throw error;
      }
      // Erro de rede - tentar novamente
      console.warn(`[ASSEMBLYAI] Erro no polling (tentativa ${attempt + 1}): ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  throw new Error('Timeout: Transcrição não foi concluída no tempo esperado');
}

/**
 * Processa transcrição completa do vídeo
 * Extrai áudio, faz upload, transcreve e retorna resultado
 */
export async function transcribeVideo(videoPath, languageCode = 'pt') {
  const audioPath = path.join(path.dirname(videoPath), `audio_${Date.now()}.mp3`);

  try {
    // Passo 1: Extrair áudio
    await extractAudio(videoPath, audioPath);

    // Passo 2: Upload para AssemblyAI
    const uploadUrl = await uploadAudio(audioPath);

    // Passo 3: Iniciar transcrição
    const transcriptId = await startTranscription(uploadUrl, languageCode);

    // Passo 4: Polling até concluir
    const result = await pollTranscription(transcriptId);

    // Estruturar resposta
    const transcription = {
      text: result.text || '',
      words: (result.words || []).map(word => ({
        text: word.text,
        start: Math.round(word.start * 100) / 100, // 2 casas decimais
        end: Math.round(word.end * 100) / 100
      }))
    };

    console.log(`[ASSEMBLYAI] Transcrição concluída: ${transcription.words.length} palavras`);

    return transcription;

  } catch (error) {
    console.error(`[ASSEMBLYAI] Erro: ${error.message}`);
    throw error;
  } finally {
    // Limpar arquivo de áudio temporário
    if (fs.existsSync(audioPath)) {
      try {
        fs.unlinkSync(audioPath);
      } catch (unlinkError) {
        console.warn(`[ASSEMBLYAI] Não foi possível remover arquivo temporário: ${unlinkError.message}`);
      }
    }
  }
}

