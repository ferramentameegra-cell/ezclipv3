import { NICHES } from '../models/niches.js';

export const getNiches = (req, res) => {
  try {
    const nichesList = Object.values(NICHES).map(niche => ({
      id: niche.id,
      name: niche.name,
      description: niche.description
    }));
    
    res.json({ niches: nichesList });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getNicheDetails = (req, res) => {
  try {
    const { nicheId } = req.params;
    const niche = NICHES[nicheId];
    
    if (!niche) {
      return res.status(404).json({ error: 'Nicho não encontrado' });
    }
    
    res.json({ niche });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

