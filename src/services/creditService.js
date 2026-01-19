/**
 * SERVIÇO DE CRÉDITOS
 * Gerencia consumo e débito de créditos
 */

import { getUserById, updateUser, getTotalCredits, hasEnoughCredits, isAdmin } from '../models/users.js';
import { createUsageLog } from '../models/usageLogs.js';

/**
 * Verificar e debitar créditos para geração de clipes
 * Prioriza free trial antes dos créditos pagos
 * Admin não consome créditos
 */
export async function consumeCreditsForClips(userId, clipCount, seriesId = null) {
  const user = getUserById(userId);
  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  // Admin não consome créditos - permitir diretamente
  if (isAdmin(userId)) {
    console.log(`[CREDITS] Admin ${user.email} gerando ${clipCount} clipes sem débito de créditos`);
    return {
      totalDebited: 0,
      freeTrialUsed: 0,
      paidCreditsUsed: 0,
      remainingFreeTrial: null,
      remainingPaid: null,
      isAdmin: true
    };
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
 * Admin sempre tem acesso ilimitado
 */
export function checkCreditsBeforeGeneration(userId, requiredClips) {
  const user = getUserById(userId);
  if (!user) {
    return {
      allowed: false,
      reason: 'Usuário não encontrado'
    };
  }

  // Admin sempre tem acesso ilimitado
  if (isAdmin(userId)) {
    return {
      allowed: true,
      availableCredits: null, // null = ilimitado
      requiredCredits: requiredClips,
      freeTrialCredits: null,
      paidCredits: null,
      isAdmin: true
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
