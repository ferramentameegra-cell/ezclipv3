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
    headlineStrokeColor: '#000000',
    headlineFontSize: 'medium',
    headlineTitlePosition: 'center',
    headlineTarjaSuperiorSize: null,
    headlineTarjaInferiorSize: null,
    headlineTarjaCentralSize: null,
    headlineTarjaSuperiorColor: '#1976D2',
    headlineTarjaInferiorColor: '#D32F2F',
    headlineTarjaCentralColor: '#7B1FA2',
    font: 'Inter',
    backgroundColor: '#000000',
    jobId: null,
    seriesId: null,
    currentUser: null,
    userToken: null,
    userVideos: null, // { videos_used, videos_limit, videos_remaining, is_unlimited, plan_id, plan_name }
    pendingGeneration: null, // Estado salvo para retomar geração após login
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

      // Tratar erros de autenticação
      // NÃO limpar sessão automaticamente - manter usuário conectado
      // Apenas logar o erro mas não deslogar o usuário
      if (response.status === 401 || response.status === 403) {
        // Token pode ter expirado, mas NÃO limpar sessão automaticamente
        // Manter token no localStorage para tentar novamente depois
        console.warn('[API] Token pode ter expirado, mas mantendo sessão ativa...');
        // NÃO limpar localStorage - manter usuário conectado
        // Apenas lançar erro para que a função chamadora trate
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro de autenticação. Tente novamente.');
      }
      
      // Tratar erros de limite de vídeos
      if (response.status === 402) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || 'Limite de vídeos atingido';
        
        // Se for erro de limite de vídeos, mostrar modal de upgrade
        if (errorData.code === 'VIDEO_LIMIT_REACHED' && errorData.needsUpgrade) {
          if (typeof showCreditsPurchaseModal === 'function') {
            setTimeout(() => showCreditsPurchaseModal(), 100);
          }
        }
        
        throw new Error(errorMessage);
      }

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

  getAuthHeaders() {
    const token = localStorage.getItem('ezv2_token');
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async get(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = { ...this.getAuthHeaders(), ...options.headers };
    return this.fetchWithRetry(url, { ...options, method: 'GET', headers });
  }

  async post(endpoint, body, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = { ...this.getAuthHeaders(), ...options.headers };
    return this.fetchWithRetry(url, {
      ...options,
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
  }
}

const apiClient = new ApiClient(window.location.origin);

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    // Atualizar estado do botão de gerar ao carregar
    updateGenerateButtonState();
    initializeApp();
    
    // Verificar pagamento após retorno do Stripe (Checkout Session dinâmica)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success') {
        setTimeout(() => {
            checkPaymentStatus();
        }, 1000);
    }
    
    // Verificar se há pagamento pendente via Payment Link
    const paymentPending = localStorage.getItem('stripe_payment_pending');
    const planId = localStorage.getItem('stripe_plan_id');
    if (paymentPending === 'true' && planId) {
        console.log('[APP] Verificando pagamento pendente via Payment Link...');
        // Aguardar um pouco para dar tempo do webhook processar
        setTimeout(() => {
            verifyPaymentLinkPurchase(planId);
        }, 3000);
    }
});

async function initializeApp() {
    // CRÍTICO: Garantir que conteúdo principal está visível e interativo (nunca bloquear)
    showMainContent();
    
    // Forçar que auth-section esteja escondida e não bloqueie (múltiplas garantias)
    const authSection = document.getElementById('auth-section');
    if (authSection) {
        authSection.style.display = 'none';
        authSection.style.pointerEvents = 'none';
        authSection.style.zIndex = '-1';
        authSection.style.visibility = 'hidden';
        authSection.style.opacity = '0';
        authSection.style.position = 'fixed';
        authSection.style.top = '-9999px';
        authSection.style.left = '-9999px';
        authSection.style.width = '0';
        authSection.style.height = '0';
        authSection.classList.add('hidden');
    }
    
    // Garantir que loading-overlay não bloqueie
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay && loadingOverlay.classList.contains('hidden')) {
        loadingOverlay.style.display = 'none';
        loadingOverlay.style.pointerEvents = 'none';
        loadingOverlay.style.zIndex = '-1';
    }
    
    // Verificar autenticação (opcional - não bloqueia uso da plataforma)
    await checkAuth();
    
    // Inicializar funcionalidades (disponíveis para todos, mesmo sem login)
    setupYouTubeInput();
    setupUploadDragDrop();
    setupTrimControls();
    loadNiches();
    
    // Inicializar com primeiro step (etapa 1)
    currentStepIndex = 0;
    
    // Mostrar TODOS os cards desde o início (sempre acessíveis e editáveis)
    // IMPORTANTE: Todos os cards devem permanecer visíveis durante todo o processo
    setTimeout(() => {
        document.querySelectorAll('[data-step-card]').forEach(card => {
            card.style.display = 'block';
            card.style.pointerEvents = 'auto';
            card.classList.remove('hidden');
            // Garantir que está visível e interativo
            if (card.style.display === 'none') {
                card.style.display = 'block';
            }
        });
        
        // Garantir que todos os elementos interativos estão funcionando
        document.querySelectorAll('button, a, input, select, textarea').forEach(el => {
            if (!el.disabled) {
                el.style.pointerEvents = 'auto';
                if (el.tagName === 'BUTTON' || el.tagName === 'A') {
                    el.style.cursor = 'pointer';
                }
            }
        });
        
        // Verificar se há elementos bloqueando cliques
        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
            const computedStyle = window.getComputedStyle(el);
            // Se elemento está visível mas com pointer-events: none, verificar se deveria ter
            if (computedStyle.display !== 'none' && 
                computedStyle.visibility !== 'hidden' &&
                computedStyle.pointerEvents === 'none' &&
                (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'INPUT' || el.onclick)) {
                // Elemento interativo com pointer-events: none - corrigir
                if (!el.disabled) {
                    el.style.pointerEvents = 'auto';
                }
            }
        });
        
        console.log('[INIT] ✅ Interface inicializada e elementos interativos verificados');
    }, 100);
    
    updateProgressSteps('youtube'); // Etapa 1
    
    // Atualizar estado do botão de gerar
    updateGenerateButtonState();
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
        // Garantir que o card esteja visível
        if (card.style.display === 'none') {
            card.style.display = 'block';
        }
        
        // Fazer scroll suave até o card
        setTimeout(() => {
            const cardPosition = card.getBoundingClientRect().top + window.pageYOffset;
            const offset = 100; // Offset para navbar
            
            window.scrollTo({
                top: Math.max(0, cardPosition - offset),
                behavior: 'smooth'
            });
        }, 100);
    }
}

function scrollToTool() {
    scrollToCard('youtube');
}

// ========== AUTHENTICATION ==========
/**
 * Verificar autenticação (opcional - não bloqueia acesso)
 * Apenas carrega dados do usuário se houver token válido
 */
async function checkAuth() {
    const token = localStorage.getItem('ezv2_token');
    const user = localStorage.getItem('ezv2_user');
    
    if (token && user) {
        try {
            // Verificar token válido no backend
            const { data } = await apiClient.get('/api/auth/me');
            if (data && data.user) {
                appState.currentUser = data.user;
                appState.userToken = token;
                localStorage.setItem('ezv2_user', JSON.stringify(data.user));
                updateUserUI();
                await loadUserVideos(); // Carregar informações de vídeos
                return true;
            }
        } catch (error) {
            console.error('[AUTH] Erro ao verificar token:', error);
            // NÃO limpar sessão automaticamente - manter usuário conectado
            // Apenas logar o erro mas continuar com token salvo
            console.warn('[AUTH] Token pode ter expirado, mas mantendo sessão ativa. Usuário permanece conectado.');
            // NÃO chamar clearAuth() - manter token no localStorage
        }
    }
    
    // Sem token ou token inválido - continuar sem autenticação
    // NÃO bloquear acesso - usuário pode usar a plataforma livremente
    appState.currentUser = null;
    appState.userToken = null;
    updateUserUI();
    return false;
}

/**
 * Limpar autenticação
 */
function clearAuth() {
    appState.currentUser = null;
    appState.userToken = null;
    appState.userCredits = null;
    localStorage.removeItem('ezv2_user');
    localStorage.removeItem('ezv2_token');
    updateUserUI();
}

/**
 * Mostrar tela de login obrigatória
 * NOTA: Esta função não deve ser usada para bloquear acesso inicial
 * Apenas quando usuário explicitamente precisa fazer login
 */
function showAuthRequired() {
    const mainContent = document.querySelector('main');
    const authSection = document.getElementById('auth-section');
    
    if (mainContent) {
        mainContent.style.display = 'none';
        mainContent.style.pointerEvents = 'none';
    }
    if (authSection) {
        authSection.style.display = 'flex';
        authSection.style.pointerEvents = 'auto';
        authSection.style.zIndex = '1000';
        authSection.classList.remove('hidden');
    }
    
    // Garantir que login está visível
    const loginCard = document.getElementById('login-card');
    const registerCard = document.getElementById('register-card');
    if (loginCard) loginCard.classList.remove('hidden');
    if (registerCard) registerCard.classList.add('hidden');
}

/**
 * Mostrar conteúdo principal (sempre visível - não bloqueia acesso)
 */
function showMainContent() {
    const mainContent = document.querySelector('main');
    const authSection = document.getElementById('auth-section');
    
    // Sempre esconder seção de auth (não é a página inicial)
    // Usar display: none E pointer-events: none para garantir que não bloqueie cliques
    if (authSection) {
        authSection.style.display = 'none';
        authSection.style.pointerEvents = 'none';
        authSection.style.zIndex = '-1';
        authSection.style.visibility = 'hidden';
        authSection.style.opacity = '0';
        authSection.classList.add('hidden');
    }
    
    // Sempre mostrar conteúdo principal e garantir interatividade
    if (mainContent) {
        mainContent.style.display = 'block';
        mainContent.style.pointerEvents = 'auto';
        mainContent.style.zIndex = '1';
        mainContent.style.visibility = 'visible';
        mainContent.style.opacity = '1';
        mainContent.classList.remove('hidden');
        
        // Garantir que todos os elementos filhos também sejam interativos
        const interactiveElements = mainContent.querySelectorAll('button, a, input, select, textarea, [onclick]');
        interactiveElements.forEach(el => {
            if (!el.disabled) {
                el.style.pointerEvents = 'auto';
                el.style.cursor = 'pointer';
            }
        });
    }
}

/**
 * Carregar informações de vídeos do usuário
 */
async function loadUserVideos() {
    if (!appState.currentUser) return;
    
    try {
        const { data } = await apiClient.get('/api/credits/balance');
        if (data) {
            appState.userVideos = {
                videos_used: data.videos_used || 0,
                videos_limit: data.videos_limit,
                videos_remaining: data.videos_remaining,
                is_unlimited: data.is_unlimited || false,
                plan_id: data.plan_id || null,
                plan_name: data.plan_name || 'Sem plano',
                total_videos_processed: data.total_videos_processed || 0
            };
            updateVideosUI();
            updateGenerateButtonState(); // Atualizar botão após carregar vídeos
            console.log('[VIDEOS] Informações de vídeos carregadas:', appState.userVideos);
        }
    } catch (error) {
        console.error('[VIDEOS] Erro ao carregar informações de vídeos:', error);
    }
}

/**
 * Atualizar UI de vídeos processados
 */
