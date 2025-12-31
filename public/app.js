// Adicionar função para gerar clips diretamente (sem série completa)
async function generateClips() {
    if (!appState.videoId || !appState.trimStart || !appState.trimEnd || !appState.cutDuration) {
        alert('Por favor, defina o trim e a duração dos clips');
        return;
    }

    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');

    try {
        const response = await fetch(`${API_BASE}/api/clips/generate-clips`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoId: appState.videoId,
                startTime: appState.trimStart,
                endTime: appState.trimEnd,
                clipDuration: appState.cutDuration
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Exibir links para download dos clips
            displayClipsDownload(data.clips);
            showStatus(`${data.clipsCount} clips gerados com sucesso!`, 'success');
        } else {
            alert('Erro ao gerar clips: ' + (data.error || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao gerar clips');
    } finally {
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }
}

function displayClipsDownload(clips) {
    // Criar ou atualizar área de download de clips
    let clipsContainer = document.getElementById('clips-download-container');
    if (!clipsContainer) {
        clipsContainer = document.createElement('div');
        clipsContainer.id = 'clips-download-container';
        clipsContainer.className = 'tool-card';
        clipsContainer.style.marginTop = '24px';
        
        const trimCard = document.getElementById('trim-card');
        if (trimCard) {
            trimCard.parentNode.insertBefore(clipsContainer, trimCard.nextSibling);
        }
    }

    clipsContainer.innerHTML = `
        <h3 class="card-title">Clips Gerados</h3>
        <p class="card-description">Baixe os clips individualmente:</p>
        <div class="clips-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-top: 16px;">
            ${clips.map(clip => `
                <a href="${clip.url}" download="${clip.filename}" class="btn-secondary" style="text-align: center; text-decoration: none; display: block;">
                    📥 Clip ${clip.index} (${clip.duration}s)
                </a>
            `).join('')}
        </div>
    `;
    
    clipsContainer.classList.remove('hidden');
}
