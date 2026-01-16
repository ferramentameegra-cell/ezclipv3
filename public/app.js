// Estado centralizado da aplicação
const appState = {
    videoId: null,
    videoInfo: null,
    videoDuration: null,
    videoPlayableUrl: null,
    trimStart: 0,
    trimEnd: 0,
    cutDuration: 60,
    headlineText: 'Headline',
    numberOfCuts: 0,
    nicheId: null,
    retentionVideoId: 'random',
    headlineStyle: 'bold',
    headlineSize: 72,
    headlineColor: '#FFFFFF',
    font: 'Inter',
    backgroundColor: '#000000',
    jobId: null,
    seriesId: null,
    currentUser: null,
    currentTab: 'home',
    configurations: {
        format: '9:16',
        platforms: { tiktok: true, reels: true, shorts: true },
        captionLanguage: 'pt',
        captionStyle: 'modern',
        clipsQuantity: null,
        safeMargins: 10
    }
};

// Tornar appState globalmente acessível
if (typeof window !== 'undefined') {
    window.appState = appState;
}

const API_BASE = window.location.origin;

// Cliente API com retry (definido inline para compatibilidade)
class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async fetchWithRetry(url, options = {}, retries = this.maxRetries) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        if (retries > 0) {
          console.log(`[API] Rate limited. Aguardando ${retryAfter}s...`);
          await this.sleep(retryAfter * 1000);
          return this.fetchWithRetry(url, options, retries - 1);
        }
      }

      if (response.status >= 500 && retries > 0) {
        console.log(`[API] Erro ${response.status}. Tentando novamente...`);
        await this.sleep(this.retryDelay * (this.maxRetries - retries + 1));
        return this.fetchWithRetry(url, options, retries - 1);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Resposta não é JSON: ${text.substring(0, 100)}`);
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Erro ${response.status}`);
      }

      return { data, response };
    } catch (error) {
      if (retries > 0 && !error.message.includes('JSON')) {
        await this.sleep(this.retryDelay * (this.maxRetries - retries + 1));
        return this.fetchWithRetry(url, options, retries - 1);
      }
      throw error;
    }
  }

  async get(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    return this.fetchWithRetry(url, { ...options, method: 'GET' });
  }

  async post(endpoint, body, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    return this.fetchWithRetry(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body)
    });
  }
}

const apiClient = new ApiClient(window.location.origin);

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    setupYouTubeInput();
    setupUploadDragDrop();
    setupTrimControls();
    loadNiches();
    checkAuth();
    // Inicializar com primeiro step (etapa 1)
    currentStepIndex = 0;
    
    // Mostrar TODOS os cards desde o início (sempre acessíveis e editáveis)
    // IMPORTANTE: Todos os cards devem permanecer visíveis durante todo o processo
    setTimeout(() => {
        document.querySelectorAll('[data-step-card]').forEach(card => {
            card.style.display = 'block';
            card.classList.remove('hidden');
            // Garantir que está visível
            if (card.style.display === 'none') {
                card.style.display = 'block';
            }
        });
    }, 100);
    
    updateProgressSteps('youtube'); // Etapa 1
}

// ========== TAB NAVIGATION ==========
function switchTab(tabName) {
    // Atualizar estado
    appState.currentTab = tabName;
    
    // Atualizar tabs visuais
    document.querySelectorAll('.nav-item').forEach(tab => {
        tab.classList.remove('active');
    });
    const navLink = document.querySelector(`[data-tab="${tabName}"]`);
    if (navLink) navLink.classList.add('active');
    
    // Mostrar conteúdo da tab
    document.querySelectorAll('.tab-content').forEach(panel => {
        panel.classList.remove('active');
    });
    const panel = document.getElementById(`tab-${tabName}`);
    if (panel) panel.classList.add('active');
    
    // NÃO fazer scroll automático - usuário controla a rolagem
    // window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========== PROGRESS STEPS INDICATOR ==========
// Ordem sequencial das etapas (OBRIGATÓRIA): youtube → trim → captions → configurations → niche → headline → generate
const STEP_ORDER = ['youtube', 'trim', 'captions', 'configurations', 'niche', 'headline', 'generate'];
let currentStepIndex = 0; // Rastrear etapa atual

function updateProgressSteps(stepName) {
    const stepIndex = STEP_ORDER.indexOf(stepName);
    
    if (stepIndex === -1) {
        console.warn('[STEPS] Etapa desconhecida:', stepName);
        return;
    }
    
    // VALIDAÇÃO CRÍTICA: Não permitir pular etapas (apenas log, sem alerta bloqueante)
    if (stepIndex > currentStepIndex + 1) {
        console.error('[STEPS] ❌ TENTATIVA DE PULAR ETAPAS!');
        console.error(`[STEPS] Etapa atual: ${STEP_ORDER[currentStepIndex]} (índice ${currentStepIndex})`);
        console.error(`[STEPS] Tentando ir para: ${stepName} (índice ${stepIndex})`);
        // Não bloquear - apenas logar para debug
        console.warn('[STEPS] Pulando validação - permitindo avanço controlado pelo usuário');
    }
    
    // Atualizar índice atual
    currentStepIndex = stepIndex;
    
    // Atualizar indicadores visuais
    document.querySelectorAll('.progress-step').forEach((step, index) => {
        step.classList.remove('active', 'completed');
        
        if (index < stepIndex) {
            step.classList.add('completed');
        } else if (index === stepIndex) {
            step.classList.add('active');
        }
    });
    
    // NUNCA esconder cards - manter TODOS sempre visíveis e editáveis
    // Apenas marcar qual está ativo (visualmente)
    document.querySelectorAll('[data-step-card]').forEach(card => {
        card.classList.remove('active');
        // Remover hidden se existir
        card.classList.remove('hidden');
        // Garantir que está sempre visível
        card.style.display = 'block';
    });
    
    // Marcar card atual como ativo (apenas visual)
    // NÃO fazer scroll automático - usuário controla a rolagem
    const activeCard = document.querySelector(`[data-step-card="${stepName}"]`);
    if (activeCard) {
        activeCard.classList.add('active');
        activeCard.style.display = 'block';
        // NÃO fazer scroll - removido scrollIntoView
    }
    
    console.log(`[STEPS] ✅ Etapa atualizada: ${stepName} (índice ${stepIndex})`);
}

/**
 * Valida se pode avançar para próxima etapa
 */
function canAdvanceToStep(stepName) {
    const stepIndex = STEP_ORDER.indexOf(stepName);
    if (stepIndex === -1) return false;
    
    // Só pode avançar para a próxima etapa sequencial
    return stepIndex === currentStepIndex + 1;
}

/**
 * Avança para próxima etapa sequencial
 */
function advanceToNextStep() {
    if (currentStepIndex < STEP_ORDER.length - 1) {
        const nextStep = STEP_ORDER[currentStepIndex + 1];
        updateProgressSteps(nextStep);
        return nextStep;
    }
    return null;
}

/**
 * Faz scroll suave até um card específico
 */
function scrollToCard(stepName) {
    const card = document.querySelector(`[data-step-card="${stepName}"]`);
    if (card) {
        // Garantir que o card esteja visível antes de fazer scroll
        if (card.style.display === 'none') {
            card.style.display = 'block';
        }
        
        setTimeout(() => {
            // Scroll suave até o card
            const cardPosition = card.getBoundingClientRect().top + window.pageYOffset;
            const offset = 80; // Offset maior para melhor visualização
            
            window.scrollTo({
                top: cardPosition - offset,
                behavior: 'smooth'
            });
        }, 200);
    } else {
        console.warn(`[SCROLL] Card não encontrado: ${stepName}`);
    }
}

function scrollToTool() {
    // Fazer scroll até a etapa 1 (youtube/upload)
    scrollToCard('youtube');
}

// ========== AUTHENTICATION ==========
function checkAuth() {
    const user = localStorage.getItem('ezv2_user');
    if (user) {
        appState.currentUser = JSON.parse(user);
        updateUserUI();
    }
}

function updateUserUI() {
    const navLoginBtn = document.getElementById('nav-login-btn');
    const userMenu = document.getElementById('user-menu');
    const userInitial = document.getElementById('user-initial');
    const userNameDropdown = document.getElementById('user-name-dropdown');
    const userEmailDropdown = document.getElementById('user-email-dropdown');
    
    if (appState.currentUser) {
        if (navLoginBtn) navLoginBtn.classList.add('hidden');
        if (userMenu) userMenu.classList.remove('hidden');
        if (userInitial) {
            const name = appState.currentUser.name || appState.currentUser.email;
            userInitial.textContent = name.charAt(0).toUpperCase();
        }
        if (userNameDropdown) userNameDropdown.textContent = appState.currentUser.name || 'Usuário';
        if (userEmailDropdown) userEmailDropdown.textContent = appState.currentUser.email;
    } else {
        if (navLoginBtn) navLoginBtn.classList.remove('hidden');
        if (userMenu) userMenu.classList.add('hidden');
    }
}

async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btnText = document.getElementById('login-btn-text');
    const btnSpinner = document.getElementById('login-btn-spinner');
    const statusMsg = document.getElementById('login-status');
    
    if (btnText) btnText.classList.add('hidden');
    if (btnSpinner) btnSpinner.classList.remove('hidden');
    if (statusMsg) statusMsg.classList.add('hidden');
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            appState.currentUser = data.user;
            localStorage.setItem('ezv2_user', JSON.stringify(data.user));
            localStorage.setItem('ezv2_token', data.token);
            
            if (statusMsg) {
                statusMsg.textContent = 'Login realizado com sucesso!';
                statusMsg.className = 'status-modern success';
                statusMsg.classList.remove('hidden');
            }
            
            updateUserUI();
            
            setTimeout(() => {
                switchTab('home');
            }, 1500);
        } else {
            if (statusMsg) {
                statusMsg.textContent = data.error || 'Erro ao fazer login';
                statusMsg.className = 'status-modern error';
                statusMsg.classList.remove('hidden');
            }
        }
    } catch (error) {
        console.error('Erro:', error);
        if (statusMsg) {
            statusMsg.textContent = 'Erro ao conectar com o servidor';
            statusMsg.className = 'status-modern error';
            statusMsg.classList.remove('hidden');
        }
    } finally {
        if (btnText) btnText.classList.remove('hidden');
        if (btnSpinner) btnSpinner.classList.add('hidden');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const btnText = document.getElementById('register-btn-text');
    const btnSpinner = document.getElementById('register-btn-spinner');
    const statusMsg = document.getElementById('register-status');
    
    btnText.classList.add('hidden');
    btnSpinner.classList.remove('hidden');
    statusMsg.classList.add('hidden');
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            statusMsg.textContent = 'Conta criada com sucesso! Faça login para continuar.';
            statusMsg.className = 'login-status success';
            statusMsg.classList.remove('hidden');
            
            setTimeout(() => {
                showLogin();
            }, 2000);
        } else {
            statusMsg.textContent = data.error || 'Erro ao criar conta';
            statusMsg.className = 'login-status error';
            statusMsg.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Erro:', error);
        statusMsg.textContent = 'Erro ao conectar com o servidor';
        statusMsg.className = 'login-status error';
        statusMsg.classList.remove('hidden');
    } finally {
        btnText.classList.remove('hidden');
        btnSpinner.classList.add('hidden');
    }
}

function showRegister() {
    const loginCard = document.getElementById('login-card');
    const registerCard = document.getElementById('register-card');
    if (loginCard) loginCard.classList.add('hidden');
    if (registerCard) registerCard.classList.remove('hidden');
}

function showLogin() {
    const loginCard = document.getElementById('login-card');
    const registerCard = document.getElementById('register-card');
    if (registerCard) registerCard.classList.add('hidden');
    if (loginCard) loginCard.classList.remove('hidden');
}

