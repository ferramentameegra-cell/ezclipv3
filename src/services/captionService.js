/**
 * SERVIÇO DE LEGENDAS AUTOMÁTICAS COM OPENAI
 * 
 * Funcionalidades:
 * - Transcrição de áudio com Whisper
 * - Geração de legendas inteligentes com timestamps
 * - Detecção de pausas e quebra por sentido
 * - Destaque automático de palavras-chave
 */

import fs from 'fs';
import path from 'path';

// Inicializar OpenAI apenas quando necessário (lazy loading)
let openai = null;

async function getOpenAIClient() {
  if (!openai) {
    // Carregar dotenv se ainda não foi carregado
    if (!process.env.OPENAI_API_KEY) {
      try {
        const dotenv = await import('dotenv');
        dotenv.default.config();
      } catch (e) {
        // dotenv pode não estar disponível, continuar
      }
    }
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('[CAPTION] ⚠️ OPENAI_API_KEY não configurada no ambiente');
      return null;
    }
    
    try {
      const OpenAI = (await import('openai')).default;
      openai = new OpenAI({
        apiKey: apiKey
      });
      console.log('[CAPTION] ✅ OpenAI client inicializado com sucesso');
    } catch (error) {
      console.error('[CAPTION] ❌ Erro ao inicializar OpenAI:', error.message);
      return null;
    }
  }
  return openai;
}

/**
 * Extrai e comprime áudio do vídeo usando FFmpeg
 * Comprime para MP3 com bitrate reduzido para evitar erro 413
 */
