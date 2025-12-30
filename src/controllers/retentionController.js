import { RETENTION_VIDEOS, NICHES } from '../models/niches.js';

export const getRetentionVideos = (req, res) => {
  try {
    const videos = Object.values(RETENTION_VIDEOS);
    res.json({ videos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getRetentionVideoByNiche = (req, res) => {
  try {
    const { nicheId } = req.params;
    const niche = NICHES[nicheId];
    
    if (!niche) {
      return res.status(404).json({ error: 'Nicho não encontrado' });
    }
    
    const videos = niche.retentionVideos.map(videoId => RETENTION_VIDEOS[videoId]);
    res.json({ videos, niche: niche.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


