// Nichos disponíveis com suas configurações
export const NICHES = {
  podcast: {
    id: 'podcast',
    name: 'Podcast',
    description: 'Conversas, entrevistas e debates',
    retentionVideos: [
      'hydraulic-press',
      'hydraulic-press-1',
      'hydraulic-press-2',
      'hydraulic-press-3',
      'satisfying-loops',
      'timelapse-abstract',
      'mechanical-loop'
    ],
    headlineStyles: ['bold', 'impact', 'modern'],
    fonts: ['Inter', 'Roboto', 'Montserrat']
  },
  educacao: {
    id: 'educacao',
    name: 'Educação',
    description: 'Aulas, tutoriais e conteúdo educacional',
    retentionVideos: [
      'sand-kinetic',
      'slime',
      'satisfying-loops',
      'timelapse-nature'
    ],
    headlineStyles: ['clean', 'academic', 'modern'],
    fonts: ['Roboto', 'Open Sans', 'Lato']
  },
  motivacional: {
    id: 'motivacional',
    name: 'Motivacional',
    description: 'Conteúdo inspirador e de desenvolvimento pessoal',
    retentionVideos: [
      'sunset-timelapse',
      'ocean-waves',
      'satisfying-loops',
      'abstract-flow'
    ],
    headlineStyles: ['bold', 'elegant', 'impact'],
    fonts: ['Montserrat', 'Playfair Display', 'Poppins']
  },
  tech: {
    id: 'tech',
    name: 'Tech',
    description: 'Tecnologia, programação e inovação',
    retentionVideos: [
      'circuit-animation',
      'code-rain',
      'mechanical-loop',
      'abstract-tech'
    ],
    headlineStyles: ['futuristic', 'modern', 'minimal'],
    fonts: ['Roboto Mono', 'Fira Code', 'Inter']
  },
  financeiro: {
    id: 'financeiro',
    name: 'Financeiro',
    description: 'Investimentos, economia e finanças',
    retentionVideos: [
      'gold-particles',
      'satisfying-loops',
      'timelapse-city',
      'abstract-numbers'
    ],
    headlineStyles: ['professional', 'bold', 'clean'],
    fonts: ['Inter', 'Roboto', 'Lato']
  }
};

/**
 * VÍDEOS DE RETENÇÃO
 * 
 * Para adicionar um novo vídeo de retenção:
 * 1. Adicione o metadado abaixo com um ID único
 * 2. Faça upload do arquivo via POST /api/retention/upload com o mesmo ID
 *    ou coloque manualmente o arquivo em retention-library/{id}.mp4
 * 
 * Exemplo:
 * - ID: 'meu-video'
 * - Nome do arquivo: 'meu-video.mp4'
 * - Caminho: retention-library/meu-video.mp4
 */