function updateVideosUI() {
    const creditsElement = document.getElementById('user-credits');
    const creditsDropdown = document.getElementById('user-credits-dropdown');
    
    if (appState.userVideos) {
        const videosUsed = appState.userVideos.videos_used || 0;
        const videosLimit = appState.userVideos.videos_limit;
        const isUnlimited = appState.userVideos.is_unlimited;
        
        // Badge na navbar
        if (creditsElement) {
            if (isUnlimited) {
                creditsElement.innerHTML = `
                    ${videosUsed} vídeos <span style="color: #10b981; font-size: 0.75rem;">(ilimitado)</span>
                `;
            } else {
                const remaining = appState.userVideos.videos_remaining || 0;
                creditsElement.innerHTML = `
                    ${videosUsed}/${videosLimit} vídeos
                    ${remaining > 0 ? ` <span style="color: #10b981; font-size: 0.75rem;">(${remaining} restantes)</span>` : ''}
                `;
            }
        }
        
        // Informações no dropdown
        if (creditsDropdown) {
            if (isUnlimited) {
                creditsDropdown.innerHTML = `
                    <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1);">
                        <div>Plano: <strong>${appState.userVideos.plan_name}</strong></div>
                        <div style="color: #10b981; font-size: 0.75rem;">Vídeos ilimitados</div>
                        <div style="color: #999; font-size: 0.75rem;">${videosUsed} processados</div>
                    </div>
                `;
            } else {
                creditsDropdown.innerHTML = `
                    <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1);">
                        <div>Plano: <strong>${appState.userVideos.plan_name}</strong></div>
                        <div>Vídeos: <strong>${videosUsed}/${videosLimit}</strong></div>
                        ${appState.userVideos.videos_remaining > 0 ? `<div style="color: #10b981; font-size: 0.75rem;">${appState.userVideos.videos_remaining} restantes</div>` : '<div style="color: #ef4444; font-size: 0.75rem;">Limite atingido</div>'}
                        <div style="color: #999; font-size: 0.75rem; margin-top: 0.25rem;">Cortes ilimitados por vídeo</div>
                    </div>
                `;
            }
        }
    } else if (creditsElement) {
        creditsElement.textContent = '0 vídeos';
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
    
    // Atualizar vídeos na UI
    updateVideosUI();
    
    // Atualizar estado do botão de gerar
    updateGenerateButtonState();
}

/**
 * Mostrar modal de compra de planos
 */
async function showCreditsPurchaseModal() {
    try {
        // Buscar planos disponíveis (rota pública)
        const response = await fetch(`${API_BASE}/api/credits/plans`);
        if (!response.ok) {
            throw new Error('Erro ao carregar planos');
        }
        const data = await response.json();
        const plans = data.plans || [];
        
        if (!plans || plans.length === 0) {
            throw new Error('Nenhum plano disponível');
        }
        
        // Criar modal com planos
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'credits-modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border);">
                    <h2 style="margin: 0;">Escolher Plano</h2>
                    <button onclick="closeCreditsModal()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="margin-bottom: 1.5rem; color: var(--text-primary);">Cada plano permite processar uma quantidade de vídeos. <strong>Cortes por vídeo são ilimitados!</strong></p>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
                        ${plans.map(plan => {
                            const videosText = plan.is_unlimited ? 'Ilimitados' : plan.videos_limit;
                            const isUnlimited = plan.is_unlimited || plan.videos_limit === null;
                            return `
                            <div class="plan-card" style="border: 2px solid rgba(255,255,255,0.2); border-radius: 12px; padding: 1.5rem; cursor: pointer; transition: all 0.3s; background: var(--bg-secondary);" 
                                 onmouseover="this.style.borderColor='#667eea'; this.style.transform='translateY(-4px)'" 
                                 onmouseout="this.style.borderColor='rgba(255,255,255,0.2)'; this.style.transform='translateY(0)'"
                                 onclick="purchasePlan('${plan.id}')">
                                <h3 style="margin: 0 0 0.5rem 0; font-size: 1.25rem;">${plan.name}</h3>
                                <div style="font-size: 2.5rem; font-weight: bold; margin: 1rem 0; color: #667eea;">
                                    ${isUnlimited ? '∞' : videosText}
                                </div>
                                <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1rem; min-height: 40px;">${plan.description}</div>
                                <div style="font-size: 1.5rem; font-weight: 600; color: #667eea; margin-bottom: 0.5rem;">
                                    R$ ${plan.price.toFixed(2).replace('.', ',')}
                                </div>
                                <div style="color: #10b981; font-size: 0.75rem; margin-top: 0.5rem;">
                                    ✨ Cortes ilimitados por vídeo
                                </div>
                            </div>
                        `;
                        }).join('')}
                    </div>
                    <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(102, 126, 234, 0.1); border-radius: 8px; font-size: 0.875rem; color: var(--text-secondary); border-left: 3px solid #667eea;">
                        <strong>💡 Importante:</strong> Os vídeos são acumuláveis. Você pode comprar o mesmo plano múltiplas vezes e os vídeos não expiram. Cada vídeo pode gerar cortes ilimitados.
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Fechar ao clicar fora
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeCreditsModal();
            }
        });
    } catch (error) {
        console.error('[PLANS] Erro ao carregar planos:', error);
        alert('Erro ao carregar planos. Tente novamente.');
    }
}

/**
 * Fechar modal de créditos
 */
function closeCreditsModal() {
    const modal = document.getElementById('credits-modal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Comprar plano (com Stripe)
 */
async function purchasePlan(planId) {
    try {
        console.log('[PLANS] Iniciando compra do plano:', planId);
        
        // Buscar informações do plano para mostrar confirmação
        const plansResponse = await fetch(`${API_BASE}/api/credits/plans`);
        const plansData = await plansResponse.json();
        const plan = plansData.plans.find(p => p.id === planId);
        
        if (!plan) {
            throw new Error('Plano não encontrado');
        }
        
        // Se for plano free, processar diretamente
        if (planId === 'free') {
            const { data } = await apiClient.post('/api/credits/create-checkout', { planId });
            
            if (data.success) {
                const videosText = data.plan.is_unlimited ? 'vídeos ilimitados' : `${data.plan.videos_limit} vídeo(s)`;
                alert(`Plano Free ativado com sucesso! Você agora pode processar ${videosText}.`);
                
                await loadUserVideos();
                closeCreditsModal();
            }
            return;
        }
        
        // Confirmar compra
        const priceFormatted = plan.price.toFixed(2).replace('.', ',');
        const videosText = plan.is_unlimited ? 'vídeos ilimitados' : `${plan.videos_limit} vídeos`;
        const confirmMessage = `Deseja comprar o plano ${plan.name}?\n\n${videosText}\nR$ ${priceFormatted}\n\nVocê será redirecionado para o pagamento seguro.`;
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        // Se o plano tiver link externo do Stripe, usar ele
        if (plan.stripe_checkout_url) {
            console.log('[PLANS] Usando link externo do Stripe:', plan.stripe_checkout_url);
            
            // Salvar informações no localStorage
            localStorage.setItem('stripe_plan_id', planId);
            localStorage.setItem('stripe_payment_pending', 'true');
            
            // Adicionar parâmetros à URL para identificar o usuário e plano
            const currentUser = appState.currentUser;
            if (currentUser && currentUser.id) {
                const checkoutUrl = new URL(plan.stripe_checkout_url);
                // Adicionar metadata via URL (Stripe Payment Links suporta client_reference_id)
                checkoutUrl.searchParams.set('client_reference_id', currentUser.id);
                checkoutUrl.searchParams.set('prefilled_email', currentUser.email || '');
                
                // Abrir em nova janela
                const stripeWindow = window.open(
                    checkoutUrl.toString(),
                    'stripe-checkout',
                    'width=600,height=700,scrollbars=yes,resizable=yes'
                );
                
                // Monitorar quando a janela fecha
                const checkWindowClosed = setInterval(() => {
                    if (stripeWindow.closed) {
                        clearInterval(checkWindowClosed);
                        console.log('[PLANS] Janela do Stripe fechada, verificando pagamento...');
                        
                        // Aguardar um pouco antes de verificar (dar tempo para webhook processar)
                        setTimeout(() => {
                            verifyPaymentLinkPurchase(planId);
                        }, 2000);
                    }
                }, 1000);
                
                // Timeout de segurança (5 minutos)
                setTimeout(() => {
                    clearInterval(checkWindowClosed);
                }, 300000);
                
            } else {
                // Se não estiver logado, salvar plano desejado e redirecionar para login
                localStorage.setItem('pending_plan_id', planId);
                closeCreditsModal();
                alert('Para comprar um plano, você precisa fazer login primeiro. Você será redirecionado para a página de login.');
                switchTab('login');
                // Mostrar mensagem na tela de login
                setTimeout(() => {
                    const statusMsg = document.getElementById('auth-login-status');
                    if (statusMsg) {
                        statusMsg.textContent = 'Faça login para continuar com a compra do plano';
                        statusMsg.className = 'auth-status-message info';
                        statusMsg.classList.remove('hidden');
                    }
                }, 500);
                return;
            }
            
            return;
        }
        
        // Verificar se está logado antes de criar checkout
        const currentUser = appState.currentUser;
        if (!currentUser || !currentUser.id) {
            // Se não estiver logado, salvar plano desejado e redirecionar para login
            localStorage.setItem('pending_plan_id', planId);
            closeCreditsModal();
            alert('Para comprar um plano, você precisa fazer login primeiro. Você será redirecionado para a página de login.');
            switchTab('login');
            // Mostrar mensagem na tela de login
            setTimeout(() => {
                const statusMsg = document.getElementById('auth-login-status');
                if (statusMsg) {
                    statusMsg.textContent = 'Faça login para continuar com a compra do plano';
                    statusMsg.className = 'auth-status-message info';
                    statusMsg.classList.remove('hidden');
                }
            }, 500);
            return;
        }
        
        // Fallback: criar sessão de checkout dinâmica
        console.log('[PLANS] Criando checkout session...');
        const { data } = await apiClient.post('/api/credits/create-checkout', { planId });
        
        if (!data.url || !data.sessionId) {
            throw new Error('Erro ao criar sessão de pagamento');
        }
        
        console.log('[PLANS] Redirecionando para Stripe Checkout:', data.url);
        
        // Salvar sessionId no localStorage para verificar após retorno
        localStorage.setItem('stripe_session_id', data.sessionId);
        localStorage.setItem('stripe_plan_id', planId);
        
        // Redirecionar para Stripe Checkout
        window.location.href = data.url;
        
    } catch (error) {
        console.error('[PLANS] Erro ao comprar plano:', error);
        const errorMsg = error.response?.data?.error || error.message || 'Erro ao processar compra';
        alert(`Erro ao comprar plano: ${errorMsg}`);
    }
}

/**
 * Verificar pagamento após retorno do Stripe (Checkout Session dinâmica)
 */
async function checkPaymentStatus() {
    const sessionId = localStorage.getItem('stripe_session_id');
    const planId = localStorage.getItem('stripe_plan_id');
    
    if (!sessionId || !planId) {
        return;
    }
    
    try {
        console.log('[PLANS] Verificando status do pagamento...', sessionId);
        
        // Verificar status da sessão
        const { data } = await apiClient.get(`/api/stripe/verify-session?sessionId=${sessionId}`);
        
        if (data.payment_status === 'paid') {
            // Pagamento confirmado, processar compra
            console.log('[PLANS] Pagamento confirmado, processando compra...');
            
            const purchaseResponse = await apiClient.post('/api/credits/purchase', { 
                planId, 
                sessionId 
            });
            
            const purchaseData = purchaseResponse.data;
            const videosText = purchaseData.plan.is_unlimited 
                ? 'vídeos ilimitados' 
                : `${purchaseData.plan.videos_limit} vídeos`;
            
            alert(`✅ Pagamento confirmado! Plano ${purchaseData.plan.name} ativado com sucesso!\n\nVocê agora pode processar ${videosText}.`);
            
            // Recarregar informações
            await loadUserVideos();
            
            // Limpar localStorage
            localStorage.removeItem('stripe_session_id');
            localStorage.removeItem('stripe_plan_id');
            
            // Remover parâmetros da URL
            const url = new URL(window.location);
            url.searchParams.delete('payment');
            url.searchParams.delete('session_id');
            window.history.replaceState({}, '', url);
            
        } else if (data.payment_status === 'unpaid') {
            console.log('[PLANS] Pagamento ainda não confirmado');
        }
        
    } catch (error) {
        console.error('[PLANS] Erro ao verificar pagamento:', error);
        // Não mostrar erro ao usuário, apenas logar
    }
}

/**
 * Verificar compra via Payment Link (link externo)
 */
async function verifyPaymentLinkPurchase(planId) {
    try {
        console.log('[PLANS] Verificando compra via Payment Link para plano:', planId);
        
        // Verificar se o plano foi ativado (o webhook deve ter processado)
        const { data: balanceData } = await apiClient.get('/api/credits/balance');
        
        // Buscar informações do plano
        const plansResponse = await fetch(`${API_BASE}/api/credits/plans`);
        const plansData = await plansResponse.json();
        const plan = plansData.plans.find(p => p.id === planId);
        
        if (!plan) {
            throw new Error('Plano não encontrado');
        }
        
        // Verificar se o plano atual do usuário corresponde ao plano comprado
        if (balanceData.plan_id === planId) {
            // Plano ativado com sucesso!
            const videosText = plan.is_unlimited 
                ? 'vídeos ilimitados' 
                : `${plan.videos_limit} vídeos`;
            
            alert(`✅ Pagamento confirmado! Plano ${plan.name} ativado com sucesso!\n\nVocê agora pode processar ${videosText}.`);
            
            // Recarregar informações
            await loadUserVideos();
            closeCreditsModal();
            
            // Limpar localStorage
            localStorage.removeItem('stripe_plan_id');
            localStorage.removeItem('stripe_payment_pending');
        } else {
            // Ainda não processado, tentar validar manualmente
            console.log('[PLANS] Plano ainda não ativado, tentando validação manual...');
            
            // Chamar endpoint de validação manual
            const { data } = await apiClient.post('/api/stripe/validate-payment-link', { planId });
            
            if (data.success) {
                const videosText = plan.is_unlimited 
                    ? 'vídeos ilimitados' 
                    : `${plan.videos_limit} vídeos`;
                
                alert(`✅ Pagamento confirmado! Plano ${plan.name} ativado com sucesso!\n\nVocê agora pode processar ${videosText}.`);
                
                await loadUserVideos();
                closeCreditsModal();
                
                localStorage.removeItem('stripe_plan_id');
                localStorage.removeItem('stripe_payment_pending');
            } else {
                console.log('[PLANS] Pagamento ainda não confirmado, aguardando webhook...');
                // Não mostrar erro, o webhook pode ainda estar processando
            }
        }
        
    } catch (error) {
        console.error('[PLANS] Erro ao verificar compra via Payment Link:', error);
        // Não mostrar erro ao usuário, o webhook pode processar depois
    }
}

async function handleForgotPassword(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const emailInput = document.getElementById('auth-forgot-email');
    const btnText = document.getElementById('auth-forgot-btn-text');
    const btnSpinner = document.getElementById('auth-forgot-btn-spinner');
    const statusMsg = document.getElementById('auth-forgot-status');

    if (!emailInput) return;

    const email = emailInput.value.trim();
    if (!email) {
        if (statusMsg) {
            statusMsg.textContent = 'Digite seu email';
            statusMsg.className = 'auth-status-message error';
            statusMsg.classList.remove('hidden');
        }
        return;
    }

    if (btnText) btnText.classList.add('hidden');
    if (btnSpinner) btnSpinner.classList.remove('hidden');
    if (statusMsg) statusMsg.classList.add('hidden');

    try {
        const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro ao enviar email');
        }

        if (statusMsg) {
            statusMsg.textContent = data.message || 'Se o email existir, você receberá um link para redefinir sua senha. Verifique sua caixa de entrada e spam.';
            statusMsg.className = 'auth-status-message success';
            statusMsg.classList.remove('hidden');
        }
    } catch (error) {
        if (statusMsg) {
            statusMsg.textContent = error.message || 'Erro ao enviar email. Tente novamente.';
            statusMsg.className = 'auth-status-message error';
            statusMsg.classList.remove('hidden');
        }
    } finally {
        if (btnText) btnText.classList.remove('hidden');
        if (btnSpinner) btnSpinner.classList.add('hidden');
    }
}

async function handleLogin(event) {
    console.log('[AUTH] handleLogin chamado', event);
    
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    // Buscar elementos na nova estrutura
    const emailInput = document.getElementById('auth-login-email');
    const passwordInput = document.getElementById('auth-login-password');
    const btnText = document.getElementById('auth-login-btn-text');
    const btnSpinner = document.getElementById('auth-login-btn-spinner');
    const statusMsg = document.getElementById('auth-login-status');
    
    console.log('[AUTH] Elementos encontrados:', { 
        emailInput: !!emailInput, 
        passwordInput: !!passwordInput,
        btnText: !!btnText,
        btnSpinner: !!btnSpinner,
        statusMsg: !!statusMsg
    });
    
    if (!emailInput || !passwordInput) {
        console.error('[AUTH] ❌ Campos de login não encontrados');
        alert('Erro: Campos de login não encontrados. Recarregue a página.');
        return;
    }
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    if (btnText) btnText.classList.add('hidden');
    if (btnSpinner) btnSpinner.classList.remove('hidden');
    if (statusMsg) statusMsg.classList.add('hidden');
    
    // Validação básica
    if (!email || !password) {
        if (statusMsg) {
            statusMsg.textContent = 'Por favor, preencha todos os campos';
            statusMsg.className = 'auth-status-message error';
            statusMsg.classList.remove('hidden');
        }
        if (btnText) btnText.classList.remove('hidden');
        if (btnSpinner) btnSpinner.classList.add('hidden');
        return;
    }
    
    try {
        console.log('[AUTH] 🔐 Tentando fazer login...', { 
            email: email.substring(0, 5) + '***', 
            apiBase: API_BASE,
            timestamp: new Date().toISOString()
        });
        
        const loginPayload = { email, password };
        console.log('[AUTH] 📤 Enviando requisição:', {
            url: `${API_BASE}/api/auth/login`,
            method: 'POST',
            hasEmail: !!email,
            hasPassword: !!password
        });
        
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(loginPayload),
            credentials: 'include', // Importante para cookies
            mode: 'cors' // Garantir CORS
        });
        
        console.log('[AUTH] Resposta recebida:', { status: response.status, statusText: response.statusText, ok: response.ok });
        
        let data;
        try {
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('[AUTH] Resposta não é JSON:', text.substring(0, 500));
                throw new Error(`Servidor retornou resposta inválida (não é JSON). Status: ${response.status}`);
            }
            
            const text = await response.text();
            console.log('[AUTH] Resposta texto (primeiros 200 chars):', text.substring(0, 200));
            
            if (!text || text.trim() === '') {
                throw new Error('Resposta vazia do servidor');
            }
            
            data = JSON.parse(text);
        } catch (parseError) {
            console.error('[AUTH] Erro ao parsear resposta:', parseError);
            if (statusMsg) {
                statusMsg.textContent = parseError.message || 'Erro ao processar resposta do servidor';
                statusMsg.className = 'auth-status-message error';
                statusMsg.classList.remove('hidden');
            }
            if (btnText) btnText.classList.remove('hidden');
            if (btnSpinner) btnSpinner.classList.add('hidden');
            return;
        }
        
        console.log('[AUTH] Dados parseados:', { 
            hasUser: !!data.user, 
            hasToken: !!(data.token || data.session?.access_token), 
            hasSession: !!data.session,
            error: data.error 
        });
        
        if (!response.ok) {
            // Mostrar erro
            if (statusMsg) {
                statusMsg.textContent = data.error || 'Erro ao fazer login';
                statusMsg.className = 'auth-status-message error';
                statusMsg.classList.remove('hidden');
            }
            if (btnText) btnText.classList.remove('hidden');
            if (btnSpinner) btnSpinner.classList.add('hidden');
            return;
        }
        
        // Verificar se temos usuário e token (pode vir em data.token ou data.session.access_token)
        const accessToken = data.token || data.session?.access_token;
        
        if (data.user && accessToken) {
            console.log('[AUTH] ✅ Login realizado com sucesso!');
            
            appState.currentUser = data.user;
            appState.userToken = accessToken;
            localStorage.setItem('ezv2_user', JSON.stringify(data.user));
            localStorage.setItem('ezv2_token', accessToken);
            
            // Salvar também a sessão completa se disponível
            if (data.session) {
                localStorage.setItem('ezv2_session', JSON.stringify(data.session));
            }
            
            if (statusMsg) {
                statusMsg.textContent = 'Login realizado com sucesso!';
                statusMsg.className = 'auth-status-message success';
                statusMsg.classList.remove('hidden');
            }
            
            // Restaurar botões
            if (btnText) btnText.classList.remove('hidden');
            if (btnSpinner) btnSpinner.classList.add('hidden');
            
            updateUserUI();
            
            // Carregar créditos
            await loadUserVideos();
            
            // Fechar modal de login se estiver aberto
            closeLoginRequiredModal();
            
            // Garantir que conteúdo principal está visível
            showMainContent();
            
            // Verificar se há plano pendente para compra
            const pendingPlanId = localStorage.getItem('pending_plan_id');
            if (pendingPlanId) {
                console.log('[AUTH] Plano pendente encontrado após login:', pendingPlanId);
                localStorage.removeItem('pending_plan_id');
                // Aguardar um pouco para garantir que UI está atualizada
                setTimeout(() => {
                    showCreditsPurchaseModal();
                    // Destacar o plano que estava pendente
                    setTimeout(() => {
                        const planCard = document.querySelector(`[onclick*="${pendingPlanId}"]`);
                        if (planCard) {
                            planCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            planCard.style.borderColor = '#667eea';
                            planCard.style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.5)';
                        }
                    }, 300);
                }, 500);
                return;
            }
            
            // Retomar geração se estava pendente
            if (appState.pendingGeneration) {
                console.log('[AUTH] Retomando geração após login...');
                // Restaurar estado
                Object.assign(appState, appState.pendingGeneration);
                appState.pendingGeneration = null;
                
                // Verificar vídeos e continuar geração
                setTimeout(() => {
                    proceedToGenerate();
                }, 500);
                return;
            }
            
            // Se não havia geração pendente, apenas atualizar UI
            setTimeout(() => {
                switchTab('home');
            }, 500);
        } else {
            console.error('[AUTH] Resposta inválida:', data);
            console.error('[AUTH] Estrutura esperada: { user: {...}, token: "..." } ou { user: {...}, session: { access_token: "..." } }');
            if (statusMsg) {
                const errorMsg = data.error || 
                    (data.user ? 'Erro: Token não recebido do servidor' : 'Erro: Dados do usuário não recebidos');
                statusMsg.textContent = errorMsg;
                statusMsg.className = 'auth-status-message error';
                statusMsg.classList.remove('hidden');
            }
            if (btnText) btnText.classList.remove('hidden');
            if (btnSpinner) btnSpinner.classList.add('hidden');
        }
    } catch (error) {
        console.error('[AUTH] Erro no login:', error);
        if (statusMsg) {
            statusMsg.textContent = error.message || 'Erro ao conectar com o servidor. Verifique sua conexão.';
            statusMsg.className = 'auth-status-message error';
            statusMsg.classList.remove('hidden');
        }
        if (btnText) btnText.classList.remove('hidden');
        if (btnSpinner) btnSpinner.classList.add('hidden');
    }
}

