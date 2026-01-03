const API_BASE = window.location.origin;

const appState = {
  videoId: null,
  jobId: null,
  seriesId: null,
};

/* ==============================
   YOUTUBE DOWNLOAD
============================== */

async function handleYouTubeSubmit() {
  const url = document.getElementById('youtube-url').value.trim();

  if (!url) {
    showStatus('Cole um link do YouTube', 'error');
    return;
  }

  showStatus('Iniciando download...', 'info');

  await downloadWithProgress(url);
}

function downloadWithProgress(url) {
  return new Promise((resolve, reject) => {
    const es = new EventSource(
      `${API_BASE}/api/download/progress?url=${encodeURIComponent(url)}`
    );

    es.onmessage = (e) => {
      const data = JSON.parse(e.data);

      if (data.progress !== undefined) {
        showStatus(`Download ${data.progress}%`, 'info');
      }

      if (data.completed) {
        es.close();

        appState.videoId = data.videoId;

        renderVideo(data.playableUrl);

        showStatus('Download concluído', 'success');
        resolve();
      }
    };

    es.onerror = () => {
      es.close();
      showStatus('Erro no download', 'error');
      reject();
    };
  });
}

function renderVideo(url) {
  const container = document.getElementById('video-player-container');

  container.innerHTML = `
    <video
      src="${url}"
      controls
      style="width:100%; max-height:400px; margin-top:20px"
    ></video>
  `;
}

function showStatus(msg, type) {
  const el = document.getElementById('youtube-status');
  el.textContent = msg;
  el.style.color =
    type === 'error' ? 'red' :
    type === 'success' ? 'lime' :
    '#aaa';
}

/* ==============================
   GERAR SÉRIE
============================== */

async function generateSeries() {
  if (!appState.videoId) {
    alert('Faça o download do vídeo primeiro');
    return;
  }

  document.getElementById('loading-overlay').style.display = 'flex';

  const res = await fetch(`${API_BASE}/api/generate/series`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      videoId: appState.videoId,
      nicheId: 'default',
      numberOfCuts: 5,
      trimStart: 0,
      trimEnd: 600,
      cutDuration: 60,
    }),
  });

  const data = await res.json();

  appState.jobId = data.jobId;
  appState.seriesId = data.seriesId;

  monitorProgress(appState.jobId);
}

/* ==============================
   PROGRESSO REAL
============================== */

function monitorProgress(jobId) {
  const bar = document.getElementById('loading-progress');
  const text = document.getElementById('loading-percent');

  const interval = setInterval(async () => {
    try {
      const res = await fetch(
        `${API_BASE}/api/generate/status/${jobId}`,
        { cache: 'no-store' }
      );

      const { job } = await res.json();
      if (!job) return;

      const progress = Number(job.progress || 0);

      bar.style.width = `${progress}%`;
      text.textContent = `${progress}%`;

      if (job.status === 'completed') {
        clearInterval(interval);
        document.getElementById('loading-overlay').style.display = 'none';
        alert('Série gerada com sucesso!');
      }

      if (job.status === 'error') {
        clearInterval(interval);
        document.getElementById('loading-overlay').style.display = 'none';
        alert(job.error);
      }
    } catch {
      console.warn('Aguardando progresso...');
    }
  }, 1000);
}