function logout() {
    appState.currentUser = null;
    localStorage.removeItem('ezv2_user');
    localStorage.removeItem('ezv2_token');
    updateUserUI();
    switchTab('home');
}

// ========== CURSOS - REMOVIDO ==========
// A aba de estudos foi removida conforme solicitado

// ========== TERMOS DE USO ==========
let termsAccepted = false;

function checkTermsAcceptance() {
    const input = document.getElementById('youtube-url');
    const url = input?.value.trim() || '';
    const checkboxContainer = document.getElementById('terms-checkbox-container');
    const checkbox = document.getElementById('terms-checkbox');
    const btn = document.getElementById('btn-process-youtube');
    
    if (!input || !checkboxContainer || !checkbox || !btn) return;
    
    // Se há URL do YouTube, mostrar checkbox
    if (url && isValidYouTubeUrl(url)) {
        checkboxContainer.style.display = 'block';
        // Verificar se checkbox está marcado para habilitar botão
        updateButtonState();
    } else {
        checkboxContainer.style.display = 'none';
        checkbox.checked = false;
        termsAccepted = false;
        btn.disabled = true;
    }
}

function handleTermsCheckboxChange() {
    const checkbox = document.getElementById('terms-checkbox');
    termsAccepted = checkbox?.checked || false;
    updateButtonState();
    
    // Esconder alerta quando termos forem aceitos
    if (termsAccepted) {
        const termsAlert = document.getElementById('terms-alert');
        if (termsAlert) {
            termsAlert.style.display = 'none';
        }
        
        // Remover borda vermelha do checkbox container
        const checkboxContainer = document.getElementById('terms-checkbox-container');
        if (checkboxContainer) {
            checkboxContainer.style.border = '1px solid var(--border)';
        }
        
        // Registrar aceite no backend
        registerTermsAcceptance();
    }
}

function updateButtonState() {
    const checkbox = document.getElementById('terms-checkbox');
    const btn = document.getElementById('btn-process-youtube');
    
    if (!checkbox || !btn) return;
    
    // Botão só habilitado se checkbox estiver marcado
    btn.disabled = !checkbox.checked;
    
    // Adicionar estilo visual quando desabilitado
    if (btn.disabled) {
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
    } else {
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    }
}

function openTermsModal() {
    const modal = document.getElementById('terms-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function closeTermsModal() {
    const modal = document.getElementById('terms-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

function focusTermsCheckbox() {
    const checkbox = document.getElementById('terms-checkbox');
    const checkboxContainer = document.getElementById('terms-checkbox-container');
    
    // Garantir que o checkbox container está visível
    if (checkboxContainer) {
        checkboxContainer.style.display = 'block';
        // Scroll suave até o checkbox
        setTimeout(() => {
            checkboxContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }
    
    // Focar no checkbox
    if (checkbox) {
        checkbox.focus();
        // Destacar visualmente
        checkboxContainer.style.border = '2px solid var(--primary)';
        checkboxContainer.style.animation = 'pulse 0.5s';
        setTimeout(() => {
            checkboxContainer.style.border = '1px solid var(--border)';
            checkboxContainer.style.animation = '';
        }, 500);
    }
}

async function registerTermsAcceptance() {
    try {
        const clientIP = await fetch('https://api.ipify.org?format=json')
            .then(res => res.json())
            .then(data => data.ip)
            .catch(() => null);
        
        const sessionId = localStorage.getItem('ezv2_session_id') || generateSessionId();
        if (!localStorage.getItem('ezv2_session_id')) {
            localStorage.setItem('ezv2_session_id', sessionId);
        }
        
        await apiClient.post('/api/terms/accept', {
            timestamp: new Date().toISOString(),
            sessionId: sessionId,
            ipAddress: clientIP,
            userAgent: navigator.userAgent
        });
        
        console.log('[TERMS] Aceite dos termos registrado com sucesso');
    } catch (error) {
        console.error('[TERMS] Erro ao registrar aceite:', error);
        // Não bloquear o fluxo se o registro falhar
    }
}

function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ========== YOUTUBE & VIDEO PROCESSING ==========
function setupYouTubeInput() {
    const input = document.getElementById('youtube-url');
    const btn = document.getElementById('btn-process-youtube');
    
    if (!input) return;
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleYouTubeSubmit();
        }
    });
    
    // Debounce para buscar preview quando URL válida é colada
    let previewTimeout = null;
    input.addEventListener('input', () => {
        const url = input.value.trim();
        
        // Verificar termos de uso quando URL válida
        checkTermsAcceptance();
        
        if (btn) {
            if (isValidYouTubeUrl(url)) {
                // Botão só habilitado se termos aceitos
                const checkbox = document.getElementById('terms-checkbox');
                btn.disabled = !checkbox || !checkbox.checked;
                
                // Buscar preview após 1 segundo de inatividade
                clearTimeout(previewTimeout);
                previewTimeout = setTimeout(() => {
                    loadYouTubePreview(url);
                }, 1000);
            } else {
                btn.disabled = url.length === 0;
                clearTimeout(previewTimeout);
                clearVideoPreview();
            }
        }
    });
    
    // Inicializar estado do botão
    updateButtonState();
}

function isValidYouTubeUrl(url) {
    const patterns = [
        /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/,
        /^https?:\/\/youtube\.com\/.*[?&]v=/
    ];
    return patterns.some(pattern => pattern.test(url));
}

/**
 * Carregar preview do vídeo YouTube (thumbnail, título, duração)
 */
async function loadYouTubePreview(url) {
    try {
        const response = await fetch(`${API_BASE}/api/youtube/info?url=${encodeURIComponent(url)}`);
        const data = await response.json();
        
        if (response.ok && data.success) {
            displayYouTubePreview(data);
            appState.youtubePreview = data;
        }
    } catch (error) {
        console.warn('[PREVIEW] Erro ao carregar preview:', error);
    }
}

/**
 * Exibir preview do vídeo YouTube (thumbnail)
 */
function displayYouTubePreview(videoInfo) {
    const container = document.getElementById('video-player-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="youtube-preview" style="position: relative; width: 100%; height: 100%; border-radius: 12px; overflow: hidden;">
            <img src="${videoInfo.thumbnail}" alt="${videoInfo.title}" style="width: 100%; height: 100%; object-fit: cover;">
            <div class="preview-overlay" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.7) 100%); display: flex; flex-direction: column; justify-content: flex-end; padding: 16px; color: white;">
                <h4 style="margin: 0 0 8px 0; font-size: 1rem; font-weight: 600; line-height: 1.3;">${videoInfo.title}</h4>
                <div style="display: flex; gap: 12px; font-size: 0.875rem; opacity: 0.9;">
                    <span>${formatDuration(videoInfo.duration)}</span>
                    <span>•</span>
                    <span>${videoInfo.author}</span>
                </div>
            </div>
        </div>
    `;
    
    // NÃO mostrar trim card automaticamente - apenas preview
}

/**
 * Limpar preview
 */
function clearVideoPreview() {
    const container = document.getElementById('video-player-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="video-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path d="M8 5V19L19 12L8 5Z" fill="currentColor"/>
            </svg>
            <p>Carregando vídeo...</p>
        </div>
    `;
}

/**
 * Formatar duração em segundos para MM:SS
 */
function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * REFATORADO: Download automático de vídeo YouTube com progresso em tempo real
 * Quando URL é submetida, baixa com progresso SSE e renderiza player
 */
// Estado do arquivo selecionado para upload
let selectedFile = null;

/**
 * Trocar entre tabs (YouTube e Upload)
 */
function switchInputTab(tabName) {
    // Atualizar tabs
    document.querySelectorAll('.input-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
    
    // Mostrar opção correspondente
    document.getElementById('input-youtube')?.classList.toggle('active', tabName === 'youtube');
    document.getElementById('input-youtube')?.classList.toggle('hidden', tabName !== 'youtube');
    document.getElementById('input-upload')?.classList.toggle('active', tabName === 'upload');
    document.getElementById('input-upload')?.classList.toggle('hidden', tabName !== 'upload');
    
    // Limpar status
    const statusYoutube = document.getElementById('youtube-status');
    const statusUpload = document.getElementById('upload-status');
    if (statusYoutube) statusYoutube.classList.add('hidden');
    if (statusUpload) statusUpload.classList.add('hidden');
}

/**
 * Handler para seleção de arquivo
 */
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    selectedFile = file;
    
    // Mostrar informações do arquivo
    const fileInfo = document.getElementById('file-info');
    const fileName = document.getElementById('file-name');
    const fileSize = document.getElementById('file-size');
    const uploadBtn = document.getElementById('btn-process-upload');
    
    if (fileInfo && fileName && fileSize) {
        fileName.textContent = file.name;
        const sizeMB = (file.size / 1024 / 1024).toFixed(2);
        fileSize.textContent = `${sizeMB} MB`;
        fileInfo.classList.remove('hidden');
    }
    
    // Habilitar botão de upload
    if (uploadBtn) {
        uploadBtn.disabled = false;
    }
    
    // Ocultar conteúdo de upload inicial
    const uploadContent = document.querySelector('.upload-content');
    if (uploadContent && fileInfo) {
        uploadContent.style.display = fileInfo.classList.contains('hidden') ? 'flex' : 'none';
    }
}

/**
 * Handler para upload de vídeo
 */
async function handleUploadSubmit() {
    if (!selectedFile) {
        showUploadStatus('Por favor, selecione um arquivo de vídeo', 'error');
        return;
    }
    
    const btn = document.getElementById('btn-process-upload');
    const btnText = document.getElementById('btn-text-upload');
    const btnLoader = document.getElementById('btn-loader-upload');
    const statusMsg = document.getElementById('upload-status');
    
    // Estado de loading
    if (btn) {
        btn.disabled = true;
        if (btnText) btnText.classList.add('hidden');
        if (btnLoader) btnLoader.classList.remove('hidden');
    }
    if (statusMsg) statusMsg.classList.add('hidden');
    
    try {
        const formData = new FormData();
        formData.append('video', selectedFile);
        
        showUploadStatus('Enviando e validando vídeo...', 'info');
        
        const response = await fetch(`${API_BASE}/api/download/upload`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Erro ao enviar vídeo');
        }
        
        if (data.success && data.videoId && data.ready) {
            // Vídeo enviado e validado com sucesso
            appState.videoId = data.videoId;
            appState.videoInfo = {
                id: data.videoId,
                playableUrl: data.playableUrl,
                duration: data.duration || data.videoDuration,
                uploaded: true,
                validated: true,
                state: 'ready'
            };
            
            console.log('[UPLOAD] Vídeo pronto:', {
                videoId: data.videoId,
                duration: data.duration || data.videoDuration,
                playableUrl: data.playableUrl
            });
            
            showUploadStatus('Vídeo enviado e validado com sucesso!', 'success');
            
            // Renderizar player IMEDIATAMENTE (igual ao YouTube)
            renderVideoPlayer(data.playableUrl);
            
            // Limpar seleção de arquivo
            selectedFile = null;
            document.getElementById('file-input').value = '';
            const fileInfo = document.getElementById('file-info');
            if (fileInfo) fileInfo.classList.add('hidden');
            const uploadContent = document.querySelector('.upload-content');
            if (uploadContent) uploadContent.style.display = 'flex';
            
            // Salvar dados do vídeo no estado
            appState.videoDuration = data.duration || data.videoDuration;
            appState.videoPlayableUrl = data.playableUrl;
            
            // AVANÇAR AUTOMATICAMENTE para etapa 2 (Trim) após upload
            setTimeout(() => {
                showTrimSection();
                // Fazer scroll para a etapa de trim
                scrollToCard('trim');
            }, 500);
            
            // Aguardar um pouco para garantir que elementos estão prontos
            setTimeout(() => {
                setupTrimControlsForVideo({
                    duration: data.duration || data.videoDuration,
                    playableUrl: data.playableUrl
                });
            }, 300);
        } else {
            throw new Error(data.error || 'Upload incompleto');
        }
        
    } catch (error) {
        console.error('[UPLOAD] Erro:', error);
        const errorMessage = error.message || 'Erro ao enviar vídeo. Verifique o formato e tamanho do arquivo.';
        showUploadStatus(errorMessage, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            if (btnText) btnText.classList.remove('hidden');
            if (btnLoader) btnLoader.classList.add('hidden');
        }
    }
}

/**
 * Mostrar status de upload
 */
function showUploadStatus(message, type) {
    const statusMsg = document.getElementById('upload-status');
    if (!statusMsg) return;
    
    statusMsg.textContent = message;
    statusMsg.className = `status-message ${type}`;
    statusMsg.classList.remove('hidden');
}

/**
 * Configurar drag and drop para upload
 */
function setupUploadDragDrop() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    
    if (!uploadArea || !fileInput) return;
    
    // Prevenir comportamento padrão do navegador
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // Highlight quando arrastar sobre
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.add('dragover');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.remove('dragover');
        }, false);
    });
    
    // Handle drop
    uploadArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            fileInput.files = files;
            handleFileSelect({ target: fileInput });
        }
    }, false);
}