async function handleRegister(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    // Buscar elementos na nova estrutura
    const nameInput = document.getElementById('auth-register-name');
    const emailInput = document.getElementById('auth-register-email');
    const passwordInput = document.getElementById('auth-register-password');
    const btnText = document.getElementById('auth-register-btn-text');
    const btnSpinner = document.getElementById('auth-register-btn-spinner');
    const statusMsg = document.getElementById('auth-register-status');
    
    console.log('[AUTH] Elementos de registro encontrados:', { 
        nameInput: !!nameInput,
        emailInput: !!emailInput, 
        passwordInput: !!passwordInput,
        btnText: !!btnText,
        btnSpinner: !!btnSpinner,
        statusMsg: !!statusMsg
    });
    
    if (!nameInput || !emailInput || !passwordInput) {
        console.error('[AUTH] ❌ Campos de registro não encontrados');
        alert('Erro: Campos de registro não encontrados. Recarregue a página.');
        return;
    }
    
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    btnText.classList.add('hidden');
    btnSpinner.classList.remove('hidden');
    statusMsg.classList.add('hidden');
    
    // Validação básica
    if (!name || !email || !password) {
        statusMsg.textContent = 'Por favor, preencha todos os campos';
        statusMsg.className = 'auth-status-message error';
        statusMsg.classList.remove('hidden');
        btnText.classList.remove('hidden');
        btnSpinner.classList.add('hidden');
        return;
    }
    
    if (password.length < 6) {
        statusMsg.textContent = 'A senha deve ter no mínimo 6 caracteres';
        statusMsg.className = 'auth-status-message error';
        statusMsg.classList.remove('hidden');
        btnText.classList.remove('hidden');
        btnSpinner.classList.add('hidden');
        return;
    }
    
    try {
        console.log('[AUTH] Tentando criar conta...');
        const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        
        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            console.error('[AUTH] Erro ao parsear resposta:', parseError);
            throw new Error('Resposta inválida do servidor');
        }
        
        if (!response.ok) {
            // Mostrar erro
            statusMsg.textContent = data.error || 'Erro ao criar conta';
            statusMsg.className = 'auth-status-message error';
            statusMsg.classList.remove('hidden');
            btnText.classList.remove('hidden');
            btnSpinner.classList.add('hidden');
            return;
        }
        
        // Verificar se registro foi bem-sucedido
        if (data.user) {
            console.log('[AUTH] ✅ Conta criada com sucesso!');
            
            // Se requer confirmação de email, não fazer login automático
            if (data.requiresEmailConfirmation) {
                statusMsg.textContent = data.message || 'Conta criada! Verifique seu email para confirmar antes de fazer login.';
                statusMsg.className = 'auth-status-message success';
                statusMsg.classList.remove('hidden');
                
                // Restaurar botões
                btnText.classList.remove('hidden');
                btnSpinner.classList.add('hidden');
                
                // Mudar para tela de login após 2 segundos
                setTimeout(() => {
                    switchAuthView('login');
                    if (statusMsg) {
                        statusMsg.textContent = 'Faça login após confirmar seu email';
                        statusMsg.className = 'auth-status-message info';
                    }
                }, 2000);
                return;
            }
            
            // Se não requer confirmação, fazer login automático
            const accessToken = data.token || data.session?.access_token;
            
            if (accessToken) {
                appState.currentUser = data.user;
                appState.userToken = accessToken;
                localStorage.setItem('ezv2_user', JSON.stringify(data.user));
                localStorage.setItem('ezv2_token', accessToken);
                
                if (data.session) {
                    localStorage.setItem('ezv2_session', JSON.stringify(data.session));
                }
                
                statusMsg.textContent = `Conta criada com sucesso! Você pode processar ${data.user.videos_limit || 1} vídeo(s).`;
                statusMsg.className = 'auth-status-message success';
                statusMsg.classList.remove('hidden');
                
                // Restaurar botões
                btnText.classList.remove('hidden');
                btnSpinner.classList.add('hidden');
                
                updateUserUI();
                
                // Carregar créditos
                await loadUserVideos();
                
                // Fechar modal de login se estiver aberto
                closeLoginRequiredModal();
                
                // Garantir que conteúdo principal está visível
                showMainContent();
                
                // Verificar se há plano pendente para compra
                const pendingPlanId = localStorage.getItem('pending_plan_id');
                if (pendingPlanId) {
                    console.log('[AUTH] Plano pendente encontrado após registro:', pendingPlanId);
                    localStorage.removeItem('pending_plan_id');
                    // Aguardar um pouco para garantir que UI está atualizada
                    setTimeout(() => {
                        showCreditsPurchaseModal();
                        // Destacar o plano que estava pendente
                        setTimeout(() => {
                            const planCard = document.querySelector(`[onclick*="${pendingPlanId}"]`);
                            if (planCard) {
                                planCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                planCard.style.borderColor = '#667eea';
                                planCard.style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.5)';
                            }
                        }, 300);
                    }, 500);
                    return;
                }
                
                // Retomar geração se estava pendente
                if (appState.pendingGeneration) {
                    console.log('[AUTH] Retomando geração após registro...');
                    // Restaurar estado
                    Object.assign(appState, appState.pendingGeneration);
                    appState.pendingGeneration = null;
                    
                    // Verificar vídeos e continuar geração
                    setTimeout(() => {
                        proceedToGenerate();
                    }, 500);
                    return;
                }
                
                // Se não havia geração pendente, apenas atualizar UI
                setTimeout(() => {
                    switchTab('home');
                }, 500);
            } else {
                // Conta criada mas sem token (precisa confirmar email)
                statusMsg.textContent = data.message || 'Conta criada! Verifique seu email para confirmar.';
                statusMsg.className = 'auth-status-message success';
                statusMsg.classList.remove('hidden');
                btnText.classList.remove('hidden');
                btnSpinner.classList.add('hidden');
            }
        } else {
            console.error('[AUTH] Resposta inválida:', data);
            statusMsg.textContent = data.error || 'Erro ao criar conta - resposta inválida';
            statusMsg.className = 'auth-status-message error';
            statusMsg.classList.remove('hidden');
            btnText.classList.remove('hidden');
            btnSpinner.classList.add('hidden');
        }
    } catch (error) {
        console.error('[AUTH] Erro no registro:', error);
        statusMsg.textContent = error.message || 'Erro ao conectar com o servidor. Verifique sua conexão.';
        statusMsg.className = 'login-status error';
        statusMsg.classList.remove('hidden');
        btnText.classList.remove('hidden');
        btnSpinner.classList.add('hidden');
    }
}

