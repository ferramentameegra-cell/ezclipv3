/**
 * CLIP DECISION SERVICE - OpenAI GPT-4
 * 
 * Usa GPT-4 para decidir os melhores momentos do vídeo para clips
 * baseado na transcrição, nicho e duração desejada
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Mapeia nicho para contexto do prompt
 */
function getNicheContext(nicheId) {
  const niches = {
    'podcast': {
      name: 'Podcast',
      description: 'Momentos importantes de discussão, insights, opiniões fortes ou perguntas interessantes'
    },
    'education': {
      name: 'Educacional',
      description: 'Explicações claras, conceitos-chave, exemplos práticos ou resumos de conteúdo'
    },
    'motivational': {
      name: 'Motivacional',
      description: 'Mensagens inspiradoras, frases de impacto, histórias de superação ou citações poderosas'
    },
    'entertainment': {
      name: 'Entretenimento',
      description: 'Momentos engraçados, reações, surpresas ou conteúdo viral'
    },
    'news': {
      name: 'Notícias',
      description: 'Informações importantes, atualizações, dados relevantes ou análises'
    }
  };

  return niches[nicheId] || {
    name: 'Geral',
    description: 'Momentos mais relevantes e interessantes do conteúdo'
  };
}

/**
 * Gera prompt do sistema para GPT
 */
function buildSystemPrompt(nicheContext, clipDuration) {
  return `Você é um especialista em seleção de conteúdo para redes sociais.

Seu trabalho é analisar uma transcrição de vídeo e identificar os MELHORES momentos para criar clips de ${clipDuration} segundos cada.

CONTEXTO DO NICHO: ${nicheContext.name}
${nicheContext.description}

REGRAS:
1. Selecione apenas segmentos que façam sentido isoladamente (sem dependência de contexto anterior)
2. Priorize momentos com impacto, clareza e engajamento
3. Os clips devem ser auto-contidos e compreensíveis sem o vídeo completo
4. Evite cortes no meio de frases ou pensamentos
5. Retorne EXATAMENTE o número de clips solicitado (ou menos se não houver conteúdo suficiente)

FORMATO DE RESPOSTA (JSON estrito):
{
  "clips": [
    {
      "start": 120,
      "end": 180,
      "headline": "Título curto e impactante (máx 60 caracteres)"
    }
  ]
}

IMPORTANTE:
- "start" e "end" são segundos (inteiros)
- "headline" deve ser em português (BR)
- Cada clip deve ter exatamente ${clipDuration} segundos (ou menos se for o final do vídeo)
- Não sobreponha clips (cada segundo do vídeo só pode aparecer em um clip)`;
}

/**
 * Analisa transcrição e decide melhores clips usando GPT-4
 * 
 * @param {Array} segments - Segmentos da transcrição [{ start, end, text }]
 * @param {number} clipDuration - Duração desejada do clip em segundos (60 ou 120)
 * @param {string} nicheId - ID do nicho (podcast, education, etc.)
 * @param {number} numberOfClips - Número de clips desejados
 * @param {number} videoDuration - Duração total do vídeo em segundos
 * @returns {Promise<Array>} - [{ start, end, headline }]
 */
export async function decideBestClips(segments, clipDuration, nicheId, numberOfClips, videoDuration) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY não configurada. Configure a variável de ambiente.');
  }

  if (!segments || segments.length === 0) {
    throw new Error('Transcrição vazia. Não é possível decidir clips.');
  }

  if (numberOfClips <= 0) {
    throw new Error('Número de clips deve ser maior que zero.');
  }

  const nicheContext = getNicheContext(nicheId);
  const systemPrompt = buildSystemPrompt(nicheContext, clipDuration);

  // Construir contexto da transcrição
  const transcriptText = segments
    .map(seg => `[${seg.start}s - ${seg.end}s] ${seg.text}`)
    .join('\n');

  const userPrompt = `Análise esta transcrição de vídeo e selecione os ${numberOfClips} melhores momentos para clips de ${clipDuration} segundos.

DURAÇÃO TOTAL DO VÍDEO: ${videoDuration} segundos

TRANSCRIÇÃO:
${transcriptText}

Selecione ${numberOfClips} clips que sejam:
- Auto-contidos (compreensíveis isoladamente)
- Relevantes para o nicho "${nicheContext.name}"
- Com potencial de engajamento
- Sem sobreposição entre clips

Retorne APENAS o JSON, sem explicações adicionais.`;

  console.log(`[CLIP-DECISION] Enviando para GPT-4: ${segments.length} segmentos, ${numberOfClips} clips desejados`);

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o', // GPT-4o (mais rápido e barato que 4.1)
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' } // Forçar JSON
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`[CLIP-DECISION] GPT API erro (${response.status}): ${errorData}`);
      
      if (response.status === 401) {
        throw new Error('API key inválida. Verifique OPENAI_API_KEY.');
      } else if (response.status === 429) {
        throw new Error('Rate limit excedido. Tente novamente em alguns instantes.');
      } else {
        throw new Error(`GPT API falhou: ${errorData.slice(0, 200)}`);
      }
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Resposta inválida da API GPT');
    }

    const content = data.choices[0].message.content;
    
    // Parsear JSON da resposta
    let result;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error(`[CLIP-DECISION] Erro ao parsear JSON: ${content}`);
      throw new Error('Resposta da API não é JSON válido');
    }

    // Validar estrutura
    if (!result.clips || !Array.isArray(result.clips)) {
      throw new Error('Resposta da API não contém array "clips"');
    }

    // Validar e normalizar clips
    const validClips = result.clips
      .filter(clip => {
        // Validar campos obrigatórios
        if (typeof clip.start !== 'number' || typeof clip.end !== 'number' || !clip.headline) {
          return false;
        }
        // Validar que start < end
        if (clip.start >= clip.end) {
          return false;
        }
        // Validar que está dentro da duração do vídeo
        if (clip.start < 0 || clip.end > videoDuration) {
          return false;
        }
        return true;
      })
      .map(clip => ({
        start: Math.floor(clip.start),
        end: Math.floor(clip.end),
        headline: clip.headline.trim().slice(0, 60) // Limitar tamanho
      }))
      .sort((a, b) => a.start - b.start); // Ordenar por tempo

    if (validClips.length === 0) {
      throw new Error('Nenhum clip válido foi retornado pela API');
    }

    console.log(`[CLIP-DECISION] ${validClips.length} clips selecionados pela IA`);
    return validClips;

  } catch (error) {
    if (error.message.includes('API key') || error.message.includes('Rate limit')) {
      throw error;
    }
    throw new Error(`Erro ao chamar GPT API: ${error.message}`);
  }
}


