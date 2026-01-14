/**
 * EDITOR VISUAL DE LEGENDAS
 * Componente React-like para edição de legendas com preview em tempo real
 */

class CaptionsEditor {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.videoId = options.videoId;
    // apiBase deve ser a origem (ex: http://localhost:8080)
    // As URLs serão construídas como ${this.apiBase}/api/captions/...
    this.apiBase = options.apiBase || window.location.origin;
    this.captions = [];
    this.style = {
      font: 'Inter',
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
    
    // Carregar vídeo primeiro e aguardar
    try {
      await this.loadVideo();
      console.log('[CAPTIONS] ✅ Vídeo carregado no editor');
    } catch (error) {
      console.error('[CAPTIONS] ⚠️ Erro ao carregar vídeo:', error);
      // Continuar mesmo se houver erro (pode ser que o vídeo ainda esteja processando)
    }
    
    // Carregar legendas
    await this.loadCaptions();
    
    // Configurar event listeners
    this.setupEventListeners();
    
    // Iniciar preview loop
    if (this.videoElement && this.videoElement.readyState >= 2) {
      this.startPreviewLoop();
    } else {
      // Aguardar vídeo estar pronto
      this.videoElement.addEventListener('loadeddata', () => {
        this.startPreviewLoop();
      }, { once: true });
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="captions-editor">
        <!-- Seção de Estilo ANTES de Gerar (Destaque) -->
        <div class="style-preview-section" style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 0.75rem; margin-bottom: 1.5rem; border: 1px solid var(--border);">
          <h3 style="margin: 0 0 1rem 0; font-size: 1.125rem; font-weight: 600;">⚙️ Configure o Estilo das Legendas</h3>
          <p style="margin: 0 0 1.5rem 0; color: var(--text-secondary); font-size: 0.875rem;">Personalize fonte, cor e tamanho. Veja o preview ao lado antes de gerar.</p>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
            <div class="form-group">
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; font-size: 0.875rem;">Fonte</label>
              <select id="style-font" class="form-control" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 0.5rem;">
                <option value="Arial">Arial</option>
                <option value="Inter" selected>Inter</option>
                <option value="Roboto">Roboto</option>
                <option value="Montserrat">Montserrat</option>
                <option value="Open Sans">Open Sans</option>
              </select>
            </div>

            <div class="form-group">
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; font-size: 0.875rem;">Tamanho</label>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <input type="range" id="style-fontSize" min="32" max="120" value="64" class="form-range" style="flex: 1;">
                <span id="fontSize-value" style="min-width: 50px; font-weight: 600;">64px</span>
              </div>
            </div>

            <div class="form-group">
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; font-size: 0.875rem;">Cor do Texto</label>
              <input type="color" id="style-color" value="#FFFFFF" class="form-control" style="width: 100%; height: 40px; border: 1px solid var(--border); border-radius: 0.5rem; cursor: pointer;">
            </div>

            <div class="form-group">
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; font-size: 0.875rem;">Contorno</label>
              <div style="display: flex; gap: 0.5rem; align-items: center;">
                <input type="color" id="style-strokeColor" value="#000000" class="form-control" style="width: 60px; height: 40px; border: 1px solid var(--border); border-radius: 0.5rem; cursor: pointer;">
                <input type="range" id="style-strokeWidth" min="0" max="8" value="2" class="form-range" style="flex: 1;">
                <span id="strokeWidth-value" style="min-width: 40px; font-weight: 600;">2px</span>
              </div>
            </div>
          </div>
          
          <!-- Preview de Exemplo -->
          <div style="margin-top: 1.5rem; padding: 1.5rem; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 0.75rem; border: 1px solid var(--border); position: relative; overflow: hidden; min-height: 150px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; top: 0.75rem; left: 0.75rem; color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">📝 Preview do Estilo</div>
            <div id="style-preview-text" style="font-family: Inter; font-size: 64px; color: #FFFFFF; text-shadow: 2px 2px 0 #000000; font-weight: 600; text-align: center; padding: 1rem; position: relative; z-index: 1;">
              Exemplo de Legenda
            </div>
            <div id="style-preview-background" style="position: absolute; bottom: 0; left: 0; right: 0; height: 60px; background: rgba(0, 0, 0, 0.6); border-radius: 0 0 0.5rem 0.5rem; transition: all 0.3s ease;"></div>
          </div>
        </div>

        <div class="editor-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border);">
          <h2 style="margin: 0; font-size: 1.25rem;">Editor de Legendas</h2>
          <div class="header-actions" style="display: flex; gap: 0.75rem;">
            <button id="btn-generate-captions" class="btn btn-primary" style="padding: 0.75rem 1.5rem; background: var(--primary); color: white; border: none; border-radius: 0.5rem; font-weight: 600; cursor: pointer;">🤖 Gerar Legendas (OpenAI)</button>
            <button id="btn-save-captions" class="btn btn-success" style="padding: 0.75rem 1.5rem; background: var(--success); color: white; border: none; border-radius: 0.5rem; font-weight: 600; cursor: pointer; display: none;">💾 Salvar</button>
          </div>
        </div>

        <div class="editor-layout" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
          <!-- Preview -->
          <div class="preview-panel" style="background: var(--bg-secondary); padding: 1rem; border-radius: 0.75rem; border: 1px solid var(--border);">
            <h3 style="margin: 0 0 1rem 0; font-size: 1rem; font-weight: 600;">Preview em Tempo Real</h3>
            <div class="preview-container" style="position: relative; background: #000; border-radius: 0.5rem; overflow: hidden; aspect-ratio: 9/16;">
              <video id="preview-video" controls style="width: 100%; height: 100%; object-fit: contain;"></video>
              <canvas id="preview-canvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></canvas>
            </div>
            <div class="timeline-controls" style="margin-top: 1rem;">
              <input type="range" id="timeline-slider" min="0" max="100" value="0" class="timeline-slider" style="width: 100%;">
              <div class="timeline-info" style="display: flex; justify-content: space-between; margin-top: 0.5rem; font-size: 0.875rem; color: var(--text-secondary);">
                <span id="current-time">00:00</span>
                <span id="total-time">00:00</span>
              </div>
            </div>
          </div>

          <!-- Editor -->
          <div class="editor-panel" style="background: var(--bg-secondary); padding: 1rem; border-radius: 0.75rem; border: 1px solid var(--border);">
            <div class="tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border);">
              <button class="tab active" data-tab="captions" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 2px solid var(--primary); color: var(--primary); font-weight: 600; cursor: pointer;">Legendas</button>
              <button class="tab" data-tab="style" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); cursor: pointer;">Estilo Avançado</button>
            </div>

            <!-- Tab: Legendas -->
            <div id="tab-captions" class="tab-content active">
              <div class="captions-list" id="captions-list">
                <p class="empty-state">Carregando legendas...</p>
              </div>
            </div>

            <!-- Tab: Estilo Avançado -->
            <div id="tab-style" class="tab-content">
              <div class="form-group" style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Posição</label>
                <select id="style-position" class="form-control" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 0.5rem;">
                  <option value="bottom" selected>Inferior</option>
                  <option value="center">Centro</option>
                  <option value="top">Superior</option>
                </select>
              </div>

              <div class="form-group" style="margin-bottom: 1rem;">
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                  <input type="checkbox" id="style-background-enabled" checked>
                  <span>Fundo da Legenda</span>
                </label>
                <div id="background-options" class="sub-options" style="margin-top: 0.5rem; margin-left: 1.5rem; display: flex; gap: 0.5rem; align-items: center;">
                  <input type="color" id="style-background-color" value="#000000" style="width: 60px; height: 40px; border: 1px solid var(--border); border-radius: 0.5rem; cursor: pointer;">
                  <input type="range" id="style-background-opacity" min="0" max="1" step="0.1" value="0.6" style="flex: 1;">
                  <span id="background-opacity-value" style="min-width: 50px; font-weight: 600;">60%</span>
                </div>
              </div>

              <div class="form-group" style="margin-bottom: 1rem;">
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                  <input type="checkbox" id="style-shadow" checked>
                  <span>Sombra</span>
                </label>
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
      console.log('[CAPTIONS] Carregando vídeo para preview...');
      
      // Tentar obter estado do vídeo
      const stateResponse = await fetch(`${this.apiBase}/api/download/state/${this.videoId}`);
      const stateData = await stateResponse.json();
      
      console.log('[CAPTIONS] Estado do vídeo:', stateData);
      
      // Usar playableUrl se disponível, senão construir URL padrão
      let videoUrl = null;
      
      if (stateData.playableUrl) {
        videoUrl = `${this.apiBase}${stateData.playableUrl}`;
      } else if (stateData.success && stateData.ready) {
        // Construir URL padrão
        videoUrl = `${this.apiBase}/api/youtube/play/${this.videoId}`;
      } else {
        // Tentar URL padrão mesmo sem estado
        videoUrl = `${this.apiBase}/api/youtube/play/${this.videoId}`;
      }
      
      console.log('[CAPTIONS] URL do vídeo:', videoUrl);
      
      // Carregar vídeo
      this.videoElement.src = videoUrl;
      this.videoElement.load();
      
      // Aguardar metadata para garantir que carregou
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout ao carregar vídeo'));
        }, 10000);
        
        this.videoElement.addEventListener('loadedmetadata', () => {
          clearTimeout(timeout);
          console.log('[CAPTIONS] ✅ Vídeo carregado com sucesso');
          console.log('[CAPTIONS] Duração:', this.videoElement.duration);
          console.log('[CAPTIONS] Dimensões:', this.videoElement.videoWidth, 'x', this.videoElement.videoHeight);
          resolve();
        }, { once: true });
        
        this.videoElement.addEventListener('error', (e) => {
          clearTimeout(timeout);
          console.error('[CAPTIONS] Erro ao carregar vídeo:', e);
          console.error('[CAPTIONS] URL tentada:', videoUrl);
          reject(new Error(`Erro ao carregar vídeo: ${e.message || 'Erro desconhecido'}`));
        }, { once: true });
      });
    } catch (error) {
      console.error('[CAPTIONS] Erro ao carregar vídeo:', error);
      // Tentar URL padrão como fallback
      try {
        const fallbackUrl = `${this.apiBase}/api/youtube/play/${this.videoId}`;
        console.log('[CAPTIONS] Tentando URL fallback:', fallbackUrl);
        this.videoElement.src = fallbackUrl;
        this.videoElement.load();
      } catch (fallbackError) {
        console.error('[CAPTIONS] Erro no fallback:', fallbackError);
      }
    }
  }

  async loadCaptions() {
    try {
      const url = `${this.apiBase}/api/captions/${this.videoId}`;
      const response = await fetch(url);
      
      // Verificar se é JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('[CAPTIONS] Nenhuma legenda encontrada ou resposta inválida');
        // Mostrar estado vazio
        const listContainer = document.getElementById('captions-list');
        if (listContainer) {
          listContainer.innerHTML = '<p class="empty-state">Nenhuma legenda encontrada. Clique em "Gerar Legendas (IA)" para criar legendas automaticamente.</p>';
        }
        return;
      }

      const data = await response.json();
      
      if (data.success && data.captions && data.captions.length > 0) {
        this.captions = data.captions;
        this.renderCaptionsList();
        this.updatePreview();
      } else {
        // Mostrar estado vazio
        const listContainer = document.getElementById('captions-list');
        if (listContainer) {
          listContainer.innerHTML = '<p class="empty-state">Nenhuma legenda encontrada. Clique em "Gerar Legendas (IA)" para criar legendas automaticamente.</p>';
        }
      }
    } catch (error) {
      console.warn('[CAPTIONS] Erro ao carregar legendas (pode não existir ainda):', error.message);
      // Mostrar estado vazio em caso de erro
      const listContainer = document.getElementById('captions-list');
      if (listContainer) {
        listContainer.innerHTML = '<p class="empty-state">Nenhuma legenda encontrada. Clique em "Gerar Legendas (IA)" para criar legendas automaticamente.</p>';
      }
    }
  }

  renderCaptionsList() {
    const listContainer = document.getElementById('captions-list');
    if (!listContainer) return;

    if (!this.captions || this.captions.length === 0) {
      listContainer.innerHTML = '<p class="empty-state">Nenhuma legenda encontrada. Clique em "Gerar Legendas (IA)" para criar legendas automaticamente.</p>';
      return;
    }

    listContainer.innerHTML = '';
    
    this.captions.forEach((caption, index) => {
      const captionItem = document.createElement('div');
      captionItem.className = 'caption-item';
      captionItem.innerHTML = `
        <div class="caption-header">
          <span class="caption-time">${this.formatTime(caption.start)} - ${this.formatTime(caption.end)}</span>
          <button class="btn-remove-caption" onclick="editor.removeCaption(${index})">×</button>
        </div>
        <textarea class="caption-text" data-index="${index}" rows="2">${caption.text || (caption.lines ? caption.lines.join(' ') : '')}</textarea>
        <div class="caption-controls">
          <input type="number" class="caption-start" data-index="${index}" value="${caption.start}" step="0.1" min="0">
          <input type="number" class="caption-end" data-index="${index}" value="${caption.end}" step="0.1" min="0">
        </div>
      `;
      
      // Adicionar listeners para edição em tempo real
      const textarea = captionItem.querySelector('.caption-text');
      const startInput = captionItem.querySelector('.caption-start');
      const endInput = captionItem.querySelector('.caption-end');
      
      textarea.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index);
        this.captions[idx].text = e.target.value;
        // Atualizar linhas também
        this.captions[idx].lines = e.target.value.split('\n').filter(l => l.trim());
        this.updatePreview(); // Preview em tempo real
      });
      
      startInput.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index);
        this.captions[idx].start = parseFloat(e.target.value);
        this.updatePreview(); // Preview em tempo real
      });
      
      endInput.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index);
        this.captions[idx].end = parseFloat(e.target.value);
        this.updatePreview(); // Preview em tempo real
      });
      
      listContainer.appendChild(captionItem);
    });
  }

  removeCaption(index) {
    if (confirm('Remover esta legenda?')) {
      this.captions.splice(index, 1);
      this.renderCaptionsList();
      this.updatePreview();
    }
  }

  async loadPresets() {
    try {
      const url = `${this.apiBase}/api/captions/presets/list`;
      const response = await fetch(url);
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('[CAPTIONS] Erro ao carregar presets: resposta não é JSON');
        return;
      }

      const data = await response.json();
      
      if (data.success) {
        this.renderPresets(data.captions, data.headlines);
      }
    } catch (error) {
      console.error('[CAPTIONS] Erro ao carregar presets:', error);
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
        const tabContent = document.getElementById(`tab-${tabName}`);
        if (tabContent) {
          tabContent.classList.add('active');
        }
        
        if (tabName === 'presets') {
          this.loadPresets();
        }
      });
    });

    // Controles de estilo (atualizar preview em tempo real)
    const styleFont = document.getElementById('style-font');
    const styleFontSize = document.getElementById('style-fontSize');
    const styleColor = document.getElementById('style-color');
    const styleStrokeColor = document.getElementById('style-strokeColor');
    const styleStrokeWidth = document.getElementById('style-strokeWidth');
    const stylePosition = document.getElementById('style-position');
    const stylePreviewText = document.getElementById('style-preview-text');
    
    // Função helper para converter hex para rgba
    const hexToRgba = (hex, opacity) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };
    
    const updateStylePreview = () => {
      if (stylePreviewText) {
        const font = styleFont?.value || 'Inter';
        const fontSize = parseInt(styleFontSize?.value || 64);
        const color = styleColor?.value || '#FFFFFF';
        const strokeColor = styleStrokeColor?.value || '#000000';
        const strokeWidth = parseInt(styleStrokeWidth?.value || 2);
        const backgroundEnabled = document.getElementById('style-background-enabled')?.checked ?? true;
        const backgroundColor = document.getElementById('style-background-color')?.value || '#000000';
        const backgroundOpacity = parseFloat(document.getElementById('style-background-opacity')?.value || 0.6);
        const shadowEnabled = document.getElementById('style-shadow')?.checked ?? true;
        
        // Aplicar estilo de fonte
        stylePreviewText.style.fontFamily = font;
        stylePreviewText.style.fontSize = `${fontSize}px`;
        stylePreviewText.style.color = color;
        stylePreviewText.style.fontWeight = '600';
        
        // Aplicar contorno (stroke)
        if (strokeWidth > 0) {
          // Criar múltiplas sombras para simular stroke
          const shadows = [];
          for (let i = -strokeWidth; i <= strokeWidth; i++) {
            for (let j = -strokeWidth; j <= strokeWidth; j++) {
              if (Math.sqrt(i*i + j*j) <= strokeWidth) {
                shadows.push(`${i}px ${j}px 0 ${strokeColor}`);
              }
            }
          }
          stylePreviewText.style.textShadow = shadows.join(', ');
        } else {
          stylePreviewText.style.textShadow = 'none';
        }
        
        // Aplicar sombra adicional se habilitada
        if (shadowEnabled && strokeWidth > 0) {
          const existingShadow = stylePreviewText.style.textShadow;
          stylePreviewText.style.textShadow = `${existingShadow}, 0 4px 8px rgba(0, 0, 0, 0.5)`;
        }
        
        // Aplicar background se habilitado
        const previewBackground = document.getElementById('style-preview-background');
        if (previewBackground) {
          if (backgroundEnabled) {
            const rgba = hexToRgba(backgroundColor, backgroundOpacity);
            previewBackground.style.background = rgba;
            previewBackground.style.display = 'block';
          } else {
            previewBackground.style.display = 'none';
          }
        }
      }
    };
    
    if (styleFont) {
      styleFont.addEventListener('change', (e) => {
        this.style.font = e.target.value;
        updateStylePreview();
        this.updatePreview();
      });
    }

    if (styleFontSize) {
      styleFontSize.addEventListener('input', (e) => {
        this.style.fontSize = parseInt(e.target.value);
        const fontSizeValue = document.getElementById('fontSize-value');
        if (fontSizeValue) fontSizeValue.textContent = `${this.style.fontSize}px`;
        updateStylePreview();
        this.updatePreview();
      });
    }

    if (styleColor) {
      styleColor.addEventListener('input', (e) => {
        this.style.color = e.target.value;
        updateStylePreview();
        this.updatePreview();
      });
    }

    if (styleStrokeWidth) {
      styleStrokeWidth.addEventListener('input', (e) => {
        this.style.strokeWidth = parseInt(e.target.value);
        const strokeWidthValue = document.getElementById('strokeWidth-value');
        if (strokeWidthValue) strokeWidthValue.textContent = `${this.style.strokeWidth}px`;
        updateStylePreview();
        this.updatePreview();
      });
    }
    
    if (styleStrokeColor) {
      styleStrokeColor.addEventListener('input', (e) => {
        this.style.strokeColor = e.target.value;
        updateStylePreview();
        this.updatePreview();
      });
    }
    
    if (stylePosition) {
      stylePosition.addEventListener('change', (e) => {
        this.style.position = e.target.value;
        this.updatePreview();
      });
    }
    
    // Atualizar preview inicial
    updateStylePreview();

    const styleBackgroundEnabled = document.getElementById('style-background-enabled');
    if (styleBackgroundEnabled) {
      styleBackgroundEnabled.addEventListener('change', (e) => {
        this.style.background.enabled = e.target.checked;
        const backgroundOptions = document.getElementById('background-options');
        if (backgroundOptions) {
          backgroundOptions.style.display = e.target.checked ? 'flex' : 'none';
        }
        updateStylePreview();
        this.updatePreview();
      });
    }
    
    const styleBackgroundColor = document.getElementById('style-background-color');
    const styleBackgroundOpacity = document.getElementById('style-background-opacity');
    if (styleBackgroundColor) {
      styleBackgroundColor.addEventListener('input', (e) => {
        this.style.background.color = e.target.value;
        updateStylePreview();
        this.updatePreview();
      });
    }
    if (styleBackgroundOpacity) {
      styleBackgroundOpacity.addEventListener('input', (e) => {
        this.style.background.opacity = parseFloat(e.target.value);
        const opacityValue = document.getElementById('background-opacity-value');
        if (opacityValue) opacityValue.textContent = `${Math.round(this.style.background.opacity * 100)}%`;
        updateStylePreview();
        this.updatePreview();
      });
    }
    
    const styleShadow = document.getElementById('style-shadow');
    if (styleShadow) {
      styleShadow.addEventListener('change', (e) => {
        this.style.shadow = e.target.checked;
        updateStylePreview();
        this.updatePreview();
      });
    }

    // Headline (se existir)
    const headlineEnabled = document.getElementById('headline-enabled');
    if (headlineEnabled) {
      headlineEnabled.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        const headlineOptions = document.getElementById('headline-options');
        if (headlineOptions) {
          headlineOptions.style.display = enabled ? 'block' : 'none';
        }
        if (!enabled) {
          this.headline = null;
        }
        this.updatePreview();
      });
    }

    const headlineText = document.getElementById('headline-text');
    if (headlineText) {
      headlineText.addEventListener('input', (e) => {
        if (!this.headline) {
          this.headline = {};
        }
        this.headline.text = e.target.value;
        this.updatePreview();
      });
    }

    // Botões de ação
    const btnGenerate = document.getElementById('btn-generate-captions');
    if (btnGenerate) {
      btnGenerate.addEventListener('click', () => {
        this.generateCaptions();
      });
    }

    const btnSave = document.getElementById('btn-save-captions');
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        this.saveCaptions();
      });
    }

    const btnRender = document.getElementById('btn-render-video');
    if (btnRender) {
      btnRender.addEventListener('click', () => {
        this.renderVideo();
      });
    }

    // Timeline - configurar após vídeo carregar
    const setupTimeline = () => {
      if (this.videoElement && this.videoElement.duration) {
        const slider = document.getElementById('timeline-slider');
        if (slider) {
          slider.max = this.videoElement.duration;
          const totalTimeEl = document.getElementById('total-time');
          if (totalTimeEl) {
            totalTimeEl.textContent = this.formatTime(this.videoElement.duration);
          }
        }
      }
    };

    // Redimensionar canvas quando vídeo carregar
    const resizeCanvas = () => {
      if (this.canvas && this.videoElement) {
        // Usar dimensões do container para manter proporção
        const container = this.videoElement.parentElement;
        if (container) {
          const containerRect = container.getBoundingClientRect();
          // Manter aspect ratio 9:16
          const aspectRatio = 9 / 16;
          let canvasWidth = containerRect.width;
          let canvasHeight = canvasWidth / aspectRatio;
          
          if (canvasHeight > containerRect.height) {
            canvasHeight = containerRect.height;
            canvasWidth = canvasHeight * aspectRatio;
          }
          
          this.canvas.width = canvasWidth;
          this.canvas.height = canvasHeight;
          this.canvas.style.width = canvasWidth + 'px';
          this.canvas.style.height = canvasHeight + 'px';
          
          console.log('[CAPTIONS] Canvas redimensionado:', canvasWidth, 'x', canvasHeight);
        }
      }
    };

    if (this.videoElement) {
      this.videoElement.addEventListener('loadedmetadata', () => {
        setupTimeline();
        resizeCanvas();
        // Iniciar preview loop
        this.startPreviewLoop();
      });

      this.videoElement.addEventListener('timeupdate', () => {
        const slider = document.getElementById('timeline-slider');
        if (slider && this.videoElement.duration) {
          slider.value = this.videoElement.currentTime;
        }
        const currentTimeEl = document.getElementById('current-time');
        if (currentTimeEl) {
          currentTimeEl.textContent = this.formatTime(this.videoElement.currentTime);
        }
        // Preview será atualizado pelo loop
      });
    }

    // Redimensionar canvas quando container redimensionar
    window.addEventListener('resize', () => {
      resizeCanvas();
    });

    const slider = document.getElementById('timeline-slider');
    if (slider && this.videoElement) {
      slider.addEventListener('input', (e) => {
        if (this.videoElement) {
          this.videoElement.currentTime = parseFloat(e.target.value);
          this.updatePreview(); // Atualizar imediatamente ao arrastar
        }
      });
    }
  }

  startPreviewLoop() {
    // Loop de preview em tempo real (60fps)
    if (this.previewLoopRunning) return;
    
    this.previewLoopRunning = true;
    let lastTime = 0;
    const updateLoop = (currentTime) => {
      if (!this.previewLoopRunning) return;
      
      // Throttle para ~30fps (melhor performance)
      if (currentTime - lastTime >= 33) {
        this.updatePreview();
        lastTime = currentTime;
      }
      
      requestAnimationFrame(updateLoop);
    };
    
    requestAnimationFrame(updateLoop);
  }

  stopPreviewLoop() {
    this.previewLoopRunning = false;
  }

  updatePreview() {
    if (!this.videoElement || !this.canvas) return;
    if (this.videoElement.readyState < 2) return; // Aguardar ter dados suficientes

    const video = this.videoElement;
    const canvas = this.canvas;
    
    // Desenhar frame atual do vídeo no canvas
    try {
      // Limpar canvas
      this.ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Desenhar vídeo mantendo aspect ratio
      const videoAspect = video.videoWidth / video.videoHeight;
      const canvasAspect = canvas.width / canvas.height;
      
      let drawWidth = canvas.width;
      let drawHeight = canvas.height;
      let drawX = 0;
      let drawY = 0;
      
      if (videoAspect > canvasAspect) {
        // Vídeo mais largo - ajustar altura
        drawHeight = canvas.width / videoAspect;
        drawY = (canvas.height - drawHeight) / 2;
      } else {
        // Vídeo mais alto - ajustar largura
        drawWidth = canvas.height * videoAspect;
        drawX = (canvas.width - drawWidth) / 2;
      }
      
      this.ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
    } catch (e) {
      // Vídeo pode não estar pronto ainda
      console.warn('[CAPTIONS] Erro ao desenhar vídeo no canvas:', e);
      return;
    }

    // Desenhar legendas
    const currentTime = video.currentTime || 0;
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

    // Configurar fonte (usar valores atuais dos inputs)
    const font = document.getElementById('style-font')?.value || style.font || 'Inter';
    const fontSize = parseInt(document.getElementById('style-fontSize')?.value || style.fontSize || 64);
    const color = document.getElementById('style-color')?.value || style.color || '#FFFFFF';
    const strokeColor = document.getElementById('style-strokeColor')?.value || style.strokeColor || '#000000';
    const strokeWidth = parseInt(document.getElementById('style-strokeWidth')?.value || style.strokeWidth || 2);
    const position = document.getElementById('style-position')?.value || style.position || 'bottom';
    
    ctx.font = `${fontSize}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // Posição
    const x = this.canvas.width / 2;
    let y = this.canvas.height - 100; // bottom
    if (position === 'center') {
      y = this.canvas.height / 2;
    } else if (position === 'top') {
      y = 100;
    }

    // Fundo
    const backgroundEnabled = document.getElementById('style-background-enabled')?.checked ?? (style.background?.enabled ?? false);
    if (backgroundEnabled) {
      const text = caption.lines && caption.lines.length > 0 
        ? caption.lines.join('\n') 
        : (caption.text || '');
      const metrics = ctx.measureText(text);
      const padding = style.background?.padding || 10;
      const bgColor = document.getElementById('style-background-color')?.value || style.background?.color || '#000000';
      const bgOpacity = parseFloat(document.getElementById('style-background-opacity')?.value || style.background?.opacity || 0.6);
      
      ctx.fillStyle = bgColor + Math.round(bgOpacity * 255).toString(16).padStart(2, '0');
      ctx.fillRect(
        x - metrics.width / 2 - padding,
        y - fontSize * (caption.lines?.length || 1) - padding,
        metrics.width + padding * 2,
        fontSize * (caption.lines?.length || 1) + padding * 2
      );
    }

    // Contorno
    if (strokeWidth > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
    }

    // Sombra
    const shadowEnabled = document.getElementById('style-shadow')?.checked ?? style.shadow;
    if (shadowEnabled) {
      ctx.shadowColor = style.shadowColor || '#000000';
      ctx.shadowBlur = style.shadowBlur || 3;
      ctx.shadowOffsetX = style.shadowOffsetX || 2;
      ctx.shadowOffsetY = style.shadowOffsetY || 2;
    }

    // Texto
    ctx.fillStyle = color;
    
    if (caption.lines && caption.lines.length > 0) {
      caption.lines.forEach((line, index) => {
        ctx.fillText(line, x, y - (caption.lines.length - index - 1) * fontSize * 1.2);
        if (strokeWidth > 0) {
          ctx.strokeText(line, x, y - (caption.lines.length - index - 1) * fontSize * 1.2);
        }
      });
    } else {
      ctx.fillText(caption.text || '', x, y);
      if (strokeWidth > 0) {
        ctx.strokeText(caption.text || '', x, y);
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
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Gerando com OpenAI...';
      }

      const url = `${this.apiBase}/api/captions/generate`;
      console.log('[CAPTIONS] Gerando legendas:', url, this.videoId);

      // Coletar estilo atual antes de gerar
      const currentStyle = {
        font: document.getElementById('style-font')?.value || this.style.font,
        fontSize: parseInt(document.getElementById('style-fontSize')?.value || this.style.fontSize),
        color: document.getElementById('style-color')?.value || this.style.color,
        strokeColor: document.getElementById('style-strokeColor')?.value || this.style.strokeColor,
        strokeWidth: parseInt(document.getElementById('style-strokeWidth')?.value || this.style.strokeWidth),
        position: document.getElementById('style-position')?.value || this.style.position
      };
      
      // Atualizar estilo interno
      this.style = { ...this.style, ...currentStyle };

      // Obter trimStart e trimEnd do appState global
      // Garantir que appState está disponível globalmente
      if (typeof window !== 'undefined' && !window.appState) {
        window.appState = window.appState || {};
      }
      const trimStart = (window.appState && window.appState.trimStart) || 0;
      const trimEnd = (window.appState && window.appState.trimEnd) || null;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          videoId: this.videoId,
          trimStart: trimStart,
          trimEnd: trimEnd,
          style: currentStyle // Enviar estilo para o backend
        })
      });

      // Verificar se a resposta é JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('[CAPTIONS] Resposta não é JSON:', text.substring(0, 200));
        throw new Error(`Servidor retornou HTML em vez de JSON. Status: ${response.status}. Verifique se a rota /api/captions/generate existe.`);
      }

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `Erro HTTP ${response.status}`);
      }
      
      if (data.success) {
        this.captions = data.captions || [];
        this.renderCaptionsList();
        this.updatePreview();
        // Iniciar preview loop se ainda não estiver rodando
        if (!this.previewLoopRunning) {
          this.startPreviewLoop();
        }
        
        // Mostrar botão de salvar
        const btnSave = document.getElementById('btn-save-captions');
        if (btnSave) {
          btnSave.style.display = 'block';
        }
        
        if (btn) {
          btn.textContent = '✓ Legendas Geradas!';
          btn.style.background = 'var(--success)';
          setTimeout(() => {
            btn.textContent = '🤖 Gerar Legendas (OpenAI)';
            btn.style.background = 'var(--primary)';
          }, 3000);
        }
        
        // Salvar legendas automaticamente após gerar
        try {
          await this.saveCaptions();
          console.log('[CAPTIONS] Legendas salvas automaticamente');
        } catch (saveError) {
          console.error('[CAPTIONS] Erro ao salvar legendas automaticamente:', saveError);
          // Não bloquear o fluxo se houver erro ao salvar
        }
        
        // AVANÇAR AUTOMATICAMENTE para etapa 4 (Configurações) após gerar legendas
        if (window.continueToConfigurations) {
          setTimeout(() => {
            window.continueToConfigurations();
            // Scroll será feito pela função continueToConfigurations
          }, 1000);
        }
      } else {
        throw new Error(data.error || 'Erro desconhecido ao gerar legendas');
      }
    } catch (error) {
      console.error('[CAPTIONS] Erro:', error);
      alert('Erro ao gerar legendas: ' + error.message);
    } finally {
      const btn = document.getElementById('btn-generate-captions');
      if (btn) {
        btn.disabled = false;
        if (btn.textContent === 'Gerando...') {
          btn.textContent = 'Gerar Legendas (IA)';
        }
      }
    }
  }

  async saveCaptions() {
    try {
      // Coletar estilo atual dos inputs
      const currentStyle = {
        font: document.getElementById('style-font')?.value || this.style.font,
        fontSize: parseInt(document.getElementById('style-fontSize')?.value || this.style.fontSize),
        color: document.getElementById('style-color')?.value || this.style.color,
        strokeColor: document.getElementById('style-strokeColor')?.value || this.style.strokeColor,
        strokeWidth: parseInt(document.getElementById('style-strokeWidth')?.value || this.style.strokeWidth),
        position: document.getElementById('style-position')?.value || this.style.position,
        shadow: document.getElementById('style-shadow')?.checked ?? this.style.shadow,
        background: {
          enabled: document.getElementById('style-background-enabled')?.checked ?? (this.style.background?.enabled ?? false),
          color: document.getElementById('style-background-color')?.value || this.style.background?.color || '#000000',
          opacity: parseFloat(document.getElementById('style-background-opacity')?.value || this.style.background?.opacity || 0.6)
        }
      };
      
      // Atualizar estilo interno
      this.style = { ...this.style, ...currentStyle };
      
      const url = `${this.apiBase}/api/captions/update`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: this.videoId,
          captions: this.captions,
          style: currentStyle // Incluir estilo nas legendas salvas
        })
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Servidor retornou HTML. Status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        return Promise.resolve();
      } else {
        throw new Error(data.error || 'Erro ao salvar legendas');
      }
    } catch (error) {
      throw error;
    }
  }

  async renderVideo() {
    try {
      const btn = document.getElementById('btn-render-video');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Renderizando...';
      }

      // Coletar estilo atual
      const style = { ...this.style };
      const headline = this.headline && this.headline.text ? {
        text: this.headline.text,
        startTime: 0,
        endTime: 5
      } : null;

      const url = `${this.apiBase}/api/captions/render`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: this.videoId,
          style,
          headline
        })
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Servidor retornou HTML. Status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        alert('Vídeo renderizado! Download disponível.');
        if (data.downloadUrl) {
          window.open(data.downloadUrl, '_blank');
        }
      } else {
        throw new Error(data.error || 'Erro ao renderizar');
      }
    } catch (error) {
      console.error('[CAPTIONS] Erro ao renderizar:', error);
      alert('Erro ao renderizar: ' + error.message);
    } finally {
      const btn = document.getElementById('btn-render-video');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Renderizar Vídeo';
      }
    }
  }

  applyPreset(presetKey) {
    // Carregar preset e aplicar
    const url = `${this.apiBase}/api/captions/presets/list`;
    fetch(url)
      .then(r => {
        const contentType = r.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Resposta não é JSON');
        }
        return r.json();
      })
      .then(data => {
        if (data.success && data.captions && data.captions[presetKey]) {
          this.style = { ...data.captions[presetKey] };
          this.updateStyleInputs();
          this.updatePreview();
        }
      })
      .catch(error => {
        console.error('[CAPTIONS] Erro ao aplicar preset:', error);
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