async function handleYouTubeSubmit() {
    const input = document.getElementById('youtube-url');
    const url = input.value.trim();
    const btn = document.getElementById('btn-process-youtube');
    const btnText = document.getElementById('btn-text-youtube');
    const btnLoader = document.getElementById('btn-loader-youtube');
    const statusMsg = document.getElementById('youtube-status');
    const checkbox = document.getElementById('terms-checkbox');
    
    if (!url) {
        showStatus('Por favor, insira uma URL do YouTube', 'error');
        return;
    }
    
    if (!isValidYouTubeUrl(url)) {
        showStatus('URL do YouTube inválida. Use formato: https://youtube.com/watch?v=VIDEO_ID', 'error');
        return;
    }
    
    // VERIFICAÇÃO OBRIGATÓRIA: Termos de Uso devem estar aceitos
    if (!checkbox || !checkbox.checked) {
        // Mostrar alerta com botão
        const termsAlert = document.getElementById('terms-alert');
        if (termsAlert) {
            termsAlert.style.display = 'flex';
            // Scroll suave até o alerta
            setTimeout(() => {
                termsAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        }
        
        const checkboxContainer = document.getElementById('terms-checkbox-container');
        if (checkboxContainer) {
            checkboxContainer.style.display = 'block';
            checkboxContainer.style.border = '2px solid var(--error, #ef4444)';
            checkboxContainer.style.animation = 'shake 0.3s';
            setTimeout(() => {
                checkboxContainer.style.border = '1px solid var(--border)';
                checkboxContainer.style.animation = '';
            }, 300);
        }
        return;
    }
    
    // Esconder alerta se termos estiverem aceitos
    const termsAlert = document.getElementById('terms-alert');
    if (termsAlert) {
        termsAlert.style.display = 'none';
    }
    
    // Estado de loading
    if (btn) {
        btn.disabled = true;
        if (btnText) btnText.classList.add('hidden');
        if (btnLoader) btnLoader.classList.remove('hidden');
    }
    if (statusMsg) statusMsg.classList.add('hidden');
    
    try {
        // Iniciar download com progresso SSE
        await downloadWithProgress(url);
        
    } catch (error) {
        console.error('Erro:', error);
        // Mostrar mensagem de erro mais específica se disponível
        const errorMessage = error.message || 'Erro ao baixar vídeo do YouTube. Verifique sua conexão.';
        showStatus(errorMessage, 'error');
        clearDownloadProgress();
    } finally {
        if (btn) {
            btn.disabled = false;
            if (btnText) btnText.classList.remove('hidden');
            if (btnLoader) btnLoader.classList.add('hidden');
        }
    }
}

/**
 * Download com progresso em tempo real usando SSE
 */
async function downloadWithProgress(url) {
    return new Promise((resolve, reject) => {
        const eventSource = new EventSource(`${API_BASE}/api/download/progress?url=${encodeURIComponent(url)}`);
        let lastProgress = 0;
        let hasResolved = false;
        
        // Handler para mensagens padrão
        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('[SSE] Evento recebido:', data);
                
                // Verificar erro primeiro
                if (data.error || data.state === 'error') {
                    if (!hasResolved) {
                        hasResolved = true;
                        eventSource.close();
                        // Mostrar mensagem de erro específica do backend
                        const errorMsg = data.error || 'Erro ao baixar vídeo do YouTube';
                        showStatus(errorMsg, 'error');
                        clearDownloadProgress();
                        reject(new Error(errorMsg));
                    }
                    return;
                }
                
                // Progresso
                if (data.progress !== undefined && data.state === 'downloading') {
                    lastProgress = data.progress;
                    updateDownloadProgress(data.progress, data.message || 'Baixando...');
                    return;
                }
                
                // Conclusão
                if (data.completed && data.videoId && data.ready && data.state === 'ready') {
                    if (!hasResolved) {
                        hasResolved = true;
                        eventSource.close();
                        
                        // Vídeo baixado e VALIDADO - pronto para uso
                        appState.videoId = data.videoId;
                        appState.videoInfo = {
                            id: data.videoId,
                            playableUrl: data.playableUrl,
                            duration: data.duration || data.videoDuration,
                            downloaded: true,
                            validated: true,
                            state: 'ready'
                        };
                        
                        console.log('[SSE] Vídeo pronto:', {
                            videoId: data.videoId,
                            duration: data.duration,
                            playableUrl: data.playableUrl
                        });
                        
                        showStatus('Vídeo baixado e validado com sucesso!', 'success');
                        
                        // Renderizar player IMEDIATAMENTE com arquivo baixado
                        renderVideoPlayer(data.playableUrl);
                        
                        // Salvar dados do vídeo no estado
                        appState.videoDuration = data.duration || data.videoDuration;
                        appState.videoPlayableUrl = data.playableUrl;
                        
                        // AVANÇAR AUTOMATICAMENTE para etapa 2 (Trim) após download
                        setTimeout(() => {
                            showTrimSection();
                            // Fazer scroll para a etapa de trim
                            scrollToCard('trim');
                        }, 500);
                        
                        clearDownloadProgress();
                        resolve(data);
                    }
                    return;
                }
            } catch (error) {
                console.error('[SSE] Erro ao processar evento:', error, event.data);
                if (!hasResolved) {
                    hasResolved = true;
                    eventSource.close();
                    showStatus('Erro ao processar resposta do servidor', 'error');
                    clearDownloadProgress();
                    reject(error);
                }
            }
        };
        
        // Handler para erros de conexão
        eventSource.onerror = (error) => {
            console.error('[SSE] Erro na conexão SSE:', error, eventSource.readyState);
            
            // EventSource.readyState: 0 = CONNECTING, 1 = OPEN, 2 = CLOSED
            if (eventSource.readyState === EventSource.CLOSED) {
                if (!hasResolved) {
                    hasResolved = true;
                    eventSource.close();
                    clearDownloadProgress();
                    
                    // Tentar obter mais informações do erro
                    let errorMsg = 'Erro na conexão com o servidor. ';
                    
                    // Verificar se é problema de CORS ou conexão
                    if (!eventSource.url.includes(window.location.hostname) && window.location.protocol === 'https:' && eventSource.url.includes('http:')) {
                        errorMsg += 'Erro de protocolo (HTTPS/HTTP).';
                    } else {
                        errorMsg += 'Verifique sua conexão e tente novamente.';
                    }
                    
                    showStatus(errorMsg, 'error');
                    reject(new Error('Erro na conexão SSE'));
                }
            }
            // Se ainda está CONNECTING, aguardar um pouco antes de dar erro
            else if (eventSource.readyState === EventSource.CONNECTING) {
                console.warn('[SSE] Reconectando...');
                // Não fazer nada ainda, deixar EventSource tentar reconectar
            }
        };
    });
}

/**
 * Atualizar progresso do download sobre o thumbnail
 */
function updateDownloadProgress(percent, message) {
    const container = document.getElementById('video-player-container');
    if (!container) return;
    
    // Encontrar ou criar overlay de progresso
    let progressOverlay = container.querySelector('.download-progress-overlay');
    if (!progressOverlay) {
        progressOverlay = document.createElement('div');
        progressOverlay.className = 'download-progress-overlay';
        progressOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.85);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: white;
            z-index: 10;
            border-radius: 12px;
            pointer-events: none;
        `;
        
        const preview = container.querySelector('.youtube-preview');
        if (preview) {
            preview.style.position = 'relative';
            preview.appendChild(progressOverlay);
        } else {
            container.appendChild(progressOverlay);
        }
    }
    
    progressOverlay.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <div style="font-size: 2rem; font-weight: 700; margin-bottom: 12px;">${Math.round(percent)}%</div>
            <div style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 20px;">${message}</div>
            <div style="width: 200px; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; overflow: hidden;">
                <div style="width: ${percent}%; height: 100%; background: #4F46E5; transition: width 0.3s ease;"></div>
            </div>
        </div>
    `;
}

/**
 * Limpar overlay de progresso
 */
function clearDownloadProgress() {
    const container = document.getElementById('video-player-container');
    if (!container) return;
    
    const progressOverlay = container.querySelector('.download-progress-overlay');
    if (progressOverlay) {
        progressOverlay.remove();
    }
}

/**
 * REFATORADO: Renderizar player com vídeo local baixado
 * NUNCA usa iframe/embed do YouTube
 */
function renderVideoPlayer(playableUrl) {
    // Renderizar no container principal (trim card)
    const container = document.getElementById('video-player-container');
    let videoElement = null;
    
    if (container) {
        container.innerHTML = '';
        
        // SEMPRE usar elemento <video> HTML5 com arquivo local
        videoElement = document.createElement('video');
        videoElement.src = playableUrl;
        videoElement.controls = true;
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoElement.style.borderRadius = '12px';
        videoElement.style.objectFit = 'contain';
        videoElement.preload = 'metadata';
        videoElement.crossOrigin = 'anonymous';
        
        container.appendChild(videoElement);
    }
    
    // TAMBÉM renderizar no player fixo (sempre visível após download)
    const fixedContainer = document.getElementById('fixed-video-container');
    const fixedPlayer = document.getElementById('fixed-video-player');
    if (fixedContainer && fixedPlayer) {
        fixedContainer.innerHTML = '';
        
        const fixedVideoElement = document.createElement('video');
        fixedVideoElement.src = playableUrl;
        fixedVideoElement.controls = true;
        fixedVideoElement.style.width = '100%';
        fixedVideoElement.style.height = '100%';
        fixedVideoElement.style.borderRadius = '8px';
        fixedVideoElement.style.objectFit = 'contain';
        fixedVideoElement.preload = 'metadata';
        fixedVideoElement.crossOrigin = 'anonymous';
        
        fixedContainer.appendChild(fixedVideoElement);
        
        // Mostrar player fixo (sempre visível)
        fixedPlayer.style.display = 'block';
        
        // Usar o vídeo fixo para eventos se o principal não existir
        if (!videoElement) {
            videoElement = fixedVideoElement;
        }
    }
    
    if (!videoElement) return;
    
    videoElement.addEventListener('loadedmetadata', () => {
        console.log('[PLAYER] Vídeo local carregado:', playableUrl);
        console.log('[PLAYER] Duração:', videoElement.duration);
        
        // Remover overlay imediatamente quando vídeo carregar
        clearDownloadProgress();
        
        // Atualizar duração no estado se necessário
        if (videoElement.duration && !isNaN(videoElement.duration) && videoElement.duration > 0) {
            appState.videoInfo = appState.videoInfo || {};
            appState.videoInfo.duration = Math.floor(videoElement.duration);
            if (!appState.trimEnd && appState.videoInfo.duration) {
                appState.trimEnd = appState.videoInfo.duration;
            }
            
            // Inicializar trim controls automaticamente quando duração estiver disponível
            // Isso garante que o trim funcione mesmo se a seção ainda não estiver visível
            if (appState.videoInfo.duration > 0) {
                // Aguardar um pouco para garantir que elementos DOM estão prontos
                setTimeout(() => {
                    console.log('[PLAYER] Inicializando trim controls...');
                    setupTrimControlsForVideo({
                        duration: appState.videoInfo.duration,
                        playableUrl: playableUrl
                    });
                }, 500);
            }
        } else {
            console.warn('[PLAYER] Duração inválida:', videoElement.duration);
        }
    });
    
    // Garantir que o overlay seja removido quando o vídeo puder ser reproduzido
    videoElement.addEventListener('canplay', () => {
        clearDownloadProgress();
    });
    
    // Remover overlay em caso de erro também
    videoElement.addEventListener('error', () => {
        clearDownloadProgress();
    });
    
    videoElement.addEventListener('error', (e) => {
        console.error('[PLAYER] Erro ao carregar vídeo local:', e);
        if (container) {
            container.innerHTML = '<div class="video-placeholder"><p>Erro ao carregar vídeo. Verifique se o download foi concluído.</p></div>';
        }
    });
}

