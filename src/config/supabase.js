/**
 * CONFIGURAÇÃO DO SUPABASE
 * Cliente Supabase para backend (usa service_role para operações administrativas)
 */

import { createClient } from '@supabase/supabase-js';

// Obter variáveis de ambiente (com fallback para valores padrão)
const supabaseUrl = process.env.SUPABASE_URL || 'https://wrsefdlvqprxjelxkvee.supabase.co';
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indyc2VmZGx2cXByeGplbHhrdmVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MjExNjIsImV4cCI6MjA4NDQ5NzE2Mn0.gY7SYyAh0g6fjGbaFw9VT_h35Slq6NZysCf9gcd4CQI').trim();

// Verificar se as chaves estão configuradas (verificar se não está vazio e tem tamanho mínimo)
const hasServiceKey = supabaseServiceKey && supabaseServiceKey.length > 20; // JWT tokens têm pelo menos 20 caracteres
const hasAnonKey = supabaseAnonKey && supabaseAnonKey.length > 20;

if (!hasServiceKey) {
  console.warn('[SUPABASE] ⚠️ SUPABASE_SERVICE_ROLE_KEY não configurada. Algumas funcionalidades podem não funcionar.');
} else {
  console.log('[SUPABASE] ✅ SUPABASE_SERVICE_ROLE_KEY configurada');
}

if (!hasAnonKey) {
  console.warn('[SUPABASE] ⚠️ SUPABASE_ANON_KEY não configurada. Algumas funcionalidades podem não funcionar.');
} else {
  console.log('[SUPABASE] ✅ SUPABASE_ANON_KEY configurada');
}

console.log('[SUPABASE] URL:', supabaseUrl);

// Cliente com service_role (apenas backend - nunca expor ao frontend)
// Só criar se a chave estiver disponível
let supabaseAdmin = null;
if (hasServiceKey) {
  try {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    console.log('[SUPABASE] ✅ Cliente admin inicializado com sucesso');
  } catch (error) {
    console.error('[SUPABASE] ❌ Erro ao criar cliente admin:', error.message);
    console.error('[SUPABASE] Stack:', error.stack);
  }
} else {
  console.warn('[SUPABASE] ⚠️ Cliente admin não criado - SUPABASE_SERVICE_ROLE_KEY não configurada');
}

// Cliente público (para operações que não requerem service_role)
// Só criar se a chave estiver disponível
let supabasePublic = null;
if (hasAnonKey) {
  try {
    supabasePublic = createClient(supabaseUrl, supabaseAnonKey);
    console.log('[SUPABASE] ✅ Cliente público inicializado com sucesso');
  } catch (error) {
    console.error('[SUPABASE] ❌ Erro ao criar cliente público:', error.message);
    console.error('[SUPABASE] Stack:', error.stack);
  }
} else {
  console.warn('[SUPABASE] ⚠️ Cliente público não criado - SUPABASE_ANON_KEY não configurada');
}

export { supabaseAdmin, supabasePublic, supabaseUrl, supabaseAnonKey };
