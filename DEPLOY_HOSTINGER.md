# Guia de Implantação do ProvaPack na Hostinger (Node.js)

Este documento descreve o passo a passo completo para hospedar o ProvaPack na Hostinger, tanto em **Hospedagem Cloud / Compartilhada com suporte a Node.js (hPanel)** quanto em **VPS (Virtual Private Server com PM2 e Nginx)**.

---

## 1. Arquitetura da Aplicação

- **Backend:** Node.js + Express (API REST em `/api/*`, persistência oficial no Supabase via `service_role`).
- **Frontend:** React + Tailwind CSS (Vite SPA compilado para HTML/JS/CSS estático dentro da pasta `dist/`).
- **Ponto de Entrada de Produção:**
  - `server.js` (raiz) ou `dist/server.cjs` (arquivo compilado que atende tanto as rotas da API quanto os arquivos estáticos do frontend).

---

## 2. Opção A: Hospedagem com hPanel (Node.js Selector)

A Hostinger oferece o gerenciador de aplicativos Node.js diretamente no painel de controle (hPanel).

### Passo 1: Configurar a Aplicação no hPanel
1. Acesse o **hPanel** da Hostinger.
2. No menu lateral, navegue até **Avançado** > **Node.js** (ou busque por "Node.js").
3. Clique em **Criar Aplicativo** e preencha:
   - **Versão do Node.js:** Escolha `20.x` ou `22.x` (LTS recomendado).
   - **Modo do aplicativo (Application Mode):** `Production`
   - **Diretório raiz do aplicativo (Application root):** O caminho onde os arquivos ficarão (ex: `public_html` ou uma subpasta para subdomínio como `app`).
   - **Arquivo de inicialização (Application startup file):** `server.js`
4. Clique em **Criar**.

### Passo 2: Enviar os Arquivos do Projeto
Você pode enviar via **Git**, **SSH** ou **Gerenciador de Arquivos (ZIP)**:
- **Arquivos e pastas obrigatórios:**
  - `package.json`
  - `package-lock.json` ou `bun.lock`
  - `server.js` e `app.js`
  - `server.ts`
  - `vite.config.ts`, `tsconfig.json`, `index.html`
  - Pasta `src/`
  - Pasta `public/`
  - Pasta `supabase/`
  - Arquivo `.env` (criado diretamente no servidor)

*Dica:* Não envie a pasta `node_modules` pelo ZIP. Ela será gerada no servidor.

### Passo 3: Configurar as Variáveis de Ambiente (`.env`)
No diretório raiz do aplicativo na Hostinger, crie o arquivo `.env`:

```env
NODE_ENV=production
PORT=3000

# Chave de API do Google Gemini (para OCR e análise de etiquetas)
GEMINI_API_KEY=sua_chave_gemini_aqui

# Supabase (Metadados e integridade criptográfica)
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_secreta

# URL pública da sua aplicação
APP_URL=https://seudominio.com.br
```

### Passo 4: Instalar Dependências e Gerar o Build
No hPanel, utilize a seção **Terminal** (ou acesse via SSH):

```bash
# 1. Instalar as dependências do projeto
npm install

# 2. Gerar o build de produção (compila o frontend e o bundle do servidor)
npm run build
```

O comando `npm run build` gerará:
- A pasta `dist/` com todos os arquivos estáticos do frontend.
- O arquivo `dist/server.cjs` com o servidor de produção otimizado.

### Passo 5: Iniciar o Aplicativo
No hPanel Node.js, clique no botão **Restart** (Reiniciar Aplicativo).
Acesse o seu domínio no navegador para verificar o funcionamento.

---

## 3. Opção B: Hostinger VPS (Ubuntu / Debian com PM2 + Nginx)

Caso você utilize um VPS na Hostinger, a configuração é ultra-estável e escalável.

### Passo 1: Preparar o Servidor
Acesse seu VPS via SSH e instale o Node.js 20 LTS e o gerenciador PM2:

```bash
# Atualizar pacotes
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git

# Instalar PM2 globalmente
sudo npm install -g pm2
```

### Passo 2: Clonar o Repositório e Fazer o Build
```bash
# Clonar para /var/www/provapack
sudo mkdir -p /var/www/provapack
sudo chown -R $USER:$USER /var/www/provapack
cd /var/www/provapack

git clone https://github.com/seu-usuario/ProvaPack.git .

# Criar o .env de produção
nano .env

# Instalar e compilar
npm install
npm run build
```

### Passo 3: Iniciar o Serviço com PM2
```bash
# Iniciar a aplicação
pm2 start server.js --name provapack --env production

# Configurar reinício automático após reboot do VPS
pm2 startup
pm2 save
```

### Passo 4: Configurar o Nginx como Proxy Reverso
Crie a configuração do Nginx:
```bash
sudo nano /etc/nginx/sites-available/provapack
```

Cole o conteúdo (substituindo pelo seu domínio):
```nginx
server {
    listen 80;
    server_name seudominio.com.br www.seudominio.com.br;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Ative o site e reinicie o Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/provapack /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Passo 5: Ativar SSL Grátis (HTTPS)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d seudominio.com.br -d www.seudominio.com.br
```

---

## 4. Banco de Dados Supabase (Checklist)

Antes de colocar em produção, certifique-se de executar no painel SQL do seu Supabase as migrations em ordem:
1. `supabase/migrations/20260922_create_provapacks.sql` (Criação da tabela e índices)
2. `supabase/migrations/20260924_lock_rls_and_immutable.sql` (Fechamento do RLS e proteção de integridade imutável)

---

## 5. Teste de Saúde em Produção

Após iniciar, você pode validar o endpoint de saúde:
```bash
curl -I https://seudominio.com.br/api/health
```
Resposta esperada:
```json
HTTP/1.1 200 OK
{"status":"ok","service":"ProvaPack API","timestamp":"..."}
```
