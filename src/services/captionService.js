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
 * Extrai áudio do vídeo usando FFmpeg
 */
async function extractAudio(videoPath, audioPath) {
  const ffmpegModule = await import('fluent-ffmpeg');
  const ffmpeg = ffmpegModule.default;
  
  return new Promise((resolve, reject) => {
    
    ffmpeg(videoPath)
      .output(audioPath)
      .audioCodec('pcm_s16le')
      .audioFrequency(16000)
      .audioChannels(1)
      .on('end', () => {
        console.log('[CAPTION] Áudio extraído com sucesso');
        resolve(audioPath);
      })
      .on('error', (err) => {
        console.error('[CAPTION] Erro ao extrair áudio:', err);
        reject(err);
      })
      .run();
  });
}

/**
 * Transcreve áudio usando OpenAI Whisper
 */
async function transcribeAudio(audioPath) {
  const client = await getOpenAIClient();
  if (!client) {
    throw new Error('OpenAI API key não configurada. Configure OPENAI_API_KEY no ambiente.');
  }

  try {
    console.log('[CAPTION] Iniciando transcrição com Whisper...');
    
    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularity: 'word'
    });

    console.log('[CAPTION] Transcrição concluída');
    return transcription;
  } catch (error) {
    console.error('[CAPTION] Erro na transcrição:', error);
    throw new Error(`Erro ao transcrever áudio: ${error.message}`);
  }
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

    // Criar diretório temporário
    const tempDir = path.join(process.cwd(), 'tmp', 'captions');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const audioPath = path.join(tempDir, `audio_${Date.now()}.wav`);

    // 1. Extrair áudio
    await extractAudio(videoPath, audioPath);

    // 2. Transcrever com Whisper
    const transcription = await transcribeAudio(audioPath);

    // 3. Processar e gerar legendas
    const result = processTranscription(transcription, options);

    // Limpar arquivo temporário
    try {
      fs.unlinkSync(audioPath);
    } catch (err) {
      console.warn('[CAPTION] Erro ao limpar áudio temporário:', err);
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
