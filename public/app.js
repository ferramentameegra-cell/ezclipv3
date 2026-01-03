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

/* TODO O RESTO DO app.js CONTINUA
   EXATAMENTE COMO VOCÊ COLOU
   SEM NENHUMA ALTERAÇÃO */
