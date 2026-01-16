/**
 * PROGRESS EVENTS - Sistema de eventos de progresso em tempo real
 * 
 * Armazena eventos de progresso por jobId e emite via SSE
 */

// Mapa de eventos por jobId: { jobId: { totalClips, currentClip, status, progress, message } }
const progressEvents = new Map();

// Mapa de clientes SSE conectados: { jobId: Set<Response> }
const sseClients = new Map();

/**
 * Atualizar evento de progresso
 */
export function updateProgressEvent(jobId, event) {
  const currentEvent = progressEvents.get(jobId) || {};
  const updatedEvent = {
    ...currentEvent,
    ...event,
    timestamp: Date.now()
  };
  
  progressEvents.set(jobId, updatedEvent);
  
  // Emitir para todos os clientes SSE conectados
  broadcastToClients(jobId, updatedEvent);
  
  console.log(`[PROGRESS-EVENTS] Evento atualizado para job ${jobId}:`, updatedEvent);
}

/**
 * Obter evento de progresso atual
 */
export function getProgressEvent(jobId) {
  return progressEvents.get(jobId) || null;
}

/**
 * Remover eventos de um job (limpeza)
 */
export function removeProgressEvent(jobId) {
  progressEvents.delete(jobId);
  // Fechar conexões SSE quando job terminar
  const clients = sseClients.get(jobId);
  if (clients) {
    clients.forEach(client => {
      try {
        client.end();
      } catch (e) {
        // Ignorar erros ao fechar conexão
      }
    });
    sseClients.delete(jobId);
  }
}

/**
 * Adicionar cliente SSE
 */
export function addSSEClient(jobId, res) {
  // Configurar headers SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Desabilitar buffering do nginx
  
  // Adicionar ao conjunto de clientes
  if (!sseClients.has(jobId)) {
    sseClients.set(jobId, new Set());
  }
  sseClients.get(jobId).add(res);
  
  // Enviar evento inicial se houver
  const currentEvent = progressEvents.get(jobId);
  if (currentEvent) {
    sendSSEEvent(res, currentEvent);
  }
  
  // Enviar keepalive a cada 30 segundos
  const keepaliveInterval = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch (e) {
      clearInterval(keepaliveInterval);
      removeSSEClient(jobId, res);
    }
  }, 30000);
  
  // Remover cliente quando conexão for fechada
  res.on('close', () => {
    clearInterval(keepaliveInterval);
    removeSSEClient(jobId, res);
  });
  
  console.log(`[PROGRESS-EVENTS] Cliente SSE adicionado para job ${jobId}`);
}

/**
 * Remover cliente SSE
 */
function removeSSEClient(jobId, res) {
  const clients = sseClients.get(jobId);
  if (clients) {
    clients.delete(res);
    if (clients.size === 0) {
      sseClients.delete(jobId);
    }
  }
}

/**
 * Enviar evento SSE para um cliente específico
 */
function sendSSEEvent(res, event) {
  try {
    const data = JSON.stringify(event);
    res.write(`data: ${data}\n\n`);
  } catch (e) {
    console.error(`[PROGRESS-EVENTS] Erro ao enviar evento SSE:`, e);
  }
}

/**
 * Broadcast evento para todos os clientes de um job
 */
function broadcastToClients(jobId, event) {
  const clients = sseClients.get(jobId);
  if (!clients || clients.size === 0) {
    return;
  }
  
  const data = JSON.stringify(event);
  const deadClients = [];
  
  clients.forEach(client => {
    try {
      client.write(`data: ${data}\n\n`);
    } catch (e) {
      console.error(`[PROGRESS-EVENTS] Erro ao enviar para cliente, removendo:`, e);
      deadClients.push(client);
    }
  });
  
  // Remover clientes mortos
  deadClients.forEach(client => removeSSEClient(jobId, client));
}

/**
 * Rota SSE para progresso em tempo real
 */
export function progressSSE(req, res) {
  const { jobId } = req.params;
  
  if (!jobId) {
    return res.status(400).json({ error: 'jobId é obrigatório' });
  }
  
  // Adicionar cliente SSE
  addSSEClient(jobId, res);
  
  // Enviar evento de conexão estabelecida
  const connectEvent = {
    type: 'connected',
    jobId,
    message: 'Conexão estabelecida'
  };
  sendSSEEvent(res, connectEvent);
}

export default {
  updateProgressEvent,
  getProgressEvent,
  removeProgressEvent,
  progressSSE
};