// Alternar entre login, registro e esqueci senha
function switchAuthView(view) {
    const loginCard = document.getElementById('auth-login-card');
    const registerCard = document.getElementById('auth-register-card');
    const forgotCard = document.getElementById('auth-forgot-card');

    [loginCard, registerCard, forgotCard].forEach(c => c && c.classList.remove('active'));

    if (view === 'register' && registerCard) {
        registerCard.classList.add('active');
    } else if (view === 'forgot' && forgotCard) {
        forgotCard.classList.add('active');
        const emailFromLogin = document.getElementById('auth-login-email');
        const emailForgot = document.getElementById('auth-forgot-email');
        if (emailFromLogin && emailForgot && emailFromLogin.value) {
            emailForgot.value = emailFromLogin.value;
        }
    } else if (loginCard) {
        loginCard.classList.add('active');
    }
}

function showRegister() {
    switchAuthView('register');
    switchTab('login');
}

function showLogin() {
    switchAuthView('login');
    switchTab('login');
}

// Função antiga mantida para compatibilidade
function showRegisterOld() {
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

/**
 * Mostrar modal de login necessário para geração
 */
function showLoginRequiredModal() {
    const modal = document.getElementById('login-required-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Fechar modal de login necessário
 */
function closeLoginRequiredModal() {
    const modal = document.getElementById('login-required-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

/**
 * Abrir tela de login a partir do modal
 */
function openLoginFromModal() {
    closeLoginRequiredModal();
    // Abrir aba de login na nova estrutura
    switchTab('login');
    switchAuthView('login');
    if (mainContent) {
        mainContent.style.pointerEvents = 'none'; // Bloquear cliques no conteúdo enquanto auth está aberto
    }
    
    showLogin();
    
    // Scroll para a seção de auth
    setTimeout(() => {
        if (authSection) {
            authSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 100);
}

function logout() {
    clearAuth();
    // Após logout, mostrar conteúdo principal (não bloquear acesso)
    showMainContent();
    // Limpar formulários
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    if (emailInput) emailInput.value = '';
    if (passwordInput) passwordInput.value = '';
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
            // Upload não requer autenticação - apenas mostrar erro
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
    
    // Prevenir comportamento padrão do navegador APENAS na área de upload
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
        // NÃO adicionar ao document.body para não bloquear outros cliques
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
 * Atualizar progresso do download - barra de loading visível
 */
function updateDownloadProgress(percent, message) {
    // Criar ou atualizar barra de progresso visível abaixo do input
    let progressContainer = document.getElementById('youtube-download-progress');
    if (!progressContainer) {
        progressContainer = document.createElement('div');
        progressContainer.id = 'youtube-download-progress';
        progressContainer.className = 'youtube-download-progress';
        progressContainer.style.cssText = `
            margin-top: 1.5rem;
            padding: 1.5rem;
            background: rgba(18, 11, 46, 0.8);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(179, 140, 255, 0.3);
            border-radius: 16px;
            display: flex;
            flex-direction: column;
            gap: 1rem;
            animation: slideDown 0.3s ease-out;
        `;
        
        // Inserir após o input-group-large
        const inputGroup = document.querySelector('#input-youtube .input-group-large');
        if (inputGroup && inputGroup.parentNode) {
            inputGroup.parentNode.insertBefore(progressContainer, inputGroup.nextSibling);
        } else {
            // Fallback: inserir no card do YouTube
            const youtubeCard = document.querySelector('[data-step-card="youtube"]');
            if (youtubeCard) {
                youtubeCard.appendChild(progressContainer);
            }
        }
    }
    
    // Atualizar conteúdo da barra de progresso
    progressContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
            <div style="font-size: 0.875rem; font-weight: 600; color: #EAEAF0;">
                ${message || 'Baixando vídeo do YouTube...'}
            </div>
            <div style="font-size: 1rem; font-weight: 700; color: #B38CFF;">
                ${Math.round(percent)}%
            </div>
        </div>
        <div style="width: 100%; height: 12px; background: rgba(179, 140, 255, 0.2); border-radius: 8px; overflow: hidden; position: relative;">
            <div style="width: ${percent}%; height: 100%; background: linear-gradient(90deg, #B38CFF 0%, #FF6EC7 100%); border-radius: 8px; transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 0 12px rgba(179, 140, 255, 0.5); position: relative; overflow: hidden;">
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent); animation: shimmer 2s infinite;"></div>
            </div>
        </div>
    `;
    
    // Também atualizar overlay no player (se existir)
    const container = document.getElementById('video-player-container');
    if (container) {
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
                background: rgba(15, 10, 31, 0.9);
                backdrop-filter: blur(10px);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: white;
                z-index: 10;
                border-radius: 12px;
                pointer-events: none;
            `;
            container.appendChild(progressOverlay);
        }
        
        progressOverlay.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 2rem; font-weight: 700; margin-bottom: 12px; background: linear-gradient(135deg, #B38CFF 0%, #FF6EC7 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                    ${Math.round(percent)}%
                </div>
                <div style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 20px; color: #B8B6C9;">${message || 'Baixando...'}</div>
                <div style="width: 200px; height: 6px; background: rgba(179, 140, 255, 0.2); border-radius: 3px; overflow: hidden;">
                    <div style="width: ${percent}%; height: 100%; background: linear-gradient(90deg, #B38CFF 0%, #FF6EC7 100%); transition: width 0.3s ease; box-shadow: 0 0 8px rgba(179, 140, 255, 0.5);"></div>
                </div>
            </div>
        `;
    }
}

/**
 * Limpar overlay de progresso
 */
function clearDownloadProgress() {
    // Remover barra de progresso principal
    const progressContainer = document.getElementById('youtube-download-progress');
    if (progressContainer) {
        progressContainer.style.animation = 'slideUp 0.3s ease-out';
        setTimeout(() => {
            progressContainer.remove();
        }, 300);
    }
    
    // Remover overlay do player
    const container = document.getElementById('video-player-container');
    if (container) {
        const progressOverlay = container.querySelector('.download-progress-overlay');
        if (progressOverlay) {
            progressOverlay.remove();
        }
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
        updateGenerateButtonState(); // Atualizar botão quando número de clipes mudar
    }
    
    // AVANÇAR AUTOMATICAMENTE para etapa 3 (Legendas) após salvar intervalo
    setTimeout(() => {
        showCaptionsSection();
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
        scrollToCard('captions');
    }, 300);
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
    updateGenerateButtonState(); // Atualizar botão quando número de clipes mudar
    
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
        scrollToCard('niche');
    }
}

/**
 * Atualizar estado visual do botão de gerar clipes
 */
function updateGenerateButtonState() {
    const generateBtn = document.querySelector('button[onclick="proceedToGenerate()"]');
    if (!generateBtn) return;
    
    const isLoggedIn = appState.currentUser && appState.userToken;
    const isAdmin = appState.currentUser?.role === 'admin';
    const isUnlimited = appState.userVideos?.is_unlimited || false;
    const videosUsed = appState.userVideos?.videos_used ?? 0;
    const videosLimit = appState.userVideos?.videos_limit;
    const videosRemaining = appState.userVideos?.videos_remaining;
    const hasVideoAvailable = isAdmin || isUnlimited || (videosRemaining !== null && videosRemaining > 0);
    
    if (!isLoggedIn) {
        // Usuário não logado - botão HABILITADO mas mostrará modal de login ao clicar
        generateBtn.disabled = false;
        generateBtn.style.opacity = '1';
        generateBtn.style.cursor = 'pointer';
        generateBtn.title = 'Clique para gerar clipes (login será solicitado)';
    } else if (!hasVideoAvailable && !isAdmin) {
        // Usuário logado mas sem vídeos disponíveis
        generateBtn.disabled = true;
        generateBtn.style.opacity = '0.6';
        generateBtn.style.cursor = 'not-allowed';
        generateBtn.title = `Limite de vídeos atingido. Você já processou ${videosUsed} de ${videosLimit} vídeos permitidos.`;
    } else {
        // Usuário logado com vídeos disponíveis ou admin - botão habilitado
        generateBtn.disabled = false;
        generateBtn.style.opacity = '1';
        generateBtn.style.cursor = 'pointer';
        if (isAdmin || isUnlimited) {
            generateBtn.title = 'Gerar clipes (ilimitado) - Cortes ilimitados por vídeo';
        } else {
            generateBtn.title = `Gerar clipes - ${videosRemaining} vídeo(s) restante(s). Cortes ilimitados por vídeo.`;
        }
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
    
    // NOVO SISTEMA: Carregar vídeo de retenção do nicho (YouTube)
    await loadNicheRetentionVideo(nicheId);
    
    // Mostrar botão para continuar (NÃO avançar automaticamente)
    showContinueButtonAfterNiche();
}

/**
 * Carregar vídeo de retenção do nicho (YouTube) e todas as opções
 */
async function loadNicheRetentionVideo(nicheId) {
    try {
        console.log(`[NICHE] Carregando vídeo de retenção do nicho: ${nicheId}`);
        
        const response = await fetch(`${API_BASE}/api/retention/niche/${nicheId}`);
        const data = await response.json();
        
        console.log('[NICHE] Dados do nicho:', data);
        
        // Mostrar todas as opções de retenção em miniaturas
        const retentionInfo = document.getElementById('niche-retention-info');
        if (retentionInfo) {
            let html = `
                <div style="padding: 1rem; background: var(--bg-secondary); border-radius: 0.75rem; margin-top: 1rem;">
                    <h4 style="margin: 0 0 0.75rem 0; font-size: 1rem; font-weight: 600;">Opções de Vídeo de Retenção</h4>
                    <p style="margin: 0 0 1rem 0; color: var(--text-secondary); font-size: 0.875rem;">
                        Escolha um vídeo de retenção para este nicho. O vídeo padrão do YouTube será usado automaticamente se nenhum for selecionado.
                    </p>
                    <div id="retention-options-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.75rem; margin-bottom: 1rem;">
            `;
            
            // Opção 1: Vídeo padrão do YouTube do nicho
            if (data.retentionYoutubeUrl) {
                const youtubeIdMatch = data.retentionYoutubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
                const youtubeId = youtubeIdMatch ? youtubeIdMatch[1] : null;
                
                html += `
                    <div class="retention-option-card" data-retention-type="niche-youtube" data-youtube-id="${youtubeId || ''}" style="
                        position: relative;
                        padding-bottom: 56.25%;
                        height: 0;
                        overflow: hidden;
                        border-radius: 0.5rem;
                        border: 2px solid var(--border);
                        cursor: pointer;
                        background: var(--bg-tertiary);
                        transition: all 0.2s;
                    " onclick="selectRetentionOption('niche-youtube', '${youtubeId || ''}')">
                        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column; padding: 0.5rem;">
                            ${youtubeId ? `
                                <img src="https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg" 
                                     style="width: 100%; height: 100%; object-fit: cover; border-radius: 0.25rem;"
                                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            ` : ''}
                            <div style="display: ${youtubeId ? 'none' : 'flex'}; align-items: center; justify-content: center; width: 100%; height: 100%; flex-direction: column; gap: 0.25rem;">
                                <span style="font-size: 1.5rem;">🎬</span>
                                <span style="font-size: 0.75rem; text-align: center; color: var(--text-secondary);">YouTube</span>
                            </div>
                            <div style="position: absolute; top: 0.25rem; right: 0.25rem; background: rgba(0,0,0,0.7); color: white; padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-size: 0.625rem; font-weight: 600;">
                                PADRÃO
                            </div>
                        </div>
                    </div>
                `;
            }
            
            // Opções legadas (vídeos antigos)
            if (data.legacyVideos && data.legacyVideos.length > 0) {
                data.legacyVideos.forEach(video => {
                    html += `
                        <div class="retention-option-card" data-retention-type="legacy" data-video-id="${video.id}" style="
                            position: relative;
                            padding-bottom: 56.25%;
                            height: 0;
                            overflow: hidden;
                            border-radius: 0.5rem;
                            border: 2px solid var(--border);
                            cursor: pointer;
                            background: var(--bg-tertiary);
                            transition: all 0.2s;
                        " onclick="selectRetentionOption('legacy', '${video.id}')">
                            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column; padding: 0.5rem;">
                                <span style="font-size: 1.5rem;">${video.exists ? '🎬' : '📁'}</span>
                                <span style="font-size: 0.75rem; text-align: center; color: var(--text-secondary); margin-top: 0.25rem;">${video.name || video.id}</span>
                                ${!video.exists ? `
                                    <span style="font-size: 0.625rem; color: var(--text-tertiary); margin-top: 0.125rem;">Não disponível</span>
                                ` : ''}
                            </div>
                        </div>
                    `;
                });
            }
            
            html += `
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; padding-top: 0.75rem; border-top: 1px solid var(--border);">
                        <span id="selected-retention-info" style="color: var(--text-secondary);">
                            ${data.retentionYoutubeUrl ? '✅ Vídeo padrão do YouTube será usado' : '⚠️ Nenhum vídeo de retenção configurado'}
                        </span>
                    </div>
                </div>
            `;
            
            retentionInfo.innerHTML = html;
            retentionInfo.style.display = 'block';
            
            // Selecionar opção padrão (YouTube do nicho)
            if (data.retentionYoutubeUrl) {
                const defaultCard = retentionInfo.querySelector('[data-retention-type="niche-youtube"]');
                if (defaultCard) {
                    defaultCard.style.borderColor = 'var(--primary)';
                    defaultCard.style.boxShadow = '0 0 0 2px var(--primary-alpha)';
                }
                appState.selectedRetentionOption = {
                    type: 'niche-youtube',
                    youtubeId: data.retentionYoutubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1]
                };
            }
        }
        
        // Armazenar informações do vídeo de retenção
        appState.nicheRetentionVideo = {
            youtubeUrl: data.retentionYoutubeUrl,
            path: data.retentionVideoPath,
            downloaded: data.retentionVideoDownloaded,
            legacyVideos: data.legacyVideos || []
        };
        
    } catch (error) {
        console.error('[NICHE] Erro ao carregar vídeo de retenção:', error);
    }
}

/**
 * Selecionar opção de retenção
 */
function selectRetentionOption(type, id) {
    // Remover seleção anterior
    document.querySelectorAll('.retention-option-card').forEach(card => {
        card.style.borderColor = 'var(--border)';
        card.style.boxShadow = 'none';
    });
    
    // Selecionar nova opção
    const selectedCard = document.querySelector(`[data-retention-type="${type}"][data-${type === 'niche-youtube' ? 'youtube' : 'video'}-id="${id}"]`);
    if (selectedCard) {
        selectedCard.style.borderColor = 'var(--primary)';
        selectedCard.style.boxShadow = '0 0 0 2px var(--primary-alpha)';
    }
    
    // Atualizar estado
    if (type === 'niche-youtube') {
        appState.selectedRetentionOption = {
            type: 'niche-youtube',
            youtubeId: id
        };
        document.getElementById('selected-retention-info').textContent = '✅ Vídeo padrão do YouTube será usado';
    } else if (type === 'legacy') {
        appState.selectedRetentionOption = {
            type: 'legacy',
            videoId: id
        };
        const video = appState.nicheRetentionVideo?.legacyVideos?.find(v => v.id === id);
        document.getElementById('selected-retention-info').textContent = `✅ ${video?.name || id} será usado`;
    }
    
    console.log('[RETENTION] Opção selecionada:', appState.selectedRetentionOption);
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

const HEADLINE_FONT_SIZE_MAP = { xs: 36, small: 48, medium: 72, large: 96, xl: 120 };
const HEADLINE_TARJA_PERCENT = { 1: 0.05, 2: 0.15, 3: 0.25, 4: 0.5 };
const PREVIEW_HEIGHT_PX = 360;
const CLIP_HEIGHT_PX = 1920;

function updateHeadlineText() {
    const textInput = document.getElementById('headline-text-input');
    const countEl = document.getElementById('headline-char-count');
    if (textInput) {
        const text = textInput.value;
        appState.headlineText = (text && text.trim()) ? text : 'Headline';
        if (countEl) countEl.textContent = (text || '').length + '/500';
    }
    updateHeadlinePreview();
    updateGenerateSummary();
}

function updateHeadlinePreview() {
    const headline = document.getElementById('preview-headline');
    const tarjaTop = document.getElementById('headline-preview-tarja-top');
    const tarjaCenter = document.getElementById('headline-preview-tarja-center');
    const tarjaBottom = document.getElementById('headline-preview-tarja-bottom');
    if (!headline) return;

    const textInput = document.getElementById('headline-text-input');
    const fontSizeSelect = document.getElementById('headline-font-size');
    const positionSelect = document.getElementById('headline-title-position');
    const colorInput = document.getElementById('headline-color-input');
    const strokeInput = document.getElementById('headline-stroke-color');
    const tarjaTopSizeEl = document.getElementById('headline-tarja-superior-size');
    const tarjaCenterSizeEl = document.getElementById('headline-tarja-central-size');
    const tarjaBottomSizeEl = document.getElementById('headline-tarja-inferior-size');
    const tarjaTopColorEl = document.getElementById('headline-tarja-superior-color');
    const tarjaCenterColorEl = document.getElementById('headline-tarja-central-color');
    const tarjaBottomColorEl = document.getElementById('headline-tarja-inferior-color');

    const text = (textInput && textInput.value) ? textInput.value : '';
    appState.headlineText = (text && text.trim()) ? text : 'Headline';
    const fontSizePreset = (fontSizeSelect && fontSizeSelect.value) || 'medium';
    const position = (positionSelect && positionSelect.value) || 'center';
    const color = (colorInput && colorInput.value) || '#FFFFFF';
    const strokeColor = (strokeInput && strokeInput.value) || '#000000';
    const tarjaTopSize = (tarjaTopSizeEl && tarjaTopSizeEl.value) ? parseInt(tarjaTopSizeEl.value, 10) : 0;
    const tarjaCenterSize = (tarjaCenterSizeEl && tarjaCenterSizeEl.value) ? parseInt(tarjaCenterSizeEl.value, 10) : 0;
    const tarjaBottomSize = (tarjaBottomSizeEl && tarjaBottomSizeEl.value) ? parseInt(tarjaBottomSizeEl.value, 10) : 0;
    const tarjaTopColor = (tarjaTopColorEl && tarjaTopColorEl.value) || '#1976D2';
    const tarjaCenterColor = (tarjaCenterColorEl && tarjaCenterColorEl.value) || '#7B1FA2';
    const tarjaBottomColor = (tarjaBottomColorEl && tarjaBottomColorEl.value) || '#D32F2F';

    appState.headlineFontSize = fontSizePreset;
    appState.headlineTitlePosition = position;
    appState.headlineColor = color;
    appState.headlineStrokeColor = strokeColor;
    appState.headlineTarjaSuperiorSize = tarjaTopSize || null;
    appState.headlineTarjaCentralSize = tarjaCenterSize || null;
    appState.headlineTarjaInferiorSize = tarjaBottomSize || null;
    appState.headlineTarjaSuperiorColor = tarjaTopColor;
    appState.headlineTarjaCentralColor = tarjaCenterColor;
    appState.headlineTarjaInferiorColor = tarjaBottomColor;
    const fontSize = HEADLINE_FONT_SIZE_MAP[fontSizePreset] || 72;
    appState.headlineSize = fontSize;

    // Escala da fonte no preview = mesmo que no clipe final (proporção 360/1920)
    const fontSizeScaled = Math.max(10, Math.round(fontSize * PREVIEW_HEIGHT_PX / CLIP_HEIGHT_PX));

    if (tarjaTop) {
        if (tarjaTopSize > 0) {
            const pct = (HEADLINE_TARJA_PERCENT[tarjaTopSize] || 0.05) * 100;
            tarjaTop.style.display = 'block';
            tarjaTop.style.height = pct + '%';
            tarjaTop.style.background = tarjaTopColor;
        } else {
            tarjaTop.style.display = 'none';
        }
    }
    if (tarjaCenter) {
        if (tarjaCenterSize > 0) {
            const pct = (HEADLINE_TARJA_PERCENT[tarjaCenterSize] || 0.05) * 100;
            tarjaCenter.style.display = 'block';
            tarjaCenter.style.height = pct + '%';
            tarjaCenter.style.top = (50 - pct / 2) + '%';
            tarjaCenter.style.background = tarjaCenterColor;
        } else {
            tarjaCenter.style.display = 'none';
        }
    }
    if (tarjaBottom) {
        if (tarjaBottomSize > 0) {
            const pct = (HEADLINE_TARJA_PERCENT[tarjaBottomSize] || 0.05) * 100;
            tarjaBottom.style.display = 'block';
            tarjaBottom.style.height = pct + '%';
            tarjaBottom.style.background = tarjaBottomColor;
        } else {
            tarjaBottom.style.display = 'none';
        }
    }

    headline.textContent = (text && text.trim()) ? text : 'Headline';
    headline.style.fontSize = fontSizeScaled + 'px';
    headline.style.color = color;
    headline.style.whiteSpace = 'pre-wrap';
    headline.style.textShadow = `0 0 2px ${strokeColor}, 0 1px 1px #000`;
    headline.style.fontWeight = '900';

    // Posição da headline no preview = resultado final do clipe (Topo = sobre tarja superior, Centro = meio, Base = sobre tarja inferior)
    const pctTop = tarjaTopSize > 0 ? (HEADLINE_TARJA_PERCENT[tarjaTopSize] || 0.05) * 100 : 41;
    const pctCenter = tarjaCenterSize > 0 ? (HEADLINE_TARJA_PERCENT[tarjaCenterSize] || 0.05) * 100 : 20;
    const pctBottom = tarjaBottomSize > 0 ? (HEADLINE_TARJA_PERCENT[tarjaBottomSize] || 0.05) * 100 : 39;
    let topPercent = 51;
    if (position === 'top') {
        topPercent = pctTop / 2;
    } else if (position === 'bottom') {
        topPercent = 100 - pctBottom / 2;
    } else {
        topPercent = 50;
    }
    headline.style.top = topPercent + '%';
    headline.style.transform = 'translateY(-50%)';
    headline.style.left = '0';
    headline.style.right = '0';
}

function applyHeadlinePreviewStyles() {
    updateHeadlinePreview();
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
        scrollToCard('youtube');
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
    
    // Atualizar estado do botão se número de clipes mudou
    if (key === 'clipsQuantity') {
        updateGenerateButtonState();
    }
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

// ========== Gerador de Thumbnails 9x16 ==========
const thumbnailState = { frameToken: null, count: 0, selectedFrameIndex: null, previewBlobUrl: null };
let thumbnailPreviewTimeout = null;

async function thumbnailExtractFrames() {
    const videoId = appState.videoId;
    if (!videoId) {
        alert('Processe o vídeo primeiro (YouTube ou Upload) antes de extrair frames.');
        return;
    }
    const btnText = document.getElementById('btn-extract-text');
    const btnLoader = document.getElementById('btn-extract-loader');
    if (btnText) btnText.classList.add('hidden');
    if (btnLoader) btnLoader.classList.remove('hidden');
    try {
        const res = await fetch(`${API_BASE}/api/thumbnails/extract-frames`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoId, maxFrames: 8 })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Falha ao extrair frames');
        thumbnailState.frameToken = data.frameToken;
        thumbnailState.count = data.count || 0;
        thumbnailState.selectedFrameIndex = null;
        const grid = document.getElementById('thumbnail-frames-grid');
        const stepFrames = document.getElementById('thumb-frames-step');
        const stepEditor = document.getElementById('thumb-editor-step');
        if (grid) {
            grid.innerHTML = '';
            const duration = appState.videoDuration || 60;
            for (let i = 0; i < (data.count || 0); i++) {
                const div = document.createElement('div');
                div.className = 'thumbnail-frame-item';
                div.dataset.index = i;
                div.innerHTML = `<img src="${API_BASE}/api/thumbnails/frame/${data.frameToken}/${i}" alt="Frame ${i + 1}">`;
                div.onclick = () => thumbnailSelectFrame(i);
                grid.appendChild(div);
            }
        }
        if (stepFrames) stepFrames.style.display = 'block';
        if (stepEditor) stepEditor.style.display = 'none';
    } catch (e) {
        alert(e.message || 'Erro ao extrair frames.');
    } finally {
        if (btnText) btnText.classList.remove('hidden');
        if (btnLoader) btnLoader.classList.add('hidden');
    }
}

function thumbnailSelectFrame(index) {
    thumbnailState.selectedFrameIndex = index;
    document.querySelectorAll('.thumbnail-frame-item').forEach((el, i) => {
        el.classList.toggle('selected', i === index);
    });
    const stepEditor = document.getElementById('thumb-editor-step');
    if (stepEditor) stepEditor.style.display = 'block';
    thumbnailPreviewDebounce();
}

function thumbnailPreviewDebounce() {
    if (thumbnailPreviewTimeout) clearTimeout(thumbnailPreviewTimeout);
    thumbnailPreviewTimeout = setTimeout(() => {
        thumbnailGenerate(true);
    }, 600);
}

function getThumbnailFrameTimeSec() {
    const dur = appState.videoDuration || 60;
    const count = thumbnailState.count || 8;
    const idx = thumbnailState.selectedFrameIndex ?? 0;
    return (dur * (idx + 1)) / (count + 1);
}

async function thumbnailGenerate(silent = false) {
    if (thumbnailState.selectedFrameIndex === null && !silent) {
        alert('Selecione um frame primeiro.');
        return;
    }
    const videoId = appState.videoId;
    if (!videoId) return;
    if (!silent) {
        const btnText = document.getElementById('btn-gen-text');
        const btnLoader = document.getElementById('btn-gen-loader');
        if (btnText) btnText.classList.add('hidden');
        if (btnLoader) btnLoader.classList.remove('hidden');
    }
    try {
        const title = (document.getElementById('thumbnail-title') && document.getElementById('thumbnail-title').value) || '';
        const template = (document.getElementById('thumbnail-template') && document.getElementById('thumbnail-template').value) || 'generico';
        const contrast = (document.getElementById('thumbnail-contrast') && parseInt(document.getElementById('thumbnail-contrast').value, 10)) || 50;
        const tarjaSuperiorSizeEl = document.getElementById('thumbnail-tarja-superior-size');
        const tarjaInferiorSizeEl = document.getElementById('thumbnail-tarja-inferior-size');
        const tarjaCentralSizeEl = document.getElementById('thumbnail-tarja-central-size');
        const tarjaSuperiorSize = (tarjaSuperiorSizeEl && tarjaSuperiorSizeEl.value) ? parseInt(tarjaSuperiorSizeEl.value, 10) : null;
        const tarjaInferiorSize = (tarjaInferiorSizeEl && tarjaInferiorSizeEl.value) ? parseInt(tarjaInferiorSizeEl.value, 10) : null;
        const tarjaCentralSize = (tarjaCentralSizeEl && tarjaCentralSizeEl.value) ? parseInt(tarjaCentralSizeEl.value, 10) : null;
        const tarjaSuperiorColor = (document.getElementById('thumbnail-tarja-superior-color') && document.getElementById('thumbnail-tarja-superior-color').value) || null;
        const tarjaInferiorColor = (document.getElementById('thumbnail-tarja-inferior-color') && document.getElementById('thumbnail-tarja-inferior-color').value) || null;
        const tarjaCentralColor = (document.getElementById('thumbnail-tarja-central-color') && document.getElementById('thumbnail-tarja-central-color').value) || null;
        const fontSize = (document.getElementById('thumbnail-font-size') && document.getElementById('thumbnail-font-size').value) || 'medium';
        const titlePosition = (document.getElementById('thumbnail-title-position') && document.getElementById('thumbnail-title-position').value) || 'center';
        const textColor = (document.getElementById('thumbnail-text-color') && document.getElementById('thumbnail-text-color').value) || '#FFFFFF';
        const strokeColor = (document.getElementById('thumbnail-stroke-color') && document.getElementById('thumbnail-stroke-color').value) || '#000000';
        const res = await fetch(`${API_BASE}/api/thumbnails/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoId,
                frameTimeSec: getThumbnailFrameTimeSec(),
                title,
                template,
                contrast: contrast / 100,
                tarjaSuperiorSize,
                tarjaInferiorSize,
                tarjaCentralSize,
                tarjaSuperiorColor: tarjaSuperiorSize ? tarjaSuperiorColor : null,
                tarjaInferiorColor: tarjaInferiorSize ? tarjaInferiorColor : null,
                tarjaCentralColor: tarjaCentralSize ? tarjaCentralColor : null,
                fontSize,
                titlePosition,
                textColor,
                strokeColor
            })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Erro ao gerar thumbnail');
        }
        const blob = await res.blob();
        if (thumbnailState.previewBlobUrl) URL.revokeObjectURL(thumbnailState.previewBlobUrl);
        thumbnailState.previewBlobUrl = URL.createObjectURL(blob);
        const previewImg = document.getElementById('thumbnail-preview-img');
        const placeholder = document.getElementById('thumbnail-preview-placeholder');
        if (previewImg) {
            previewImg.src = thumbnailState.previewBlobUrl;
            previewImg.style.display = 'block';
        }
        if (placeholder) placeholder.style.display = 'none';
        const downloadLink = document.getElementById('btn-download-thumb');
        if (downloadLink) {
            downloadLink.href = thumbnailState.previewBlobUrl;
            downloadLink.download = 'ezclips-thumbnail-1080x1920.jpg';
            downloadLink.style.display = 'inline-flex';
        }
    } catch (e) {
        if (!silent) alert(e.message || 'Erro ao gerar thumbnail.');
    } finally {
        if (!silent) {
            const btnText = document.getElementById('btn-gen-text');
            const btnLoader = document.getElementById('btn-gen-loader');
            if (btnText) btnText.classList.remove('hidden');
            if (btnLoader) btnLoader.classList.add('hidden');
        }
    }
}

async function thumbnailGenerateVariations() {
    if (thumbnailState.selectedFrameIndex === null) {
        alert('Selecione um frame primeiro.');
        return;
    }
    const videoId = appState.videoId;
    if (!videoId) {
        alert('Vídeo não encontrado.');
        return;
    }
    const btnText = document.getElementById('btn-var-text');
    const btnLoader = document.getElementById('btn-var-loader');
    if (btnText) btnText.classList.add('hidden');
    if (btnLoader) btnLoader.classList.remove('hidden');
    const grid = document.getElementById('thumbnail-variations-grid');
    if (grid) grid.innerHTML = '';
    try {
        const title = (document.getElementById('thumbnail-title') && document.getElementById('thumbnail-title').value) || '';
        const template = (document.getElementById('thumbnail-template') && document.getElementById('thumbnail-template').value) || 'generico';
        const tarjaSuperiorSizeEl = document.getElementById('thumbnail-tarja-superior-size');
        const tarjaInferiorSizeEl = document.getElementById('thumbnail-tarja-inferior-size');
        const tarjaCentralSizeEl = document.getElementById('thumbnail-tarja-central-size');
        const tarjaSuperiorSize = (tarjaSuperiorSizeEl && tarjaSuperiorSizeEl.value) ? parseInt(tarjaSuperiorSizeEl.value, 10) : null;
        const tarjaInferiorSize = (tarjaInferiorSizeEl && tarjaInferiorSizeEl.value) ? parseInt(tarjaInferiorSizeEl.value, 10) : null;
        const tarjaCentralSize = (tarjaCentralSizeEl && tarjaCentralSizeEl.value) ? parseInt(tarjaCentralSizeEl.value, 10) : null;
        const tarjaSuperiorColor = (document.getElementById('thumbnail-tarja-superior-color') && document.getElementById('thumbnail-tarja-superior-color').value) || null;
        const tarjaInferiorColor = (document.getElementById('thumbnail-tarja-inferior-color') && document.getElementById('thumbnail-tarja-inferior-color').value) || null;
        const tarjaCentralColor = (document.getElementById('thumbnail-tarja-central-color') && document.getElementById('thumbnail-tarja-central-color').value) || null;
        const fontSize = (document.getElementById('thumbnail-font-size') && document.getElementById('thumbnail-font-size').value) || 'medium';
        const titlePosition = (document.getElementById('thumbnail-title-position') && document.getElementById('thumbnail-title-position').value) || 'center';
        const res = await fetch(`${API_BASE}/api/thumbnails/variations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoId,
                frameTimeSec: getThumbnailFrameTimeSec(),
                title: title.slice(0, 500),
                template,
                tarjaSuperiorSize,
                tarjaInferiorSize,
                tarjaCentralSize,
                tarjaSuperiorColor: tarjaSuperiorSize ? tarjaSuperiorColor : null,
                tarjaInferiorColor: tarjaInferiorSize ? tarjaInferiorColor : null,
                tarjaCentralColor: tarjaCentralSize ? tarjaCentralColor : null,
                fontSize,
                titlePosition
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Erro ao gerar variações');
        const variations = data.variations || [];
        if (!grid || variations.length === 0) return;
        grid.style.display = 'grid';
        grid.innerHTML = '';
        variations.forEach((base64, i) => {
            const blob = b64ToBlob(base64, 'image/jpeg');
            const url = URL.createObjectURL(blob);
            const div = document.createElement('div');
            div.className = 'thumbnail-variation-item';
            div.innerHTML = `
                <img src="${url}" alt="Variação ${i + 1}" style="width: 100%; aspect-ratio: 9/16; object-fit: cover; border-radius: 8px;">
                <a href="${url}" download="ezclips-thumbnail-variacao-${i + 1}.jpg" class="btn-secondary" style="margin-top: 0.5rem; font-size: 0.8rem; display: block; text-align: center;">Baixar ${i + 1}</a>
            `;
            grid.appendChild(div);
        });
    } catch (e) {
        alert(e.message || 'Erro ao gerar variações.');
    } finally {
        if (btnText) btnText.classList.remove('hidden');
        if (btnLoader) btnLoader.classList.add('hidden');
    }
}

function b64ToBlob(b64, mime) {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime || 'image/jpeg' });
}

function updateThumbnailCharCount() {
    const el = document.getElementById('thumbnail-title');
    const countEl = document.getElementById('thumb-char-count');
    if (el && countEl) countEl.textContent = (el.value || '').length + '/500';
}
document.addEventListener('DOMContentLoaded', () => {
    const titleEl = document.getElementById('thumbnail-title');
    if (titleEl) titleEl.addEventListener('input', updateThumbnailCharCount);
    document.querySelectorAll('#thumb-text-presets .thumb-color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const c = btn.getAttribute('data-color');
            const colorInput = document.getElementById('thumbnail-text-color');
            const hexInput = document.getElementById('thumbnail-text-color-hex');
            if (colorInput) colorInput.value = c;
            if (hexInput) hexInput.value = c;
            thumbnailPreviewDebounce();
        });
    });
    document.querySelectorAll('#thumb-stroke-presets .thumb-color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const c = btn.getAttribute('data-color');
            const colorInput = document.getElementById('thumbnail-stroke-color');
            const hexInput = document.getElementById('thumbnail-stroke-color-hex');
            if (colorInput) colorInput.value = c;
            if (hexInput) hexInput.value = c;
            thumbnailPreviewDebounce();
        });
    });
    document.querySelectorAll('#thumb-tarja-superior-presets .thumb-color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const c = btn.getAttribute('data-color');
            const colorInput = document.getElementById('thumbnail-tarja-superior-color');
            const hexInput = document.getElementById('thumbnail-tarja-superior-color-hex');
            if (colorInput) colorInput.value = c;
            if (hexInput) hexInput.value = c;
            thumbnailPreviewDebounce();
        });
    });
    document.querySelectorAll('#thumb-tarja-inferior-presets .thumb-color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const c = btn.getAttribute('data-color');
            const colorInput = document.getElementById('thumbnail-tarja-inferior-color');
            const hexInput = document.getElementById('thumbnail-tarja-inferior-color-hex');
            if (colorInput) colorInput.value = c;
            if (hexInput) hexInput.value = c;
            thumbnailPreviewDebounce();
        });
    });
    const textColorEl = document.getElementById('thumbnail-text-color');
    const textHexEl = document.getElementById('thumbnail-text-color-hex');
    if (textColorEl && textHexEl) {
        textColorEl.addEventListener('input', () => { textHexEl.value = textColorEl.value; });
    }
    const strokeColorEl = document.getElementById('thumbnail-stroke-color');
    const strokeHexEl = document.getElementById('thumbnail-stroke-color-hex');
    if (strokeColorEl && strokeHexEl) {
        strokeColorEl.addEventListener('input', () => { strokeHexEl.value = strokeColorEl.value; });
    }
    const tarjaSupColor = document.getElementById('thumbnail-tarja-superior-color');
    const tarjaSupHex = document.getElementById('thumbnail-tarja-superior-color-hex');
    if (tarjaSupColor && tarjaSupHex) tarjaSupColor.addEventListener('input', () => { tarjaSupHex.value = tarjaSupColor.value; });
    const tarjaInfColor = document.getElementById('thumbnail-tarja-inferior-color');
    const tarjaInfHex = document.getElementById('thumbnail-tarja-inferior-color-hex');
    if (tarjaInfColor && tarjaInfHex) tarjaInfColor.addEventListener('input', () => { tarjaInfHex.value = tarjaInfColor.value; });
    // Headline presets
    document.querySelectorAll('#headline-tarja-superior-presets .thumb-color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const c = btn.getAttribute('data-color');
            const colorInput = document.getElementById('headline-tarja-superior-color');
            const hexInput = document.getElementById('headline-tarja-superior-color-hex');
            if (colorInput) colorInput.value = c;
            if (hexInput) hexInput.value = c;
            updateHeadlinePreview();
        });
    });
    document.querySelectorAll('#headline-tarja-inferior-presets .thumb-color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const c = btn.getAttribute('data-color');
            const colorInput = document.getElementById('headline-tarja-inferior-color');
            const hexInput = document.getElementById('headline-tarja-inferior-color-hex');
            if (colorInput) colorInput.value = c;
            if (hexInput) hexInput.value = c;
            updateHeadlinePreview();
        });
    });
    document.querySelectorAll('#headline-tarja-central-presets .thumb-color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const c = btn.getAttribute('data-color');
            const colorInput = document.getElementById('headline-tarja-central-color');
            const hexInput = document.getElementById('headline-tarja-central-color-hex');
            if (colorInput) colorInput.value = c;
            if (hexInput) hexInput.value = c;
            updateHeadlinePreview();
        });
    });
    document.querySelectorAll('#headline-text-presets .thumb-color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const c = btn.getAttribute('data-color');
            const colorInput = document.getElementById('headline-color-input');
            const hexInput = document.getElementById('headline-color-text');
            if (colorInput) colorInput.value = c;
            if (hexInput) hexInput.value = c;
            updateHeadlinePreview();
        });
    });
    document.querySelectorAll('#headline-stroke-presets .thumb-color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const c = btn.getAttribute('data-color');
            const colorInput = document.getElementById('headline-stroke-color');
            const hexInput = document.getElementById('headline-stroke-color-hex');
            if (colorInput) colorInput.value = c;
            if (hexInput) hexInput.value = c;
            updateHeadlinePreview();
        });
    });
    const headlineTextEl = document.getElementById('headline-text-input');
    const headlineCountEl = document.getElementById('headline-char-count');
    if (headlineTextEl && headlineCountEl) {
        headlineTextEl.addEventListener('input', () => {
            headlineCountEl.textContent = (headlineTextEl.value || '').length + '/500';
        });
    }
});

