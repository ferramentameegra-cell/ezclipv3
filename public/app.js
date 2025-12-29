// Estado da aplicação
const appState = {
    videoId: null,
    videoInfo: null,
    nicheId: null,
    retentionVideoId: 'random',
    numberOfCuts: 0,
    trimStart: 0,
    trimEnd: 0,
    cutDuration: 60,
    headlineStyle: 'bold',
    font: 'Inter',
    captionStyle: 'tiktok',
    jobId: null,
    seriesId: null
};

const API_BASE = window.location.origin;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    loadNiches();
    setupYouTubeInput();
});

// Setup YouTube input com Enter key
function setupYouTubeInput() {
    const input = document.getElementById('youtube-url-input');
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            processYouTube();
        }
    });
}

// Processar YouTube
async function processYouTube() {
    const url = document.getElementById('youtube-url-input').value.trim();
    const btn = document.getElementById('btn-process-youtube');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');
    const statusMsg = document.getElementById('youtube-status');
    
    if (!url) {
        showStatus('Por favor, insira uma URL do YouTube', 'error');
        return;
    }

    // Mostrar loading
    btn.disabled = true;
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');
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
            showTrimTool(data.video);
        } else {
            showStatus(data.error || 'Erro ao processar vídeo', 'error');
        }
    } catch (error) {
        console.error('Erro:', error);
        showStatus('Erro ao processar vídeo do YouTube', 'error');
    } finally {
        btn.disabled = false;
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
    }
}

// Mostrar status
function showStatus(message, type) {
    const statusMsg = document.getElementById('youtube-status');
    statusMsg.textContent = message;
    statusMsg.className = `status-message ${type}`;
    statusMsg.classList.remove('hidden');
}

