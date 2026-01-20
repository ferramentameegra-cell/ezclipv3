/**
 * CONFIGURAÇÃO DO SUPABASE
 * Cliente Supabase para backend (usa service_role para operações administrativas)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://wrsefdlvqprxjelxkvee.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseServiceKey) {
  console.warn('[SUPABASE] ⚠️ SUPABASE_SERVICE_ROLE_KEY não configurada. Algumas funcionalidades podem não funcionar.');
}

// Cliente com service_role (apenas backend - nunca expor ao frontend)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Cliente público (para operações que não requerem service_role)
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indyc2VmZGx2cXByeGplbHhrdmVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MjExNjIsImV4cCI6MjA4NDQ5NzE2Mn0.gY7SYyAh0g6fjGbaFw9VT_h35Slq6NZysCf9gcd4CQI';

export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey);

export { supabaseUrl, supabaseAnonKey };