function showStatus(message, type) {
    const statusMsg = document.getElementById('youtube-status');
    if (!statusMsg) return;
    statusMsg.textContent = message;
    statusMsg.className = `status-message ${type}`;
    statusMsg.classList.remove('hidden');
}

/**
 * Verificar estado do vídeo no backend antes de mostrar trim
 */
async function verifyVideoReady(videoId) {
    try {
        const response = await fetch(`${API_BASE}/api/download/state/${videoId}`);
        const data = await response.json();
        
        if (data.success && data.ready && data.state === 'ready') {
            return true;
        }
        return false;
    } catch (error) {
        console.error('[VERIFY] Erro ao verificar estado:', error);
        return false;
    }
}

/**
 * Mostra a seção de trim (ETAPA 3 - após configurações)
 */
async function showTrimSection() {
    // Sem validação bloqueante - usuário controla o fluxo
    
    const trimCard = document.getElementById('trim-card');
    if (!trimCard) return;
    
    // Verificar se vídeo está pronto (apenas log, sem bloquear)
    if (!appState.videoId) {
        console.warn('[TRIM] VideoId não encontrado, mas permitindo continuar');
    }
    
    // Verificar estado no backend (apenas log, sem bloquear)
    const isReady = await verifyVideoReady(appState.videoId);
    if (!isReady) {
        console.warn('[TRIM] Vídeo pode não estar pronto, mas permitindo continuar');
    }
    
    // Card sempre visível - garantir que está visível
    trimCard.style.display = 'block';
    updateProgressSteps('trim'); // Etapa 2 (após download)
    
    // Configurar controles de trim se ainda não foram configurados
    if (appState.videoDuration && appState.videoPlayableUrl) {
        setTimeout(() => {
            setupTrimControlsForVideo({
                duration: appState.videoDuration,
                playableUrl: appState.videoPlayableUrl
            });
        }, 300);
    }
    
    // Fazer scroll automático para a etapa de trim
    scrollToCard('trim');
}

/**
 * Salva o intervalo e AVANÇA AUTOMATICAMENTE para etapa 3 (Legendas)
 */
function saveTrimInterval() {
    // Validação básica apenas (sem bloquear)
    if (appState.trimStart >= appState.trimEnd) {
        console.warn('[TRIM] Tempo de início maior ou igual ao fim - pode causar problemas');
        // Não bloquear - deixar usuário decidir
    }
    
    console.log('[TRIM] Intervalo salvo:', appState.trimStart, '-', appState.trimEnd);
    
    // Calcular número de clipes
    if (appState.trimStart !== undefined && appState.trimEnd !== undefined && appState.cutDuration) {
        const duration = appState.trimEnd - appState.trimStart;
        appState.numberOfCuts = Math.floor(duration / appState.cutDuration);
        updateClipsCount();
    }
    
    // AVANÇAR AUTOMATICAMENTE para etapa 3 (Legendas) após salvar intervalo
    setTimeout(() => {
        showCaptionsSection();
        // Fazer scroll para a etapa de legendas
        scrollToCard('captions');
    }, 500);
}

/**
 * Mostra botão para continuar após salvar intervalo
 */
function showContinueButtonAfterTrim() {
    const trimCard = document.getElementById('trim-card');
    if (!trimCard) return;
    
    // Verificar se botão já existe
    let continueSection = document.getElementById('trim-continue-section');
    if (!continueSection) {
        continueSection = document.createElement('div');
        continueSection.id = 'trim-continue-section';
        continueSection.style.cssText = 'margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border);';
        continueSection.innerHTML = `
            <button class="btn-primary" onclick="continueToCaptions()" style="width: 100%;">
                Gerar Conteúdo com Clipes Selecionados
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="margin-left: 8px;">
                    <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        `;
        trimCard.appendChild(continueSection);
    }
    
    continueSection.classList.remove('hidden');
    // NÃO fazer scroll automático
}

/**
 * Continua para geração de legendas após trim (ETAPA 3)
 */
function continueToCaptions() {
    // Sem validação bloqueante - usuário controla o fluxo
    showCaptionsSection(); // Etapa 3
    // Fazer scroll para a etapa de legendas
    scrollToCard('captions');
}

/**
 * Mostra a seção de legendas (ETAPA 4 - após salvar trim)
 */
function showCaptionsSection() {
    // Sem validação bloqueante - usuário controla o fluxo
    
    const captionsCard = document.getElementById('captions-card');
    if (!captionsCard) return;
    
    // Verificar se vídeo está pronto (apenas log, sem bloquear)
    if (!appState.videoId) {
        console.warn('[CAPTIONS] VideoId não encontrado, mas permitindo continuar');
    }
    
    // Card sempre visível - garantir que está visível
    captionsCard.style.display = 'block';
    updateProgressSteps('captions'); // Etapa 3 (após trim)
    
    // Inicializar editor de legendas
    setTimeout(() => {
        initializeCaptionsEditor(appState.videoId);
        // Fazer scroll para a etapa de legendas
        scrollToCard('captions');
    }, 100);
}

/**
 * Inicializa o editor de legendas
 */
let captionsEditorInstance = null;

function initializeCaptionsEditor(videoId) {
    const container = document.getElementById('captions-editor-container');
    if (!container) {
        console.error('[CAPTIONS] Container não encontrado');
        return;
    }

    // Limpar container anterior
    container.innerHTML = '';

    // Garantir que o card está visível
    const captionsCard = document.getElementById('captions-card');
    if (captionsCard) {
        captionsCard.style.display = 'block';
    }

    // Verificar se o script já foi carregado
    if (window.CaptionsEditor) {
        createCaptionsEditor(videoId);
    } else {
        // Carregar script dinamicamente se necessário
        if (!document.getElementById('captions-editor-js')) {
            const script = document.createElement('script');
            script.id = 'captions-editor-js';
            script.src = '/captions-editor.js?v=3.0.0';
            script.onload = () => {
                createCaptionsEditor(videoId);
            };
            document.body.appendChild(script);
        } else {
            // Aguardar um pouco e tentar novamente
            setTimeout(() => createCaptionsEditor(videoId), 500);
        }
    }
}

function createCaptionsEditor(videoId) {
    const container = document.getElementById('captions-editor-container');
    if (!container || !window.CaptionsEditor) {
        // Tentar novamente após um delay
        setTimeout(() => createCaptionsEditor(videoId), 500);
        return;
    }

    // Criar wrapper para o editor
    const wrapper = document.createElement('div');
    wrapper.id = 'captions-editor-wrapper';
    container.appendChild(wrapper);

    // Inicializar editor (ferramenta independente do trim)
    captionsEditorInstance = new CaptionsEditor('captions-editor-wrapper', {
        videoId: videoId,
        apiBase: window.location.origin // Usar origem completa para garantir URLs corretas
    });

    // Fluxo agora avança automaticamente após gerar legendas
}

// Função removida - usando showTrimSection() que já existe acima

// Função removida - substituída por renderVideoPlayer

