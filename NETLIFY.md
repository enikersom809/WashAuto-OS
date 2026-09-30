# 🚀 Guia de Deploy no Netlify

Este projeto está 100% preparado e otimizado para deploy contínuo no **Netlify**.

---

## 📁 Arquivos de Configuração Criados

1. **`netlify.toml`**: Arquivo mestre de configuração lido automaticamente pelo Netlify (comando de build, pasta de publicação `dist`, redirecionamento de rotas SPA, headers de segurança e cache do PWA).
2. **`public/_redirects`**: Regras de roteamento SPA e redirecionamento de APIs (`/api/*` e `/* -> /index.html`).
3. **`public/_headers`**: Configurações de cabeçalhos HTTP, CORS, segurança e controle de cache para service workers e manifest.
4. **`netlify/functions/ai-insights.ts`**: Serverless function para o assistente de IA Gemini (`/api/ai-insights`), mantendo compatibilidade total com o Netlify Functions v1 e v2.
5. **`.env.example`**: Lista detalhada de variáveis de ambiente prontas para serem copiadas no painel do Netlify.

---

## 🛠️ Opção 1: Deploy Automático via Git (GitHub / GitLab / Bitbucket)

Esta é a opção recomendada para atualizações automáticas a cada `git push`:

1. Acesse [netlify.com](https://www.netlify.com/) e faça login.
2. Clique em **"Add new site"** -> **"Import an existing project"**.
3. Conecte sua conta do GitHub/GitLab e selecione o repositório deste projeto.
4. O Netlify detectará automaticamente o arquivo `netlify.toml`:
   - **Base directory:** *(deixe em branco)*
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Functions directory:** `netlify/functions`
5. Clique em **"Deploy site"**.

---

## 📦 Opção 2: Deploy Manual (Netlify Drop)

Caso queira fazer o deploy arrastando a pasta:

1. Execute o comando de compilação:
   ```bash
   npm run build:client
   ```
2. Acesse [app.netlify.com/drop](https://app.netlify.com/drop).
3. Arraste a pasta **`dist`** gerada para a tela do navegador.
4. O deploy estará ativo em segundos!

---

## 🔑 Configuração de Variáveis de Ambiente no Netlify

No painel do seu site no Netlify, vá em **Site configuration** -> **Environment variables** -> **Add a variable**:

| Chave | Descrição | Exemplo / Valor |
|---|---|---|
| `GEMINI_API_KEY` | Chave da API do Google Gemini para o assistente de IA | `AIzaSy...` |
| `VITE_FIREBASE_API_KEY` | *(Opcional)* Chave de API do Firebase | Já possui fallback embutido |
| `VITE_FIREBASE_PROJECT_ID` | *(Opcional)* ID do projeto Firebase | `meulavajatogestaoparalavajato` |
| `VITE_FIREBASE_AUTH_DOMAIN` | *(Opcional)* Domínio de Auth do Firebase | `meulavajatogestaoparalavajato.firebaseapp.com` |

---

## ⚡ Recursos Integrados

- **SPA Routing:** Nenhuma rota exibirá erro 404 ao recarregar a página (F5).
- **PWA Ready:** O Service Worker (`sw.js`) e o `manifest.webmanifest` são servidos com os cabeçalhos corretos.
- **Serverless API:** O endpoint `/api/ai-insights` funciona diretamente na nuvem da Netlify com fallback offline inteligente se a chave Gemini não for informada.
