// Estado centralizado da aplicação
const appState = {
    videoId: null,
    videoInfo: null,
    trimStart: 0,
    trimEnd: 0,
    cutDuration: 60,
    numberOfCuts: 0,
    nicheId: null,
    retentionVideoId: 'random',
    headlineStyle: 'bold',
    font: 'Inter',
    jobId: null,
    seriesId: null,
    currentUser: null,
    currentTab: 'home'
};

const API_BASE = window.location.origin;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    setupYouTubeInput();
    setupUploadDragDrop();
    setupTrimControls();
    loadNiches();
    loadCursos();
    checkAuth();
    updateProgressSteps('youtube'); // Inicializar com primeiro step
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
    
    // Scroll para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========== PROGRESS STEPS INDICATOR ==========
function updateProgressSteps(stepName) {
    const steps = ['youtube', 'trim', 'niche', 'retention', 'generate'];
    const stepIndex = steps.indexOf(stepName);
    
    if (stepIndex === -1) return;
    
    document.querySelectorAll('.progress-step').forEach((step, index) => {
        step.classList.remove('active', 'completed');
        
        if (index < stepIndex) {
            step.classList.add('completed');
        } else if (index === stepIndex) {
            step.classList.add('active');
        }
    });
    
    // Atualizar card ativo
    document.querySelectorAll('[data-step-card]').forEach(card => {
        card.classList.remove('active');
    });
    
    const activeCard = document.querySelector(`[data-step-card="${stepName}"]`);
    if (activeCard) {
        activeCard.classList.add('active');
    }
}