async function extractAudio(videoPath, audioPath) {
  const ffmpegModule = await import('fluent-ffmpeg');
  const ffmpeg = ffmpegModule.default;
  
  return new Promise((resolve, reject) => {
    // Obter duração do vídeo primeiro para estimar tamanho
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        return reject(err);
      }

      const duration = metadata?.format?.duration || 0;
      const maxDuration = 25 * 60; // 25 minutos máximo (limite seguro para 25MB)
      
      // Se vídeo for muito longo, precisaremos chunking
      if (duration > maxDuration) {
        console.log(`[CAPTION] Vídeo muito longo (${duration}s), será necessário chunking`);
      }

      // Extrair áudio comprimido (MP3, mono, 16kHz, 16kbps)
      // Reduzir bitrate para 16kbps para garantir arquivos menores
      // Isso reduz drasticamente o tamanho do arquivo (de ~100MB para ~2-6MB)
      // 16kbps ainda é suficiente para transcrição de voz
      ffmpeg(videoPath)
        .output(audioPath)
        .noVideo()
        .audioCodec('libmp3lame')
        .audioBitrate(16) // 16kbps (reduzido ainda mais para garantir arquivos menores)
        .audioFrequency(16000) // 16kHz (Whisper funciona bem com isso)
        .audioChannels(1) // Mono
        .outputOptions([
          '-ac', '1', // Forçar mono
          '-ar', '16000', // Sample rate 16kHz
          '-b:a', '16k', // Bitrate 16kbps (reduzido ainda mais)
          '-f', 'mp3', // Forçar formato MP3
          '-compression_level', '2', // Compressão máxima
          '-q:a', '9' // Qualidade mínima (máxima compressão)
        ])
        .on('start', (cmdline) => {
          console.log('[CAPTION] Extraindo áudio comprimido...');
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`[CAPTION] Extração: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', () => {
          // Verificar tamanho do arquivo após extração
          const stats = fs.statSync(audioPath);
          const sizeMB = stats.size / 1024 / 1024;
          const sizeBytes = stats.size;
          const safeSizeBytes = 18 * 1024 * 1024; // 18MB
          
          console.log(`[CAPTION] Áudio extraído: ${sizeMB.toFixed(2)} MB (${sizeBytes} bytes)`);
          
          // Se ainda for muito grande (>= 18MB), avisar que será necessário chunking
          if (sizeBytes >= safeSizeBytes) {
            console.warn(`[CAPTION] ⚠️ Áudio ainda grande (${sizeMB.toFixed(2)}MB >= 18MB), será necessário chunking automático`);
          } else if (sizeMB > 15) {
            console.warn(`[CAPTION] ⚠️ Áudio grande (${sizeMB.toFixed(2)}MB), próximo do limite, pode precisar chunking`);
          }
          
          resolve(audioPath);
        })
        .on('error', (err) => {
          console.error('[CAPTION] Erro ao extrair áudio:', err);
          reject(err);
        })
        .run();
    });
  });
}

/**
 * Transcreve áudio usando OpenAI Whisper
 * Implementa chunking automático se o arquivo for muito grande
 */
async function transcribeAudio(audioPath) {
  const client = await getOpenAIClient();
  if (!client) {
    throw new Error('OpenAI API key não configurada. Configure OPENAI_API_KEY no ambiente.');
  }

  try {
    // Verificar tamanho do arquivo ANTES de tentar enviar
    const stats = fs.statSync(audioPath);
    const sizeBytes = stats.size;
    const sizeMB = sizeBytes / 1024 / 1024;
    const maxSizeBytes = 25 * 1024 * 1024; // 25MB em bytes (limite da API OpenAI)
    const safeSizeBytes = 18 * 1024 * 1024; // 18MB como limite seguro (margem de segurança maior)
    
    console.log(`[CAPTION] Tamanho do áudio: ${sizeMB.toFixed(2)} MB (${sizeBytes} bytes)`);
    console.log(`[CAPTION] Limite da API: 25MB (${maxSizeBytes} bytes)`);
    console.log(`[CAPTION] Limite seguro: 18MB (${safeSizeBytes} bytes)`);
    
    // SEMPRE usar chunking se o arquivo for maior que 18MB (margem de segurança maior)
    // Isso evita o erro 413 que ocorre quando o arquivo está próximo do limite
    if (sizeBytes >= safeSizeBytes) {
      console.log(`[CAPTION] Arquivo grande (${sizeMB.toFixed(2)}MB >= 18MB), usando chunking preventivo obrigatório...`);
      return await transcribeAudioWithChunking(audioPath, client);
    }
    
    // Verificar novamente antes de enviar (double-check absoluto)
    if (sizeBytes >= maxSizeBytes) {
      console.warn(`[CAPTION] ⚠️ CRÍTICO: Arquivo excede limite (${sizeMB.toFixed(2)}MB >= 25MB), forçando chunking...`);
      return await transcribeAudioWithChunking(audioPath, client);
    }
    
    // Verificar se está muito próximo do limite (dentro de 1MB do limite)
    const marginBytes = 1 * 1024 * 1024; // 1MB de margem
    if (sizeBytes > (maxSizeBytes - marginBytes)) {
      console.warn(`[CAPTION] ⚠️ Arquivo muito próximo do limite (${sizeMB.toFixed(2)}MB), usando chunking preventivo...`);
      return await transcribeAudioWithChunking(audioPath, client);
    }
    
    // Arquivo pequeno o suficiente, transcrever diretamente
    console.log('[CAPTION] Iniciando transcrição com Whisper (arquivo pequeno e seguro)...');
    
    // Verificação final antes de criar o stream
    const finalStats = fs.statSync(audioPath);
    if (finalStats.size >= safeSizeBytes) {
      console.warn(`[CAPTION] ⚠️ Tamanho mudou durante verificação, usando chunking...`);
      return await transcribeAudioWithChunking(audioPath, client);
    }
    
    // Retry logic com backoff exponencial para rate limiting
    const maxRetries = 5;
    let lastError = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const transcription = await client.audio.transcriptions.create({
          file: fs.createReadStream(audioPath),
          model: 'whisper-1',
          response_format: 'verbose_json',
          timestamp_granularity: 'word'
        });

        console.log('[CAPTION] Transcrição concluída');
        return transcription;
      } catch (error) {
        lastError = error;
        console.error(`[CAPTION] Erro na transcrição (tentativa ${attempt + 1}/${maxRetries}):`, error.message);
        
        // Verificar se é erro 413 - sempre tentar chunking se ocorrer
        if (error.status === 413 || 
            error.message.includes('413') || 
            error.message.includes('Maximum content size') ||
            error.message.includes('26214400')) {
          console.log('[CAPTION] Erro 413 detectado, tentando chunking automático...');
          try {
            return await transcribeAudioWithChunking(audioPath, client);
          } catch (chunkError) {
            throw new Error(`Erro ao transcrever áudio (tentativa com chunking): ${chunkError.message}`);
          }
        }
        
        // Verificar se é rate limit ou ECONNRESET - fazer retry com backoff
        const isRateLimit = error.status === 429 || 
                           error.message.includes('rate limit') ||
                           error.message.includes('Rate limit') ||
                           error.message.includes('too many requests') ||
                           error.code === 'ECONNRESET' ||
                           error.message.includes('ECONNRESET') ||
                           error.message.includes('Limite de processamentos');
        
        if (isRateLimit && attempt < maxRetries - 1) {
          // Backoff exponencial: 2^attempt segundos (2s, 4s, 8s, 16s, 32s)
          const waitTime = Math.min(2 ** attempt * 1000, 30000); // Máximo 30 segundos
          console.log(`[CAPTION] Rate limit detectado, aguardando ${waitTime/1000}s antes de tentar novamente...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue; // Tentar novamente
        }
        
        // Se não é rate limit ou já tentou todas as vezes, lançar erro
        if (!isRateLimit || attempt === maxRetries - 1) {
          throw error;
        }
      }
    }
    
    // Se chegou aqui, todas as tentativas falharam
    throw new Error(`Erro ao transcrever áudio após ${maxRetries} tentativas: ${lastError?.message || 'Erro desconhecido'}`);
  } catch (error) {
    console.error('[CAPTION] Erro final na transcrição:', error);
    throw error;
  }
}

