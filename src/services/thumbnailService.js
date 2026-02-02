/**
 * THUMBNAIL SERVICE - Gerador de thumbnails 9x16 (1080x1920)
 * Extração de frames com FFmpeg e composição com Sharp.
 */

import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FONT_PATH = path.join(__dirname, '../../thumb/Montserrat-Black.ttf');
let fontBase64 = null;

function getFontBase64() {
  if (fontBase64) return fontBase64;
  if (fs.existsSync(FONT_PATH)) {
    fontBase64 = fs.readFileSync(FONT_PATH).toString('base64');
    return fontBase64;
  }
  return null;
}

const THUMB_WIDTH = 1080;
const THUMB_HEIGHT = 1920;
const PREVIEW_WIDTH = 270;
const PREVIEW_HEIGHT = 480;
const FRAMES_DIR = process.env.NODE_ENV === 'production' ? '/tmp/thumb_frames' : path.join(__dirname, '../../tmp/thumb_frames');

// Token -> basePath (limpar após 1h)
const frameTokens = new Map();
const TOKEN_TTL = 60 * 60 * 1000;

function ensureFramesDir() {
  if (!fs.existsSync(FRAMES_DIR)) {
    fs.mkdirSync(FRAMES_DIR, { recursive: true });
  }
}

/**
 * Extrair N frames do vídeo (preview size) e salvar em pasta temporária.
 * @param {string} videoPath - Caminho do vídeo
 * @param {object} options - { maxFrames: 8 }
 * @returns {Promise<{ frameToken: string, count: number }>}
 */
