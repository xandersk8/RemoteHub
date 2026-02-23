const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { exec } = require('child_process');
const wol = require('node-wol');
const db = require('./database');
require('dotenv').config();

const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey-remote-pc';

app.use(cors());
app.use(bodyParser.json());

// Serve static files from the React app dist folder
app.use(express.static(path.join(__dirname, '../client/dist')));

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Auth endpoints
app.post('/api/login', async (req, res) => {
    let { username, password } = req.body;
    username = username?.trim();
    password = password?.trim();
    console.log(`Login attempt for username: [${username}]`);
    try {
        const user = await db.getUserByUsername(username);
        if (!user) {
            console.log(`User [${username}] not found in database`);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = bcrypt.compareSync(password, user.password);
        console.log(`Password match for [${username}]: ${isMatch}`);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, username: user.username, theme: user.theme || 'dark' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Device management endpoints
app.get('/api/devices', authenticateToken, async (req, res) => {
    try {
        const devices = await db.getDevices(req.user.id);
        res.json(devices);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching devices' });
    }
});

app.post('/api/devices', authenticateToken, async (req, res) => {
    const { name, ip, mac, type, group_name, win_user, win_pass } = req.body;
    try {
        const result = await db.addDevice(req.user.id, name, ip, mac, type || 'desktop', group_name || 'Geral', win_user, win_pass);
        await db.addLog(req.user.id, `Adicionou dispositivo: ${name}`);
        res.json({ id: result.id, message: 'Device added successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error adding device' });
    }
});

app.put('/api/devices/:id', authenticateToken, async (req, res) => {
    const { name, ip, mac, type, group_name, win_user, win_pass } = req.body;
    try {
        await db.updateDevice(req.params.id, req.user.id, name, ip, mac, type || 'desktop', group_name || 'Geral', win_user, win_pass);
        await db.addLog(req.user.id, `Atualizou dispositivo: ${name}`);
        res.json({ message: 'Device updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating device' });
    }
});

app.delete('/api/devices/:id', authenticateToken, async (req, res) => {
    try {
        await db.deleteDevice(req.params.id, req.user.id);
        res.json({ message: 'Device deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting device' });
    }
});

app.put('/api/profile/password', authenticateToken, async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: 'A nova senha deve ter pelo menos 6 caracteres.' });
    }
    try {
        await db.updateUserPassword(req.user.id, newPassword);
        await db.addLog(req.user.id, `Alterou a própria senha`);
        res.json({ message: 'Senha alterada com sucesso!' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao alterar senha.' });
    }
});

app.put('/api/profile/theme', authenticateToken, async (req, res) => {
    const { theme } = req.body;
    if (!['light', 'dark'].includes(theme)) {
        return res.status(400).json({ message: 'Tema inválido.' });
    }
    try {
        await db.updateUserTheme(req.user.id, theme);
        res.json({ message: 'Tema atualizado com sucesso!' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao atualizar tema.' });
    }
});

// Activity Logs endpoints
app.get('/api/logs', authenticateToken, async (req, res) => {
    try {
        const logs = await db.getLogs(req.user.id);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar logs.' });
    }
});

app.delete('/api/logs', authenticateToken, async (req, res) => {
    try {
        await db.clearLogs(req.user.id);
        res.json({ message: 'Histórico limpo com sucesso!' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao limpar logs.' });
    }
});

const ping = require('ping');

// ... (existing imports and setup)

// Device status endpoint
app.post('/api/devices/status', authenticateToken, async (req, res) => {
    const { devices } = req.body;
    if (!Array.isArray(devices)) return res.status(400).json({ message: 'Devices array required' });

    try {
        const statusResults = await Promise.all(devices.map(async (device) => {
            const res = await ping.promise.probe(device.ip, { timeout: 2 });
            return { id: device.id, isOnline: res.alive };
        }));
        res.json(statusResults);
    } catch (error) {
        res.status(500).json({ message: 'Error checking status' });
    }
});

const isWin = process.platform === "win32";

// Command endpoints
app.post('/api/command', authenticateToken, async (req, res) => {
    let { action, ip, deviceId } = req.body;
    if (deviceId) deviceId = parseInt(deviceId);

    const targetIp = ip || '127.0.0.1';
    const isLocal = targetIp === '127.0.0.1' || targetIp === 'localhost';

    // Retrieve credentials if deviceId is provided
    let credentials = null;
    if (deviceId) {
        try {
            const allDevices = await db.getDevices(req.user.id);
            const device = allDevices.find(d => d.id === deviceId);
            if (device && device.win_user && device.win_pass) {
                credentials = { user: device.win_user, pass: device.win_pass };
            }
        } catch (err) {
            console.error('Error fetching device for credentials:', err);
        }
    }

    let fullCommand = '';
    let flag = '';

    if (action === 'shutdown') flag = isWin ? '/s' : '-s';
    else if (action === 'restart') flag = isWin ? '/r' : '-r';
    else if (action === 'abort') flag = isWin ? '/a' : ''; // Abort logic for RPC is complex
    else return res.status(400).json({ message: 'Ação inválida' });

    if (isLocal) {
        fullCommand = `shutdown ${flag} /f /t 10 /c "RemotePC-Controller"`;
    } else {
        if (isWin) {
            // Windows to Windows Command
            fullCommand = action === 'abort' ? `shutdown /m \\\\${targetIp} /a` : `shutdown /m \\\\${targetIp} ${flag} /f /t 10 /c "RemotePC-Controller"`;
        } else {
            // Linux/Docker to Windows Command (using net rpc)
            if (!credentials) {
                return res.status(400).json({ message: 'Credenciais (User/Pass) são obrigatórias para controle por Linux/Docker' });
            }
            fullCommand = `net rpc shutdown -I ${targetIp} -U "${credentials.user}%${credentials.pass}" ${flag} -t 10 -C "RemotePC-Controller"`;
        }
    }

    const executeCommand = () => {
        console.log(`Executing command: ${fullCommand}`);
        exec(fullCommand, (err, stdout, stderr) => {
            if (err) {
                console.error(`Command failed: ${stderr || err.message}`);
                let errorMsg = 'O comando falhou.';
                const combinedErr = (stderr + err.message).toLowerCase();

                if (combinedErr.includes('acesso negado') || combinedErr.includes('access is denied')) {
                    errorMsg = 'Acesso Negado. Verifique credenciais e permissões no PC de destino.';
                } else if (combinedErr.includes('caminho da rede') || combinedErr.includes('network path') || combinedErr.includes('unreachable')) {
                    errorMsg = 'PC não encontrado na rede ou offline.';
                } else if (combinedErr.includes('not found') || combinedErr.includes('net: command not found')) {
                    errorMsg = 'Ferramenta "net" (Samba) não instalada no servidor.';
                }
                return res.status(500).json({ message: errorMsg, details: stderr || err.message });
            }
            res.json({ message: `Comando enviado com sucesso para ${targetIp}` });
        });
    };

    // If on Windows and we have credentials, establish session first
    if (isWin && !isLocal && credentials) {
        const authCmd = `net use \\\\${targetIp} /user:${credentials.user} ${credentials.pass}`;
        exec(authCmd, (authErr) => {
            if (authErr) console.log(`Auth attempt failed for ${targetIp}, trying command anyway...`);
            executeCommand();
        });
    } else {
        executeCommand();
    }

    // Add activity log
    try {
        const deviceName = deviceId ? (await db.getDevices(req.user.id)).find(d => d.id === deviceId)?.name : targetIp;
        await db.addLog(req.user.id, `Enviou ${action} para ${deviceName || targetIp}`);
    } catch (e) { }
});

// Group Command endpoint (Bulk)
app.post('/api/command/group', authenticateToken, async (req, res) => {
    const { action, group_name } = req.body;
    if (!action || !group_name) return res.status(400).json({ message: 'Ação e nome do grupo são obrigatórios' });

    try {
        const allDevices = await db.getDevices(req.user.id);
        const targetDevices = allDevices.filter(d => d.group_name === group_name);

        if (targetDevices.length === 0) {
            return res.status(404).json({ message: 'Nenhum dispositivo encontrado neste grupo' });
        }

        // We respond immediately and process in background to avoid timeout
        res.json({ message: `Executando ${action} em ${targetDevices.length} dispositivos do grupo ${group_name}` });

        for (const device of targetDevices) {
            // Internal logic for command (simplified for group)
            if (action === 'wol') {
                if (device.mac) wol.wake(device.mac, () => { });
            } else {
                // For shutdown/restart we'd ideally trigger the same logic as /api/command
                // For brevity in group actions, we'll implement a simplified version or 
                // we could trigger internal functions if refactored.
                // Let's use a simplified call for now.
                const flag = isWin ? (action === 'shutdown' ? '/s' : '/r') : (action === 'shutdown' ? '-s' : '-r');
                const targetIp = device.ip;
                const isLocal = targetIp === '127.0.0.1' || targetIp === 'localhost';
                const credentials = (device.win_user && device.win_pass) ? { user: device.win_user, pass: device.win_pass } : null;

                let cmd = '';
                if (isLocal) {
                    cmd = `shutdown ${flag} /f /t 10 /c "Group-Hub-Action"`;
                } else if (isWin) {
                    cmd = `shutdown /m \\\\${targetIp} ${flag} /f /t 10 /c "Group-Hub-Action"`;
                } else if (credentials) {
                    cmd = `net rpc shutdown -I ${targetIp} -U "${credentials.user}%${credentials.pass}" ${flag} -t 10 -C "Group-Hub-Action"`;
                }

                if (cmd) {
                    if (isWin && !isLocal && credentials) {
                        exec(`net use \\\\${targetIp} /user:${credentials.user} ${credentials.pass}`, () => exec(cmd));
                    } else {
                        exec(cmd);
                    }
                }
            }
        }

        await db.addLog(req.user.id, `Executou ação de grupo: ${action} no grupo ${group_name}`);
    } catch (error) {
        console.error('Group command error:', error);
    }
});

// Wake on LAN endpoint
app.post('/api/wol', authenticateToken, (req, res) => {
    const { mac } = req.body;
    if (!mac) return res.status(400).json({ message: 'MAC address required' });

    try {
        wol.wake(mac, (error) => {
            if (error) return res.status(500).json({ message: 'WoL failed' });
            res.json({ message: 'Magic Packet sent successfully' });
        });
    } catch (e) {
        res.status(500).json({ message: 'WoL error' });
    }
});

// Timer / Scheduled Tasks Engine
const scheduledTasks = new Map();

app.post('/api/timer', authenticateToken, async (req, res) => {
    let { deviceId, action, minutes } = req.body;
    if (deviceId) deviceId = parseInt(deviceId);
    if (!deviceId || !action || !minutes) return res.status(400).json({ message: 'Missing parameters' });

    // Find device to get IP and credentials
    let device;
    try {
        const allDevices = await db.getDevices(req.user.id);
        console.log(`[Timer] User ID: ${req.user.id}, Seeking Device ID: ${deviceId} (${typeof deviceId})`);
        console.log(`[Timer] Available Devices:`, allDevices.map(d => `${d.id} (${typeof d.id})`));

        device = allDevices.find(d => String(d.id) === String(deviceId));
    } catch (err) {
        console.error('[Timer] Error fetching devices:', err);
        return res.status(500).json({ message: 'Error fetching device' });
    }

    if (!device) {
        console.warn(`[Timer] Device ${deviceId} not found for user ${req.user.id}`);
        const debugInfo = {
            seekingId: deviceId,
            seekingIdType: typeof deviceId,
            userId: req.user.id,
            foundCount: allDevices.length,
            availableIds: allDevices.map(d => d.id)
        };
        return res.status(404).json({
            message: 'Device not found',
            debug: debugInfo
        });
    }

    // Cancel existing timer if any
    if (scheduledTasks.has(deviceId)) {
        clearTimeout(scheduledTasks.get(deviceId).timeoutId);
    }

    const executionTime = Date.now() + (minutes * 60 * 1000);

    const timeoutId = setTimeout(async () => {
        console.log(`Executing scheduled ${action} for ${device.name} (${device.ip})`);
        // Reuse command logic (internal call or refactor)
        // For simplicity, we trigger the endpoint's logic manually here
        const credentials = (device.win_user && device.win_pass) ? { user: device.win_user, pass: device.win_pass } : null;
        const targetIp = device.ip;
        const isLocal = targetIp === '127.0.0.1' || targetIp === 'localhost';

        let flag = '';
        if (action === 'shutdown') flag = isWin ? '/s' : '-s';
        else if (action === 'restart') flag = isWin ? '/r' : '-r';

        let fullCommand = '';
        if (isLocal) {
            fullCommand = `shutdown ${flag} /f /t 10 /c "Scheduled-Remote-Hub"`;
        } else {
            if (isWin) {
                fullCommand = `shutdown /m \\\\${targetIp} ${flag} /f /t 10 /c "Scheduled-Remote-Hub"`;
            } else {
                fullCommand = `net rpc shutdown -I ${targetIp} -U "${credentials.user}%${credentials.pass}" ${flag} -f -t 10 -C "Scheduled-Remote-Hub"`;
            }
        }

        const runCmd = () => {
            console.log(`Executing scheduled command: ${fullCommand}`);
            exec(fullCommand, (err, stdout, stderr) => {
                if (err) console.error(`Scheduled command failed: ${stderr || err.message}`);
                else console.log(`Scheduled command successful for ${targetIp}`);
            });
        };

        if (isWin && !isLocal && credentials) {
            exec(`net use \\\\${targetIp} /user:${credentials.user} ${credentials.pass}`, () => runCmd());
        } else {
            runCmd();
        }

        scheduledTasks.delete(deviceId);
    }, minutes * 60 * 1000);

    scheduledTasks.set(deviceId, {
        timeoutId,
        action,
        minutes,
        name: device.name,
        expiresAt: executionTime
    });

    res.json({ message: `Timer set: ${action} in ${minutes} minutes` });
});

app.get('/api/timer', authenticateToken, (req, res) => {
    const list = Array.from(scheduledTasks.entries()).map(([deviceId, data]) => ({
        deviceId,
        action: data.action,
        name: data.name,
        expiresAt: data.expiresAt
    }));
    res.json(list);
});

app.delete('/api/timer/:deviceId', authenticateToken, (req, res) => {
    const deviceId = parseInt(req.params.deviceId);
    if (scheduledTasks.has(deviceId)) {
        clearTimeout(scheduledTasks.get(deviceId).timeoutId);
        scheduledTasks.delete(deviceId);
        res.json({ message: 'Timer cancelled' });
    } else {
        res.status(404).json({ message: 'No timer found for this device' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`To access from phone, use http://[IP_ADDRESS]:${PORT}`);
});