function scrollToTool() {
    const toolSection = document.getElementById('tool-section');
    if (toolSection) {
        toolSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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

// ========== CURSOS ==========
const cursosData = [
    {
        id: 1,
        title: 'Criação de Vídeos Virais para TikTok',
        description: 'Aprenda a criar conteúdo que viraliza no TikTok usando técnicas de retenção e storytelling.',
        category: 'video',
        price: 297,
        oldPrice: 497,
        image: '🎬'
    },
    {
        id: 2,
        title: 'Marketing Digital Completo',
        description: 'Domine todas as estratégias de marketing digital: SEO, ads, redes sociais e muito mais.',
        category: 'marketing',
        price: 497,
        oldPrice: 797,
        image: '📈'
    },
    {
        id: 3,
        title: 'Como Criar um Negócio Online',
        description: 'Do zero ao primeiro cliente: aprenda a criar e escalar seu negócio digital.',
        category: 'business',
        price: 397,
        oldPrice: 597,
        image: '💼'
    },
    {
        id: 4,
        title: 'Programação para Iniciantes',
        description: 'Aprenda programação do zero e crie seus primeiros projetos web e mobile.',
        category: 'tech',
        price: 347,
        oldPrice: 547,
        image: '💻'
    },
    {
        id: 5,
        title: 'Edição de Vídeo Profissional',
        description: 'Domine Premiere, After Effects e crie vídeos de nível profissional.',
        category: 'video',
        price: 447,
        oldPrice: 697,
        image: '🎞️'
    },
    {
        id: 6,
        title: 'Estratégias de Growth Hacking',
        description: 'Técnicas avançadas para fazer sua empresa crescer rapidamente.',
        category: 'marketing',
        price: 547,
        oldPrice: 847,
        image: '🚀'
    }
];

let currentFilter = 'all';

function loadCursos() {
    renderCursos(cursosData);
}

function filterCursos(category) {
    currentFilter = category;
    
    // Atualizar botões de filtro
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Filtrar cursos
    const filtered = category === 'all' 
        ? cursosData 
        : cursosData.filter(curso => curso.category === category);
    
    renderCursos(filtered);
}

function renderCursos(cursos) {
    const grid = document.getElementById('cursos-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    cursos.forEach(curso => {
        const card = document.createElement('div');
        card.className = 'curso-card';
        card.innerHTML = `
            <div class="curso-image">${curso.image}</div>
            <div class="curso-content">
                <span class="curso-category">${curso.category.toUpperCase()}</span>
                <h3 class="curso-title">${curso.title}</h3>
                <p class="curso-description">${curso.description}</p>
                <div class="curso-footer">
                    <div>
                        <span class="curso-price-old">R$ ${curso.oldPrice}</span>
                        <span class="curso-price">R$ ${curso.price}</span>
                    </div>
                    <button class="btn-comprar" onclick="comprarCurso(${curso.id})">
                        Comprar
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function comprarCurso(cursoId) {
    if (!appState.currentUser) {
        alert('Por favor, faça login para comprar cursos.');
        switchTab('login');
        return;
    }
    
    const curso = cursosData.find(c => c.id === cursoId);
    if (curso) {
        alert(`Redirecionando para compra do curso: ${curso.title}\n\nValor: R$ ${curso.price}`);
        // Aqui você pode integrar com gateway de pagamento
    }
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
        if (btn) {
            if (isValidYouTubeUrl(url)) {
                btn.disabled = false;
                
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
    
    // Mostrar container de vídeo
    const trimCard = document.getElementById('trim-card');
    if (trimCard) {
        trimCard.classList.remove('hidden');
    }
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
            
            // Exibir trim tool APENAS quando estado === ready (igual ao YouTube)
            showTrimSection();
            
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
    
    if (!url) {
        showStatus('Por favor, insira uma URL do YouTube', 'error');
        return;
    }
    
    if (!isValidYouTubeUrl(url)) {
        showStatus('URL do YouTube inválida. Use formato: https://youtube.com/watch?v=VIDEO_ID', 'error');
        return;
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
                        
                        // Exibir trim tool APENAS quando estado === ready
                        showTrimSection();
                        
                        // Aguardar um pouco para garantir que elementos estão prontos
                        setTimeout(() => {
                            setupTrimControlsForVideo({
                                duration: data.duration || data.videoDuration,
                                playableUrl: data.playableUrl
                            });
                        }, 100);
                        
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
    const container = document.getElementById('video-player-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    // SEMPRE usar elemento <video> HTML5 com arquivo local
    const videoElement = document.createElement('video');
    videoElement.src = playableUrl;
    videoElement.controls = true;
    videoElement.style.width = '100%';
    videoElement.style.height = '100%';
    videoElement.style.borderRadius = '12px';
    videoElement.style.objectFit = 'contain';
    videoElement.preload = 'metadata';
    videoElement.crossOrigin = 'anonymous';
    
    videoElement.addEventListener('loadedmetadata', () => {
        console.log('[PLAYER] Vídeo local carregado:', playableUrl);
        // Atualizar duração no estado se necessário
        if (videoElement.duration) {
            appState.videoInfo = appState.videoInfo || {};
            appState.videoInfo.duration = Math.floor(videoElement.duration);
            if (!appState.trimEnd && appState.videoInfo.duration) {
                appState.trimEnd = appState.videoInfo.duration;
                // Atualizar trim controls se já foram inicializados
                if (appState.videoInfo.duration > 0) {
                    const trimDurationEl = document.getElementById('trim-duration');
                    const endTimecode = document.getElementById('end-timecode');
                    if (trimDurationEl) trimDurationEl.textContent = formatTime(Math.floor(appState.videoInfo.duration));
                    if (endTimecode) endTimecode.textContent = formatTime(Math.floor(appState.videoInfo.duration));
                }
            }
        }
    });
    
    videoElement.addEventListener('error', (e) => {
        console.error('[PLAYER] Erro ao carregar vídeo local:', e);
        container.innerHTML = '<div class="video-placeholder"><p>Erro ao carregar vídeo. Verifique se o download foi concluído.</p></div>';
    });
    
    container.appendChild(videoElement);
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

async function showTrimSection() {
    const trimCard = document.getElementById('trim-card');
    if (!trimCard) return;
    
    // Verificar se vídeo está pronto
    if (!appState.videoId) {
        showStatus('Vídeo não encontrado', 'error');
        return;
    }
    
    // Verificar estado no backend
    const isReady = await verifyVideoReady(appState.videoId);
    if (!isReady) {
        showStatus('Vídeo ainda não está pronto. Aguarde a validação completar.', 'error');
        return;
    }
    
    trimCard.classList.remove('hidden');
    updateProgressSteps('trim');
    setTimeout(() => {
        trimCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
}

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
    const duration = video.duration || appState.videoInfo?.duration || 0;
    
    if (duration === 0 || !duration) {
        console.warn('[TRIM] Duração do vídeo não disponível:', duration);
        showStatus('Duração do vídeo não disponível. Aguarde o processamento.', 'error');
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
    
    // Inicializar timeline drag-based
    initializeTimeline(Math.floor(duration));
    
    // Calcular clips inicial
    calculateClips();
    
    console.log('[TRIM] Timeline configurada - Início:', appState.trimStart, 'Fim:', appState.trimEnd);
}

/**
 * Inicializar timeline drag-based trim tool
 */
function initializeTimeline(duration) {
    const track = document.getElementById('timeline-track');
    const selected = document.getElementById('timeline-selected');
    const handleStart = document.getElementById('timeline-handle-start');
    const handleEnd = document.getElementById('timeline-handle-end');
    
    if (!track || !selected || !handleStart || !handleEnd) {
        console.warn('[TIMELINE] Elementos não encontrados');
        return;
    }
    
    const trackRect = track.getBoundingClientRect();
    const trackWidth = trackRect.width;
    
    // Configurar posições iniciais (0% a 100%)
    let startPercent = 0;
    let endPercent = 100;
    
    // Atualizar visual da timeline
    function updateTimeline() {
        const startPx = (startPercent / 100) * trackWidth;
        const endPx = (endPercent / 100) * trackWidth;
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
        isDraggingStart = true;
    });
    
    handleStart.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isDraggingStart = true;
    });
    
    // Drag handle end
    let isDraggingEnd = false;
    handleEnd.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isDraggingEnd = true;
    });
    
    handleEnd.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isDraggingEnd = true;
    });
    
    // Mouse move
    document.addEventListener('mousemove', (e) => {
        if (isDraggingStart || isDraggingEnd) {
            const percent = getPercentFromEvent(e);
            
            if (isDraggingStart) {
                startPercent = Math.max(0, Math.min(percent, endPercent - 1));
            } else if (isDraggingEnd) {
                endPercent = Math.max(startPercent + 1, Math.min(100, percent));
            }
            
            updateTimeline();
        }
    });
    
    document.addEventListener('touchmove', (e) => {
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
    });
    
    // Mouse up
    document.addEventListener('mouseup', () => {
        isDraggingStart = false;
        isDraggingEnd = false;
    });
    
    document.addEventListener('touchend', () => {
        isDraggingStart = false;
        isDraggingEnd = false;
    });
    
    // Clique na track para mover playhead (opcional)
    track.addEventListener('click', (e) => {
        if (!isDraggingStart && !isDraggingEnd) {
            // Pode implementar playhead se necessário
        }
    });
    
    // Atualizar inicialmente
    updateTimeline();
    
    // Atualizar ao redimensionar (debounced)
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            updateTimeline();
        }, 100);
    });
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
    const nicheCard = document.getElementById('niche-card');
    if (nicheCard) {
        nicheCard.classList.remove('hidden');
        updateProgressSteps('niche');
        setTimeout(() => {
            nicheCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
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
    
    const retentionCard = document.getElementById('retention-card');
    if (retentionCard) {
        retentionCard.classList.remove('hidden');
        updateProgressSteps('retention');
        setTimeout(() => {
            retentionCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
    
    await loadRetentionVideos(nicheId);
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
    
    headline.style.fontFamily = font;
    
    if (style === 'bold') {
        headline.style.fontWeight = '800';
        headline.style.textTransform = 'none';
    } else if (style === 'impact') {
        headline.style.fontWeight = '900';
        headline.style.textTransform = 'uppercase';
    } else {
        headline.style.fontWeight = '600';
        headline.style.textTransform = 'none';
    }
}

async function generateSeries() {
    if (!appState.videoId || !appState.nicheId || !appState.numberOfCuts) {
        alert('Por favor, complete todas as etapas');
        return;
    }
    
    // Verificar se vídeo está pronto antes de gerar
    const isReady = await verifyVideoReady(appState.videoId);
    if (!isReady) {
        alert('Vídeo ainda não está pronto. Por favor, aguarde a validação completar.');
        return;
    }
    
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');
    
    try {
        const response = await fetch(`${API_BASE}/api/generate/series`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoId: appState.videoId,
                nicheId: appState.nicheId,
                retentionVideoId: appState.retentionVideoId,
                numberOfCuts: appState.numberOfCuts,
                headlineStyle: appState.headlineStyle,
                font: appState.font,
                trimStart: appState.trimStart,
                trimEnd: appState.trimEnd,
                cutDuration: appState.cutDuration
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            appState.jobId = data.jobId;
            appState.seriesId = data.seriesId;
            monitorProgress(data.jobId);
        } else {
            alert('Erro ao gerar série: ' + data.error);
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
    
    const interval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/generate/status/${jobId}`);
            const data = await response.json();
            
            // Backend retorna { jobId, status, progress, failedReason }
            const progress = data.progress || 0;
            const status = data.status || 'processing';
            
            if (progressFill) progressFill.style.width = `${progress}%`;
            if (progressText) progressText.textContent = `${progress}%`;
            
            if (status === 'completed' || status === 'finished') {
                clearInterval(interval);
                showSuccessModal(data);
            } else if (status === 'failed' || status === 'error') {
                clearInterval(interval);
                alert('Erro ao gerar série: ' + (data.failedReason || data.error || 'Erro desconhecido'));
                const loadingOverlay = document.getElementById('loading-overlay');
                if (loadingOverlay) loadingOverlay.classList.add('hidden');
            }
        } catch (error) {
            console.error('Erro ao verificar progresso:', error);
        }
    }, 1000);
}

function showSuccessModal(job) {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
    
    const modal = document.getElementById('success-modal');
    const message = document.getElementById('success-message');
    
    if (modal && message) {
        message.textContent = `Série com ${appState.numberOfCuts} partes gerada com sucesso!`;
        modal.classList.remove('hidden');
    }
}

async function downloadSeries() {
    if (!appState.seriesId) {
        alert('Série não encontrada');
        return;
    }
    
    window.location.href = `${API_BASE}/api/generate/download/${appState.seriesId}`;
}

function openTikTokStudio() {
    window.open('https://www.tiktok.com/studio', '_blank');
}