export async function extractFrames(videoPath, options = {}) {
  const maxFrames = options.maxFrames || 8;
  ensureFramesDir();
  const token = `tf_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const outDir = path.join(FRAMES_DIR, token);
  fs.mkdirSync(outDir, { recursive: true });

  const durationSec = await new Promise((res, rej) => {
    ffmpeg.ffprobe(videoPath, (err, meta) => {
      if (err) return res(60);
      res(Math.min(meta?.format?.duration || 60, 600));
    });
  });

  const interval = durationSec / (maxFrames + 1);
  const scaleFilter = `scale=${PREVIEW_WIDTH}:${PREVIEW_HEIGHT}:force_original_aspect_ratio=decrease,pad=${PREVIEW_WIDTH}:${PREVIEW_HEIGHT}:(ow-iw)/2:(oh-ih)/2`;

  for (let i = 0; i < maxFrames; i++) {
    const t = interval * (i + 1);
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(t)
        .outputOptions(['-vframes', '1', '-vf', scaleFilter])
        .output(path.join(outDir, `frame_${i}.png`))
        .on('error', reject)
        .on('end', resolve)
        .run();
    });
  }

  frameTokens.set(token, { outDir, createdAt: Date.now() });
  setTimeout(() => {
    try {
      if (frameTokens.get(token)) {
        frameTokens.delete(token);
        try {
          fs.rmSync(outDir, { recursive: true });
        } catch (_) {}
      }
    } catch (_) {}
  }, TOKEN_TTL);

  return { frameToken: token, count: maxFrames };
}

/**
 * Obter caminho de um frame por token e índice (para rota GET).
 */
export function getFramePath(frameToken, index) {
  const entry = frameTokens.get(frameToken);
  if (!entry) return null;
  const p = path.join(entry.outDir, `frame_${index}.png`);
  return fs.existsSync(p) ? p : null;
}

/**
 * Extrair um único frame em resolução full (1080x1920) para gerar thumbnail final.
 */
function extractSingleFrame(videoPath, timeSeconds) {
  return new Promise((resolve, reject) => {
    const outPath = path.join(FRAMES_DIR, `single_${Date.now()}.png`);
    ensureFramesDir();
    ffmpeg(videoPath)
      .seekInput(timeSeconds)
      .outputOptions([
        '-vframes', '1',
        '-vf', `scale=${THUMB_WIDTH}:${THUMB_HEIGHT}:force_original_aspect_ratio=increase,crop=${THUMB_WIDTH}:${THUMB_HEIGHT}`
      ])
      .output(outPath)
      .on('error', reject)
      .on('end', () => {
        resolve(outPath);
      })
      .run();
  });
}

const COLOR_NAMES = {
  red: '#FF0000',
  vermelho: '#FF0000',
  blue: '#0000FF',
  azul: '#0000FF',
  white: '#FFFFFF',
  branco: '#FFFFFF',
  black: '#000000',
  preto: '#000000',
  yellow: '#FFEB3B',
  amarelo: '#FFEB3B',
  green: '#00E676',
  verde: '#00E676',
  orange: '#FF5722',
  laranja: '#FF5722',
  pink: '#E91E63',
  rosa: '#E91E63'
};

function parseColorToken(token) {
  const t = String(token).trim().toLowerCase();
  if (COLOR_NAMES[t]) return COLOR_NAMES[t];
  if (/^#[0-9a-f]{6}$/i.test(t)) return t;
  if (/^#[0-9a-f]{3}$/i.test(t)) return t;
  return null;
}

/** Parse uma linha com markup [red], [blue], [#hex] -> array de { text, color } */
function parseLineSegments(lineStr, defaultColor) {
  const segments = [];
  let currentColor = defaultColor;
  let i = 0;
  while (i < lineStr.length) {
    if (lineStr[i] === '[') {
      const end = lineStr.indexOf(']', i);
      if (end === -1) {
        segments.push({ text: lineStr[i], color: currentColor });
        i++;
        continue;
      }
      const token = lineStr.slice(i + 1, end);
      const parsed = parseColorToken(token);
      if (parsed) currentColor = parsed;
      i = end + 1;
      continue;
    }
    let j = i;
    while (j < lineStr.length && lineStr[j] !== '[') j++;
    const text = lineStr.slice(i, j);
    if (text) segments.push({ text, color: currentColor });
    i = j;
  }
  if (segments.length === 0 && lineStr.trim()) segments.push({ text: lineStr, color: defaultColor });
  return segments;
}

/** Quebra título em linhas e parse de cores por linha */
function parseTitleWithMarkup(titleStr, defaultColor) {
  const defaultHex = (c) => (c && String(c).trim()) ? (String(c).trim().startsWith('#') ? String(c).trim() : `#${String(c).trim()}`) : '#FFFFFF';
  const def = defaultHex(defaultColor) || '#FFFFFF';
  const lines = String(titleStr || '').split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.map((line) => parseLineSegments(line, def));
}

const TEMPLATES = {
  saude: { primary: '#00C853', secondary: '#00BFA5', text: '#FFFFFF', font: 'Impact' },
  fitness: { primary: '#FF5722', secondary: '#FF9800', text: '#FFFFFF', font: 'Impact' },
  negocios: { primary: '#1976D2', secondary: '#FFD700', text: '#FFFFFF', font: 'Impact' },
  educacao: { primary: '#7B1FA2', secondary: '#FFC107', text: '#FFFFFF', font: 'Impact' },
  tecnologia: { primary: '#0288D1', secondary: '#00BCD4', text: '#FFFFFF', font: 'Impact' },
  culinaria: { primary: '#D32F2F', secondary: '#FFEB3B', text: '#FFFFFF', font: 'Impact' },
  entretenimento: { primary: '#E91E63', secondary: '#9C27B0', text: '#FFFFFF', font: 'Impact' },
  generico: { primary: '#455A64', secondary: '#78909C', text: '#FFFFFF', font: 'Impact' }
};

// Posições do título: top, center, bottom -> margem superior (px) para o bloco de texto
const TITLE_POSITION_MAP = {
  top: 120,
  center: null, // null = centralizar verticalmente
  bottom: null  // null = calcular como bottom
};

// Tamanhos de fonte (preset -> px)
const FONT_SIZE_MAP = {
  xs: 36, small: 48, medium: 72, large: 96, xl: 120
};

