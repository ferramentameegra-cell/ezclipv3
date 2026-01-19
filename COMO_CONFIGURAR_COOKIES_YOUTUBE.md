# Como Configurar Cookies do YouTube

## Problema

O YouTube está detectando acesso automatizado e bloqueando downloads com a mensagem:
```
Sign in to confirm you're not a bot. Use --cookies-from-browser or --cookies
```

## Solução

Configure cookies do seu navegador para que o yt-dlp pareça um usuário real.

## Método 1: Usando Extensão do Navegador (Recomendado)

### Chrome/Edge/Brave

1. Instale a extensão **"Get cookies.txt LOCALLY"** ou **"cookies.txt"** da Chrome Web Store
2. Acesse https://www.youtube.com e faça login na sua conta
3. Clique na extensão e exporte os cookies
4. Copie o conteúdo do arquivo de cookies gerado
5. Configure a variável de ambiente `YTDLP_COOKIES` no Railway com o conteúdo completo

### Firefox

1. Instale a extensão **"cookies.txt"** para Firefox
2. Acesse https://www.youtube.com e faça login
3. Clique na extensão e exporte os cookies
4. Copie o conteúdo e configure `YTDLP_COOKIES`

## Método 2: Usando yt-dlp Diretamente

```bash
# Exportar cookies do navegador Chrome
yt-dlp --cookies-from-browser chrome -o "cookies.txt" "https://www.youtube.com"

# Ou do Firefox
yt-dlp --cookies-from-browser firefox -o "cookies.txt" "https://www.youtube.com"
```

Depois, copie o conteúdo do arquivo `cookies.txt` para a variável `YTDLP_COOKIES`.

## Configuração no Railway

1. Acesse o dashboard do Railway
2. Vá em **Variables** (Variáveis de Ambiente)
3. Adicione uma nova variável:
   - **Nome**: `YTDLP_COOKIES`
   - **Valor**: Cole o conteúdo completo do arquivo de cookies (formato Netscape)
4. Salve e faça redeploy

## Formato do Arquivo de Cookies

O arquivo deve estar no formato Netscape, exemplo:
```
# Netscape HTTP Cookie File
.youtube.com	TRUE	/	FALSE	1735689600	VISITOR_INFO1_LIVE	abc123...
.youtube.com	TRUE	/	FALSE	1735689600	YSC	xyz789...
```

## Verificação

Após configurar, os logs devem mostrar:
```
[YT-DLP] ✅ Usando cookies de variável de ambiente
[DOWNLOAD-WORKER] ✅ Cookies disponíveis: /tmp/ytdlp_cookies_...
```

## Importante

- **Atualize os cookies periodicamente** (a cada 1-2 semanas) pois eles expiram
- **Não compartilhe seus cookies** - eles dão acesso à sua conta do YouTube
- **Use uma conta secundária** se possível, para evitar riscos à conta principal

## Troubleshooting

### Cookies não estão funcionando

1. Verifique se o formato está correto (formato Netscape)
2. Certifique-se de que fez login no YouTube antes de exportar
3. Tente exportar novamente - cookies podem ter expirado
4. Verifique os logs para ver se os cookies estão sendo carregados

### Ainda recebendo erro 403

1. Os cookies podem ter expirado - exporte novamente
2. O IP do servidor pode estar bloqueado - considere usar VPS com IP residencial
3. Tente usar uma conta diferente do YouTube

## Referências

- [Documentação do yt-dlp sobre cookies](https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp)
- [Como exportar cookies do YouTube](https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies)