function extractYouTubeId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/.*[?&]v=([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

function setupTrimControls() {
    // Timeline drag-based trim tool será inicializado quando vídeo for carregado
    // Não precisa de inicialização aqui
}

/**
 * REFATORADO: Configurar timeline drag-based trim tool
 * Timeline estilo YouTube Studio/Premiere com handles arrastáveis
 */
function setupTrimControlsForVideo(video) {
    // Verificar se o card de trim está visível
    const trimCard = document.getElementById('trim-card');
    if (!trimCard) {
        console.warn('[TRIM] Card de trim não encontrado');
        return;
    }
    
    const duration = video.duration || appState.videoInfo?.duration || 0;
    
    if (duration === 0 || !duration || isNaN(duration)) {
        console.warn('[TRIM] Duração do vídeo não disponível:', duration);
        console.warn('[TRIM] video object:', video);
        console.warn('[TRIM] appState.videoInfo:', appState.videoInfo);
        
        // Tentar obter duração do elemento de vídeo diretamente
        const videoElement = document.querySelector('#video-player-container video');
        if (videoElement && videoElement.duration && !isNaN(videoElement.duration) && videoElement.duration > 0) {
            const videoDuration = Math.floor(videoElement.duration);
            console.log('[TRIM] Usando duração do elemento de vídeo:', videoDuration);
            return setupTrimControlsForVideo({ duration: videoDuration, playableUrl: video.playableUrl });
        }
        
        // Tentar novamente após um delay
        setTimeout(() => {
            const retryVideoElement = document.querySelector('#video-player-container video');
            if (retryVideoElement && retryVideoElement.duration) {
                console.log('[TRIM] Retry: Usando duração do elemento de vídeo:', retryVideoElement.duration);
                setupTrimControlsForVideo({ duration: Math.floor(retryVideoElement.duration), playableUrl: video.playableUrl });
            } else {
                showStatus('Duração do vídeo não disponível. Aguarde o processamento.', 'error');
            }
        }, 1000);
        return;
    }
    
    console.log('[TRIM] Configurando trim para vídeo de', duration, 'segundos');
    
    // Inicializar estado
    appState.trimStart = 0;
    appState.trimEnd = Math.floor(duration);
    appState.videoDuration = Math.floor(duration);
    
    // Atualizar timecodes imediatamente
    const startTimecode = document.getElementById('start-timecode');
    const endTimecode = document.getElementById('end-timecode');
    const trimDurationEl = document.getElementById('trim-duration');
    
    if (startTimecode) startTimecode.textContent = formatTime(0);
    if (endTimecode) endTimecode.textContent = formatTime(Math.floor(duration));
    if (trimDurationEl) trimDurationEl.textContent = formatTime(Math.floor(duration));
    
    // Aguardar um pouco para garantir que o DOM está pronto e o card está visível
    setTimeout(() => {
        // Verificar novamente se elementos existem
        const track = document.getElementById('timeline-track');
        if (!track) {
            console.warn('[TRIM] Timeline track não encontrado, tentando novamente...');
            setTimeout(() => initializeTimeline(Math.floor(duration)), 500);
            return;
        }
        
        // Inicializar timeline drag-based
        console.log('[TRIM] Inicializando timeline...');
        initializeTimeline(Math.floor(duration));
        
        // Calcular clips inicial
        calculateClips();
        
        console.log('[TRIM] Timeline configurada - Início:', appState.trimStart, 'Fim:', appState.trimEnd);
    }, 200);
}

// Variável para rastrear se a timeline já foi inicializada e armazenar handlers
let timelineInitialized = false;
let timelineHandlers = null;

/**
 * Inicializar timeline drag-based trim tool
 * Previne múltiplas inicializações que causam listeners duplicados
 */
function initializeTimeline(duration) {
    const track = document.getElementById('timeline-track');
    const selected = document.getElementById('timeline-selected');
    const handleStart = document.getElementById('timeline-handle-start');
    const handleEnd = document.getElementById('timeline-handle-end');
    
    if (!track || !selected || !handleStart || !handleEnd) {
        console.warn('[TIMELINE] Elementos não encontrados. Tentando novamente...');
        // Tentar novamente após um delay se elementos não estiverem prontos
        setTimeout(() => {
            const retryTrack = document.getElementById('timeline-track');
            if (retryTrack) {
                console.log('[TIMELINE] Elementos encontrados na segunda tentativa');
                initializeTimeline(duration);
            } else {
                console.error('[TIMELINE] Elementos ainda não encontrados após retry');
            }
        }, 500);
        return;
    }
    
    console.log('[TIMELINE] Inicializando timeline com duração:', duration);
    
    // Limpar listeners anteriores se já foi inicializado
    if (timelineInitialized && timelineHandlers) {
        console.log('[TIMELINE] Limpando listeners anteriores...');
        if (timelineHandlers.mousemove) {
            document.removeEventListener('mousemove', timelineHandlers.mousemove);
        }
        if (timelineHandlers.touchmove) {
            document.removeEventListener('touchmove', timelineHandlers.touchmove);
        }
        if (timelineHandlers.mouseup) {
            document.removeEventListener('mouseup', timelineHandlers.mouseup);
        }
        if (timelineHandlers.touchend) {
            document.removeEventListener('touchend', timelineHandlers.touchend);
        }
        if (timelineHandlers.resize) {
            window.removeEventListener('resize', timelineHandlers.resize);
        }
    }
    
    const trackRect = track.getBoundingClientRect();
    const trackWidth = trackRect.width;
    
    // Configurar posições iniciais (0% a 100%)
    let startPercent = 0;
    let endPercent = 100;
    
    // Atualizar visual da timeline
    function updateTimeline() {
        const rect = track.getBoundingClientRect();
        const currentTrackWidth = rect.width;
        const startPx = (startPercent / 100) * currentTrackWidth;
        const endPx = (endPercent / 100) * currentTrackWidth;
        const selectedWidth = Math.max(0, endPx - startPx);
        
        selected.style.left = startPx + 'px';
        selected.style.width = selectedWidth + 'px';
        
        handleStart.style.left = startPx + 'px';
        handleEnd.style.left = endPx + 'px';
        
        // Calcular tempos em segundos
        const startTime = Math.max(0, (startPercent / 100) * duration);
        const endTime = Math.min(duration, (endPercent / 100) * duration);
        const trimDuration = Math.max(0, endTime - startTime);
        
        // Atualizar estado
        appState.trimStart = Math.floor(startTime);
        appState.trimEnd = Math.floor(endTime);
        
        // Atualizar timecodes (verificar se elementos existem)
        const startTimecodeEl = document.getElementById('start-timecode');
        const endTimecodeEl = document.getElementById('end-timecode');
        const trimDurationEl = document.getElementById('trim-duration');
        const handleStartTimecodeEl = document.getElementById('handle-start-timecode');
        const handleEndTimecodeEl = document.getElementById('handle-end-timecode');
        
        if (startTimecodeEl) startTimecodeEl.textContent = formatTime(appState.trimStart);
        if (endTimecodeEl) endTimecodeEl.textContent = formatTime(appState.trimEnd);
        if (trimDurationEl) trimDurationEl.textContent = formatTime(Math.floor(trimDuration));
        if (handleStartTimecodeEl) handleStartTimecodeEl.textContent = formatTime(appState.trimStart);
        if (handleEndTimecodeEl) handleEndTimecodeEl.textContent = formatTime(appState.trimEnd);
        
        // Calcular clips em tempo real
        calculateClips();
        
        console.log('[TRIM] Atualizado - Início:', appState.trimStart, 'Fim:', appState.trimEnd, 'Duração:', trimDuration);
    }
    
    // Atualizar timeline inicialmente
    updateTimeline();
    
    // Converter posição do mouse para percentual
    function getPercentFromEvent(e) {
        const rect = track.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        return Math.max(0, Math.min(100, (x / rect.width) * 100));
    }
    
    // Drag handle start
    let isDraggingStart = false;
    handleStart.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isDraggingStart = true;
    });
    
    handleStart.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isDraggingStart = true;
    });
    
    // Drag handle end
    let isDraggingEnd = false;
    handleEnd.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isDraggingEnd = true;
    });
    
    handleEnd.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isDraggingEnd = true;
    });
    
    // Criar handlers que podem ser removidos depois
    const mousemoveHandler = (e) => {
        if (isDraggingStart || isDraggingEnd) {
            const percent = getPercentFromEvent(e);
            
            if (isDraggingStart) {
                startPercent = Math.max(0, Math.min(percent, endPercent - 1));
            } else if (isDraggingEnd) {
                endPercent = Math.max(startPercent + 1, Math.min(100, percent));
            }
            
            updateTimeline();
        }
    };
    
    const touchmoveHandler = (e) => {
        if (isDraggingStart || isDraggingEnd) {
            e.preventDefault();
            const percent = getPercentFromEvent(e);
            
            if (isDraggingStart) {
                startPercent = Math.max(0, Math.min(percent, endPercent - 1));
            } else if (isDraggingEnd) {
                endPercent = Math.max(startPercent + 1, Math.min(100, percent));
            }
            
            updateTimeline();
        }
    };
    
    const mouseupHandler = () => {
        isDraggingStart = false;
        isDraggingEnd = false;
    };
    
    const touchendHandler = () => {
        isDraggingStart = false;
        isDraggingEnd = false;
    };
    
    // Adicionar listeners
    document.addEventListener('mousemove', mousemoveHandler);
    document.addEventListener('touchmove', touchmoveHandler);
    document.addEventListener('mouseup', mouseupHandler);
    document.addEventListener('touchend', touchendHandler);
    
    // Clique na track para mover playhead (opcional)
    track.addEventListener('click', (e) => {
        if (!isDraggingStart && !isDraggingEnd) {
            // Pode implementar playhead se necessário
        }
    });
    
    // Atualizar ao redimensionar (debounced)
    let resizeTimeout;
    const resizeHandler = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            updateTimeline();
        }, 100);
    };
    window.addEventListener('resize', resizeHandler);
    
    // Armazenar handlers para poder remover depois
    timelineHandlers = {
        mousemove: mousemoveHandler,
        touchmove: touchmoveHandler,
        mouseup: mouseupHandler,
        touchend: touchendHandler,
        resize: resizeHandler
    };
    
    timelineInitialized = true;
    console.log('[TIMELINE] Timeline inicializada com sucesso');
}

// Funções updateStartTime e updateEndTime removidas - agora usamos timeline drag-based
// updateTimeDisplay também removida - timecodes atualizados diretamente na timeline

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function selectDuration(seconds) {
    appState.cutDuration = seconds;
    
    document.querySelectorAll('.duration-option').forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.duration) === seconds) {
            btn.classList.add('active');
        }
    });
    
    calculateClips();
}

/**
 * REFATORADO: Calcular clips dinamicamente
 * Calcula para 60s e 120s automaticamente
 * Usa novo endpoint da API
 */
async function calculateClips() {
    const start = Math.max(0, Math.floor(appState.trimStart || 0));
    const end = Math.max(start + 1, Math.floor(appState.trimEnd || 0));
    const duration = appState.cutDuration || 60;
    
    // Validar valores
    if (start < 0 || end <= start) {
        console.warn('[CALC] Valores de trim inválidos:', { start, end });
        appState.numberOfCuts = 0;
        updateClipsDisplay(0, 0, 0);
        return;
    }
    
    // Calcular localmente para resposta imediata
    const trimmedSeconds = end - start;
    const clips60s = Math.floor(trimmedSeconds / 60);
    const clips120s = Math.floor(trimmedSeconds / 120);
    const selectedClips = Math.floor(trimmedSeconds / duration);
    
    appState.numberOfCuts = selectedClips;
    
    // Atualizar display imediatamente
    updateClipsDisplay(clips60s, clips120s, selectedClips);
    
    // Também calcular via API para validação
    if (appState.videoId) {
        try {
            const response = await fetch(`${API_BASE}/api/trim/count-clips`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    videoId: appState.videoId,
                    startTime: start,
                    endTime: end,
                    clipDuration: duration
                })
            });
            
            const data = await response.json();
            if (data.success) {
                // Atualizar com dados da API (mais preciso)
                updateClipsDisplay(data.clips60s, data.clips120s, data.selectedClipsCount);
                console.log('[CALC] Cálculo validado pela API:', data);
            }
        } catch (error) {
            console.warn('[CALC] Erro ao calcular via API:', error);
            // Continuar com cálculo local
        }
    }
    
    if (selectedClips > 0) {
        showNextSteps();
    }
}

/**
 * Atualizar display de clips (60s e 120s)
 */
function updateClipsDisplay(clips60s, clips120s, selectedClips) {
    const clipsCount = document.getElementById('clips-count');
    const clipsResult = document.getElementById('clips-result');
    const previewTotal = document.getElementById('preview-total');
    
    // Atualizar contador principal
    if (clipsCount) clipsCount.textContent = selectedClips;
    if (previewTotal) previewTotal.textContent = selectedClips;
    
    // Exibir ambos os valores (60s e 120s)
    let clipsInfo = document.getElementById('clips-info');
    if (!clipsInfo) {
        // Criar elemento se não existir
        clipsInfo = document.createElement('div');
        clipsInfo.id = 'clips-info';
        const clipsResult = document.getElementById('clips-result');
        if (clipsResult) {
            clipsResult.appendChild(clipsInfo);
        }
    }
    
    if (clipsInfo) {
        clipsInfo.innerHTML = `
            <div style="display: flex; gap: 16px; margin-top: 8px; font-size: 0.875rem; color: var(--text-secondary);">
                <div><strong>60s:</strong> ${clips60s} clips</div>
                <div><strong>120s:</strong> ${clips120s} clips</div>
            </div>
        `;
    }
    
    if (clipsResult) {
        if (selectedClips > 0) {
            clipsResult.style.opacity = '1';
        } else {
            clipsResult.style.opacity = '0.5';
        }
    }
    
    console.log(`[CALC] Clips calculados:`, {
        clips60s,
        clips120s,
        selectedClips,
        trimmedDuration: appState.trimEnd - appState.trimStart
    });
}

function showNextSteps() {
    // AVANÇAR AUTOMATICAMENTE para headline após selecionar nicho - ETAPA 6
    updateProgressSteps('headline'); // Etapa 6
    updateGenerateSummary();
    const headlineCard = document.getElementById('headline-card');
    if (headlineCard) {
        headlineCard.style.display = 'block';
        // Fazer scroll para a etapa de headline
        scrollToCard('headline');
    }
}

/**
 * Avança para step de nicho (ETAPA 5)
 */
function showNicheSection() {
    // Sem validação bloqueante - usuário controla o fluxo
    
    const nicheCard = document.getElementById('niche-card');
    if (nicheCard) {
        // Card sempre visível - garantir que está visível
        nicheCard.style.display = 'block';
        updateProgressSteps('niche'); // Etapa 5 (após configurations)
        // Fazer scroll para a etapa de nicho
        scrollToCard('niche');
    }
}

/**
 * Atualiza resumo na tela de gerar
 */
