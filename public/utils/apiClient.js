/**
 * Cliente API com retry automático e tratamento de erros
 */
class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 segundo
  }

  /**
   * Fetch com retry automático
   */
  async fetchWithRetry(url, options = {}, retries = this.maxRetries) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      // Se rate limited, aguardar e tentar novamente
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        if (retries > 0) {
          console.log(`[API] Rate limited. Aguardando ${retryAfter}s antes de tentar novamente...`);
          await this.sleep(retryAfter * 1000);
          return this.fetchWithRetry(url, options, retries - 1);
        }
      }

      // Se erro 5xx, tentar novamente
      if (response.status >= 500 && retries > 0) {
        console.log(`[API] Erro ${response.status}. Tentando novamente (${retries} tentativas restantes)...`);
        await this.sleep(this.retryDelay * (this.maxRetries - retries + 1));
        return this.fetchWithRetry(url, options, retries - 1);
      }

      // Verificar Content-Type antes de fazer parse
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Resposta não é JSON: ${text.substring(0, 100)}`);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Erro ${response.status}`);
      }

      return { data, response };
    } catch (error) {
      if (retries > 0 && !error.message.includes('JSON')) {
        console.log(`[API] Erro na requisição. Tentando novamente (${retries} tentativas restantes)...`);
        await this.sleep(this.retryDelay * (this.maxRetries - retries + 1));
        return this.fetchWithRetry(url, options, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Helper para sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * GET request
   */
  async get(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    return this.fetchWithRetry(url, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post(endpoint, body, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    return this.fetchWithRetry(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  /**
   * PUT request
   */
  async put(endpoint, body, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    return this.fetchWithRetry(url, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  /**
   * DELETE request
   */
  async delete(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    return this.fetchWithRetry(url, { ...options, method: 'DELETE' });
  }
}

// Instância global
const apiClient = new ApiClient(window.location.origin);

export default apiClient;
