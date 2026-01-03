/**
 * GESTOR DE ESTADOS DE VÍDEO
 * Estado machine explícito para garantir confiabilidade
 */

// Estados válidos
export const VIDEO_STATES = {
  IDLE: 'idle',
  DOWNLOADING: 'downloading',
  PROCESSING: 'processing',
  READY: 'ready',
  ERROR: 'error'
};

// Store de estados (em produção, usar Redis)
const videoStateStore = new Map();

/**
 * Inicializar estado de um vídeo
 */
export function initVideoState(videoId) {
  const state = {
    id: videoId,
    state: VIDEO_STATES.IDLE,
    progress: 0,
    error: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  videoStateStore.set(videoId, state);
  return state;
}

/**
 * Atualizar estado de um vídeo
 */
export function updateVideoState(videoId, updates) {
  const currentState = videoStateStore.get(videoId);
  if (!currentState) {
    throw new Error(`Estado do vídeo ${videoId} não encontrado`);
  }
  
  const newState = {
    ...currentState,
    ...updates,
    updatedAt: new Date()
  };
  
  videoStateStore.set(videoId, newState);
  return newState;
}

/**
 * Obter estado de um vídeo
 */
export function getVideoState(videoId) {
  return videoStateStore.get(videoId) || null;
}

/**
 * Verificar se vídeo está pronto para uso
 */
export function isVideoReady(videoId) {
  const state = getVideoState(videoId);
  return state?.state === VIDEO_STATES.READY;
}

/**
 * Limpar estado de um vídeo (cleanup)
 */
export function clearVideoState(videoId) {
  videoStateStore.delete(videoId);
}

/**
 * Obter todos os estados (para debug)
 */
export function getAllStates() {
  return Array.from(videoStateStore.entries());
}