function updateGenerateSummary() {
    const summaryTrim = document.getElementById('summary-trim');
    const summaryClips = document.getElementById('summary-clips');
    const summaryNiche = document.getElementById('summary-niche');
    const summaryHeadline = document.getElementById('summary-headline');
    
    if (summaryTrim) {
        if (appState.trimStart !== undefined && appState.trimEnd !== undefined) {
            summaryTrim.textContent = `${formatTime(appState.trimStart)} - ${formatTime(appState.trimEnd)}`;
        } else {
            summaryTrim.textContent = 'Não definido';
        }
    }
    
    if (summaryClips) {
        if (appState.trimStart !== undefined && appState.trimEnd !== undefined && appState.cutDuration) {
            const duration = appState.trimEnd - appState.trimStart;
            const clipsCount = Math.floor(duration / appState.cutDuration);
            summaryClips.textContent = `${clipsCount} clipes`;
        } else {
            summaryClips.textContent = 'Não calculado';
        }
    }
    
    if (summaryNiche) {
        // Buscar nome do nicho
        const nicheName = document.querySelector(`.niche-card.selected h3`)?.textContent || 
                         document.querySelector(`.niche-card.selected .card-title`)?.textContent || 
                         '-';
        summaryNiche.textContent = nicheName;
    }
    
    if (summaryHeadline) {
        summaryHeadline.textContent = appState.headlineText || 'Não definido';
    }
}

/**
 * Permite editar uma etapa específica (TODAS AS ETAPAS SEMPRE ACESSÍVEIS)
 */
function editStep(stepName) {
    console.log('[EDIT] Editando etapa:', stepName);
    
    const stepIndex = STEP_ORDER.indexOf(stepName);
    if (stepIndex === -1) {
        console.warn('[EDIT] Etapa desconhecida:', stepName);
        return;
    }
    
    // Atualizar para a etapa desejada (todas sempre acessíveis)
    updateProgressSteps(stepName);
    
    // Garantir que o card da etapa esteja visível
    const targetCard = document.querySelector(`[data-step-card="${stepName}"]`);
    
    // Fazer scroll automático para a etapa selecionada
    scrollToCard(stepName);
    if (targetCard) {
        targetCard.style.display = 'block';
    }
    
    // Inicializar controles específicos se necessário
    switch(stepName) {
        case 'trim':
            if (appState.videoDuration && appState.videoPlayableUrl) {
                setTimeout(() => {
                    setupTrimControlsForVideo({
                        duration: appState.videoDuration,
                        playableUrl: appState.videoPlayableUrl
                    });
                }, 300);
            }
            break;
        case 'captions':
            if (appState.videoId) {
                setTimeout(() => {
                    initializeCaptionsEditor(appState.videoId);
                }, 100);
            }
            break;
        case 'niche':
            loadNiches();
            break;
        default:
            // Outras etapas não precisam inicialização especial
            break;
    }
}

