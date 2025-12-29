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
    seriesId: null
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
}

// Setup YouTube input com Enter key e validação em tempo real
function setupYouTubeInput() {
    const input = document.getElementById('youtube-url');
    const btn = document.getElementById('btn-process');
    
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

// Validar URL do YouTube
function isValidYouTubeUrl(url) {
    const patterns = [
        /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/,
        /^https?:\/\/youtube\.com\/.*[?&]v=/
    ];
    return patterns.some(pattern => pattern.test(url));
}

// Processar YouTube - função principal
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
    
    // UI feedback
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
            
            // Mostrar trim tool imediatamente
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

// Mostrar status
function showStatus(message, type) {
    const statusMsg = document.getElementById('youtube-status');
    statusMsg.textContent = message;
    statusMsg.className = `status-message ${type}`;
    statusMsg.classList.remove('hidden');
}

// Mostrar seção de trim
function showTrimSection() {
    const trimSection = document.getElementById('step-trim');
    trimSection.classList.remove('hidden');
    
    // Scroll suave para a seção
    setTimeout(() => {
        trimSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
}

// Configurar player de vídeo
function setupVideoPlayer(video) {
    const container = document.getElementById('video-player-container');
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

// Extrair ID do YouTube
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

// Setup controles de trim
function setupTrimControls() {
    const startSlider = document.getElementById('trim-start-slider');
    const startInput = document.getElementById('trim-start-input');
    const endSlider = document.getElementById('trim-end-slider');
    const endInput = document.getElementById('trim-end-input');
    
    if (!startSlider || !startInput || !endSlider || !endInput) {
        console.warn('Trim controls not found, will be set up when video is loaded');
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

// Configurar controles para vídeo específico
function setupTrimControlsForVideo(video) {
    const duration = video.duration || 0;
    const startSlider = document.getElementById('trim-start-slider');
    const startInput = document.getElementById('trim-start-input');
    const endSlider = document.getElementById('trim-end-slider');
    const endInput = document.getElementById('trim-end-input');
    
    if (!startSlider || !startInput || !endSlider || !endInput) {
        console.error('Trim controls not found');
        return;
    }
    
    // Configurar máximos
    startSlider.max = duration || 3600; // Default to 1 hour if unknown
    startInput.max = duration || 3600;
    endSlider.max = duration || 3600;
    endInput.max = duration || 3600;
    
    // Valores iniciais
    const initialEnd = duration > 0 ? duration : 0;
    startSlider.value = 0;
    startInput.value = 0;
    endSlider.value = initialEnd;
    endInput.value = initialEnd;
    
    appState.trimStart = 0;
    appState.trimEnd = initialEnd;
    
    // Atualizar displays
    updateTimeDisplay('start', 0);
    updateTimeDisplay('end', initialEnd);
    
    // Calcular clips inicial
    calculateClips();
}

// Atualizar tempo inicial
function updateStartTime(seconds) {
    const max = parseInt(document.getElementById('trim-start-slider').max);
    const value = Math.max(0, Math.min(seconds, max));
    
    appState.trimStart = value;
    
    document.getElementById('trim-start-slider').value = value;
    document.getElementById('trim-start-input').value = value;
    updateTimeDisplay('start', value);
    
    // Garantir que fim > início
    const endValue = appState.trimEnd;
    if (endValue <= value) {
        const newEnd = Math.min(value + 1, max);
        updateEndTime(newEnd);
    }
    
    calculateClips();
}

// Atualizar tempo final
function updateEndTime(seconds) {
    const max = parseInt(document.getElementById('trim-end-slider').max);
    const min = appState.trimStart;
    const value = Math.max(min + 1, Math.min(seconds, max));
    
    appState.trimEnd = value;
    
    document.getElementById('trim-end-slider').value = value;
    document.getElementById('trim-end-input').value = value;
    updateTimeDisplay('end', value);
    
    calculateClips();
}

// Atualizar display de tempo
function updateTimeDisplay(type, seconds) {
    const display = document.getElementById(`${type}-time-display`);
    display.textContent = formatTime(seconds);
}

// Formatar tempo MM:SS
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Selecionar duração
function selectDuration(seconds) {
    appState.cutDuration = seconds;
    
    // Atualizar UI
    document.querySelectorAll('.duration-btn').forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.duration) === seconds) {
            btn.classList.add('active');
        }
    });
    
    calculateClips();
}

// Calcular número de clips (TEMPO REAL)
function calculateClips() {
    const start = appState.trimStart;
    const end = appState.trimEnd;
    const duration = appState.cutDuration;
    
    const totalDuration = end - start;
    const clips = totalDuration > 0 && duration > 0 ? Math.floor(totalDuration / duration) : 0;
    
    appState.numberOfCuts = clips;
    
    // Atualizar UI imediatamente
    const clipsCount = document.getElementById('clips-count');
    const clipsCard = document.getElementById('clips-calculation');
    const previewTotal = document.getElementById('preview-total');
    
    if (clipsCount) {
        clipsCount.textContent = clips;
    }
    
    if (clipsCard) {
        if (clips > 0) {
            clipsCard.classList.add('has-result');
        } else {
            clipsCard.classList.remove('has-result');
        }
    }
    
    // Atualizar preview
    if (previewTotal) {
        previewTotal.textContent = clips;
    }
    
    // Mostrar próximas etapas se tiver clips válidos
    if (clips > 0) {
        showNextSteps();
    }
}

// Mostrar próximas etapas progressivamente
function showNextSteps() {
    const nicheStep = document.getElementById('step-niche');
    if (nicheStep && !nicheStep.classList.contains('visible')) {
        nicheStep.classList.remove('hidden');
        nicheStep.classList.add('visible');
        
        // Scroll suave para a próxima etapa
        setTimeout(() => {
            nicheStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
    }
}

// Carregar nichos
async function loadNiches() {
    try {
        const response = await fetch(`${API_BASE}/api/niches`);
        const data = await response.json();
        
        const container = document.getElementById('niches-container');
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

// Selecionar nicho
async function selectNiche(nicheId, cardElement) {
    document.querySelectorAll('.niche-card-item').forEach(card => {
        card.classList.remove('selected');
    });
    
    cardElement.classList.add('selected');
    appState.nicheId = nicheId;
    
    // Mostrar retenção
    const retentionStep = document.getElementById('step-retention');
    retentionStep.classList.remove('hidden');
    retentionStep.classList.add('visible');
    
    setTimeout(() => {
        retentionStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    
    await loadRetentionVideos(nicheId);
}

// Carregar vídeos de retenção
async function loadRetentionVideos(nicheId) {
    try {
        const response = await fetch(`${API_BASE}/api/retention/niche/${nicheId}`);
        const data = await response.json();
        
        const container = document.getElementById('retention-container');
        container.innerHTML = '';
        
        data.videos.forEach(video => {
            const card = document.createElement('div');
            card.className = 'retention-card-item';
            card.innerHTML = `
                <div class="retention-preview-icon">🎬</div>
                <h4>${video.name}</h4>
                <div class="retention-tags-row">
                    ${video.tags.map(tag => `<span class="tag-item">${tag}</span>`).join('')}
                </div>
            `;
            card.addEventListener('click', () => selectRetentionVideo(video.id, card));
            container.appendChild(card);
        });
        
        // Mostrar preview
        const previewStep = document.getElementById('step-preview');
        previewStep.classList.remove('hidden');
        previewStep.classList.add('visible');
    } catch (error) {
        console.error('Erro ao carregar vídeos de retenção:', error);
    }
}

// Selecionar vídeo de retenção
function selectRetentionVideo(videoId, cardElement) {
    document.querySelectorAll('.retention-card-item').forEach(card => {
        card.classList.remove('selected');
    });
    
    cardElement.classList.add('selected');
    appState.retentionVideoId = videoId;
    updatePreviewStyle();
}

// Atualizar modo de retenção
function updateRetentionMode(mode) {
    appState.retentionVideoId = mode;
}

// Atualizar estilo do preview
function updatePreviewStyle() {
    const headline = document.getElementById('preview-headline');
    const font = document.getElementById('headline-font-select').value;
    const style = document.getElementById('headline-style-select').value;
    
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

// Gerar série
async function generateSeries() {
    if (!appState.videoId || !appState.nicheId || !appState.numberOfCuts) {
        alert('Por favor, complete todas as etapas');
        return;
    }
    
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.classList.remove('hidden');
    
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
            loadingOverlay.classList.add('hidden');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao gerar série');
        loadingOverlay.classList.add('hidden');
    }
}

// Monitorar progresso
async function monitorProgress(jobId) {
    const progressFill = document.getElementById('loading-progress');
    const progressText = document.getElementById('loading-percent');
    
    const interval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/generate/status/${jobId}`);
            const data = await response.json();
            
            if (data.job) {
                const progress = data.job.progress || 0;
                progressFill.style.width = `${progress}%`;
                progressText.textContent = `${progress}%`;
                
                if (data.job.status === 'completed') {
                    clearInterval(interval);
                    showSuccessModal(data.job);
                } else if (data.job.status === 'error') {
                    clearInterval(interval);
                    alert('Erro ao gerar série: ' + data.job.error);
                    document.getElementById('loading-overlay').classList.add('hidden');
                }
            }
        } catch (error) {
            console.error('Erro ao verificar progresso:', error);
        }
    }, 1000);
}

// Mostrar modal de sucesso
function showSuccessModal(job) {
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.classList.add('hidden');
    
    const modal = document.getElementById('success-modal');
    const message = document.getElementById('success-message');
    message.textContent = `Série com ${appState.numberOfCuts} partes gerada com sucesso!`;
    
    modal.classList.remove('hidden');
}

// Download série
async function downloadSeries() {
    if (!appState.seriesId) {
        alert('Série não encontrada');
        return;
    }
    
    window.location.href = `${API_BASE}/api/generate/download/${appState.seriesId}`;
}

// Abrir TikTok Studio
function openTikTokStudio() {
    window.open('https://www.tiktok.com/studio', '_blank');
}