// Mostrar trim tool
function showTrimTool(video) {
    const trimStep = document.getElementById('step-trim');
    trimStep.classList.remove('hidden');
    
    // Configurar vídeo
    setupVideoPlayer(video);
    
    // Configurar controles
    setupTrimControls(video);
    
    // Scroll suave
    setTimeout(() => {
        trimStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

// Configurar player de vídeo
function setupVideoPlayer(video) {
    const container = document.getElementById('video-player-container');
    container.innerHTML = '';
    
    if (video.youtubeVideoId || video.youtubeUrl) {
        const videoId = video.youtubeVideoId || extractYouTubeId(video.youtubeUrl);
        if (videoId) {
            const iframe = document.createElement('iframe');
            iframe.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1`;
            iframe.width = '100%';
            iframe.height = '400';
            iframe.style.border = 'none';
            iframe.style.borderRadius = '8px';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            iframe.allowFullscreen = true;
            container.appendChild(iframe);
        }
    }
}

// Configurar controles de trim
function setupTrimControls(video) {
    const duration = video.duration || 0;
    const startSlider = document.getElementById('trim-start-slider');
    const startInput = document.getElementById('trim-start-input');
    const endSlider = document.getElementById('trim-end-slider');
    const endInput = document.getElementById('trim-end-input');
    
    // Configurar máximos
    startSlider.max = duration;
    startInput.max = duration;
    endSlider.max = duration;
    endInput.max = duration;
    
    // Configurar valores iniciais
    endSlider.value = duration;
    endInput.value = duration;
    appState.trimEnd = duration;
    
    // Atualizar displays
    updateTimeDisplay('start', 0);
    updateTimeDisplay('end', duration);
    
    // Calcular clips inicial
    calculateClips();
}

// Atualizar tempo inicial do slider
function updateStartTime(value) {
    const numValue = parseInt(value);
    appState.trimStart = numValue;
    
    document.getElementById('trim-start-input').value = numValue;
    updateTimeDisplay('start', numValue);
    
    // Garantir que fim > início
    const endValue = parseInt(document.getElementById('trim-end-slider').value);
    if (endValue <= numValue) {
        const newEnd = numValue + 1;
        document.getElementById('trim-end-slider').value = newEnd;
        document.getElementById('trim-end-input').value = newEnd;
        appState.trimEnd = newEnd;
        updateTimeDisplay('end', newEnd);
    }
    
    calculateClips();
}

// Atualizar tempo inicial do input
function updateStartTimeFromInput(value) {
    const numValue = parseInt(value) || 0;
    const max = parseInt(document.getElementById('trim-start-slider').max);
    const clampedValue = Math.min(Math.max(0, numValue), max);
    
    document.getElementById('trim-start-slider').value = clampedValue;
    updateStartTime(clampedValue);
}

// Atualizar tempo final do slider
function updateEndTime(value) {
    const numValue = parseInt(value);
    appState.trimEnd = numValue;
    
    document.getElementById('trim-end-input').value = numValue;
    updateTimeDisplay('end', numValue);
    
    // Garantir que fim > início
    const startValue = parseInt(document.getElementById('trim-start-slider').value);
    if (numValue <= startValue) {
        const newStart = numValue - 1;
        document.getElementById('trim-start-slider').value = Math.max(0, newStart);
        document.getElementById('trim-start-input').value = Math.max(0, newStart);
        appState.trimStart = Math.max(0, newStart);
        updateTimeDisplay('start', Math.max(0, newStart));
    }
    
    calculateClips();
}

// Atualizar tempo final do input
function updateEndTimeFromInput(value) {
    const numValue = parseInt(value) || 0;
    const max = parseInt(document.getElementById('trim-end-slider').max);
    const clampedValue = Math.min(Math.max(0, numValue), max);
    
    document.getElementById('trim-end-slider').value = clampedValue;
    updateEndTime(clampedValue);
}

// Atualizar display de tempo
function updateTimeDisplay(type, seconds) {
    const display = document.getElementById(`${type}-time-display`);
    display.textContent = formatTime(seconds);
}

// Formatar tempo (MM:SS)
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Calcular número de clips
function calculateClips() {
    const start = appState.trimStart;
    const end = appState.trimEnd;
    const duration = parseInt(document.querySelector('input[name="clip-duration"]:checked').value);
    
    appState.cutDuration = duration;
    
    const totalDuration = end - start;
    const clips = totalDuration > 0 ? Math.floor(totalDuration / duration) : 0;
    
    appState.numberOfCuts = clips;
    
    // Atualizar UI
    const clipsCount = document.getElementById('clips-count');
    clipsCount.textContent = clips;
    
    // Atualizar preview
    document.getElementById('preview-total').textContent = clips;
    
    // Mostrar próximas etapas se tiver clips
    if (clips > 0) {
        showNextSteps();
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

// Mostrar próximas etapas
function showNextSteps() {
    const nicheStep = document.getElementById('step-niche');
    if (!nicheStep.classList.contains('visible')) {
        nicheStep.classList.remove('hidden');
        nicheStep.classList.add('visible');
    }
}

// Carregar nichos
async function loadNiches() {
    try {
        const response = await fetch(`${API_BASE}/api/niches`);
        const data = await response.json();
        
        const grid = document.getElementById('niches-grid');
        grid.innerHTML = '';
        
        data.niches.forEach(niche => {
            const card = document.createElement('div');
            card.className = 'niche-card';
            card.innerHTML = `
                <h3>${niche.name}</h3>
                <p>${niche.description}</p>
            `;
            card.addEventListener('click', () => selectNiche(niche.id, card));
            grid.appendChild(card);
        });
    } catch (error) {
        console.error('Erro ao carregar nichos:', error);
    }
}

// Selecionar nicho
async function selectNiche(nicheId, cardElement) {
    document.querySelectorAll('.niche-card').forEach(card => {
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
        
        const grid = document.getElementById('retention-grid');
        grid.innerHTML = '';
        
        data.videos.forEach(video => {
            const card = document.createElement('div');
            card.className = 'retention-card';
            card.innerHTML = `
                <div class="retention-preview">🎬</div>
                <h4>${video.name}</h4>
                <div class="retention-tags">
                    ${video.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
            `;
            card.addEventListener('click', () => selectRetentionVideo(video.id, card));
            grid.appendChild(card);
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
    document.querySelectorAll('.retention-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    cardElement.classList.add('selected');
    appState.retentionVideoId = videoId;
    updatePreview();
}

// Atualizar retenção
function updateRetention(value) {
    appState.retentionVideoId = value;
}

// Atualizar preview
function updatePreview() {
    const headline = document.getElementById('preview-headline');
    const font = document.getElementById('headline-font').value;
    const style = document.getElementById('headline-style').value;
    
    appState.font = font;
    appState.headlineStyle = style;
    
    headline.style.fontFamily = font;
    
    if (style === 'bold') {
        headline.style.fontWeight = '800';
    } else if (style === 'impact') {
        headline.style.fontWeight = '900';
        headline.style.textTransform = 'uppercase';
    } else {
        headline.style.fontWeight = '600';
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
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
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
    const seriesInfo = document.getElementById('series-info');
    seriesInfo.textContent = `Série com ${appState.numberOfCuts} partes gerada com sucesso!`;
    
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
