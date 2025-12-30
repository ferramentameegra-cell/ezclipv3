import express from 'express';
import { getNiches, getNicheDetails } from '../controllers/nicheController.js';

const router = express.Router();

// Listar todos os nichos
router.get('/', getNiches);

// Obter detalhes de um nicho específico
router.get('/:nicheId', getNicheDetails);

export default router;


