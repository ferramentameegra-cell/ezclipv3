/**
 * CONFIGURAÇÃO DO SUPABASE
 * Cliente Supabase para backend (usa service_role para operações administrativas)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://wrsefdlvqprxjelxkvee.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indyc2VmZGx2cXByeGplbHhrdmVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MjExNjIsImV4cCI6MjA4NDQ5NzE2Mn0.gY7SYyAh0g6fjGbaFw9VT_h35Slq6NZysCf9gcd4CQI';

// Verificar se as chaves estão configuradas
if (!supabaseServiceKey || supabaseServiceKey.trim() === '') {
  console.warn('[SUPABASE] ⚠️ SUPABASE_SERVICE_ROLE_KEY não configurada. Algumas funcionalidades podem não funcionar.');
}

if (!supabaseAnonKey || supabaseAnonKey.trim() === '') {
  console.warn('[SUPABASE] ⚠️ SUPABASE_ANON_KEY não configurada. Algumas funcionalidades podem não funcionar.');
}

// Cliente com service_role (apenas backend - nunca expor ao frontend)
// Só criar se a chave estiver disponível
let supabaseAdmin = null;
if (supabaseServiceKey && supabaseServiceKey.trim() !== '') {
  try {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    console.log('[SUPABASE] ✅ Cliente admin inicializado');
  } catch (error) {
    console.error('[SUPABASE] ❌ Erro ao criar cliente admin:', error.message);
  }
} else {
  console.warn('[SUPABASE] ⚠️ Cliente admin não criado - SUPABASE_SERVICE_ROLE_KEY não configurada');
}

// Cliente público (para operações que não requerem service_role)
// Só criar se a chave estiver disponível
let supabasePublic = null;
if (supabaseAnonKey && supabaseAnonKey.trim() !== '') {
  try {
    supabasePublic = createClient(supabaseUrl, supabaseAnonKey);
    console.log('[SUPABASE] ✅ Cliente público inicializado');
  } catch (error) {
    console.error('[SUPABASE] ❌ Erro ao criar cliente público:', error.message);
  }
} else {
  console.warn('[SUPABASE] ⚠️ Cliente público não criado - SUPABASE_ANON_KEY não configurada');
}

export { supabaseAdmin, supabasePublic, supabaseUrl, supabaseAnonKey };
