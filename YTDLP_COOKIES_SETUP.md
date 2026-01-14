# Guia de Configuração: Cookies e User-Agent para yt-dlp (Solução Erro 403)

## Problema
Ao usar yt-dlp em plataformas de nuvem como Railway, é comum encontrar o erro **HTTP Error 403: Forbidden** ao tentar acessar vídeos do YouTube. Isso ocorre porque o YouTube bloqueia IPs de datacenters.

## Solução Implementada
O sistema agora suporta cookies e User-Agent via variáveis de ambiente, permitindo que o yt-dlp se comporte como um navegador legítimo.

## Configuração no Railway

### 1. Obter Cookies do YouTube

1. **Instalar extensão de navegador:**
   - Chrome: "Get cookies.txt LOCALLY" ou "cookies.txt"
   - Firefox: "cookies.txt"

2. **Fazer login no YouTube:**
   - Acesse https://www.youtube.com
   - Faça login na sua conta

3. **Exportar cookies:**
   - Use a extensão para exportar cookies
   - Salve como `cookies.txt` (formato Netscape HTTP Cookie File)
   - O arquivo deve começar com: `# Netscape HTTP Cookie File`

### 2. Obter User-Agent

1. Acesse: https://www.whatismybrowser.com/detect/what-is-my-user-agent
2. Copie a string completa do User-Agent (começa com `Mozilla/5.0...`)

### 3. Configurar Variáveis de Ambiente no Railway

No painel do Railway, adicione as seguintes variáveis:

#### `YTDLP_COOKIES`
- **Valor:** Todo o conteúdo do arquivo `cookies.txt` exportado
- **Formato:** Texto completo do arquivo (multilinha)
- **Exemplo:**
```
# Netscape HTTP Cookie File
.youtube.com	TRUE	/	FALSE	1735689600	VISITOR_INFO1_LIVE	abc123...
.youtube.com	TRUE	/	FALSE	1735689600	YSC	def456...
```

#### `YTDLP_USER_AGENT`
- **Valor:** String completa do User-Agent do seu navegador
- **Exemplo:**
```
Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
```

## Como Funciona

1. **Cookies:** O sistema cria um arquivo temporário com os cookies da variável `YTDLP_COOKIES` e passa para o yt-dlp via `--cookies`
2. **User-Agent:** O sistema usa o User-Agent da variável `YTDLP_USER_AGENT` ou um padrão se não estiver configurado
3. **Limpeza:** Os arquivos temporários são automaticamente removidos após o download

## Manutenção

### Atualizar Cookies
Os cookies expiram periodicamente. Se o erro 403 voltar a aparecer:

1. Exporte novos cookies seguindo os passos acima
2. Atualize a variável `YTDLP_COOKIES` no Railway
3. Reinicie o serviço

### Atualizar User-Agent
Se você mudar de navegador ou versão:

1. Obtenha o novo User-Agent
2. Atualize a variável `YTDLP_USER_AGENT` no Railway

## Verificação

Após configurar, você verá nos logs:

```
[DOWNLOAD] Usando cookies de variável de ambiente (YTDLP_COOKIES)
[DOWNLOAD] User-Agent: Mozilla/5.0...
```

Se não estiver configurado:

```
[DOWNLOAD] Nenhum cookie configurado (YTDLP_COOKIES não definido)
```

## Arquivos Modificados

- `src/services/ytdlpDownloaderFixed.js` - Suporte a cookies e User-Agent
- `src/controllers/downloadProgressController.js` - Integração com variáveis de ambiente

## Notas Importantes

- ⚠️ **Segurança:** Não compartilhe seus cookies publicamente
- ⚠️ **Expiração:** Cookies expiram - monitore e atualize regularmente
- ⚠️ **Atualização:** Mantenha o yt-dlp atualizado: `yt-dlp -U`
- ✅ **Funcionalidade:** Esta solução resolve a maioria dos casos de erro 403

## Referências

- [yt-dlp Documentation](https://github.com/yt-dlp/yt-dlp)
- [Netscape Cookie File Format](https://curl.se/docs/http-cookies.html)
