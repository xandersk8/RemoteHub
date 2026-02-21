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
    const { username, password } = req.body;
    try {
        const user = await db.getUserByUsername(username);
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, username: user.username });
    } catch (error) {
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
    const { name, ip, mac, type, win_user, win_pass } = req.body;
    try {
        const result = await db.addDevice(req.user.id, name, ip, mac, type || 'desktop', win_user, win_pass);
        res.json({ id: result.id, message: 'Device added successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error adding device' });
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
    const { action, ip, deviceId } = req.body;

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
        fullCommand = `shutdown ${flag} /t 10 /c "RemotePC-Controller"`;
    } else {
        if (isWin) {
            // Windows to Windows Command
            fullCommand = action === 'abort' ? `shutdown /m \\\\${targetIp} /a` : `shutdown /m \\\\${targetIp} ${flag} /t 10 /c "RemotePC-Controller"`;
        } else {
            // Linux/Docker to Windows Command (using net rpc)
            if (!credentials) {
                return res.status(400).json({ message: 'Credenciais (User/Pass) são obrigatórias para controle por Linux/Docker' });
            }
            fullCommand = `net rpc shutdown -I ${targetIp} -U "${credentials.user}%${credentials.pass}" ${flag} -t 10 -C "RemotePC-Controller"`;
        }
    }

    const executeCommand = () => {
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
});

// Wake on LAN endpoint
app.post('/api/wol', authenticateToken, (req, res) => {
    const { mac } = req.body;
    if (!mac) return res.status(400).json({ message: 'MAC Address is required' });

    wol.wake(mac, (err) => {
        if (err) {
            console.error('WoL Error:', err);
            return res.status(500).json({ message: 'Failed to send Magic Packet' });
        }
        res.json({ message: `Magic Packet sent to ${mac}` });
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`To access from phone, use http://[IP_ADDRESS]:${PORT}`);
});
