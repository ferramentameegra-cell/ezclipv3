/**
 * CONFIGURAÇÃO DO SUPABASE - FRONTEND
 * Cliente Supabase para frontend (usa anon key)
 */

// Configurações públicas do Supabase (seguras para frontend)
const SUPABASE_URL = 'https://wrsefdlvqprxjelxkvee.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indyc2VmZGx2cXByeGplbHhrdmVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MjExNjIsImV4cCI6MjA4NDQ5NzE2Mn0.gY7SYyAh0g6fjGbaFw9VT_h35Slq6NZysCf9gcd4CQI';

// Inicializar cliente Supabase (será carregado após o script do Supabase)
let supabase = null;

// Função para inicializar Supabase (chamada após carregar o script)
function initSupabase() {
  if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('[SUPABASE] ✅ Cliente Supabase inicializado no frontend');
    return supabase;
  } else {
    console.error('[SUPABASE] ❌ Biblioteca Supabase não carregada. Verifique se o script foi incluído.');
    return null;
  }
}

// Inicializar automaticamente quando o script carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initSupabase, 100); // Aguardar um pouco para garantir que o script do Supabase carregou
  });
} else {
  setTimeout(initSupabase, 100);
}

// Exportar para uso global
window.SUPABASE_CONFIG = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  init: initSupabase,
  getClient: () => supabase || initSupabase()
};
