#!/bin/bash

# Remote Hub PC - Raspberry Pi Uninstaller
# This script stops the service, removes systemd integration and optionally cleans up files.

set -e

SERVICE_NAME="remote-hub"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"

echo "------------------------------------------------"
echo "🛑 Iniciando Desinstalação do Remote Hub PC..."
echo "------------------------------------------------"

# 1. Stop and Disable Service
if systemctl is-active --quiet $SERVICE_NAME; then
    echo "停止 O serviço está rodando. Parando..."
    sudo systemctl stop $SERVICE_NAME
fi

if systemctl is-enabled --quiet $SERVICE_NAME; then
    echo "禁用 Desativando inicialização automática..."
    sudo systemctl disable $SERVICE_NAME
fi

# 2. Remove Service File
if [ -f "$SERVICE_FILE" ]; then
    echo "🗑️ Removendo arquivo de serviço: $SERVICE_FILE"
    sudo rm "$SERVICE_FILE"
    sudo systemctl daemon-reload
else
    echo "ℹ️ Arquivo de serviço não encontrado. Pulando..."
fi

echo "------------------------------------------------"
echo "✅ Desinstalação concluída!"
echo "💡 Os arquivos do projeto (código-fonte e banco de dados) foram mantidos."
echo "   Se desejar remover tudo, apague a pasta do projeto manualmente."
echo "------------------------------------------------"
