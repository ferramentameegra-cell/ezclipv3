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
    setupTrimControls();
    loadNiches();
    loadCursos();
    checkAuth();
}

// ========== TAB NAVIGATION ==========
function switchTab(tabName) {
    // Atualizar estado
    appState.currentTab = tabName;
    
    // Atualizar tabs visuais
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Mostrar conteúdo da tab
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    // Scroll para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    const userInfo = document.getElementById('user-info');
    const userName = document.getElementById('user-name');
    
    if (appState.currentUser) {
        userInfo.classList.remove('hidden');
        userName.textContent = appState.currentUser.name || appState.currentUser.email;
    } else {
        userInfo.classList.add('hidden');
    }
}

async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btnText = document.getElementById('login-btn-text');
    const btnSpinner = document.getElementById('login-btn-spinner');
    const statusMsg = document.getElementById('login-status');
    
    btnText.classList.add('hidden');
    btnSpinner.classList.remove('hidden');
    statusMsg.classList.add('hidden');
    
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
            
            statusMsg.textContent = 'Login realizado com sucesso!';
            statusMsg.className = 'login-status success';
            statusMsg.classList.remove('hidden');
            
            updateUserUI();
            
            setTimeout(() => {
                switchTab('home');
            }, 1500);
        } else {
            statusMsg.textContent = data.error || 'Erro ao fazer login';
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
    document.getElementById('login-form').closest('.login-box').classList.add('hidden');
    document.getElementById('register-box').classList.remove('hidden');
}

