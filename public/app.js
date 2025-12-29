// Estado da aplicação
const appState = {
    currentStep: 1,
    videoId: null,
    videoInfo: null,
    nicheId: null,
    retentionVideoId: 'random',
    numberOfCuts: 0,
    trimStart: 0,
    trimEnd: null,
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
    setupFileUpload();
    setupStepNavigation();
});

// Setup file upload
function setupFileUpload() {
    const fileInput = document.getElementById('video-file');
    const fileName = document.getElementById('file-name');
    
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            fileName.textContent = file.name;
            await uploadVideo(file);
        }
    });
}

// Upload de vídeo
async function uploadVideo(file) {
    try {
        const formData = new FormData();
        formData.append('video', file);

        const response = await fetch(`${API_BASE}/api/video/upload`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        
        if (response.ok) {
            appState.videoId = data.videoId;
            appState.videoInfo = data.video;
            showVideoPreview(data.video);
            // Ir para step 2 (trim) automaticamente
            goToStep(2);
            setupTrimVideo(data.video);
        } else {
            alert('Erro ao fazer upload: ' + data.error);
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao fazer upload do vídeo');
    }
}

// Processar YouTube
async function processYouTube() {
    const url = document.getElementById('youtube-url').value;
    
    if (!url) {
        alert('Por favor, insira uma URL do YouTube');
        return;
    }

    // Mostrar loading
    const button = event.target;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Processando...';

    try {
        const response = await fetch(`${API_BASE}/api/video/youtube`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ youtubeUrl: url })
        });

        const data = await response.json();
        
        if (response.ok) {
            appState.videoId = data.videoId;
            appState.videoInfo = data.video;
            showVideoPreview(data.video);
            // Ir para step 2 (trim) automaticamente
            goToStep(2);
            setupTrimVideo(data.video);
        } else {
            // Mostrar erro mais detalhado
            const errorMsg = data.error || data.details || 'Erro desconhecido';
            const suggestion = data.suggestion || '';
            const fullMessage = suggestion ? `${errorMsg}\n\n${suggestion}` : errorMsg;
            
            alert(fullMessage);
            console.error('Erro detalhado:', data);
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao processar vídeo do YouTube: ' + error.message);
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}

// Mostrar preview do vídeo
function showVideoPreview(video) {
    const preview = document.getElementById('video-preview');
    preview.classList.remove('hidden');
    preview.innerHTML = `
        <div class="video-info">
            <h3>${video.title || video.originalName}</h3>
            ${video.duration ? `<p>Duração: ${formatDuration(video.duration)}</p>` : ''}
        </div>
    `;
}

// Configurar vídeo no trim
function setupTrimVideo(video) {
    const trimVideo = document.getElementById('trim-video');
    const trimStartInput = document.getElementById('trim-start');
    const trimEndInput = document.getElementById('trim-end');
    
    // Se for vídeo do YouTube, usar iframe
    if (video.youtubeVideoId || video.youtubeUrl) {
        const videoId = video.youtubeVideoId || extractYouTubeId(video.youtubeUrl);
        if (videoId) {
            // Criar iframe do YouTube
            trimVideo.style.display = 'none';
            const iframe = document.createElement('iframe');
            iframe.id = 'youtube-player';
            iframe.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1`;
            iframe.width = '100%';
            iframe.height = '400';
            iframe.style.border = 'none';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            iframe.allowFullscreen = true;
            
            // Remover iframe anterior se existir
            const existingIframe = document.getElementById('youtube-player');
            if (existingIframe) {
                existingIframe.remove();
            }
            
            trimVideo.parentElement.appendChild(iframe);
        }
    } else if (video.path) {
        // Vídeo local
        trimVideo.src = `${API_BASE}/api/video/stream/${video.id}`;
        trimVideo.style.display = 'block';
    }
    
    // Configurar valores padrão
    trimStartInput.value = 0;
    trimStartInput.max = video.duration || 0;
    trimEndInput.value = video.duration || '';
    trimEndInput.max = video.duration || 0;
    trimEndInput.placeholder = `Máximo: ${formatDuration(video.duration || 0)}`;
    
    // Atualizar estimativa inicial
    updateTrimEstimate();
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

// Atualizar estimativa de cortes
function updateTrimEstimate() {
    const trimStart = parseInt(document.getElementById('trim-start').value) || 0;
    const trimEnd = parseInt(document.getElementById('trim-end').value);
    const duration = appState.videoInfo?.duration || 0;
    
    const effectiveDuration = trimEnd ? (trimEnd - trimStart) : (duration - trimStart);
    
    // Assumindo cortes de 60 segundos
    const estimatedCuts = Math.max(1, Math.floor(effectiveDuration / 60));
    
    const estimateText = document.getElementById('trim-estimate');
    if (effectiveDuration > 0) {
        estimateText.textContent = `Este vídeo gerará aproximadamente ${estimatedCuts} partes`;
    } else {
        estimateText.textContent = 'Defina o trim para calcular o número de partes';
    }
}

// Calcular cortes
function calculateCuts() {
    const trimStart = parseInt(document.getElementById('trim-start').value) || 0;
    const trimEnd = parseInt(document.getElementById('trim-end').value);
    
    appState.trimStart = trimStart;
    appState.trimEnd = trimEnd;
    
    const duration = appState.videoInfo?.duration || 0;
    const effectiveDuration = trimEnd ? (trimEnd - trimStart) : (duration - trimStart);
    
    if (effectiveDuration <= 0) {
        alert('Por favor, defina um trim válido (fim maior que início)');
        return;
    }
    
    // Assumindo cortes de 60 segundos
    const estimatedCuts = Math.max(1, Math.floor(effectiveDuration / 60));
    
    appState.numberOfCuts = estimatedCuts;
    
    const estimateText = document.getElementById('trim-estimate');
    estimateText.textContent = `Este vídeo gerará aproximadamente ${estimatedCuts} partes`;
    
    nextStep();
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
    // Remover seleção anterior
    document.querySelectorAll('.niche-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Adicionar seleção atual
    cardElement.classList.add('selected');
    appState.nicheId = nicheId;
    
    // Carregar vídeos de retenção do nicho
    await loadRetentionVideos(nicheId);
    
    nextStep();
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
    } catch (error) {
        console.error('Erro ao carregar vídeos de retenção:', error);
    }
}

// Selecionar vídeo de retenção
function selectRetentionVideo(videoId, cardElement) {
    // Remover seleção anterior
    document.querySelectorAll('.retention-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Adicionar seleção atual
    cardElement.classList.add('selected');
    appState.retentionVideoId = videoId;
    
    updatePreview();
}

// Setup radio buttons para retenção
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('input[name="retention"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'none') {
                appState.retentionVideoId = null;
            } else if (e.target.value === 'random') {
                appState.retentionVideoId = 'random';
            }
            updatePreview();
        });
    });
});

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
    
    // Atualizar número da parte
    const partNumber = document.getElementById('preview-part');
    partNumber.textContent = `PARTE 1/${appState.numberOfCuts || 42}`;
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
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                videoId: appState.videoId,
                nicheId: appState.nicheId,
                retentionVideoId: appState.retentionVideoId,
                numberOfCuts: appState.numberOfCuts,
                headlineStyle: appState.headlineStyle,
                font: appState.font,
                trimStart: appState.trimStart,
                trimEnd: appState.trimEnd
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            appState.jobId = data.jobId;
            appState.seriesId = data.seriesId;
            
            // Monitorar progresso
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

// Navegação entre steps
function setupStepNavigation() {
    // Implementar navegação se necessário
}

function nextStep() {
    if (appState.currentStep < 5) {
        appState.currentStep++;
        updateStepDisplay();
    }
}

function goToStep(step) {
    appState.currentStep = step;
    updateStepDisplay();
}

function updateStepDisplay() {
    // Atualizar indicador de steps
    document.querySelectorAll('.step').forEach((step, index) => {
        if (index + 1 <= appState.currentStep) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });
    
    // Atualizar conteúdo dos steps
    document.querySelectorAll('.step-content').forEach((content, index) => {
        if (index + 1 === appState.currentStep) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });
}

// Formatar duração
function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

