# Configurar emails ilimitados no Supabase

Por padrão, o Supabase limita a **2 emails por hora** para todo o projeto (recuperação de senha, confirmação, etc.).

Para que cada usuário possa solicitar "Esqueci minha senha" quantas vezes quiser:

1. Acesse **Supabase Dashboard** → seu projeto
2. Vá em **Project Settings** → **Auth** → **SMTP Settings**
3. Ative **Custom SMTP**
4. Configure um provedor (gratuito ou pago):
   - **Brevo** (Sendinblue): 300 emails/dia grátis
   - **Resend**: 100 emails/dia grátis
   - **AWS SES**: ~62.000/mês grátis (12 meses)
   - **Mailgun**, **SendGrid**, etc.

5. Preencha:
   - Host, Port, User, Password (do provedor)
   - Sender email (ex: noreply@seudominio.com)
   - Sender name (ex: EZ Clips AI)

Depois disso, o limite de emails será o do seu provedor SMTP, não mais o do Supabase.
