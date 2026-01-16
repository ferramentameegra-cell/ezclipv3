/**
 * SERVIÇO DE CRÉDITOS
 * Gerencia consumo e débito de créditos
 */

import { getUserById, updateUser, getTotalCredits, hasEnoughCredits } from '../models/users.js';
import { createUsageLog } from '../models/usageLogs.js';

/**
 * Verificar e debitar créditos para geração de clipes
 * Prioriza free trial antes dos créditos pagos
 */
export async function consumeCreditsForClips(userId, clipCount, seriesId = null) {
  const user = getUserById(userId);
  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  // Verificar se tem créditos suficientes
  if (!hasEnoughCredits(userId, clipCount)) {
    throw new Error(`Créditos insuficientes. Necessário: ${clipCount}, Disponível: ${getTotalCredits(userId)}`);
  }

  let remainingToDebit = clipCount;
  let freeTrialUsed = 0;
  let paidCreditsUsed = 0;

  // Primeiro: consumir free trial credits
  if (user.free_trial_credits > 0 && remainingToDebit > 0) {
    const freeTrialDebit = Math.min(user.free_trial_credits, remainingToDebit);
    freeTrialUsed = freeTrialDebit;
    remainingToDebit -= freeTrialDebit;

    // Atualizar free trial credits
    updateUser(userId, {
      free_trial_credits: user.free_trial_credits - freeTrialDebit
    });
  }

  // Depois: consumir credits_balance
  if (remainingToDebit > 0 && user.credits_balance > 0) {
    const paidDebit = Math.min(user.credits_balance, remainingToDebit);
    paidCreditsUsed = paidDebit;
    remainingToDebit -= paidDebit;

    // Atualizar credits_balance
    const updatedUser = getUserById(userId);
    updateUser(userId, {
      credits_balance: updatedUser.credits_balance - paidDebit
    });
  }

  // Registrar logs de uso
  if (freeTrialUsed > 0) {
    createUsageLog({
      userId,
      creditsUsed: freeTrialUsed,
      type: 'free_trial',
      clipCount: freeTrialUsed,
      seriesId
    });
  }

  if (paidCreditsUsed > 0) {
    createUsageLog({
      userId,
      creditsUsed: paidCreditsUsed,
      type: 'paid',
      clipCount: paidCreditsUsed,
      seriesId
    });
  }

  console.log(`[CREDITS] Créditos debitados para usuário ${userId}: ${clipCount} clipes (${freeTrialUsed} free trial + ${paidCreditsUsed} pagos)`);

  return {
    totalDebited: clipCount,
    freeTrialUsed,
    paidCreditsUsed,
    remainingFreeTrial: getUserById(userId).free_trial_credits,
    remainingPaid: getUserById(userId).credits_balance
  };
}

/**
 * Verificar créditos disponíveis antes de gerar
 */
export function checkCreditsBeforeGeneration(userId, requiredClips) {
  const user = getUserById(userId);
  if (!user) {
    return {
      allowed: false,
      reason: 'Usuário não encontrado'
    };
  }

  const totalCredits = getTotalCredits(userId);
  
  if (totalCredits < requiredClips) {
    return {
      allowed: false,
      reason: `Créditos insuficientes. Você tem ${totalCredits} créditos disponíveis, mas precisa de ${requiredClips} para gerar ${requiredClips} clipe(s).`,
      availableCredits: totalCredits,
      requiredCredits: requiredClips
    };
  }

  return {
    allowed: true,
    availableCredits: totalCredits,
    requiredCredits: requiredClips,
    freeTrialCredits: user.free_trial_credits,
    paidCredits: user.credits_balance
  };
}
