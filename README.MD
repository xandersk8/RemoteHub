# Remote WakeOnLan PC v3.0 (Material Design)

Este projeto foi atualizado com o design Material Symbols e Tailwind CSS para proporcionar uma experiência ultra-moderna e fluida.

🌟 **Novas Funcionalidades**
- **Dashboard de Nós Ativos**: Visualização clara de dispositivos online/offline.
- **Material Design**: Uso de ícones oficiais do Google e tipografia Space Grotesk.
- **Gestão Simplificada**: Interface intuitiva de "Novo Registro".
- **Feedback de Rede**: Indicadores visuais de status em tempo real.

📱 **Guia de Instalação PWA**
Se a opção "Instalar" não aparecer no seu celular (comum em redes locais sem HTTPS), siga estes passos no Chrome:
1. Acesse: `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
2. Ative a opção (**Enabled**).
3. No campo de texto, digite o IP e porta do seu PC (ex: `http://192.168.1.5:3080`).
4. Reinicie o Chrome e acesse o endereço novamente.

🚀 **Como Executar**
1. **Servidor (Backend)**: Execute `node server.js` na pasta `server`. Porta padrão: **3080**.
2. **Painel (Frontend)**: Execute `npm run dev -- --host` na pasta `client`.
3. **Credenciais Padrão**: Usuário `admin` / Senha `admin123`.

🏢 **Opções de Instalação Profissional**
1. **Windows Service**: Execute `node install-service.js` na pasta `server` como Administrador. O app rodará em segundo plano.
2. **Raspberry Pi**: Use o script `./install_pi.sh` para uma instalação automática e configuração do systemd.

🛠 **Solução de Problemas: Desligamento Remoto (Windows 11)**
Se o comando de desligamento falhar ou der "Acesso Negado", siga estes 3 passos no PC de destino:

1. **Registro do Windows (LocalAccountTokenFilterPolicy)**:
   - Pressione `Win + R`, digite `regedit` e vá para: `HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System`
   - Crie um novo **Valor DWORD (32 bits)** chamado `LocalAccountTokenFilterPolicy` e defina o valor como `1`. Reinicie o PC.

2. **Configuração de Firewall**:
   - No Firewall do Windows, certifique-se de que "Instrumentação de Gerenciamento do Windows (WMI)" e "Compartilhamento de Arquivo e Impressora" estão marcados para redes **Privadas**.

3. **Serviço de Registro Remoto**:
   - No `services.msc`, procure por **Registro Remoto (Remote Registry)**, mude para **Automático** e clique em **Iniciar**.

# Remote WakeOnLan