function showLogin() {
    document.getElementById('register-box').classList.add('hidden');
    document.getElementById('login-form').closest('.login-box').classList.remove('hidden');
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
    const btn = document.getElementById('btn-process');
    
    if (!input || !btn) return;
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleYouTubeSubmit();
        }
    });
    
    input.addEventListener('input', () => {
        const url = input.value.trim();
        if (isValidYouTubeUrl(url)) {
            btn.disabled = false;
        } else {
            btn.disabled = url.length === 0;
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

async function handleYouTubeSubmit() {
    const input = document.getElementById('youtube-url');
    const url = input.value.trim();
    const btn = document.getElementById('btn-process');
    const btnText = btn.querySelector('.btn-text');
    const btnSpinner = btn.querySelector('.btn-spinner');
    const statusMsg = document.getElementById('youtube-status');
    
    if (!url) {
        showStatus('Por favor, insira uma URL do YouTube', 'error');
        return;
    }
    
    if (!isValidYouTubeUrl(url)) {
        showStatus('URL do YouTube inválida. Use formato: https://youtube.com/watch?v=VIDEO_ID', 'error');
        return;
    }
    
    btn.disabled = true;
    btnText.classList.add('hidden');
    btnSpinner.classList.remove('hidden');
    statusMsg.classList.add('hidden');
    
    try {
        const response = await fetch(`${API_BASE}/api/video/youtube`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ youtubeUrl: url })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            appState.videoId = data.videoId;
            appState.videoInfo = data.video;
            
            showStatus('Vídeo processado com sucesso!', 'success');
            
            showTrimSection();
            setupVideoPlayer(data.video);
            setupTrimControlsForVideo(data.video);
            
        } else {
            showStatus(data.error || 'Erro ao processar vídeo', 'error');
        }
    } catch (error) {
        console.error('Erro:', error);
        showStatus('Erro ao processar vídeo do YouTube. Verifique sua conexão.', 'error');
    } finally {
        btn.disabled = false;
        btnText.classList.remove('hidden');
        btnSpinner.classList.add('hidden');
    }
}

function showStatus(message, type) {
    const statusMsg = document.getElementById('youtube-status');
    if (!statusMsg) return;
    statusMsg.textContent = message;
    statusMsg.className = `status-message ${type}`;
    statusMsg.classList.remove('hidden');
}

function showTrimSection() {
    const trimSection = document.getElementById('step-trim');
    if (trimSection) {
        trimSection.classList.remove('hidden');
        setTimeout(() => {
            trimSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
    }
}

function setupVideoPlayer(video) {
    const container = document.getElementById('video-player-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (video.youtubeVideoId || video.youtubeUrl) {
        const videoId = video.youtubeVideoId || extractYouTubeId(video.youtubeUrl);
        if (videoId) {
            const iframe = document.createElement('iframe');
            iframe.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&rel=0`;
            iframe.width = '100%';
            iframe.height = '100%';
            iframe.style.border = 'none';
            iframe.style.borderRadius = '12px';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            iframe.allowFullscreen = true;
            container.appendChild(iframe);
        }
    }
}

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
    const startSlider = document.getElementById('trim-start-slider');
    const startInput = document.getElementById('trim-start-input');
    const endSlider = document.getElementById('trim-end-slider');
    const endInput = document.getElementById('trim-end-input');
    
    if (!startSlider || !startInput || !endSlider || !endInput) {
        return;
    }
    
    startSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        updateStartTime(value);
    });
    
    startInput.addEventListener('input', (e) => {
        const value = parseInt(e.target.value) || 0;
        updateStartTime(value);
    });
    
    endSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        updateEndTime(value);
    });
    
    endInput.addEventListener('input', (e) => {
        const value = parseInt(e.target.value) || 0;
        updateEndTime(value);
    });
}

function setupTrimControlsForVideo(video) {
    const duration = video.duration || 0;
    const startSlider = document.getElementById('trim-start-slider');
    const startInput = document.getElementById('trim-start-input');
    const endSlider = document.getElementById('trim-end-slider');
    const endInput = document.getElementById('trim-end-input');
    
    if (!startSlider || !startInput || !endSlider || !endInput) {
        return;
    }
    
    startSlider.max = duration || 3600;
    startInput.max = duration || 3600;
    endSlider.max = duration || 3600;
    endInput.max = duration || 3600;
    
    const initialEnd = duration > 0 ? duration : 0;
    startSlider.value = 0;
    startInput.value = 0;
    endSlider.value = initialEnd;
    endInput.value = initialEnd;
    
    appState.trimStart = 0;
    appState.trimEnd = initialEnd;
    
    updateTimeDisplay('start', 0);
    updateTimeDisplay('end', initialEnd);
    
    calculateClips();
}

function updateStartTime(seconds) {
    const max = parseInt(document.getElementById('trim-start-slider')?.max || 3600);
    const value = Math.max(0, Math.min(seconds, max));
    
    appState.trimStart = value;
    
    const startSlider = document.getElementById('trim-start-slider');
    const startInput = document.getElementById('trim-start-input');
    if (startSlider) startSlider.value = value;
    if (startInput) startInput.value = value;
    updateTimeDisplay('start', value);
    
    const endValue = appState.trimEnd;
    if (endValue <= value) {
        const newEnd = Math.min(value + 1, max);
        updateEndTime(newEnd);
    }
    
    calculateClips();
}

function updateEndTime(seconds) {
    const max = parseInt(document.getElementById('trim-end-slider')?.max || 3600);
    const min = appState.trimStart;
    const value = Math.max(min + 1, Math.min(seconds, max));
    
    appState.trimEnd = value;
    
    const endSlider = document.getElementById('trim-end-slider');
    const endInput = document.getElementById('trim-end-input');
    if (endSlider) endSlider.value = value;
    if (endInput) endInput.value = value;
    updateTimeDisplay('end', value);
    
    calculateClips();
}

function updateTimeDisplay(type, seconds) {
    const display = document.getElementById(`${type}-time-display`);
    if (display) {
        display.textContent = formatTime(seconds);
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function selectDuration(seconds) {
    appState.cutDuration = seconds;
    
    document.querySelectorAll('.duration-btn').forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.duration) === seconds) {
            btn.classList.add('active');
        }
    });
    
    calculateClips();
}

function calculateClips() {
    const start = appState.trimStart;
    const end = appState.trimEnd;
    const duration = appState.cutDuration;
    
    const totalDuration = end - start;
    const clips = totalDuration > 0 && duration > 0 ? Math.floor(totalDuration / duration) : 0;
    
    appState.numberOfCuts = clips;
    
    const clipsCount = document.getElementById('clips-count');
    const clipsCard = document.getElementById('clips-calculation');
    const previewTotal = document.getElementById('preview-total');
    
    if (clipsCount) clipsCount.textContent = clips;
    
    if (clipsCard) {
        if (clips > 0) {
            clipsCard.classList.add('has-result');
        } else {
            clipsCard.classList.remove('has-result');
        }
    }
    
    if (previewTotal) previewTotal.textContent = clips;
    
    if (clips > 0) {
        showNextSteps();
    }
}

function showNextSteps() {
    const nicheStep = document.getElementById('step-niche');
    if (nicheStep && !nicheStep.classList.contains('visible')) {
        nicheStep.classList.remove('hidden');
        nicheStep.classList.add('visible');
        setTimeout(() => {
            nicheStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
    }
}

async function loadNiches() {
    try {
        const response = await fetch(`${API_BASE}/api/niches`);
        const data = await response.json();
        
        const container = document.getElementById('niches-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        data.niches.forEach(niche => {
            const card = document.createElement('div');
            card.className = 'niche-card-item';
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
    document.querySelectorAll('.niche-card-item').forEach(card => {
        card.classList.remove('selected');
    });
    
    cardElement.classList.add('selected');
    appState.nicheId = nicheId;
    
    const retentionStep = document.getElementById('step-retention');
    if (retentionStep) {
        retentionStep.classList.remove('hidden');
        retentionStep.classList.add('visible');
        setTimeout(() => {
            retentionStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
    
    await loadRetentionVideos(nicheId);
}

async function loadRetentionVideos(nicheId) {
    try {
        const response = await fetch(`${API_BASE}/api/retention/niche/${nicheId}`);
        const data = await response.json();
        
        const container = document.getElementById('retention-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        data.videos.forEach(video => {
            const card = document.createElement('div');
            card.className = 'retention-card-item';
            card.innerHTML = `
                <div class="retention-preview-icon">🎬</div>
                <h4>${video.name}</h4>
                <div class="retention-tags-row">
                    ${video.tags?.map(tag => `<span class="tag-item">${tag}</span>`).join('') || ''}
                </div>
            `;
            card.addEventListener('click', () => selectRetentionVideo(video.id, card));
            container.appendChild(card);
        });
        
        const previewStep = document.getElementById('step-preview');
        if (previewStep) {
            previewStep.classList.remove('hidden');
            previewStep.classList.add('visible');
        }
    } catch (error) {
        console.error('Erro ao carregar vídeos de retenção:', error);
    }
}

function selectRetentionVideo(videoId, cardElement) {
    document.querySelectorAll('.retention-card-item').forEach(card => {
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
            
            if (data.job) {
                const progress = data.job.progress || 0;
                if (progressFill) progressFill.style.width = `${progress}%`;
                if (progressText) progressText.textContent = `${progress}%`;
                
                if (data.job.status === 'completed') {
                    clearInterval(interval);
                    showSuccessModal(data.job);
                } else if (data.job.status === 'error') {
                    clearInterval(interval);
                    alert('Erro ao gerar série: ' + data.job.error);
                    const loadingOverlay = document.getElementById('loading-overlay');
                    if (loadingOverlay) loadingOverlay.classList.add('hidden');
                }
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