// Tamanhos de tarja: 1=~5%, 2=~15%, 3=~25%, 4=50% da tela (sem texto)
const TARJA_SIZE_PERCENT = { 1: 0.05, 2: 0.15, 3: 0.25, 4: 0.5 };

function resolveFontSize(size) {
  if (size == null || size === '') return 72;
  const n = Number(size);
  if (!Number.isNaN(n)) return Math.min(120, Math.max(28, n));
  const preset = String(size).toLowerCase();
  return FONT_SIZE_MAP[preset] ?? 72;
}

function resolveTarjaHeight(sizeNum) {
  const n = Number(sizeNum);
  if (n < 1 || n > 4) return 0;
  const pct = TARJA_SIZE_PERCENT[n] ?? 0.05;
  return Math.round(THUMB_HEIGHT * pct);
}

/**
 * Gerar thumbnail final: frame + título + template + tarjas (sem texto) + posição.
 * @param {object} options - { videoPath, frameTimeSec, title, template, contrast, tarjaSuperiorSize, tarjaInferiorSize, tarjaSuperiorColor, tarjaInferiorColor, textColor, strokeColor, fontSize, titlePosition }
 * @returns {Promise<Buffer>} PNG ou JPEG
 */
export async function generateThumbnail(options) {
  const {
    videoPath,
    frameTimeSec = 1,
    title = '',
    template = 'generico',
    contrast = 0.5,
    tarjaSuperiorSize = null,
    tarjaInferiorSize = null,
    tarjaCentralSize = null,
    tarjaSuperiorColor = null,
    tarjaInferiorColor = null,
    tarjaCentralColor = null,
    textColor = '#FFFFFF',
    strokeColor = '#000000',
    fontSize = 72,
    titlePosition = 'center'
  } = options;

  const framePath = await extractSingleFrame(videoPath, frameTimeSec);
  try {
    let img = sharp(framePath).resize(THUMB_WIDTH, THUMB_HEIGHT, { fit: 'cover' });
    if (contrast > 0) {
      const m = 1 + contrast * 0.5;
      const b = -(128 * m) + 128;
      img = sharp(await img.linear(m, b).toBuffer());
    }

    const tpl = TEMPLATES[template] || TEMPLATES.generico;
    const composites = [];
    const overlayOpacity = 0.25;
    const overlaySvg = `<svg width="${THUMB_WIDTH}" height="${THUMB_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${tpl.primary}" opacity="${overlayOpacity}"/>
    </svg>`;
    composites.push({ input: Buffer.from(overlaySvg), blend: 'over' });

    const norm = (c) => (c && String(c).trim()) ? (String(c).trim().startsWith('#') ? String(c).trim() : `#${String(c).trim()}`) : null;
    const strokeHex = norm(strokeColor) || '#000000';
    const defaultTextColor = norm(textColor) || '#FFFFFF';
    const safeFontSize = resolveFontSize(fontSize);
    const posKey = String(titlePosition || 'center').toLowerCase();
    const titleTopMargin = TITLE_POSITION_MAP[posKey] !== undefined ? TITLE_POSITION_MAP[posKey] : null;

    // Tarja superior (faixa colorida sem texto; tamanhos 1–4, 4 = metade da tela)
    const tarjaTopH = resolveTarjaHeight(tarjaSuperiorSize);
    if (tarjaTopH > 0) {
      const fillColor = norm(tarjaSuperiorColor) || tpl.primary;
      const tarjaSvg = `<svg width="${THUMB_WIDTH}" height="${tarjaTopH}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${fillColor}" opacity="0.92"/>
      </svg>`;
      composites.push({ input: Buffer.from(tarjaSvg), top: 0, left: 0 });
    }

    // Tarja central (faixa colorida sem texto, verticalmente ao centro)
    const tarjaCenterH = resolveTarjaHeight(tarjaCentralSize);
    if (tarjaCenterH > 0) {
      const fillColor = norm(tarjaCentralColor) || tpl.primary;
      const centerY = Math.round((THUMB_HEIGHT - tarjaCenterH) / 2);
      const tarjaSvg = `<svg width="${THUMB_WIDTH}" height="${tarjaCenterH}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${fillColor}" opacity="0.92"/>
      </svg>`;
      composites.push({ input: Buffer.from(tarjaSvg), top: centerY, left: 0 });
    }

    // Tarja inferior (faixa colorida sem texto)
    const tarjaBottomH = resolveTarjaHeight(tarjaInferiorSize);
    if (tarjaBottomH > 0) {
      const fillColor = norm(tarjaInferiorColor) || tpl.primary;
      const tarjaSvg = `<svg width="${THUMB_WIDTH}" height="${tarjaBottomH}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${fillColor}" opacity="0.92"/>
      </svg>`;
      composites.push({ input: Buffer.from(tarjaSvg), top: THUMB_HEIGHT - tarjaBottomH, left: 0 });
    }

    if (title && String(title).trim()) {
      const linesOfSegments = parseTitleWithMarkup(String(title).slice(0, 500), defaultTextColor);
      if (linesOfSegments.length > 0) {
        const lineHeight = safeFontSize * 1.25;
        const textBlockHeight = Math.min(THUMB_HEIGHT - 120, linesOfSegments.length * lineHeight + 40);
        let textTop;
        // Texto desenhado por último (em cima das tarjas). Posição "topo" = centralizado sobre a tarja superior; "base" = centralizado sobre a tarja inferior.
        if (posKey === 'top') {
          if (tarjaTopH > 0) {
            textTop = Math.round(tarjaTopH / 2 - textBlockHeight / 2);
            textTop = Math.max(0, textTop);
          } else {
            textTop = titleTopMargin ?? 120;
          }
        } else if (posKey === 'bottom') {
          if (tarjaBottomH > 0) {
            textTop = Math.round(THUMB_HEIGHT - tarjaBottomH / 2 - textBlockHeight / 2);
            textTop = Math.min(THUMB_HEIGHT - textBlockHeight, Math.max(0, textTop));
          } else {
            textTop = THUMB_HEIGHT - textBlockHeight - 80;
          }
        } else {
          textTop = Math.round((THUMB_HEIGHT - textBlockHeight) / 2);
        }
        const fontB64 = getFontBase64();
        const fontFace = fontB64
          ? `<defs><style>@font-face { font-family: 'Montserrat'; src: url(data:font/ttf;base64,${fontB64}) format('truetype'); font-weight: 900; }</style></defs>`
          : '';
        const escapeXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const firstLineY = Math.round(textBlockHeight / 2 - (linesOfSegments.length - 1) * lineHeight / 2 + safeFontSize * 0.35);
        const textLines = linesOfSegments.map((segments, lineIndex) => {
          const y = firstLineY + lineIndex * lineHeight;
          const tspans = segments.map((seg) => `<tspan fill="${escapeXml(seg.color)}" stroke="${strokeHex}" stroke-width="4">${escapeXml(seg.text)}</tspan>`).join('');
          return `<text x="540" y="${y}" text-anchor="middle" font-family="Montserrat, Impact, sans-serif" font-size="${safeFontSize}" font-weight="900">${tspans}</text>`;
        }).join('\n');
        const textSvg = `<svg width="${THUMB_WIDTH}" height="${textBlockHeight}" xmlns="http://www.w3.org/2000/svg">
          ${fontFace}
          ${textLines}
        </svg>`;
        composites.push({ input: Buffer.from(textSvg), top: textTop, left: 0 });
      }
    }

    img = img.composite(composites);
    const out = await img.jpeg({ quality: 90 }).toBuffer();
    return out;
  } finally {
    try {
      if (fs.existsSync(framePath)) fs.unlinkSync(framePath);
    } catch (_) {}
  }
}

/**
 * Gerar 2–3 variações para A/B test.
 */
export async function generateVariations(options) {
  const variations = [];
  const templates = [options.template || 'generico', 'fitness', 'negocios'].slice(0, 3);
  for (let i = 0; i < templates.length; i++) {
    const buf = await generateThumbnail({
      ...options,
      template: templates[i]
    });
    variations.push(buf);
  }
  return variations;
}