export const RETENTION_VIDEOS = {
  'hydraulic-press': {
    id: 'hydraulic-press',
    name: 'Prensa Hidráulica',
    tags: ['Alta retenção', 'Hipnótico', 'Seguro para TikTok'],
    description: 'Loop de prensa hidráulica comprimindo objetos'
  },
  'hydraulic-press-1': {
    id: 'hydraulic-press-1',
    name: 'Prensa Hidráulica #1',
    tags: ['Alta retenção', 'Hipnótico', 'Seguro para TikTok'],
    description: 'Vídeo 1 de prensa hidráulica comprimindo objetos',
    source: 'https://drive.google.com/drive/folders/1kdiGFY604ETx4CalQUdc1zhmFomscjne',
    // url: 'https://res.cloudinary.com/seu-account/video/upload/v1234567/hydraulic-press-1.mp4' // ← Adicione a URL aqui após upload
  },
  'hydraulic-press-2': {
    id: 'hydraulic-press-2',
    name: 'Prensa Hidráulica #2',
    tags: ['Alta retenção', 'Hipnótico', 'Seguro para TikTok'],
    description: 'Vídeo 2 de prensa hidráulica comprimindo objetos',
    source: 'https://drive.google.com/drive/folders/1kdiGFY604ETx4CalQUdc1zhmFomscjne',
    // url: 'https://res.cloudinary.com/seu-account/video/upload/v1234567/hydraulic-press-2.mp4' // ← Adicione a URL aqui após upload
  },
  'hydraulic-press-3': {
    id: 'hydraulic-press-3',
    name: 'Prensa Hidráulica #3',
    tags: ['Alta retenção', 'Hipnótico', 'Seguro para TikTok'],
    description: 'Vídeo 3 de prensa hidráulica comprimindo objetos',
    source: 'https://drive.google.com/drive/folders/1kdiGFY604ETx4CalQUdc1zhmFomscjne',
    // url: 'https://res.cloudinary.com/seu-account/video/upload/v1234567/hydraulic-press-3.mp4' // ← Adicione a URL aqui após upload
  },
  'satisfying-loops': {
    id: 'satisfying-loops',
    name: 'Loops Satisfatórios',
    tags: ['Alta retenção', 'Viral', 'Seguro para TikTok'],
    description: 'Vídeos de satisfação visual em loop'
  },
  'sand-kinetic': {
    id: 'sand-kinetic',
    name: 'Areia Cinética',
    tags: ['Hipnótico', 'Alta retenção', 'Seguro para TikTok'],
    description: 'Areia cinética sendo manipulada'
  },
  'slime': {
    id: 'slime',
    name: 'Slime',
    tags: ['Viral', 'Alta retenção', 'Seguro para TikTok'],
    description: 'Slime sendo cortado e esticado'
  },
  'timelapse-abstract': {
    id: 'timelapse-abstract',
    name: 'Timelapse Abstrato',
    tags: ['Hipnótico', 'Alta retenção'],
    description: 'Timelapse de padrões abstratos'
  },
  'mechanical-loop': {
    id: 'mechanical-loop',
    name: 'Loop Mecânico',
    tags: ['Hipnótico', 'Alta retenção'],
    description: 'Máquinas e mecanismos em loop'
  },
  'timelapse-nature': {
    id: 'timelapse-nature',
    name: 'Timelapse Natureza',
    tags: ['Hipnótico', 'Alta retenção'],
    description: 'Timelapse de paisagens naturais'
  },
  'sunset-timelapse': {
    id: 'sunset-timelapse',
    name: 'Pôr do Sol',
    tags: ['Hipnótico', 'Alta retenção'],
    description: 'Timelapse de pôr do sol'
  },
  'ocean-waves': {
    id: 'ocean-waves',
    name: 'Ondas do Mar',
    tags: ['Hipnótico', 'Alta retenção'],
    description: 'Ondas do oceano em loop'
  },
  'abstract-flow': {
    id: 'abstract-flow',
    name: 'Fluxo Abstrato',
    tags: ['Hipnótico', 'Alta retenção'],
    description: 'Padrões de fluxo abstratos'
  },
  'circuit-animation': {
    id: 'circuit-animation',
    name: 'Animação de Circuitos',
    tags: ['Hipnótico', 'Tech', 'Alta retenção'],
    description: 'Animação de circuitos elétricos'
  },
  'code-rain': {
    id: 'code-rain',
    name: 'Chuva de Código',
    tags: ['Hipnótico', 'Tech', 'Alta retenção'],
    description: 'Efeito matrix de código'
  },
  'abstract-tech': {
    id: 'abstract-tech',
    name: 'Abstrato Tech',
    tags: ['Hipnótico', 'Tech', 'Alta retenção'],
    description: 'Padrões tecnológicos abstratos'
  },
  'gold-particles': {
    id: 'gold-particles',
    name: 'Partículas Douradas',
    tags: ['Hipnótico', 'Alta retenção'],
    description: 'Partículas douradas em movimento'
  },
  'timelapse-city': {
    id: 'timelapse-city',
    name: 'Timelapse Urbano',
    tags: ['Hipnótico', 'Alta retenção'],
    description: 'Timelapse de cidade'
  },
  'abstract-numbers': {
    id: 'abstract-numbers',
    name: 'Números Abstratos',
    tags: ['Hipnótico', 'Alta retenção'],
    description: 'Animação de números e gráficos'
  }
};

