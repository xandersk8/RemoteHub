#!/bin/bash

# Remote Hub PC - Universal Raspberry Pi Native Installer
# This script installs Node.js, dependencies, and sets up the app as a system service.
# Supports ARMv6, ARMv7 (Pi 1, 2, 3), ARMv8 (Pi 4, 5) and x64.

set -e

echo "------------------------------------------------"
echo "🚀 Iniciando Instalação do Remote Hub PC..."
echo "------------------------------------------------"

# 1. Update and install basic dependencies
echo "📦 Atualizando repositórios e instalando dependências..."
sudo apt-get update
sudo apt-get install -y samba-common-bin iputils-ping git curl xz-utils

# 2. Universal Node.js Installation (Detect Architecture)
ARCH=$(uname -m)
NODE_MAJOR=20

if ! command -v node &> /dev/null; then
    echo "🟢 Node.js não encontrado. Detectando arquitetura: $ARCH"
    
    if [[ "$ARCH" == "x86_64" || "$ARCH" == "aarch64" ]]; then
        echo "✅ Arquitetura suportada pelo NodeSource. Instalando..."
        curl -fsSL https://deb.nodesource.com/setup_$NODE_MAJOR.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        echo "⚠️  Arquitetura base ($ARCH) não suportada pelo NodeSource."
        echo "📥 Baixando binários oficiais da Nodejs.org..."
        
        # Determine specific ARM version
        if [[ "$ARCH" == armv7* ]]; then
            NODE_ARCH="armv7l"
        elif [[ "$ARCH" == armv6* ]]; then
            NODE_ARCH="armv6l"
        else
            echo "❌ Erro: Arquitetura $ARCH desconhecida."
            exit 1
        fi
        
        # Build URL for official binary
        NODE_VER=$(curl -sL https://nodejs.org/download/release/latest-v$NODE_MAJOR.x/ | grep -o "node-v$NODE_MAJOR\.[0-9]*\.[0-9]*-linux-$NODE_ARCH\.tar\.xz" | head -n 1)
        URL="https://nodejs.org/dist/latest-v$NODE_MAJOR.x/$NODE_VER"
        
        echo "📦 Fazendo download de: $URL"
        curl -L "$URL" -o node_archive.tar.xz
        
        echo "🔧 Extraindo e instalando em /usr/local..."
        sudo tar -xJf node_archive.tar.xz --strip-components=1 -C /usr/local
        rm node_archive.tar.xz
        echo "✅ Node.js instalado com sucesso manualmente."
    fi
else
    echo "✅ Node.js já está instalado ($(node -v))."
fi

# 3. Setup Project Folders
BASE_DIR=$(pwd)
echo "📁 Base de instalação: $BASE_DIR"

# 4. Install Server Dependencies
echo "🧠 Instalando dependências do Servidor..."
cd "$BASE_DIR/server"

# Remove existing node_modules to avoid architecture pollution (common when transferring files from Windows)
if [ -d "node_modules" ]; then
    echo "🧹 Limpando node_modules antigos..."
    rm -rf node_modules
fi

# Install and force rebuild of native modules (like sqlite3) from source
echo "🔨 Compilando módulos nativos para sua arquitetura..."
npm install --production --build-from-source

# 5. Build Client (Frontend)
if [ -d "$BASE_DIR/client/src" ]; then
    echo "🖥️  Arquivos fonte do cliente encontrados. Construindo frontend..."
    cd "$BASE_DIR/client"
    # For low-memory Pi (like 2B/Zero), we increase memory limit for build
    export NODE_OPTIONS="--max-old-space-size=1024"
    npm install
    npm run build
else
    echo "⚠️  Aviso: Pasta do cliente (dist) não encontrada ou já pré-construída."
fi

# 6. Configure Systemd Service
echo "⚙️  Configurando serviço de sistema (systemd)..."
SERVICE_FILE="/etc/systemd/system/remote-hub.service"
sudo bash -c "cat <<EOF > $SERVICE_FILE
[Unit]
Description=Remote Hub PC Controller
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$BASE_DIR/server
ExecStart=$(command -v node) server.js
Restart=on-failure
Environment=PORT=3080
Environment=JWT_SECRET=supersecretkey-remote-pc

[Install]
WantedBy=multi-user.target
EOF"

# 7. Enable and Start Service
echo "🔄 Ativando serviço..."
sudo systemctl daemon-reload
sudo systemctl enable remote-hub
sudo systemctl start remote-hub

echo "------------------------------------------------"
echo "✅ Instalação concluída com sucesso!"
echo "📡 O Hub está rodando na porta 3080."
echo "🌍 Acesse usando http://$(hostname -I | awk '{print $1}'):3080"
echo "------------------------------------------------"