/**
 * Mostra botão para continuar após gerar legendas
 */
function showContinueButtonAfterCaptions() {
    const continueSection = document.getElementById('captions-continue-section');
    if (continueSection) {
        continueSection.classList.remove('hidden');
        // Fazer scroll para a etapa de legendas
        scrollToCard('captions');
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
        scrollToCard('niche');
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
    if (!appState.headlineSize) appState.headlineSize = 72;
    if (!appState.headlineColor) appState.headlineColor = '#FFFFFF';
    if (!appState.headlineStrokeColor) appState.headlineStrokeColor = '#000000';
    if (!appState.headlineFontSize) appState.headlineFontSize = 'medium';
    if (!appState.headlineTitlePosition) appState.headlineTitlePosition = 'center';

    const headlineTextEl = document.getElementById('headline-text-input');
    const headlineCountEl = document.getElementById('headline-char-count');
    const fontSizeEl = document.getElementById('headline-font-size');
    const positionEl = document.getElementById('headline-title-position');
    const colorInput = document.getElementById('headline-color-input');
    const colorText = document.getElementById('headline-color-text');
    const strokeInput = document.getElementById('headline-stroke-color');
    const strokeText = document.getElementById('headline-stroke-color-hex');
    if (headlineTextEl) headlineTextEl.value = appState.headlineText === 'Headline' ? '' : appState.headlineText;
    if (headlineCountEl) headlineCountEl.textContent = (appState.headlineText || '').length + '/500';
    if (fontSizeEl) fontSizeEl.value = appState.headlineFontSize || 'medium';
    if (positionEl) positionEl.value = appState.headlineTitlePosition || 'center';
    if (colorInput) colorInput.value = appState.headlineColor || '#FFFFFF';
    if (colorText) colorText.value = appState.headlineColor || '#FFFFFF';
    if (strokeInput) strokeInput.value = appState.headlineStrokeColor || '#000000';
    if (strokeText) strokeText.value = appState.headlineStrokeColor || '#000000';
    const tarjaCenterSizeEl = document.getElementById('headline-tarja-central-size');
    const tarjaCenterColorEl = document.getElementById('headline-tarja-central-color');
    const tarjaCenterHexEl = document.getElementById('headline-tarja-central-color-hex');
    if (tarjaCenterSizeEl) tarjaCenterSizeEl.value = appState.headlineTarjaCentralSize || '';
    if (tarjaCenterColorEl) tarjaCenterColorEl.value = appState.headlineTarjaCentralColor || '#7B1FA2';
    if (tarjaCenterHexEl) tarjaCenterHexEl.value = appState.headlineTarjaCentralColor || '#7B1FA2';

    updateHeadlinePreview();
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
    console.log('[GENERATE] proceedToGenerate() chamada');
    
    try {
        // AUTENTICAÇÃO OBRIGATÓRIA - Mostrar modal em vez de alert
        if (!appState.currentUser || !appState.userToken) {
            console.log('[GENERATE] Usuário não autenticado, mostrando modal de login');
            // Salvar estado atual para retomar após login
            appState.pendingGeneration = {
                videoId: appState.videoId,
                nicheId: appState.nicheId,
                numberOfCuts: appState.numberOfCuts,
                trimStart: appState.trimStart,
                trimEnd: appState.trimEnd,
                cutDuration: appState.cutDuration,
                headlineStyle: appState.headlineStyle,
                headlineText: appState.headlineText,
                headlineSize: appState.headlineSize,
                headlineColor: appState.headlineColor,
                headlineStrokeColor: appState.headlineStrokeColor,
                headlineFontSize: appState.headlineFontSize,
                headlineTitlePosition: appState.headlineTitlePosition,
                headlineTarjaSuperiorSize: appState.headlineTarjaSuperiorSize,
                headlineTarjaInferiorSize: appState.headlineTarjaInferiorSize,
                headlineTarjaCentralSize: appState.headlineTarjaCentralSize,
                headlineTarjaSuperiorColor: appState.headlineTarjaSuperiorColor,
                headlineTarjaInferiorColor: appState.headlineTarjaInferiorColor,
                headlineTarjaCentralColor: appState.headlineTarjaCentralColor,
                font: appState.font,
                backgroundColor: appState.backgroundColor,
                retentionVideoId: appState.retentionVideoId,
                configurations: { ...appState.configurations }
            };
            showLoginRequiredModal();
            return;
        }
        
        console.log('[GENERATE] Iniciando processo de geração...');
        console.log('[GENERATE] Estado atual:', {
            videoId: appState.videoId,
            nicheId: appState.nicheId,
            numberOfCuts: appState.numberOfCuts,
            trimStart: appState.trimStart,
            trimEnd: appState.trimEnd,
            cutDuration: appState.cutDuration,
            videos_used: appState.userVideos?.videos_used || 0,
            videos_limit: appState.userVideos?.videos_limit,
            is_unlimited: appState.userVideos?.is_unlimited || false
        });
        
        // Verificar dados mínimos necessários
        if (!appState.videoId) {
            console.error('[GENERATE] Erro: videoId não encontrado');
            alert('Erro: Vídeo não encontrado. Por favor, baixe o vídeo primeiro.');
            return;
        }
        
        if (!appState.nicheId) {
            console.error('[GENERATE] Erro: nicheId não encontrado');
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
        
        // Verificação de vídeos será feita no backend
        // Aqui apenas mostramos confirmação
        const clipsCount = appState.numberOfCuts || appState.configurations?.clipsQuantity || 1;
        const isAdmin = appState.currentUser?.role === 'admin';
        const isUnlimited = appState.userVideos?.is_unlimited || false;
        const videosRemaining = appState.userVideos?.videos_remaining;
        
        // Confirmar antes de gerar
        let confirmMessage;
        if (isAdmin || isUnlimited) {
            confirmMessage = `Você está prestes a gerar ${clipsCount} ${clipsCount === 1 ? 'clip' : 'clipes'}.\n\nVocê tem vídeos ilimitados. Cortes por vídeo são ilimitados.\n\nDeseja continuar?`;
        } else {
            const videoText = videosRemaining === 1 ? 'vídeo' : 'vídeos';
            confirmMessage = `Você está prestes a gerar ${clipsCount} ${clipsCount === 1 ? 'clip' : 'clipes'}.\n\n${videosRemaining === 0 ? '⚠️ ATENÇÃO: Este será seu último vídeo disponível!' : `Você tem ${videosRemaining} ${videoText} restante(s).`}\n\nCortes por vídeo são ilimitados.\n\nDeseja continuar?`;
        }
        
        if (!confirm(confirmMessage)) {
            console.log('[GENERATE] Usuário cancelou a geração.');
            return;
        }
        
        // Atualizar progresso para step de geração
        updateProgressSteps('generate');
        updateGenerateSummary();
        
        console.log('[GENERATE] Usuário confirmou. Iniciando geração...');
        // Gerar clipes diretamente
        generateSeries();
    } catch (error) {
        console.error('[GENERATE] Erro em proceedToGenerate():', error);
        alert('Erro ao iniciar geração: ' + (error.message || 'Erro desconhecido'));
    }
}

// Garantir que proceedToGenerate esteja acessível globalmente
if (typeof window !== 'undefined') {
    window.proceedToGenerate = proceedToGenerate;
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
    if (!headline) return;
    updateHeadlinePreview();
    updateGenerateSummary();
}

/**
 * Mostrar modal de loading em primeiro plano
 */
function showLoadingModal() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('hidden');
        // Garantir que o modal fique em primeiro plano
        loadingOverlay.style.zIndex = '9999';
        loadingOverlay.style.position = 'fixed';
        loadingOverlay.style.top = '0';
        loadingOverlay.style.left = '0';
        loadingOverlay.style.width = '100%';
        loadingOverlay.style.height = '100%';
        
        // Resetar informações
        const currentClipNumber = document.getElementById('current-clip-number');
        const totalClipsNumber = document.getElementById('total-clips-number');
        const clipsProgressText = document.getElementById('clips-progress-text');
        const progressMessage = document.getElementById('loading-message');
        
        if (currentClipNumber) currentClipNumber.textContent = '-';
        if (totalClipsNumber) totalClipsNumber.textContent = '-';
        if (clipsProgressText) clipsProgressText.textContent = '0 / 0';
        if (progressMessage) progressMessage.textContent = 'Iniciando processamento...';
        
        // Resetar barra de progresso
        const progressFill = document.getElementById('loading-progress');
        const progressText = document.getElementById('loading-percent');
        if (progressFill) progressFill.style.width = '0%';
        if (progressText) progressText.textContent = '0%';
        
        // Limpar etapas anteriores
        const stepList = document.getElementById('step-list');
        if (stepList) stepList.innerHTML = '';
    }
}