async function loadNiches() {
    try {
        const response = await fetch(`${API_BASE}/api/niches`);
        const data = await response.json();
        
        const container = document.getElementById('niches-grid');
        if (!container) return;
        
        container.innerHTML = '';
        
        data.niches.forEach(niche => {
            const card = document.createElement('div');
            card.className = 'niche-card';
            card.innerHTML = `
                <h3>${niche.name}</h3>
                <p>${niche.description}</p>
            `;
            card.addEventListener('click', () => selectNiche(niche.id, card));
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Erro ao carregar nichos:', error);
    }
}

async function selectNiche(nicheId, cardElement) {
    document.querySelectorAll('.niche-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    cardElement.classList.add('selected');
    appState.nicheId = nicheId;
    
    // Salvar nicho escolhido
    console.log('[NICHE] Nicho selecionado:', nicheId);
    
    // Carregar vídeos de retenção
    await loadRetentionVideos(nicheId);
    
    // Mostrar botão para continuar (NÃO avançar automaticamente)
    showContinueButtonAfterNiche();
}

async function loadRetentionVideos(nicheId) {
    try {
        const response = await fetch(`${API_BASE}/api/retention/niche/${nicheId}`);
        const data = await response.json();
        
        const container = document.getElementById('retention-grid');
        if (!container) return;
        
        container.innerHTML = '';
        
        data.videos.forEach(video => {
            const card = document.createElement('div');
            card.className = 'retention-card';
            card.innerHTML = `
                <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">🎬</div>
                <h4 style="font-weight: 600; margin-bottom: 0.5rem;">${video.name}</h4>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center;">
                    ${video.tags?.map(tag => `<span style="padding: 0.25rem 0.5rem; background: var(--bg-tertiary); border-radius: 0.375rem; font-size: 0.75rem; color: var(--text-secondary);">${tag}</span>`).join('') || ''}
                </div>
            `;
            card.addEventListener('click', () => selectRetentionVideo(video.id, card));
            container.appendChild(card);
        });
        
        const previewCard = document.getElementById('preview-card');
        if (previewCard) {
            previewCard.classList.remove('hidden');
            updateProgressSteps('generate');
        }
    } catch (error) {
        console.error('Erro ao carregar vídeos de retenção:', error);
    }
}

function selectRetentionVideo(videoId, cardElement) {
    document.querySelectorAll('.retention-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    cardElement.classList.add('selected');
    appState.retentionVideoId = videoId;
    updatePreviewStyle();
}

function updateRetentionMode(mode) {
    appState.retentionVideoId = mode;
    console.log('[RETENTION] Modo atualizado:', mode);
    
    // Mostrar/ocultar seção de upload
    const uploadSection = document.getElementById('retention-upload-section');
    if (uploadSection) {
        uploadSection.classList.toggle('hidden', mode !== 'upload');
    }
}

// Estado do arquivo de retenção
let retentionFile = null;

/**
 * Handler para seleção de arquivo de retenção
 */
function handleRetentionFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    retentionFile = file;
    
    const fileInfo = document.getElementById('retention-file-info');
    const fileName = document.getElementById('retention-file-name');
    const fileSize = document.getElementById('retention-file-size');
    const uploadContent = document.querySelector('#retention-upload-area .upload-content');
    
    if (fileInfo && fileName && fileSize) {
        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);
        fileInfo.classList.remove('hidden');
        
        if (uploadContent) {
            uploadContent.style.display = 'none';
        }
    }
    
    // Fazer upload do arquivo
    uploadRetentionFile(file);
}

/**
 * Upload do arquivo de retenção
 */
async function uploadRetentionFile(file) {
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('videoId', appState.videoId);
        
        const response = await fetch(`${API_BASE}/api/retention/upload-custom`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success && data.retentionPath) {
            appState.retentionVideoId = `upload:${data.retentionPath}`;
            console.log('[RETENTION] Upload concluído:', data.retentionPath);
        } else {
            throw new Error(data.error || 'Erro ao fazer upload');
        }
    } catch (error) {
        console.error('[RETENTION] Erro no upload:', error);
        alert('Erro ao fazer upload do arquivo de retenção: ' + error.message);
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function updateHeadlineText() {
    const headline = document.getElementById('preview-headline');
    const textInput = document.getElementById('headline-text-input');
    
    if (!headline || !textInput) return;
    
    const text = textInput.value.trim() || 'Headline';
    appState.headlineText = text;
    
    // Aplicar estilos completos (inclui quebra de linha que corresponde ao vídeo final)
    applyHeadlinePreviewStyles();
    
    // Atualizar resumo
    updateGenerateSummary();
}

function updateHeadlineSize() {
    const sizeSelect = document.getElementById('headline-size-select');
    
    if (!sizeSelect) return;
    
    // Obter tamanho nominal (XS, S, M, L, XL, XXL)
    const sizeName = sizeSelect.value;
    const config = window.HeadlineConfig || {};
    const sizes = config.SIZES || { XS: 36, S: 48, M: 60, L: 72, XL: 96, XXL: 120 };
    
    // Obter tamanho em pixels
    const size = config.getFontSize ? config.getFontSize(sizeName) : (sizes[sizeName] || 72);
    
    // Armazenar tanto o nome quanto o tamanho em pixels
    appState.headlineSizeName = sizeName;
    appState.headlineSize = size;
    
    applyHeadlinePreviewStyles();
}

function updateHeadlineColor() {
    const colorInput = document.getElementById('headline-color-input');
    const colorText = document.getElementById('headline-color-text');
    
    if (!colorInput || !colorText) return;
    
    const color = colorInput.value;
    appState.headlineColor = color;
    colorText.value = color;
    
    applyHeadlinePreviewStyles();
}

function updateHeadlineColorFromText() {
    const colorText = document.getElementById('headline-color-text');
    const colorInput = document.getElementById('headline-color-input');
    
    if (!colorText || !colorInput) return;
    
    const color = colorText.value.trim();
    // Validar formato hex
    if (/^#[0-9A-F]{6}$/i.test(color)) {
        appState.headlineColor = color;
        colorInput.value = color;
        applyHeadlinePreviewStyles();
    } else {
        // Se inválido, restaurar valor anterior
        colorText.value = appState.headlineColor || '#FFFFFF';
    }
}

function applyHeadlinePreviewStyles() {
    const headline = document.getElementById('preview-headline');
    if (!headline) return;
    
    const config = window.HeadlineConfig || {};
    const fontWeights = config.FONT_WEIGHTS || { bold: 700, impact: 900, modern: 600 };
    const lineHeightRatio = config.LINE_HEIGHT_RATIO || 1.2;
    const maxTextWidth = config.MAX_TEXT_WIDTH || 920; // 1080 - 160 (80px cada lado)
    const canvasWidth = config.CANVAS_WIDTH || 1080;
    
    // Obter configurações atuais
    const fontSize = appState.headlineSize || 72;
    const fontFamily = appState.font || 'Inter';
    const fontStyle = appState.headlineStyle || 'bold';
    const color = appState.headlineColor || '#FFFFFF';
    const headlineText = appState.headlineText || 'Headline';
    
    // Aplicar estilos EXATOS que serão usados no vídeo final
    headline.style.fontSize = fontSize + 'px';
    headline.style.fontFamily = fontFamily + ', Arial, sans-serif';
    headline.style.fontWeight = config.getFontWeight ? config.getFontWeight(fontStyle) : (fontWeights[fontStyle] || 700);
    headline.style.color = color;
    headline.style.textAlign = 'center';
    headline.style.lineHeight = lineHeightRatio;
    headline.style.wordWrap = 'break-word';
    headline.style.whiteSpace = 'pre-wrap';
    
    // Calcular largura máxima respeitando margens de 80px
    // O preview-frame tem 270px de largura (proporção 270/1080 = 0.25)
    // Margens de 80px em escala = 80 * 0.25 = 20px
    const previewScale = 270 / canvasWidth;
    const previewMarginPx = 80 * previewScale;
    const previewMaxWidth = (270 - 40 - (previewMarginPx * 2)) + 'px'; // 40px = padding do frame
    
    headline.style.maxWidth = previewMaxWidth;
    headline.style.margin = '0 auto';
    
    // Aplicar quebra de linha manual (simulando o que o FFmpeg fará)
    // Isso garante que o preview mostre exatamente como ficará no vídeo final
    applyHeadlineTextWrapping(headline, headlineText, maxTextWidth, fontSize);
}

/**
 * Avança para step de gerar após definir headline
 */
/**
 * Mostra botão para continuar após download do vídeo
 */
function showContinueButtonAfterDownload() {
    const continueSection = document.getElementById('youtube-continue-section');
    if (continueSection) {
        continueSection.classList.remove('hidden');
        // Fazer scroll para a etapa de youtube (caso o usuário esteja longe)
        setTimeout(() => scrollToCard('youtube'), 300);
    }
}

/**
 * Continua para painel de configurações após legendas (ETAPA 4)
 */
function continueToConfigurations() {
    const configCard = document.getElementById('configurations-card');
    if (configCard) {
        // Card sempre visível - garantir que está visível
        configCard.style.display = 'block';
        updateProgressSteps('configurations'); // Etapa 4
        // Fazer scroll para a etapa de configurações
        scrollToCard('configurations');
    }
}

/**
 * Atualiza configuração no estado global
 */
function updateConfiguration(key, value, checked = null) {
    if (!appState.configurations) {
        appState.configurations = {
            format: '9:16',
            platforms: { tiktok: true, reels: true, shorts: true },
            captionLanguage: 'pt',
            captionStyle: 'modern',
            clipsQuantity: null,
            safeMargins: 10
        };
    }
    
    if (key === 'platforms') {
        if (!appState.configurations.platforms) {
            appState.configurations.platforms = {};
        }
        appState.configurations.platforms[value] = checked;
    } else {
        appState.configurations[key] = value;
    }
    
    console.log('[CONFIG] Configuração atualizada:', key, value, appState.configurations);
}

/**
 * Confirma configurações e avança para próxima etapa (ETAPA 3 - TRIM)
 */
function confirmConfigurations() {
    // Sem validação bloqueante - usuário controla o fluxo
    
    // Validação básica (apenas log, sem bloquear)
    if (!appState.configurations || !appState.configurations.platforms) {
        console.warn('[CONFIG] Configurações de plataformas não encontradas');
    }
    
    const hasPlatform = appState.configurations?.platforms ? 
        Object.values(appState.configurations.platforms).some(v => v === true) : false;
    if (!hasPlatform) {
        console.warn('[CONFIG] Nenhuma plataforma selecionada - pode causar problemas na geração');
    }
    
    console.log('[CONFIG] Configurações confirmadas:', appState.configurations);
    
    // AVANÇAR AUTOMATICAMENTE para etapa 5 (Nicho) após configurações
    setTimeout(() => {
        showNicheSection();
        // Fazer scroll para a etapa de nicho
        scrollToCard('niche');
    }, 500);
}

/**
 * Mostra botão para continuar após gerar legendas
 */
function showContinueButtonAfterCaptions() {
    const continueSection = document.getElementById('captions-continue-section');
    if (continueSection) {
        continueSection.classList.remove('hidden');
        // Fazer scroll para a etapa de legendas
        setTimeout(() => scrollToCard('captions'), 300);
    }
}

/**
 * Continua para escolher nicho após legendas (ETAPA 5)
 * Esta função não é mais usada - avanço automático após configurações
 */
function continueToNiche() {
    // Sem validação bloqueante - usuário controla o fluxo
    showNicheSection(); // Etapa 5
}

/**
 * Mostra botão para continuar após selecionar nicho
 */
function showContinueButtonAfterNiche() {
    const continueSection = document.getElementById('niche-continue-section');
    if (continueSection) {
        continueSection.classList.remove('hidden');
        // Fazer scroll para a etapa de nicho
        setTimeout(() => scrollToCard('niche'), 300);
    }
}

/**
 * Continua para configurar headline após nicho (ETAPA 6)
 */
function continueToHeadline() {
    // Sem validação bloqueante - usuário controla o fluxo
    
    // Definir valores padrão se não estiverem definidos
    if (!appState.headlineText) {
        appState.headlineText = 'Headline';
    }
    if (!appState.headlineStyle) {
        appState.headlineStyle = 'bold';
    }
    // Inicializar com tamanho L (72px) como padrão
    if (!appState.headlineSize) {
        appState.headlineSize = 72;
        appState.headlineSizeName = 'L';
    }
    if (!appState.headlineColor) {
        appState.headlineColor = '#FFFFFF';
    }
    
    // Inicializar valores nos inputs se existirem
    const sizeSelect = document.getElementById('headline-size-select');
    const colorInput = document.getElementById('headline-color-input');
    const colorText = document.getElementById('headline-color-text');
    
    if (sizeSelect) {
        // Usar tamanho nominal se disponível, senão converter pixel para nominal
        const config = window.HeadlineConfig || {};
        const sizeName = appState.headlineSizeName || 
                        (config.getSizeName ? config.getSizeName(appState.headlineSize || 72) : 'L');
        sizeSelect.value = sizeName;
        // Garantir que o tamanho em pixels está sincronizado
        if (config.getFontSize) {
            appState.headlineSize = config.getFontSize(sizeName);
        }
    }
    if (colorInput) {
        colorInput.value = appState.headlineColor || '#FFFFFF';
    }
    if (colorText) {
        colorText.value = appState.headlineColor || '#FFFFFF';
    }
    
    // Aplicar estilos iniciais no preview
    applyHeadlinePreviewStyles();
    if (!appState.font) {
        appState.font = 'Inter';
    }
    if (!appState.backgroundColor) {
        appState.backgroundColor = '#000000';
    }
    if (!appState.retentionVideoId) {
        appState.retentionVideoId = 'random';
    }
    
    // Mostrar card de headline - ETAPA 6
    showNextSteps();
    // Scroll já é feito dentro de showNextSteps
}

/**
 * Continua para card de geração após headline (ETAPA 7)
 */
function continueToGenerate() {
    console.log('[NAV] Avançando para etapa de geração');
    // Avançar para etapa de geração - ETAPA 7
    updateProgressSteps('generate'); // Etapa 7
    updateGenerateSummary();
    const generateCard = document.getElementById('generate-card');
    if (generateCard) {
        generateCard.style.display = 'block';
        generateCard.classList.remove('hidden');
        // Fazer scroll para a etapa de geração
        scrollToCard('generate');
        console.log('[NAV] Card de geração exibido');
    } else {
        console.error('[NAV] Card de geração não encontrado!');
    }
}

/**
 * Volta para card de headline
 */
function goBackToHeadline() {
    // Cards sempre visíveis - apenas atualizar etapa ativa
    updateProgressSteps('headline');
    const headlineCard = document.getElementById('headline-card');
    if (headlineCard) {
        setTimeout(() => {
            // NÃO fazer scroll automático
        }, 300);
    }
}

function proceedToGenerate() {
    console.log('[GENERATE] Iniciando processo de geração...');
    console.log('[GENERATE] Estado atual:', {
        videoId: appState.videoId,
        nicheId: appState.nicheId,
        numberOfCuts: appState.numberOfCuts,
        trimStart: appState.trimStart,
        trimEnd: appState.trimEnd,
        cutDuration: appState.cutDuration
    });
    
    // Atualizar progresso para step de geração
    updateProgressSteps('generate');
    updateGenerateSummary();
    
    // Verificar dados mínimos necessários
    if (!appState.videoId) {
        alert('Erro: Vídeo não encontrado. Por favor, baixe o vídeo primeiro.');
        return;
    }
    
    if (!appState.nicheId) {
        alert('Erro: Nicho não selecionado. Por favor, selecione um nicho antes de gerar.');
        return;
    }
    
    // Calcular número de clipes baseado no intervalo e duração
    if (!appState.numberOfCuts) {
        if (appState.trimStart !== undefined && appState.trimEnd !== undefined && appState.cutDuration) {
            const duration = appState.trimEnd - appState.trimStart;
            appState.numberOfCuts = Math.max(1, Math.floor(duration / appState.cutDuration));
            console.log('[GENERATE] Número de clipes calculado:', appState.numberOfCuts);
        } else {
            // Valores padrão se não houver trim definido
            appState.trimStart = appState.trimStart || 0;
            appState.trimEnd = appState.trimEnd || appState.videoDuration || 60;
            appState.cutDuration = appState.cutDuration || 60;
            const duration = appState.trimEnd - appState.trimStart;
            appState.numberOfCuts = Math.max(1, Math.floor(duration / appState.cutDuration));
            console.log('[GENERATE] Usando valores padrão. Clipes calculados:', appState.numberOfCuts);
        }
    }
    
    // Confirmar antes de gerar
    const clipsCount = appState.numberOfCuts || 1;
    const confirmMessage = `Você está prestes a gerar ${clipsCount} ${clipsCount === 1 ? 'clip' : 'clipes'}.\n\nDeseja continuar?`;
    if (confirm(confirmMessage)) {
        console.log('[GENERATE] Usuário confirmou. Iniciando geração...');
        // Gerar clipes diretamente
        generateSeries();
    } else {
        console.log('[GENERATE] Usuário cancelou a geração.');
    }
}

/**
 * Aplicar quebra de texto no preview (mesma lógica do FFmpeg)
 */
function applyHeadlineTextWrapping(headlineElement, text, maxWidth, fontSize) {
    if (!text || !maxWidth || !fontSize) {
        headlineElement.textContent = text || 'Headline';
        return;
    }
    
    // Estimar largura média de um caractere (aproximação: 0.6 * fontSize)
    // Mesma lógica usada no videoComposer.js
    const avgCharWidth = fontSize * 0.6;
    const maxCharsPerLine = Math.floor(maxWidth / avgCharWidth);
    
    if (maxCharsPerLine <= 0 || text.length <= maxCharsPerLine) {
        headlineElement.textContent = text; // Texto cabe em uma linha
        return;
    }
    
    // Quebrar texto em palavras
    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        
        // Se a linha com a nova palavra exceder o limite, quebrar
        if (testLine.length > maxCharsPerLine) {
            if (currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                // Palavra muito longa, quebrar no meio
                lines.push(word.substring(0, maxCharsPerLine));
                currentLine = word.substring(maxCharsPerLine);
            }
        } else {
            currentLine = testLine;
        }
    }
    
    if (currentLine) {
        lines.push(currentLine);
    }
    
    // Aplicar quebra de linha no elemento
    headlineElement.textContent = lines.join('\n');
    headlineElement.style.whiteSpace = 'pre-line'; // Respeitar \n
}

function updatePreviewStyle() {
    const headline = document.getElementById('preview-headline');
    const fontSelect = document.getElementById('headline-font-select');
    const styleSelect = document.getElementById('headline-style-select');
    
    if (!headline || !fontSelect || !styleSelect) return;
    
    const font = fontSelect.value;
    const style = styleSelect.value;
    
    appState.font = font;
    appState.headlineStyle = style;
    
    // Aplicar todos os estilos no preview (inclui fonte e estilo)
    applyHeadlinePreviewStyles();
    
    // Atualizar resumo
    updateGenerateSummary();
}

async function generateSeries() {
    // Sem validação bloqueante - tentar gerar mesmo se faltar dados (backend validará)
    if (!appState.videoId || !appState.nicheId || !appState.numberOfCuts) {
        console.warn('[GENERATE] Alguns dados podem estar faltando, mas tentando gerar mesmo assim');
    }
    
    // Verificar se vídeo está pronto antes de gerar (apenas log, sem bloquear)
    const isReady = await verifyVideoReady(appState.videoId);
    if (!isReady) {
        console.warn('[GENERATE] Vídeo pode não estar pronto, mas tentando gerar mesmo assim');
        // Não bloquear - deixar backend validar
    }
    
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');
    
    try {
        // Mostrar feedback de fila
        const queueInfoEl = document.getElementById('queue-info');
        if (queueInfoEl) {
            queueInfoEl.classList.remove('hidden');
            queueInfoEl.textContent = 'Adicionando à fila de processamento...';
        }

        // Preparar dados para envio
        const requestData = {
            videoId: appState.videoId,
            nicheId: appState.nicheId,
            retentionVideoId: appState.retentionVideoId || 'random',
            numberOfCuts: appState.numberOfCuts || 1,
            headlineStyle: appState.headlineStyle || 'bold',
            headlineText: appState.headlineText || 'Headline',
            headlineSize: appState.headlineSize || 72,
            headlineColor: appState.headlineColor || '#FFFFFF',
            font: appState.font || 'Inter',
            trimStart: appState.trimStart || 0,
            trimEnd: appState.trimEnd || appState.videoDuration || null,
            cutDuration: appState.cutDuration || 60,
            backgroundColor: appState.backgroundColor || '#000000',
            // CONFIGURAÇÕES DE VÍDEO (obrigatórias)
            format: appState.configurations?.format || '9:16',
            platforms: appState.configurations?.platforms || { tiktok: true, reels: true, shorts: true },
            captionLanguage: appState.configurations?.captionLanguage || 'pt',
            captionStyle: appState.configurations?.captionStyle || 'modern',
            clipsQuantity: appState.configurations?.clipsQuantity || null,
            safeMargins: appState.configurations?.safeMargins || 10
        };
        
        console.log('[GENERATE] Enviando requisição para /api/generate/series:', requestData);
        
        // Enviar TODAS as configurações para o backend
        const { data } = await apiClient.post('/api/generate/series', requestData);
        
        console.log('[GENERATE] Resposta do backend:', data);
        
        if (data && data.jobId) {
            // Salvar dados importantes no appState
            appState.jobId = data.jobId;
            if (data.seriesId) {
                appState.seriesId = data.seriesId;
                console.log(`[GENERATE] SeriesId salvo: ${data.seriesId}`);
            }
            if (data.numberOfCuts) {
                appState.numberOfCuts = data.numberOfCuts;
            }
            
            // Mostrar informações de fila se disponíveis
            if (data.queuePosition) {
                const queueInfoEl = document.getElementById('queue-info');
                if (queueInfoEl) {
                    queueInfoEl.classList.remove('hidden');
                    const waitTime = data.estimatedWaitTime || 0;
                    queueInfoEl.innerHTML = `
                        <div class="queue-status">
                            <span class="queue-icon">⏳</span>
                            <span>Posição na fila: ${data.queuePosition}</span>
                            ${waitTime > 0 ? `<span>• Tempo estimado: ~${waitTime} min</span>` : ''}
                        </div>
                    `;
                }
            }
            
            console.log('[GENERATE] Job criado com sucesso:', data.jobId);
            console.log('[GENERATE] SeriesId:', data.seriesId);
            console.log('[GENERATE] Iniciando monitoramento de progresso...');
            monitorProgress(data.jobId);
        } else {
            console.error('[GENERATE] Erro ao criar job:', data);
            const errorMsg = data?.error || 'Erro desconhecido';
            alert('Erro ao gerar série: ' + errorMsg);
            if (loadingOverlay) loadingOverlay.classList.add('hidden');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao gerar série');
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }
}

async function monitorProgress(jobId) {
    const progressFill = document.getElementById('loading-progress');
    const progressText = document.getElementById('loading-percent');
    const progressMessage = document.getElementById('loading-message');
    
    console.log(`[GENERATE] Iniciando monitoramento via SSE do job ${jobId}`);
    
    // Fallback para polling se SSE não estiver disponível
    let useFallback = false;
    let fallbackInterval = null;
    
    // Tentar usar Server-Sent Events (SSE) para progresso em tempo real
    try {
        const eventSource = new EventSource(`${API_BASE}/api/generate/progress/${jobId}`);
        
        // Timeout de segurança: se não receber eventos em 60 segundos, usar fallback
        let sseTimeout = setTimeout(() => {
            if (eventSource.readyState === EventSource.OPEN) {
                console.warn('[GENERATE] SSE sem eventos por 60s, usando fallback');
                eventSource.close();
                useFallback = true;
                startFallbackPolling(jobId);
            }
        }, 60000);
        
        eventSource.onmessage = (event) => {
            // Limpar timeout no primeiro evento
            clearTimeout(sseTimeout);
            
            try {
                const data = JSON.parse(event.data);
                console.log(`[GENERATE-SSE] Evento recebido:`, data);
                
                const {
                    status,
                    progress = 0,
                    totalClips = 0,
                    currentClip = 0,
                    message = '',
                    seriesId,
                    error
                } = data;
                
                // Atualizar progresso percentual
                const progressPercent = Math.min(100, Math.max(0, progress));
                
                if (progressFill) {
                    progressFill.style.width = `${progressPercent}%`;
                    progressFill.style.transition = 'width 0.3s ease';
                }
                
                if (progressText) {
                    progressText.textContent = `${progressPercent}%`;
                }
                
                // Atualizar mensagem de status
                if (progressMessage) {
                    if (totalClips > 0 && currentClip > 0) {
                        // Mensagem detalhada: "Gerando clipe X de Y"
                        progressMessage.textContent = message || `Gerando clipe ${currentClip} de ${totalClips}`;
                    } else if (message) {
                        progressMessage.textContent = message;
                    } else {
                        progressMessage.textContent = 'Processando...';
                    }
                }
                
                // Atualizar appState
                if (seriesId) {
                    appState.seriesId = seriesId;
                }
                if (totalClips > 0) {
                    appState.numberOfCuts = totalClips;
                }
                
                // Verificar se concluído
                if (status === 'completed' || (status === 'processing' && progressPercent >= 100)) {
                    eventSource.close();
                    console.log('[GENERATE] ✅ Geração concluída via SSE!');
                    
                    if (progressFill) progressFill.style.width = '100%';
                    if (progressText) progressText.textContent = '100%';
                    
                    // Aguardar um pouco para garantir que o backend finalizou tudo
                    setTimeout(() => {
                        showSuccessModal({
                            seriesId: seriesId || appState.seriesId,
                            clipsCount: totalClips || appState.numberOfCuts,
                            status: 'completed',
                            progress: 100
                        });
                    }, 500);
                } else if (status === 'error') {
                    eventSource.close();
                    console.error('[GENERATE] ❌ Erro na geração via SSE:', error || message);
                    alert('Erro ao gerar série: ' + (error || message || 'Erro desconhecido'));
                    const loadingOverlay = document.getElementById('loading-overlay');
                    if (loadingOverlay) loadingOverlay.classList.add('hidden');
                }
            } catch (parseError) {
                console.error('[GENERATE-SSE] Erro ao processar evento:', parseError, event.data);
            }
        };
        
        eventSource.onerror = (error) => {
            console.error('[GENERATE-SSE] Erro na conexão SSE:', error);
            
            // Se conexão foi fechada pelo servidor (provavelmente erro), usar fallback
            if (eventSource.readyState === EventSource.CLOSED) {
                clearTimeout(sseTimeout);
                eventSource.close();
                console.log('[GENERATE] Conexão SSE fechada, usando fallback para polling');
                useFallback = true;
                startFallbackPolling(jobId);
            }
        };
        
    } catch (sseError) {
        console.warn('[GENERATE] SSE não disponível, usando fallback para polling:', sseError);
        useFallback = true;
        startFallbackPolling(jobId);
    }
    
    // Função de fallback (polling)
    function startFallbackPolling(jobId) {
        if (fallbackInterval) return; // Já está rodando
        
        let lastProgress = 0;
        const pollInterval = 2000;
        
        fallbackInterval = setInterval(async () => {
            try {
                const { data } = await apiClient.get(`/api/generate/status/${jobId}`);
                
                const progress = data.progress || 0;
                const status = data.status || 'processing';
                
                if (progress !== lastProgress || status !== 'processing') {
                    console.log(`[GENERATE-POLL] Progresso: ${lastProgress}% -> ${progress}% | Status: ${status}`);
                    lastProgress = progress;
                }
                
                // Atualizar UI
                if (progressFill) {
                    progressFill.style.width = `${progress}%`;
                    progressFill.style.transition = 'width 0.3s ease';
                }
                if (progressText) {
                    progressText.textContent = `${progress}%`;
                }
                
                // Mensagem genérica quando usando fallback
                if (progressMessage && !progressMessage.textContent) {
                    progressMessage.textContent = 'Processando...';
                }
                
                // Verificar conclusão
                if (status === 'completed' || status === 'finished' || progress >= 100) {
                    clearInterval(fallbackInterval);
                    
                    if (data.seriesId) appState.seriesId = data.seriesId;
                    if (data.clipsCount) appState.numberOfCuts = data.clipsCount;
                    
                    setTimeout(() => {
                        showSuccessModal(data);
                    }, 500);
                } else if (status === 'failed' || status === 'error') {
                    clearInterval(fallbackInterval);
                    alert('Erro ao gerar série: ' + (data.failedReason || data.error || 'Erro desconhecido'));
                    const loadingOverlay = document.getElementById('loading-overlay');
                    if (loadingOverlay) loadingOverlay.classList.add('hidden');
                }
            } catch (error) {
                console.error('[GENERATE-POLL] Erro ao verificar progresso:', error);
            }
        }, pollInterval);
    }
}

function showSuccessModal(job) {
    console.log('[MODAL] Exibindo modal de sucesso:', job);
    
    // Atualizar appState com dados do job se disponíveis
    if (job?.seriesId) {
        appState.seriesId = job.seriesId;
        console.log(`[MODAL] SeriesId atualizado: ${job.seriesId}`);
    }
    if (job?.clipsCount) {
        appState.numberOfCuts = job.clipsCount;
        console.log(`[MODAL] ClipsCount atualizado: ${job.clipsCount}`);
    }
    
    // Esconder overlay de loading
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
        loadingOverlay.style.display = 'none';
    }
    
    // Buscar elementos do modal
    const modal = document.getElementById('success-modal');
    const message = document.getElementById('success-message');
    
    if (!modal) {
        console.error('[MODAL] ❌ Modal não encontrado no DOM!');
        // Fallback: mostrar alerta e permitir download direto
        const clipsCount = appState.numberOfCuts || job?.clipsCount || 1;
        const seriesId = appState.seriesId || job?.seriesId;
        
        if (seriesId) {
            if (confirm(`Série com ${clipsCount} ${clipsCount === 1 ? 'clip' : 'clipes'} gerada com sucesso! Deseja baixar agora?`)) {
                downloadSeries();
            }
        } else {
            alert(`Série com ${clipsCount} ${clipsCount === 1 ? 'clip' : 'clipes'} gerada com sucesso! Mas o ID da série não foi encontrado. Verifique os logs do backend.`);
        }
        return;
    }
    
    if (!message) {
        console.error('[MODAL] ❌ Mensagem não encontrada no DOM!');
    }
    
    // Configurar conteúdo
    const clipsCount = appState.numberOfCuts || job?.clipsCount || 1;
    if (message) {
        message.textContent = `Série com ${clipsCount} ${clipsCount === 1 ? 'clip' : 'clipes'} gerada com sucesso!`;
    }
    
    // Garantir que o modal está visível
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    modal.style.zIndex = '10000';
    
    console.log('[MODAL] ✅ Modal exibido com sucesso');
    
    // Focar no botão de download para melhor UX
    setTimeout(() => {
        const downloadBtn = modal.querySelector('button[onclick="downloadSeries()"]');
        if (downloadBtn) {
            downloadBtn.focus();
        }
    }, 100);
}

async function downloadSeries() {
    if (!appState.seriesId) {
        console.error('[DOWNLOAD] SeriesId não encontrado no appState');
        alert('Série não encontrada. Por favor, tente gerar novamente.');
        return;
    }
    
    console.log('[DOWNLOAD] Iniciando download da série:', appState.seriesId);
    
    try {
        // Fechar modal antes de iniciar download
        const modal = document.getElementById('success-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
        
        // Iniciar download
        const downloadUrl = `${API_BASE}/api/generate/download/${appState.seriesId}`;
        console.log('[DOWNLOAD] URL:', downloadUrl);
        
        // Usar window.location para download direto
        window.location.href = downloadUrl;
        
        // Fallback: criar link temporário se window.location não funcionar
        setTimeout(() => {
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `ezclips-${appState.seriesId}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }, 500);
    } catch (error) {
        console.error('[DOWNLOAD] Erro ao baixar série:', error);
        alert('Erro ao baixar série. Por favor, tente novamente.');
    }
}

function openTikTokStudio() {
    window.open('https://www.tiktok.com/studio', '_blank');
}
