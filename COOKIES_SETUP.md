# Configuração de Cookies do YouTube

## Por que usar cookies?

O YouTube bloqueia requisições de IPs de datacenter (como Railway, Heroku, etc.). Usar cookies do seu navegador ajuda a contornar esse bloqueio, pois o YouTube reconhece você como um usuário autenticado.

## Como obter cookies.txt

### Método 1: Extensão do Navegador (Recomendado)

1. **Chrome/Edge:**
   - Instale a extensão: [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
   - Acesse https://www.youtube.com
   - Faça login na sua conta do YouTube
   - Clique no ícone da extensão
   - Clique em "Export" para baixar `cookies.txt`

2. **Firefox:**
   - Instale a extensão: [cookies.txt](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/)
   - Siga os mesmos passos acima

### Método 2: Script Python

```bash
# Instalar biblioteca
pip install browser_cookie3

# Script para extrair cookies
python3 -c "
import browser_cookie3
import json

# Para Chrome
cookies = browser_cookie3.chrome(domain_name='youtube.com')
with open('cookies.txt', 'w') as f:
    for cookie in cookies:
        f.write(f'{cookie.domain}\t{"TRUE" if cookie.secure else "FALSE"}\t{cookie.path}\t{"TRUE" if cookie.domain_specified else "FALSE"}\t{cookie.expires or 0}\t{cookie.name}\t{cookie.value}\n')
"
```

## Como usar no Railway

### Opção 1: Variável de Ambiente

1. No Railway, vá em **Variables**
2. Adicione: `YT_DLP_COOKIES_PATH=/app/cookies/cookies.txt`
3. Faça upload do arquivo `cookies.txt` via volume ou durante o build

### Opção 2: Volume Montado

1. Crie um volume no Railway
2. Faça upload do `cookies.txt` para o volume
3. Monte o volume em `/app/cookies`

### Opção 3: Durante o Build

1. Coloque o `cookies.txt` na pasta `cookies/` do projeto
2. O Dockerfile já cria o diretório automaticamente
3. Certifique-se de adicionar `cookies/` ao `.gitignore` para não commitar

## Formato do arquivo cookies.txt

O arquivo deve estar no formato Netscape:

```
# Netscape HTTP Cookie File
.youtube.com	TRUE	/	TRUE	1735689600	VISITOR_INFO1_LIVE	abc123def456
.youtube.com	TRUE	/	TRUE	1735689600	YSC	xyz789
```

## Atualização de Cookies

Os cookies expiram periodicamente. Quando isso acontecer:

1. Re-exporte os cookies do navegador
2. Atualize o arquivo no servidor
3. Reinicie o serviço

## Segurança

⚠️ **IMPORTANTE:** 
- Não commite `cookies.txt` no Git
- Use variáveis de ambiente ou volumes seguros
- Os cookies dão acesso à sua conta do YouTube

## Verificação

O sistema automaticamente detecta se os cookies estão disponíveis e os usa quando presentes. Verifique os logs:

```
[DOWNLOAD-WORKER] Cookies encontrados: /app/cookies/cookies.txt
```

ou

```
[DOWNLOAD-WORKER] ⚠️ Cookies não encontrados: /app/cookies/cookies.txt
```