/**
 * Transcreve áudio em chunks e une os resultados
 */
async function transcribeAudioWithChunking(audioPath, client) {
  const ffmpegModule = await import('fluent-ffmpeg');
  const ffmpeg = ffmpegModule.default;
  const path = await import('path');
  
  // Obter duração total
  const metadata = await new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
  
  const totalDuration = metadata?.format?.duration || 0;
  // Reduzir duração do chunk para garantir que cada chunk seja < 15MB
  // Com 16kbps, ~15 minutos de áudio = ~1.8MB, então 20 minutos = ~2.4MB (muito seguro)
  // Usar 15 minutos para garantir chunks bem menores que 15MB
  const chunkDuration = 15 * 60; // 15 minutos por chunk (muito seguro para < 15MB com 16kbps)
  const chunks = Math.ceil(totalDuration / chunkDuration);
  
  console.log(`[CAPTION] Chunking: ${chunks} chunks de ${chunkDuration}s (~${(chunkDuration/60).toFixed(0)}min cada)`);
  
  console.log(`[CAPTION] Dividindo em ${chunks} chunks de ~${chunkDuration}s`);
  
  const tempDir = path.default.dirname(audioPath);
  const allWords = [];
  let currentOffset = 0;
  
  for (let i = 0; i < chunks; i++) {
    const chunkStart = i * chunkDuration;
    const chunkEnd = Math.min((i + 1) * chunkDuration, totalDuration);
    const chunkPath = path.default.join(tempDir, `chunk_${i}_${Date.now()}.mp3`);
    
    console.log(`[CAPTION] Processando chunk ${i + 1}/${chunks} (${chunkStart}s - ${chunkEnd}s)...`);
    
    try {
      // Extrair chunk do áudio original
      await new Promise((resolve, reject) => {
        ffmpeg(audioPath)
          .seekInput(chunkStart)
          .duration(chunkEnd - chunkStart)
          .output(chunkPath)
          .noVideo()
          .audioCodec('libmp3lame')
          .audioBitrate(16) // Mesmo bitrate reduzido para chunks (16kbps)
          .audioFrequency(16000)
          .audioChannels(1)
          .outputOptions([
            '-ac', '1',
            '-ar', '16000',
            '-b:a', '16k', // Mesmo bitrate reduzido (16kbps)
            '-f', 'mp3',
            '-compression_level', '2', // Compressão máxima
            '-q:a', '9' // Qualidade mínima (máxima compressão)
          ])
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
      
      // Verificar tamanho do chunk antes de enviar
      const chunkStats = fs.statSync(chunkPath);
      const chunkSizeBytes = chunkStats.size;
      const chunkSizeMB = chunkSizeBytes / 1024 / 1024;
      const maxChunkSizeBytes = 15 * 1024 * 1024; // 15MB limite seguro para chunks
      const absoluteMaxBytes = 20 * 1024 * 1024; // 20MB limite absoluto
      
      console.log(`[CAPTION] Chunk ${i + 1}/${chunks}: ${chunkSizeMB.toFixed(2)}MB (${chunkSizeBytes} bytes)`);
      
      if (chunkSizeBytes >= absoluteMaxBytes) {
        throw new Error(`Chunk ${i + 1} muito grande (${chunkSizeMB.toFixed(2)}MB >= 20MB). Não é seguro enviar.`);
      }
      
      if (chunkSizeBytes >= maxChunkSizeBytes) {
        console.warn(`[CAPTION] ⚠️ Chunk ${i + 1} grande (${chunkSizeMB.toFixed(2)}MB >= 15MB), mas dentro do limite absoluto. Enviando...`);
      }
      
      console.log(`[CAPTION] Enviando chunk ${i + 1}/${chunks} (${chunkSizeMB.toFixed(2)}MB)...`);
      
      // Transcrever chunk com retry logic
      const maxRetries = 5;
      let chunkTranscription = null;
      let chunkError = null;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          chunkTranscription = await client.audio.transcriptions.create({
            file: fs.createReadStream(chunkPath),
            model: 'whisper-1',
            response_format: 'verbose_json',
            timestamp_granularity: 'word'
          });
          break; // Sucesso, sair do loop
        } catch (error) {
          chunkError = error;
          console.error(`[CAPTION] Erro no chunk ${i + 1} (tentativa ${attempt + 1}/${maxRetries}):`, error.message);
          
          // Verificar se é rate limit ou ECONNRESET
          const isRateLimit = error.status === 429 || 
                             error.message.includes('rate limit') ||
                             error.message.includes('Rate limit') ||
                             error.message.includes('too many requests') ||
                             error.code === 'ECONNRESET' ||
                             error.message.includes('ECONNRESET') ||
                             error.message.includes('Limite de processamentos');
          
          if (isRateLimit && attempt < maxRetries - 1) {
            // Backoff exponencial: 2^attempt segundos (2s, 4s, 8s, 16s, 32s)
            const waitTime = Math.min(2 ** attempt * 1000, 30000); // Máximo 30 segundos
            console.log(`[CAPTION] Rate limit no chunk ${i + 1}, aguardando ${waitTime/1000}s...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue; // Tentar novamente
          }
          
          // Se não é rate limit ou já tentou todas as vezes, lançar erro
          if (!isRateLimit || attempt === maxRetries - 1) {
            throw error;
          }
        }
      }
      
      if (!chunkTranscription) {
        throw new Error(`Falha ao transcrever chunk ${i + 1} após ${maxRetries} tentativas: ${chunkError?.message || 'Erro desconhecido'}`);
      }
      
      // Ajustar timestamps do chunk (adicionar offset)
      if (chunkTranscription.words && Array.isArray(chunkTranscription.words)) {
        chunkTranscription.words.forEach(word => {
          word.start += chunkStart;
          word.end += chunkStart;
          allWords.push(word);
        });
      }
      
      // Limpar chunk temporário
      try {
        fs.unlinkSync(chunkPath);
      } catch (e) {
        console.warn(`[CAPTION] Erro ao limpar chunk ${i}:`, e.message);
      }
      
    } catch (chunkError) {
      console.error(`[CAPTION] Erro no chunk ${i + 1}:`, chunkError);
      // Limpar chunk em caso de erro
      try {
        if (fs.existsSync(chunkPath)) fs.unlinkSync(chunkPath);
      } catch (e) {}
      
      // Continuar com próximo chunk
      continue;
    }
  }
  
  // Construir transcrição unificada
  const unifiedTranscription = {
    text: allWords.map(w => w.word).join(' '),
    words: allWords.sort((a, b) => a.start - b.start),
    duration: totalDuration,
    language: 'pt' // Assumir português, pode ser detectado do primeiro chunk
  };
  
  console.log(`[CAPTION] ✅ Transcrição unificada: ${allWords.length} palavras`);
  return unifiedTranscription;
}

/**
 * Processa transcrição e gera legendas inteligentes
 */
function processTranscription(transcription, options = {}) {
  const {
    maxLinesPerBlock = 2,
    maxCharsPerLine = 40,
    highlightKeywords = true
  } = options;

  const words = transcription.words || [];
  const captions = [];
  let currentBlock = {
    start: null,
    end: null,
    text: '',
    words: [],
    highlight: []
  };

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordText = word.word.trim();
    
    if (!wordText) continue;

    // Inicializar bloco
    if (currentBlock.start === null) {
      currentBlock.start = word.start;
      currentBlock.text = wordText;
      currentBlock.words = [wordText];
    } else {
      currentBlock.text += ' ' + wordText;
      currentBlock.words.push(wordText);
    }

    currentBlock.end = word.end;

    // Detectar pausa natural (gap > 0.5s) ou limite de caracteres
    const nextWord = words[i + 1];
    const hasPause = nextWord && (nextWord.start - word.end) > 0.5;
    const exceedsLength = currentBlock.text.length > (maxCharsPerLine * maxLinesPerBlock);
    const isLastWord = i === words.length - 1;

    if (hasPause || exceedsLength || isLastWord) {
      // Quebrar em linhas se necessário
      const lines = breakIntoLines(currentBlock.text, maxCharsPerLine, maxLinesPerBlock);
      
      // Detectar palavras-chave para highlight
      const highlight = highlightKeywords 
        ? detectKeywords(currentBlock.words)
        : [];

      captions.push({
        start: currentBlock.start,
        end: currentBlock.end,
        text: currentBlock.text,
        lines: lines,
        highlight: highlight,
        duration: currentBlock.end - currentBlock.start
      });

      // Resetar bloco
      currentBlock = {
        start: null,
        end: null,
        text: '',
        words: [],
        highlight: []
      };
    }
  }

  return {
    captions,
    totalDuration: transcription.duration,
    language: transcription.language || 'pt'
  };
}

/**
 * Quebra texto em linhas respeitando limite de caracteres
 */
function breakIntoLines(text, maxCharsPerLine, maxLines) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    
    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Palavra muito longa, força quebra
        lines.push(word.substring(0, maxCharsPerLine));
        currentLine = word.substring(maxCharsPerLine);
      }
    }

    if (lines.length >= maxLines) {
      if (currentLine) {
        lines.push(currentLine);
      }
      break;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Detecta palavras-chave para highlight
 * Prioriza: substantivos, verbos de ação, números, palavras em maiúscula
 */
function detectKeywords(words) {
  const keywords = [];
  const stopWords = new Set(['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'da', 'do', 'em', 'na', 'no', 'para', 'com', 'por', 'que', 'é', 'são', 'foi', 'ser', 'ter', 'estar']);

  for (const word of words) {
    const cleanWord = word.toLowerCase().replace(/[.,!?;:]/g, '');
    
    // Ignorar stop words
    if (stopWords.has(cleanWord)) continue;
    
    // Palavras em maiúscula
    if (word === word.toUpperCase() && word.length > 1) {
      keywords.push(word);
      continue;
    }
    
    // Números
    if (/^\d+/.test(word)) {
      keywords.push(word);
      continue;
    }
    
    // Palavras longas (> 5 caracteres) são provavelmente importantes
    if (cleanWord.length > 5) {
      keywords.push(word);
    }
  }

  // Limitar a 3 palavras-chave por bloco
  return keywords.slice(0, 3);
}

/**
 * Gera legendas completas a partir de um vídeo
 */
export async function generateCaptions(videoPath, options = {}) {
  try {
    console.log('[CAPTION] Iniciando geração de legendas...');
    
    const { trimStart = 0, trimEnd = null } = options;
    
    // Se há intervalo definido, criar vídeo temporário apenas com esse intervalo
    let videoToProcess = videoPath;
    let tempVideoPath = null;
    
    if (trimStart > 0 || trimEnd !== null) {
      console.log(`[CAPTION] Gerando legendas apenas para intervalo: ${trimStart}s - ${trimEnd || 'fim'}s`);
      
      const ffmpegModule = await import('fluent-ffmpeg');
      const ffmpeg = ffmpegModule.default;
      
      tempVideoPath = path.join(process.cwd(), 'tmp', 'captions', `trimmed_${Date.now()}.mp4`);
      const tempDir = path.dirname(tempVideoPath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Criar vídeo temporário apenas com o intervalo escolhido
      await new Promise((resolve, reject) => {
        let command = ffmpeg(videoPath);
        
        if (trimStart > 0) {
          command = command.seekInput(trimStart);
        }
        
        if (trimEnd !== null) {
          const duration = trimEnd - trimStart;
          command = command.duration(duration);
        }
        
        command
          .output(tempVideoPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
      
      videoToProcess = tempVideoPath;
      console.log(`[CAPTION] Vídeo temporário criado: ${tempVideoPath}`);
    }

    // Criar diretório temporário
    const tempDir = path.join(process.cwd(), 'tmp', 'captions');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Usar MP3 em vez de WAV para reduzir tamanho
    const audioPath = path.join(tempDir, `audio_${Date.now()}.mp3`);

    // 1. Extrair áudio do vídeo (trimado ou completo)
    await extractAudio(videoToProcess, audioPath);

    // 2. Transcrever com Whisper
    const transcription = await transcribeAudio(audioPath);
    
    // 3. Ajustar timestamps se foi usado trim
    if (trimStart > 0 && transcription.words) {
      transcription.words.forEach(word => {
        word.start += trimStart;
        word.end += trimStart;
      });
    }

    // 3. Processar e gerar legendas
    // Ajustar opções para formato vertical 9:16 (1080x1920)
    // Formato vertical tem menos largura, então reduzir caracteres por linha
    const verticalOptions = {
      ...options,
      maxCharsPerLine: options.maxCharsPerLine || 30, // Reduzido de 40 para 30 para formato vertical
      maxLinesPerBlock: options.maxLinesPerBlock || 2 // Manter 2 linhas
    };
    console.log('[CAPTION] Gerando legendas para formato vertical 9:16 com opções:', verticalOptions);
    const result = processTranscription(transcription, verticalOptions);

    // Limpar arquivos temporários
    try {
      fs.unlinkSync(audioPath);
      if (tempVideoPath && fs.existsSync(tempVideoPath)) {
        fs.unlinkSync(tempVideoPath);
      }
    } catch (err) {
      console.warn('[CAPTION] Erro ao limpar arquivos temporários:', err);
    }

    console.log(`[CAPTION] ✅ Legendas geradas: ${result.captions.length} blocos`);
    
    return result;
  } catch (error) {
    console.error('[CAPTION] Erro na geração de legendas:', error);
    throw error;
  }
}

/**
 * Valida estrutura de legendas
 */
export function validateCaptions(captions) {
  if (!Array.isArray(captions)) {
    throw new Error('Legendas devem ser um array');
  }

  for (const caption of captions) {
    if (typeof caption.start !== 'number' || typeof caption.end !== 'number') {
      throw new Error('Cada legenda deve ter start e end numéricos');
    }
    if (caption.start >= caption.end) {
      throw new Error('Start deve ser menor que end');
    }
    if (!caption.text || typeof caption.text !== 'string') {
      throw new Error('Cada legenda deve ter texto');
    }
  }

  return true;
}
