#!/bin/bash

# Remote Hub PC - Raspberry Pi Native Installer
# This script installs Node.js, dependencies, and sets up the app as a system service.

set -e

echo "------------------------------------------------"
echo "🚀 Iniciando Instalação do Remote Hub PC..."
echo "------------------------------------------------"

# 1. Update and install basic dependencies
echo "📦 Atualizando repositórios e instalando dependências..."
sudo apt-get update
sudo apt-get install -y samba-common-bin iputils-ping git curl

# 2. Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "🟢 Node.js não encontrado. Instalando Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✅ Node.js já está instalado."
fi

# 3. Setup Project Folders
BASE_DIR=$(pwd)
echo "📁 Base de instalação: $BASE_DIR"

# 4. Install Server Dependencies
echo "🧠 Instalando dependências do Servidor..."
cd "$BASE_DIR/server"
npm install --production

# 5. Build Client (Frontend)
# Note: This requires the dist folder to be present. 
# If running on Pi, we usually deliver the pre-built 'dist' or build it now.
if [ -d "$BASE_DIR/client/src" ]; then
    echo "🖥️  Arquivos fonte do cliente encontrados. Construindo frontend..."
    cd "$BASE_DIR/client"
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
Environment=PORT=3000
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
echo "📡 O Hub está rodando na porta 3000."
echo "🌍 Acesse usando http://$(hostname -I | awk '{print $1}'):3000"
echo "------------------------------------------------"