/**
 * Esconder modal de loading
 */
function hideLoadingModal() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
    }
}

/**
 * Atualizar etapas do processamento
 */
/**
 * Mostrar barra de progresso de download durante geração de clipes
 */
function showDownloadProgressInGeneration(percent, message) {
    let downloadProgressContainer = document.getElementById('generation-download-progress');
    if (!downloadProgressContainer) {
        downloadProgressContainer = document.createElement('div');
        downloadProgressContainer.id = 'generation-download-progress';
        downloadProgressContainer.style.cssText = `
            margin-top: 1rem;
            padding: 1rem;
            background: rgba(18, 11, 46, 0.8);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(179, 140, 255, 0.3);
            border-radius: 12px;
            animation: slideDown 0.3s ease-out;
        `;
        
        // Inserir no modal de loading
        const loadingModal = document.getElementById('loading-modal');
        if (loadingModal) {
            const progressContainer = loadingModal.querySelector('.progress-container');
            if (progressContainer) {
                progressContainer.appendChild(downloadProgressContainer);
            } else {
                loadingModal.appendChild(downloadProgressContainer);
            }
        }
    }
    
    downloadProgressContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
            <div style="font-size: 0.875rem; font-weight: 600; color: #EAEAF0;">
                ${message || 'Baixando vídeo do YouTube...'}
            </div>
            <div style="font-size: 0.875rem; font-weight: 700; color: #B38CFF;">
                ${Math.round(percent)}%
            </div>
        </div>
        <div style="width: 100%; height: 8px; background: rgba(179, 140, 255, 0.2); border-radius: 4px; overflow: hidden;">
            <div style="width: ${percent}%; height: 100%; background: linear-gradient(90deg, #B38CFF 0%, #FF6EC7 100%); border-radius: 4px; transition: width 0.3s ease; box-shadow: 0 0 8px rgba(179, 140, 255, 0.5);"></div>
        </div>
    `;
}

/**
 * Ocultar barra de progresso de download durante geração de clipes
 */
function hideDownloadProgressInGeneration() {
    const downloadProgressContainer = document.getElementById('generation-download-progress');
    if (downloadProgressContainer) {
        downloadProgressContainer.style.animation = 'slideUp 0.3s ease-out';
        setTimeout(() => {
            if (downloadProgressContainer.parentNode) {
                downloadProgressContainer.parentNode.removeChild(downloadProgressContainer);
            }
        }, 300);
    }
}

function updateProcessingSteps(message, currentClip, totalClips) {
    const stepList = document.getElementById('step-list');
    if (!stepList) return;
    
    // Identificar etapa atual baseado na mensagem
    let currentStep = '';
    if (message) {
        if (message.includes('Iniciando') || message.includes('processamento')) {
            currentStep = 'Iniciando processamento...';
        } else if (message.includes('Validando') || message.includes('validação')) {
            currentStep = 'Validando vídeo...';
        } else if (message.includes('Gerando clipe') || message.includes('clip')) {
            currentStep = `Gerando clipe ${currentClip} de ${totalClips}...`;
        } else if (message.includes('Compondo') || message.includes('composição')) {
            currentStep = `Compondo clipe ${currentClip}...`;
        } else if (message.includes('Finalizando') || message.includes('final')) {
            currentStep = 'Finalizando...';
        } else {
            currentStep = message;
        }
    }
    
    // Adicionar etapa se ainda não existir
    const existingSteps = Array.from(stepList.children).map(el => el.textContent.trim());
    if (currentStep && !existingSteps.includes(currentStep)) {
        const stepElement = document.createElement('div');
        stepElement.style.cssText = `
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem;
            background: rgba(179, 140, 255, 0.05);
            border-radius: 6px;
            font-size: 0.75rem;
            color: rgba(255, 255, 255, 0.8);
        `;
        stepElement.innerHTML = `
            <div style="width: 8px; height: 8px; border-radius: 50%; background: #B38CFF; animation: pulse 2s infinite;"></div>
            <span>${currentStep}</span>
        `;
        stepList.appendChild(stepElement);
        
        // Manter apenas as últimas 5 etapas
        while (stepList.children.length > 5) {
            stepList.removeChild(stepList.firstChild);
        }
    }
}

async function generateSeries() {
    console.log('[GENERATE] generateSeries() iniciada');
    
    // AUTENTICAÇÃO OBRIGATÓRIA - Backend também valida
    if (!appState.currentUser || !appState.userToken) {
        // Não deve chegar aqui se proceedToGenerate foi chamado corretamente
        // Mas manter como segurança - mostrar modal de login
        console.warn('[GENERATE] Usuário não autenticado, mostrando modal de login');
        showLoginRequiredModal();
        return;
    }
    
    // Verificação de vídeos será feita no backend
    // Aqui apenas mostramos confirmação (lógica já está em proceedToGenerate)
    
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
    
    // Mostrar loading overlay IMEDIATAMENTE
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('hidden');
        console.log('[GENERATE] Loading overlay exibido');
    } else {
        console.error('[GENERATE] Loading overlay não encontrado!');
    }
    
    // Atualizar mensagem inicial
    const progressMessage = document.getElementById('loading-message');
    if (progressMessage) {
        progressMessage.textContent = 'Iniciando geração de clipes...';
    }
    
    const progressFill = document.getElementById('loading-progress');
    const progressText = document.getElementById('loading-percent');
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = '0%';
    
    try {
        // Mostrar feedback de fila
        const queueInfoEl = document.getElementById('queue-info');
        if (queueInfoEl) {
            queueInfoEl.classList.remove('hidden');
            queueInfoEl.textContent = 'Adicionando à fila de processamento...';
        }

        // Determinar retentionVideoId baseado na opção selecionada
        let retentionVideoId = 'random';
        if (appState.selectedRetentionOption) {
            if (appState.selectedRetentionOption.type === 'niche-youtube') {
                // Usar vídeo padrão do nicho (YouTube) - será baixado automaticamente
                retentionVideoId = 'niche-default';
            } else if (appState.selectedRetentionOption.type === 'legacy') {
                // Usar vídeo legado selecionado
                retentionVideoId = appState.selectedRetentionOption.videoId;
            }
        } else if (appState.retentionVideoId) {
            // Fallback para opção antiga
            retentionVideoId = appState.retentionVideoId;
        }
        
        // Preparar dados para envio
        const requestData = {
            videoId: appState.videoId,
            nicheId: appState.nicheId,
            retentionVideoId: retentionVideoId,
            numberOfCuts: appState.numberOfCuts || 1,
            headlineStyle: appState.headlineStyle || 'bold',
            headlineText: appState.headlineText || 'Headline',
            headlineSize: appState.headlineSize || 72,
            headlineColor: appState.headlineColor || '#FFFFFF',
            headlineStrokeColor: appState.headlineStrokeColor || '#000000',
            headlineFontSize: appState.headlineFontSize || 'medium',
            headlineTitlePosition: appState.headlineTitlePosition || 'center',
            headlineTarjaSuperiorSize: appState.headlineTarjaSuperiorSize ?? null,
            headlineTarjaInferiorSize: appState.headlineTarjaInferiorSize ?? null,
            headlineTarjaCentralSize: appState.headlineTarjaCentralSize ?? null,
            headlineTarjaSuperiorColor: appState.headlineTarjaSuperiorColor || null,
            headlineTarjaInferiorColor: appState.headlineTarjaInferiorColor || null,
            headlineTarjaCentralColor: appState.headlineTarjaCentralColor || null,
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
                
                // Recarregar informações de vídeos após iniciar geração
                await loadUserVideos();
            
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
            
            // Mostrar modal de loading em primeiro plano
            showLoadingModal();
            
            monitorProgress(data.jobId);
        } else {
            console.error('[GENERATE] Erro ao criar job:', data);
            const errorMsg = data?.error || 'Erro desconhecido';
            const errorCode = data?.code;
            
            // Se for erro de limite de vídeos, mostrar modal de upgrade
            if (errorCode === 'VIDEO_LIMIT_REACHED' && data?.needsUpgrade) {
                if (confirm(`${errorMsg}\n\nDeseja fazer upgrade do seu plano?`)) {
                    showCreditsPurchaseModal();
                }
            } else {
                alert('Erro ao gerar série: ' + errorMsg);
            }
            
            hideLoadingModal();
        }
    } catch (error) {
        console.error('Erro:', error);
        const errorMessage = error.message || 'Erro ao gerar série';
        
        // Verificar se é erro de limite de vídeos
        if (errorMessage.includes('Limite de vídeos') || errorMessage.includes('VIDEO_LIMIT')) {
            if (confirm(`${errorMessage}\n\nDeseja fazer upgrade do seu plano?`)) {
                showCreditsPurchaseModal();
            }
        } else {
            alert('Erro ao gerar série: ' + errorMessage);
        }
        
        hideLoadingModal();
    }
}

async function monitorProgress(jobId) {
    const progressFill = document.getElementById('loading-progress');
    const progressText = document.getElementById('loading-percent');
    const progressMessage = document.getElementById('loading-message');
    
    // Garantir que elementos existem
    if (!progressFill || !progressText || !progressMessage) {
        console.error('[GENERATE] Elementos de progresso não encontrados!');
        return;
    }
    
    // Inicializar progresso
    progressFill.style.width = '0%';
    progressText.textContent = '0%';
    progressMessage.textContent = 'Iniciando processamento...';
    
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
                    error,
                    downloadProgress,
                    downloadStatus
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
                
                // Atualizar informações de clipes
                const currentClipNumber = document.getElementById('current-clip-number');
                const totalClipsNumber = document.getElementById('total-clips-number');
                const clipsProgressText = document.getElementById('clips-progress-text');
                
                if (currentClipNumber) {
                    currentClipNumber.textContent = currentClip > 0 ? currentClip : '-';
                }
                if (totalClipsNumber) {
                    totalClipsNumber.textContent = totalClips > 0 ? totalClips : '-';
                }
                if (clipsProgressText) {
                    if (totalClips > 0 && currentClip > 0) {
                        clipsProgressText.textContent = `${currentClip} / ${totalClips}`;
                    } else {
                        clipsProgressText.textContent = '0 / 0';
                    }
                }
                
                // Atualizar mensagem de status
                if (progressMessage) {
                    // Se houver progresso de download, mostrar isso primeiro
                    if (downloadStatus && downloadProgress !== undefined) {
                        if (downloadStatus === 'downloading') {
                            progressMessage.textContent = `Baixando vídeo: ${Math.round(downloadProgress)}%`;
                        } else if (downloadStatus === 'retrying') {
                            progressMessage.textContent = message || 'Tentando novamente o download...';
                        } else if (downloadStatus === 'starting') {
                            progressMessage.textContent = 'Iniciando download do vídeo...';
                        } else if (downloadStatus === 'completed') {
                            progressMessage.textContent = 'Download concluído, processando...';
                        } else if (downloadStatus === 'failed') {
                            progressMessage.textContent = 'Erro no download. Tentando outra estratégia...';
                        } else {
                            progressMessage.textContent = message || 'Processando...';
                        }
                    } else if (totalClips > 0 && currentClip > 0) {
                        // Mensagem detalhada: "Gerando clipe X de Y"
                        progressMessage.textContent = message || `Gerando clipe ${currentClip} de ${totalClips}...`;
                    } else if (message) {
                        progressMessage.textContent = message;
                    } else {
                        progressMessage.textContent = 'Processando...';
                    }
                }
                
                // Mostrar barra de progresso de download se estiver em download
                if (downloadStatus === 'downloading' && downloadProgress !== undefined) {
                    showDownloadProgressInGeneration(downloadProgress, message || 'Baixando vídeo do YouTube...');
                } else if (downloadStatus === 'completed' || downloadStatus === 'failed') {
                    hideDownloadProgressInGeneration();
                }
                
                // Atualizar etapas do processamento
                updateProcessingSteps(message, currentClip, totalClips);
                
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
                    hideLoadingModal();
                    alert('Erro ao gerar série: ' + (error || message || 'Erro desconhecido'));
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
                    
                    // Atualizar progresso visual
                    if (progressFill) progressFill.style.width = `${progress}%`;
                    if (progressText) progressText.textContent = `${Math.round(progress)}%`;
                    if (progressMessage && data.message) {
                        progressMessage.textContent = data.message;
                    }
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
                
                // Atualizar informações de clipes (fallback)
                const currentClipNumber = document.getElementById('current-clip-number');
                const totalClipsNumber = document.getElementById('total-clips-number');
                const clipsProgressText = document.getElementById('clips-progress-text');
                
                if (currentClipNumber && data.currentClip) {
                    currentClipNumber.textContent = data.currentClip;
                }
                if (totalClipsNumber && data.totalClips) {
                    totalClipsNumber.textContent = data.totalClips;
                }
                if (clipsProgressText) {
                    if (data.totalClips > 0 && data.currentClip > 0) {
                        clipsProgressText.textContent = `${data.currentClip} / ${data.totalClips}`;
                    } else {
                        clipsProgressText.textContent = '0 / 0';
                    }
                }
                
                // Atualizar etapas do processamento (fallback)
                if (data.message) {
                    updateProcessingSteps(data.message, data.currentClip || 0, data.totalClips || 0);
                }
                
                // Mensagem genérica quando usando fallback
                if (progressMessage && !progressMessage.textContent) {
                    progressMessage.textContent = data.message || 'Processando...';
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
                    hideLoadingModal();
                    alert('Erro ao gerar série: ' + (data.failedReason || data.error || 'Erro desconhecido'));
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
    window.open('https://www.tiktok.com/tiktokstudio/upload', '_blank');
}
