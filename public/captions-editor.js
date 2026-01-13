/**
 * EDITOR VISUAL DE LEGENDAS
 * Componente React-like para edição de legendas com preview em tempo real
 */

class CaptionsEditor {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.videoId = options.videoId;
    this.apiBase = options.apiBase || '/api';
    this.captions = [];
    this.style = {
      font: 'Arial',
      fontSize: 64,
      color: '#FFFFFF',
      highlightColor: '#FFD700',
      strokeColor: '#000000',
      strokeWidth: 2,
      shadow: true,
      background: {
        enabled: true,
        color: '#000000',
        opacity: 0.6
      },
      position: 'bottom',
      animation: 'fade'
    };
    this.headline = null;
    this.videoElement = null;
    this.canvas = null;
    this.ctx = null;
    
    this.init();
  }

  async init() {
    this.render();
    await this.loadVideo();
    await this.loadCaptions();
    this.setupEventListeners();
  }

  render() {
    this.container.innerHTML = `
      <div class="captions-editor">
        <div class="editor-header">
          <h2>Editor de Legendas</h2>
          <div class="header-actions">
            <button id="btn-generate-captions" class="btn btn-primary">Gerar Legendas (IA)</button>
            <button id="btn-save-captions" class="btn btn-success">Salvar Legendas</button>
            <button id="btn-render-video" class="btn btn-warning">Renderizar Vídeo</button>
          </div>
        </div>

        <div class="editor-layout">
          <!-- Preview -->
          <div class="preview-panel">
            <div class="preview-container">
              <video id="preview-video" controls></video>
              <canvas id="preview-canvas"></canvas>
            </div>
            <div class="timeline-controls">
              <input type="range" id="timeline-slider" min="0" max="100" value="0" class="timeline-slider">
              <div class="timeline-info">
                <span id="current-time">00:00</span> / <span id="total-time">00:00</span>
              </div>
            </div>
          </div>

          <!-- Editor -->
          <div class="editor-panel">
            <div class="tabs">
              <button class="tab active" data-tab="style">Estilo</button>
              <button class="tab" data-tab="headline">Headline</button>
              <button class="tab" data-tab="presets">Presets</button>
            </div>

            <!-- Tab: Estilo -->
            <div id="tab-style" class="tab-content active">
              <div class="form-group">
                <label>Fonte</label>
                <select id="style-font" class="form-control">
                  <option value="Arial">Arial</option>
                  <option value="Inter">Inter</option>
                  <option value="Roboto">Roboto</option>
                </select>
              </div>

              <div class="form-group">
                <label>Tamanho da Fonte</label>
                <input type="range" id="style-fontSize" min="32" max="120" value="64" class="form-range">
                <span id="fontSize-value">64px</span>
              </div>

              <div class="form-group">
                <label>Cor do Texto</label>
                <input type="color" id="style-color" value="#FFFFFF" class="form-control">
              </div>

              <div class="form-group">
                <label>Cor de Destaque</label>
                <input type="color" id="style-highlightColor" value="#FFD700" class="form-control">
              </div>

              <div class="form-group">
                <label>Contorno</label>
                <div class="inline-controls">
                  <input type="color" id="style-strokeColor" value="#000000" class="form-control">
                  <input type="range" id="style-strokeWidth" min="0" max="8" value="2" class="form-range">
                  <span id="strokeWidth-value">2px</span>
                </div>
              </div>

              <div class="form-group">
                <label>
                  <input type="checkbox" id="style-shadow" checked> Sombra
                </label>
              </div>

              <div class="form-group">
                <label>
                  <input type="checkbox" id="style-background-enabled" checked> Fundo da Legenda
                </label>
                <div id="background-options" class="sub-options">
                  <input type="color" id="style-background-color" value="#000000" class="form-control">
                  <input type="range" id="style-background-opacity" min="0" max="1" step="0.1" value="0.6" class="form-range">
                  <span id="background-opacity-value">60%</span>
                </div>
              </div>

              <div class="form-group">
                <label>Posição</label>
                <select id="style-position" class="form-control">
                  <option value="bottom">Inferior</option>
                  <option value="center">Centro</option>
                  <option value="top">Superior</option>
                </select>
              </div>

              <div class="form-group">
                <label>Animação</label>
                <select id="style-animation" class="form-control">
                  <option value="fade">Fade</option>
                  <option value="pop">Pop</option>
                  <option value="slide">Slide</option>
                </select>
              </div>
            </div>

            <!-- Tab: Headline -->
            <div id="tab-headline" class="tab-content">
              <div class="form-group">
                <label>
                  <input type="checkbox" id="headline-enabled"> Habilitar Headline
                </label>
              </div>

              <div id="headline-options" class="sub-options" style="display: none;">
                <div class="form-group">
                  <label>Texto</label>
                  <input type="text" id="headline-text" placeholder="Digite o texto da headline" class="form-control">
                </div>

                <div class="form-group">
                  <label>Fonte</label>
                  <select id="headline-font" class="form-control">
                    <option value="Arial">Arial</option>
                    <option value="Inter">Inter</option>
                  </select>
                </div>

                <div class="form-group">
                  <label>Tamanho</label>
                  <input type="range" id="headline-fontSize" min="48" max="120" value="72" class="form-range">
                  <span id="headline-fontSize-value">72px</span>
                </div>

                <div class="form-group">
                  <label>Cor do Texto</label>
                  <input type="color" id="headline-color" value="#FFFFFF" class="form-control">
                </div>

                <div class="form-group">
                  <label>
                    <input type="checkbox" id="headline-background-enabled" checked> Tarja de Fundo
                  </label>
                  <div id="headline-background-options" class="sub-options">
                    <input type="color" id="headline-background-color" value="#FF0000" class="form-control">
                    <input type="range" id="headline-background-opacity" min="0" max="1" step="0.1" value="0.9" class="form-range">
                    <span id="headline-background-opacity-value">90%</span>
                    <input type="range" id="headline-background-height" min="80" max="200" value="120" class="form-range">
                    <span id="headline-background-height-value">120px</span>
                  </div>
                </div>

                <div class="form-group">
                  <label>Posição</label>
                  <select id="headline-position" class="form-control">
                    <option value="top">Topo</option>
                    <option value="center">Centro</option>
                    <option value="bottom">Inferior</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Tab: Presets -->
            <div id="tab-presets" class="tab-content">
              <div class="presets-grid" id="presets-list">
                <!-- Presets serão carregados aqui -->
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Inicializar canvas
    this.canvas = document.getElementById('preview-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.videoElement = document.getElementById('preview-video');
  }

  async loadVideo() {
    try {
      const response = await fetch(`${this.apiBase}/download/state/${this.videoId}`);
      const data = await response.json();
      
      if (data.video && data.video.path) {
        // Carregar vídeo para preview
        this.videoElement.src = `${this.apiBase}/download/play/${this.videoId}`;
        this.videoElement.load();
      }
    } catch (error) {
      console.error('Erro ao carregar vídeo:', error);
    }
  }

  async loadCaptions() {
    try {
      const response = await fetch(`${this.apiBase}/captions/${this.videoId}`);
      const data = await response.json();
      
      if (data.success && data.captions) {
        this.captions = data.captions;
        this.updatePreview();
      }
    } catch (error) {
      console.error('Erro ao carregar legendas:', error);
    }
  }

  async loadPresets() {
    try {
      const response = await fetch(`${this.apiBase}/captions/presets/list`);
      const data = await response.json();
      
      if (data.success) {
        this.renderPresets(data.captions, data.headlines);
      }
    } catch (error) {
      console.error('Erro ao carregar presets:', error);
    }
  }

  renderPresets(captionPresets, headlinePresets) {
    const container = document.getElementById('presets-list');
    container.innerHTML = '';

    // Presets de legendas
    const captionSection = document.createElement('div');
    captionSection.className = 'presets-section';
    captionSection.innerHTML = '<h3>Estilos de Legendas</h3>';
    
    Object.entries(captionPresets).forEach(([key, preset]) => {
      const presetCard = document.createElement('div');
      presetCard.className = 'preset-card';
      presetCard.innerHTML = `
        <h4>${preset.name}</h4>
        <p>${preset.description}</p>
        <button class="btn btn-sm" onclick="editor.applyPreset('${key}')">Aplicar</button>
      `;
      captionSection.appendChild(presetCard);
    });

    container.appendChild(captionSection);
  }

  setupEventListeners() {
    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${tabName}`).classList.add('active');
        
        if (tabName === 'presets') {
          this.loadPresets();
        }
      });
    });

    // Controles de estilo
    document.getElementById('style-fontSize').addEventListener('input', (e) => {
      this.style.fontSize = parseInt(e.target.value);
      document.getElementById('fontSize-value').textContent = `${this.style.fontSize}px`;
      this.updatePreview();
    });

    document.getElementById('style-color').addEventListener('input', (e) => {
      this.style.color = e.target.value;
      this.updatePreview();
    });

    document.getElementById('style-highlightColor').addEventListener('input', (e) => {
      this.style.highlightColor = e.target.value;
      this.updatePreview();
    });

    document.getElementById('style-strokeWidth').addEventListener('input', (e) => {
      this.style.strokeWidth = parseInt(e.target.value);
      document.getElementById('strokeWidth-value').textContent = `${this.style.strokeWidth}px`;
      this.updatePreview();
    });

    document.getElementById('style-background-enabled').addEventListener('change', (e) => {
      this.style.background.enabled = e.target.checked;
      document.getElementById('background-options').style.display = e.target.checked ? 'block' : 'none';
      this.updatePreview();
    });

    // Headline
    document.getElementById('headline-enabled').addEventListener('change', (e) => {
      const enabled = e.target.checked;
      document.getElementById('headline-options').style.display = enabled ? 'block' : 'none';
      if (!enabled) {
        this.headline = null;
      }
      this.updatePreview();
    });

    document.getElementById('headline-text').addEventListener('input', (e) => {
      if (!this.headline) {
        this.headline = {};
      }
      this.headline.text = e.target.value;
      this.updatePreview();
    });

    // Botões de ação
    document.getElementById('btn-generate-captions').addEventListener('click', () => {
      this.generateCaptions();
    });

    document.getElementById('btn-save-captions').addEventListener('click', () => {
      this.saveCaptions();
    });

    document.getElementById('btn-render-video').addEventListener('click', () => {
      this.renderVideo();
    });

    // Timeline
    this.videoElement.addEventListener('loadedmetadata', () => {
      document.getElementById('timeline-slider').max = this.videoElement.duration;
      document.getElementById('total-time').textContent = this.formatTime(this.videoElement.duration);
    });

    this.videoElement.addEventListener('timeupdate', () => {
      document.getElementById('timeline-slider').value = this.videoElement.currentTime;
      document.getElementById('current-time').textContent = this.formatTime(this.videoElement.currentTime);
      this.updatePreview();
    });

    document.getElementById('timeline-slider').addEventListener('input', (e) => {
      this.videoElement.currentTime = parseFloat(e.target.value);
    });
  }

  updatePreview() {
    if (!this.videoElement || !this.canvas) return;

    const video = this.videoElement;
    const canvas = this.canvas;
    
    canvas.width = video.videoWidth || 1080;
    canvas.height = video.videoHeight || 1920;

    // Desenhar frame atual do vídeo
    this.ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Desenhar legendas
    const currentTime = video.currentTime;
    const activeCaption = this.captions.find(c => 
      currentTime >= c.start && currentTime <= c.end
    );

    if (activeCaption) {
      this.drawCaption(activeCaption);
    }

    // Desenhar headline
    if (this.headline && this.headline.text) {
      this.drawHeadline();
    }
  }

  drawCaption(caption) {
    const ctx = this.ctx;
    const { style } = this;

    ctx.save();

    // Configurar fonte
    ctx.font = `${style.fontSize}px ${style.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // Posição
    const x = this.canvas.width / 2;
    let y = this.canvas.height - 100; // bottom
    if (style.position === 'center') {
      y = this.canvas.height / 2;
    } else if (style.position === 'top') {
      y = 100;
    }

    // Fundo
    if (style.background.enabled) {
      const text = caption.lines && caption.lines.length > 0 
        ? caption.lines.join('\n') 
        : caption.text;
      const metrics = ctx.measureText(text);
      const padding = style.background.padding || 10;
      
      ctx.fillStyle = style.background.color + Math.round(style.background.opacity * 255).toString(16).padStart(2, '0');
      ctx.fillRect(
        x - metrics.width / 2 - padding,
        y - style.fontSize * (caption.lines?.length || 1) - padding,
        metrics.width + padding * 2,
        style.fontSize * (caption.lines?.length || 1) + padding * 2
      );
    }

    // Contorno
    if (style.strokeWidth > 0) {
      ctx.strokeStyle = style.strokeColor;
      ctx.lineWidth = style.strokeWidth;
    }

    // Sombra
    if (style.shadow) {
      ctx.shadowColor = style.shadowColor || '#000000';
      ctx.shadowBlur = style.shadowBlur || 3;
      ctx.shadowOffsetX = style.shadowOffsetX || 2;
      ctx.shadowOffsetY = style.shadowOffsetY || 2;
    }

    // Texto
    ctx.fillStyle = style.color;
    
    if (caption.lines && caption.lines.length > 0) {
      caption.lines.forEach((line, index) => {
        ctx.fillText(line, x, y - (caption.lines.length - index - 1) * style.fontSize * 1.2);
        if (style.strokeWidth > 0) {
          ctx.strokeText(line, x, y - (caption.lines.length - index - 1) * style.fontSize * 1.2);
        }
      });
    } else {
      ctx.fillText(caption.text, x, y);
      if (style.strokeWidth > 0) {
        ctx.strokeText(caption.text, x, y);
      }
    }

    ctx.restore();
  }

  drawHeadline() {
    const ctx = this.ctx;
    const headlineStyle = {
      font: document.getElementById('headline-font')?.value || 'Arial',
      fontSize: parseInt(document.getElementById('headline-fontSize')?.value || 72),
      color: document.getElementById('headline-color')?.value || '#FFFFFF',
      background: {
        enabled: document.getElementById('headline-background-enabled')?.checked || false,
        color: document.getElementById('headline-background-color')?.value || '#FF0000',
        opacity: parseFloat(document.getElementById('headline-background-opacity')?.value || 0.9),
        height: parseInt(document.getElementById('headline-background-height')?.value || 120)
      },
      position: document.getElementById('headline-position')?.value || 'top'
    };

    ctx.save();
    ctx.font = `${headlineStyle.fontSize}px ${headlineStyle.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const x = this.canvas.width / 2;
    let y = 50;
    if (headlineStyle.position === 'center') {
      y = this.canvas.height / 2;
    } else if (headlineStyle.position === 'bottom') {
      y = this.canvas.height - 100;
    }

    // Fundo (tarja)
    if (headlineStyle.background.enabled) {
      const metrics = ctx.measureText(this.headline.text);
      ctx.fillStyle = headlineStyle.background.color + Math.round(headlineStyle.background.opacity * 255).toString(16).padStart(2, '0');
      ctx.fillRect(0, y - 20, this.canvas.width, headlineStyle.background.height);
    }

    // Texto
    ctx.fillStyle = headlineStyle.color;
    ctx.fillText(this.headline.text, x, y);

    ctx.restore();
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  async generateCaptions() {
    try {
      const btn = document.getElementById('btn-generate-captions');
      btn.disabled = true;
      btn.textContent = 'Gerando...';

      const response = await fetch(`${this.apiBase}/captions/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: this.videoId })
      });

      const data = await response.json();
      
      if (data.success) {
        this.captions = data.captions;
        this.updatePreview();
        alert('Legendas geradas com sucesso!');
      } else {
        alert('Erro ao gerar legendas: ' + data.error);
      }
    } catch (error) {
      alert('Erro ao gerar legendas: ' + error.message);
    } finally {
      const btn = document.getElementById('btn-generate-captions');
      btn.disabled = false;
      btn.textContent = 'Gerar Legendas (IA)';
    }
  }

  async saveCaptions() {
    try {
      const response = await fetch(`${this.apiBase}/captions/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: this.videoId,
          captions: this.captions
        })
      });

      const data = await response.json();
      
      if (data.success) {
        alert('Legendas salvas com sucesso!');
      } else {
        alert('Erro ao salvar legendas: ' + data.error);
      }
    } catch (error) {
      alert('Erro ao salvar legendas: ' + error.message);
    }
  }

  async renderVideo() {
    try {
      const btn = document.getElementById('btn-render-video');
      btn.disabled = true;
      btn.textContent = 'Renderizando...';

      // Coletar estilo atual
      const style = { ...this.style };
      const headline = this.headline && this.headline.text ? {
        text: this.headline.text,
        startTime: 0,
        endTime: 5
      } : null;

      const response = await fetch(`${this.apiBase}/captions/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: this.videoId,
          style,
          headline
        })
      });

      const data = await response.json();
      
      if (data.success) {
        alert('Vídeo renderizado! Download disponível.');
        window.open(data.downloadUrl, '_blank');
      } else {
        alert('Erro ao renderizar: ' + data.error);
      }
    } catch (error) {
      alert('Erro ao renderizar: ' + error.message);
    } finally {
      const btn = document.getElementById('btn-render-video');
      btn.disabled = false;
      btn.textContent = 'Renderizar Vídeo';
    }
  }

  applyPreset(presetKey) {
    // Carregar preset e aplicar
    fetch(`${this.apiBase}/captions/presets/list`)
      .then(r => r.json())
      .then(data => {
        if (data.captions[presetKey]) {
          this.style = { ...data.captions[presetKey] };
          this.updateStyleInputs();
          this.updatePreview();
        }
      });
  }

  updateStyleInputs() {
    // Atualizar inputs do formulário com o estilo atual
    document.getElementById('style-font').value = this.style.font;
    document.getElementById('style-fontSize').value = this.style.fontSize;
    document.getElementById('style-color').value = this.style.color;
    document.getElementById('style-highlightColor').value = this.style.highlightColor;
    document.getElementById('style-strokeWidth').value = this.style.strokeWidth;
    document.getElementById('style-background-enabled').checked = this.style.background?.enabled || false;
    // ... outros campos
  }
}

// Exportar para uso global
window.CaptionsEditor = CaptionsEditor;
