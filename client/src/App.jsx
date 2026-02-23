import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = `${window.location.protocol}//${window.location.host}/api`;

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [view, setView] = useState('dashboard'); // 'dashboard', 'add-device', 'timer', 'logs', 'profile'
  const [devices, setDevices] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingDeviceId, setEditingDeviceId] = useState(null);
  const [timers, setTimers] = useState([]);
  const [timerData, setTimerData] = useState({ deviceId: '', action: 'shutdown', minutes: 30 });
  const [passwordData, setPasswordData] = useState({ newPassword: '', confirmPassword: '' });

  // New Device Form
  const [newDevice, setNewDevice] = useState({ name: '', ip: '', mac: '', type: 'desktop', group_name: 'Geral', win_user: '', win_pass: '' });
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [logs, setLogs] = useState([]);
  const [previousStatuses, setPreviousStatuses] = useState({});

  useEffect(() => {
    if (token) {
      setIsLoggedIn(true);
      fetchDevices();
    }
  }, [token]);

  // Effect to periodically refresh device status
  useEffect(() => {
    let interval;
    if (isLoggedIn && devices.length > 0 && view === 'dashboard') {
      refreshStatuses(); // Initial check
      interval = setInterval(refreshStatuses, 15000); // Check every 15 seconds
    }
    return () => clearInterval(interval);
  }, [isLoggedIn, devices.length, view]);

  useEffect(() => {
    if (isLoggedIn && view === 'timer') {
      fetchTimers();
      const interval = setInterval(fetchTimers, 10000);
      return () => clearInterval(interval);
    }
    if (isLoggedIn && view === 'logs') {
      fetchLogs();
      const interval = setInterval(fetchLogs, 20000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, view]);

  // Notifications Request
  useEffect(() => {
    if ("Notification" in window) {
      if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
      }
    }
  }, []);

  // Effect to clear status message after 5 seconds
  useEffect(() => {
    if (status || error) {
      const timer = setTimeout(() => {
        setStatus('');
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [status, error]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const fetchDevices = async () => {
    try {
      const response = await axios.get(`${API_URL}/devices`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDevices(response.data);
    } catch (err) {
      console.error('Failed to fetch devices');
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout();
      }
    }
  };

  const refreshStatuses = async () => {
    if (devices.length === 0) return;
    try {
      const response = await axios.post(`${API_URL}/devices/status`,
        { devices: devices.map(d => ({ id: d.id, ip: d.ip })) },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const statusMap = {};
      response.data.forEach(res => {
        statusMap[res.id] = res.isOnline;

        // Check for changes to trigger notification
        if (previousStatuses[res.id] !== undefined && previousStatuses[res.id] !== res.isOnline) {
          const device = devices.find(d => d.id === res.id);
          if (device) {
            const statusText = res.isOnline ? 'ONLINE' : 'OFFLINE';
            if (Notification.permission === "granted") {
              new Notification(`Remote Hub: ${device.name}`, {
                body: `O dispositivo está ${statusText} agora.`,
                icon: '/icon.svg'
              });
            }
          }
        }
      });

      setPreviousStatuses(statusMap);
      setDevices(prev => prev.map(d => ({
        ...d,
        isOnline: statusMap[d.id] ?? false
      })));
    } catch (err) {
      console.error('Status refresh failed', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await axios.get(`${API_URL}/logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs(response.data);
    } catch (err) {
      console.error('Failed to fetch logs');
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('Deseja limpar todo o histórico de atividades?')) return;
    setLoading(true);
    try {
      await axios.delete(`${API_URL}/logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus('Histórico limpo com sucesso!');
      setLogs([]);
    } catch (err) {
      setError('Erro ao limpar histórico');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_URL}/login`, { username, password });
      const { token: receivedToken, username: loggedUsername, theme: userTheme } = response.data;
      localStorage.setItem('token', receivedToken);
      localStorage.setItem('theme', userTheme || 'dark');
      setToken(receivedToken);
      setTheme(userTheme || 'dark');
      setUsername(loggedUsername);
      setIsLoggedIn(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Falha na autenticação');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setIsLoggedIn(false);
    setView('dashboard');
  };

  const handleSaveDevice = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingDeviceId) {
        await axios.put(`${API_URL}/devices/${editingDeviceId}`, newDevice, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStatus('Dispositivo atualizado!');
      } else {
        await axios.post(`${API_URL}/devices`, newDevice, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStatus('Dispositivo adicionado!');
      }
      fetchDevices();
      setView('dashboard');
      setNewDevice({ name: '', ip: '', mac: '', type: 'desktop', group_name: 'Geral', win_user: '', win_pass: '' });
      setEditingDeviceId(null);
    } catch (err) {
      setError('Erro ao salvar dispositivo');
    } finally {
      setLoading(false);
    }
  };

  const handleEditDevice = (device) => {
    setEditingDeviceId(device.id);
    setNewDevice({
      name: device.name,
      ip: device.ip,
      mac: device.mac,
      type: device.type,
      group_name: device.group_name || 'Geral',
      win_user: device.win_user || '',
      win_pass: device.win_pass || ''
    });
    setView('add-device');
  };

  const handleDeleteDevice = async (id) => {
    if (!confirm('Deseja excluir este dispositivo?')) return;
    try {
      await axios.delete(`${API_URL}/devices/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchDevices();
      setStatus('Dispositivo removido');
    } catch (err) {
      setError('Erro ao excluir dispositivo');
    }
  };

  const sendCommand = async (action, ip, deviceId) => {
    setLoading(true);
    setStatus('Enviando comando...');
    try {
      const response = await axios.post(`${API_URL}/command`, { action, ip, deviceId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus(response.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao enviar comando');
    } finally {
      setLoading(false);
    }
  };

  const fetchTimers = async () => {
    try {
      const response = await axios.get(`${API_URL}/timer`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTimers(response.data);
    } catch (err) {
      console.error('Failed to fetch timers');
    }
  };

  const handleSetTimer = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/timer`, timerData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus(response.data.message);
      fetchTimers();
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao definir timer');
    } finally {
      setLoading(false);
    }
  };

  const cancelTimer = async (deviceId) => {
    try {
      await axios.delete(`${API_URL}/timer/${deviceId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus('Timer cancelado');
      fetchTimers();
    } catch (err) {
      setError('Erro ao cancelar timer');
    }
  };

  const sendWol = async (mac) => {
    setLoading(true);
    setStatus('Enviando Magic Packet...');
    try {
      const response = await axios.post(`${API_URL}/wol`, { mac }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus(response.data.message);
    } catch (err) {
      setError('Erro ao enviar sinal de ligar (WoL)');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }
    setLoading(true);
    try {
      await axios.put(`${API_URL}/profile/password`, { newPassword: passwordData.newPassword }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus('Senha alterada com sucesso!');
      setPasswordData({ newPassword: '', confirmPassword: '' });
      setView('dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao alterar senha');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (token) {
      try {
        await axios.put(`${API_URL}/profile/theme`, { theme: newTheme }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        console.error('Failed to update theme on server');
      }
    }
  };

  const handleGroupAction = async (groupName, action) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/command/group`,
        { action, group_name: groupName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStatus(response.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Erro na ação de grupo');
    } finally {
      setLoading(false);
    }
  };

  const groupedDevices = devices.reduce((acc, device) => {
    const group = (device.group_name && device.group_name.trim() !== '') ? device.group_name : 'Geral';
    if (!acc[group]) acc[group] = [];
    acc[group].push(device);
    return acc;
  }, {});

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-10 shadow-xl shadow-primary/5">
          <div className="flex justify-center mb-10">
            <div className="size-20 bg-primary/20 rounded-[1.5rem] flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-5xl">router</span>
            </div>
          </div>
          <h1 className="text-3xl font-black text-center mb-2 tracking-tight">Remote Hub</h1>
          <p className="text-slate-500 dark:text-slate-400 text-center mb-10">Controle seus dispositivos remotamente</p>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Usuário</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">person</span>
                <input type="text" className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-12 pr-4 focus:ring-2 focus:ring-primary outline-none transition-all text-slate-900 dark:text-white" placeholder="admin" value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Senha</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">lock</span>
                <input type="password" className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-12 pr-4 focus:ring-2 focus:ring-primary outline-none transition-all text-slate-900 dark:text-white" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>
            <button disabled={loading} className="w-full h-14 bg-primary text-white rounded-2xl font-bold text-lg shadow-lg shadow-primary/25 active:scale-[0.98] transition-all">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
          {error && <p className="mt-8 text-red-500 text-center font-bold bg-red-500/10 p-4 rounded-2xl">{error}</p>}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-2 rounded-lg">
            <span className="material-symbols-outlined text-primary text-2xl">router</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Remote Hub</h1>
        </div>
        <button onClick={handleLogout} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
          <span className="material-symbols-outlined">logout</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pt-6 pb-24 space-y-4 max-w-2xl mx-auto w-full">
        {view === 'dashboard' ? (
          <>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">Online</p>
                <p className="text-2xl font-bold">{devices.filter(d => d.isOnline).length} <span className="text-sm font-normal text-slate-500">Nodes</span></p>
              </div>
              <div className="bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">Total</p>
                <p className="text-2xl font-bold">{devices.length} <span className="text-sm font-normal text-slate-500">Dispositivos</span></p>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4 mt-6">
              <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Seus Dispositivos</h3>
              <button
                onClick={() => { setEditingDeviceId(null); setNewDevice({ name: '', ip: '', mac: '', type: 'desktop', group_name: 'Geral', win_user: '', win_pass: '' }); setView('add-device'); }}
                className="px-3 py-1.5 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-primary hover:text-white transition-all"
              >
                + Adicionar
              </button>
            </div>

            <AnimatePresence>
              {Object.entries(groupedDevices).map(([groupName, groupDevices]) => (
                <div key={groupName} className="space-y-4 mb-8">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-xs font-black uppercase tracking-tighter text-slate-400 flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">folder_open</span>
                      {groupName}
                    </h4>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleGroupAction(groupName, 'wol')}
                        className="px-2 py-1 bg-green-500/10 text-green-500 text-[9px] font-black uppercase tracking-widest rounded-md hover:bg-green-500 hover:text-white transition-colors"
                      >
                        Ligar Todos
                      </button>
                      <button
                        onClick={() => handleGroupAction(groupName, 'shutdown')}
                        className="px-2 py-1 bg-red-500/10 text-red-500 text-[9px] font-black uppercase tracking-widest rounded-md hover:bg-red-500 hover:text-white transition-colors"
                      >
                        Desligar Todos
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {groupDevices.map((device) => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={device.id}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm premium-card"
                      >
                        <div className="p-4 flex items-start justify-between">
                          <div className="flex gap-4">
                            <div className={`size-12 rounded-xl ${device.isOnline ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'} flex items-center justify-center transition-colors shadow-inner`}>
                              <span className="material-symbols-outlined text-3xl">
                                {device.type === 'server' ? 'dns' : device.type === 'laptop' ? 'laptop_mac' : 'desktop_windows'}
                              </span>
                            </div>
                            <div>
                              <h4 className="font-bold text-lg leading-tight tracking-tight">{device.name}</h4>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="relative flex h-2 w-2">
                                  {device.isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                                  <span className={`relative inline-flex rounded-full h-2 w-2 ${device.isOnline ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-700'}`}></span>
                                </span>
                                <span className={`text-xs font-bold tracking-tight ${device.isOnline ? 'text-green-500' : 'text-slate-400'}`}>
                                  {device.isOnline ? 'ATIVO' : 'OFFLINE'}
                                </span>
                                <span className="text-[10px] text-slate-400 uppercase tracking-widest ml-2 font-medium">{device.ip}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button onClick={() => handleEditDevice(device)} className="size-9 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center">
                              <span className="material-symbols-outlined text-xl">settings</span>
                            </button>
                            {!device.isOnline && device.mac && (
                              <button onClick={() => sendWol(device.mac)} className="size-9 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-all flex items-center justify-center shadow-lg shadow-green-500/5">
                                <span className="material-symbols-outlined text-xl">bolt</span>
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="px-4 pb-4 grid grid-cols-2 gap-3">
                          <button
                            onClick={() => sendCommand('restart', device.ip, device.id)}
                            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all text-xs font-bold border ${!device.isOnline ? 'bg-slate-50 dark:bg-slate-950/50 text-slate-300 border-slate-200 dark:border-slate-800 cursor-not-allowed' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-primary hover:text-white border-slate-200 dark:border-slate-700 hover:border-primary'}`}
                            disabled={loading || !device.isOnline}
                          >
                            <span className="material-symbols-outlined text-sm">refresh</span> Reiniciar
                          </button>
                          <button
                            onClick={() => sendCommand('shutdown', device.ip, device.id)}
                            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all text-xs font-bold border ${!device.isOnline ? 'bg-slate-50 dark:bg-slate-950/50 text-slate-300 border-slate-200 dark:border-slate-800 cursor-not-allowed' : 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-red-500/20'}`}
                            disabled={loading || !device.isOnline}
                          >
                            <span className="material-symbols-outlined text-sm">power_settings_new</span> Desligar
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </AnimatePresence>

            {devices.length === 0 && (
              <div className="py-20 text-center">
                <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-700 mb-4">devices_other</span>
                <p className="text-slate-500 font-medium">Nenhum dispositivo encontrado</p>
              </div>
            )}
          </>
        ) : view === 'timer' ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <h2 className="text-2xl font-black mb-6 tracking-tight">Agendador (Timer)</h2>

            <form onSubmit={handleSetTimer} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm mb-8">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Dispositivo</label>
                <select
                  className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 outline-none focus:ring-2 focus:ring-primary transition-all"
                  value={timerData.deviceId}
                  onChange={e => setTimerData({ ...timerData, deviceId: e.target.value })}
                  required
                >
                  <option value="">Selecione um computador...</option>
                  {devices.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.ip})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Ação</label>
                  <select
                    className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 outline-none focus:ring-2 focus:ring-primary transition-all"
                    value={timerData.action}
                    onChange={e => setTimerData({ ...timerData, action: e.target.value })}
                  >
                    <option value="shutdown">Desligar</option>
                    <option value="restart">Reiniciar</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Minutos</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 outline-none focus:ring-2 focus:ring-primary transition-all"
                    value={timerData.minutes}
                    onChange={e => setTimerData({ ...timerData, minutes: e.target.value })}
                    required
                  />
                </div>
              </div>

              <button disabled={loading} className="w-full h-14 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 active:scale-[0.98] transition-all">
                {loading ? 'Agendando...' : 'Iniciar Timer'}
              </button>
            </form>

            <div className="space-y-4 pb-12">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Timers Ativos</h3>
              {timers.length === 0 ? (
                <div className="bg-slate-100 dark:bg-slate-950 p-8 rounded-2xl text-center border border-dashed border-slate-300 dark:border-slate-800">
                  <p className="text-slate-400 font-medium">Nenhum timer agendado</p>
                </div>
              ) : (
                timers.map(t => (
                  <div key={t.deviceId} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm border-l-4 border-l-primary">
                    <div>
                      <h4 className="font-bold">{t.name}</h4>
                      <p className="text-xs text-slate-500">
                        {t.action === 'shutdown' ? 'Desligando' : 'Reiniciando'} em{' '}
                        <span className="text-primary font-bold">
                          {Math.max(0, Math.ceil((t.expiresAt - Date.now()) / 60000))} min
                        </span>
                      </p>
                    </div>
                    <button onClick={() => cancelTimer(t.deviceId)} className="size-10 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center">
                      <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        ) : view === 'logs' ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black tracking-tight">Histórico de Atividades</h2>
              {logs.length > 0 && (
                <button
                  onClick={handleClearLogs}
                  className="px-3 py-1.5 bg-red-500/10 text-red-500 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-red-500 hover:text-white transition-all flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-xs">delete_sweep</span> Limpar
                </button>
              )}
            </div>

            <div className="space-y-3">
              {logs.length === 0 ? (
                <div className="py-20 text-center">
                  <p className="text-slate-500">Sem atividades registradas.</p>
                </div>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-start gap-4">
                    <div className="size-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-slate-400 text-lg">history</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium leading-relaxed">{log.message}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        ) : view === 'profile' ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <h2 className="text-2xl font-black mb-6 tracking-tight">Seu Perfil</h2>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm mb-8 flex flex-col items-center">
              <div className="size-24 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-primary text-5xl">person</span>
              </div>
              <h3 className="text-xl font-bold">{username}</h3>
              <p className="text-slate-500 text-sm">Administrador do Sistema</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 mb-8 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-slate-400 text-2xl">
                  {theme === 'dark' ? 'dark_mode' : 'light_mode'}
                </span>
                <div>
                  <h4 className="font-bold">Tema do Sistema</h4>
                  <p className="text-xs text-slate-500">Modo {theme === 'dark' ? 'Escuro' : 'Claro'} ativo</p>
                </div>
              </div>
              <button
                onClick={handleToggleTheme}
                className={`w-14 h-8 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-primary' : 'bg-slate-300'}`}
              >
                <div
                  className={`absolute top-1 size-6 bg-white rounded-full shadow-sm transition-all ${theme === 'dark' ? 'left-7' : 'left-1'}`}
                />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Alterar Senha</h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Nova Senha</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">lock</span>
                    <input
                      type="password"
                      className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary transition-all"
                      placeholder="Mínimo 6 caracteres"
                      value={passwordData.newPassword}
                      onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Confirmar Senha</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">verified_user</span>
                    <input
                      type="password"
                      className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary transition-all"
                      placeholder="Repita a nova senha"
                      value={passwordData.confirmPassword}
                      onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <button disabled={loading} className="w-full h-14 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 active:scale-[0.98] transition-all">
                {loading ? 'Salvando...' : 'Atualizar Senha'}
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <header className="flex items-center gap-4 mb-8">
              <button
                onClick={() => { setView('dashboard'); setEditingDeviceId(null); setNewDevice({ name: '', ip: '', mac: '', type: 'desktop', group_name: 'Geral', win_user: '', win_pass: '' }); }}
                className="size-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-primary">arrow_back_ios_new</span>
              </button>
              <h2 className="text-2xl font-extrabold tracking-tight">{editingDeviceId ? 'Editar Dispositivo' : 'Adicionar Dispositivo'}</h2>
            </header>

            <form onSubmit={handleSaveDevice} className="space-y-8">
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-primary text-sm">info</span>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Identidade & Grupo</h2>
                </div>
                <div className="space-y-4">
                  <div className="group">
                    <label className="block text-sm font-medium mb-1.5 ml-1 text-slate-700 dark:text-slate-300">Apelido da Máquina</label>
                    <input className="w-full h-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-base" placeholder="ex: PC do Quarto" type="text" value={newDevice.name} onChange={e => setNewDevice({ ...newDevice, name: e.target.value })} required />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="group">
                      <label className="block text-sm font-medium mb-1.5 ml-1 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">category</span> Categoria
                      </label>
                      <select className="w-full h-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 focus:ring-2 focus:ring-primary outline-none transition-all" value={newDevice.type} onChange={e => setNewDevice({ ...newDevice, type: e.target.value })}>
                        <option value="desktop">PC Desktop</option>
                        <option value="laptop">Laptop</option>
                        <option value="server">Servidor / Hub</option>
                      </select>
                    </div>
                    <div className="group">
                      <label className="block text-sm font-medium mb-1.5 ml-1 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">folder</span> Grupo
                      </label>
                      <input className="w-full h-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 focus:ring-2 focus:ring-primary outline-none transition-all" placeholder="ex: Sala" type="text" value={newDevice.group_name} onChange={e => setNewDevice({ ...newDevice, group_name: e.target.value })} required />
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-primary text-sm">lan</span>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Configurações de Rede</h2>
                </div>
                <div className="space-y-4">
                  <div className="group">
                    <label className="block text-sm font-medium mb-1.5 ml-1 text-slate-700 dark:text-slate-300">Endereço IP</label>
                    <div className="relative">
                      <input className="w-full h-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-base font-mono" placeholder="192.168.1.15" type="text" value={newDevice.ip} onChange={e => setNewDevice({ ...newDevice, ip: e.target.value })} required />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 dark:text-slate-600 text-xl">settings_ethernet</span>
                    </div>
                  </div>
                  <div className="group">
                    <label className="block text-sm font-medium mb-1.5 ml-1 text-slate-700 dark:text-slate-300">Endereço MAC</label>
                    <div className="relative">
                      <input className="w-full h-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-base font-mono uppercase" placeholder="00:1A:2B:3C:4D:5E" type="text" value={newDevice.mac} onChange={e => setNewDevice({ ...newDevice, mac: e.target.value })} required />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 dark:text-slate-600 text-xl">fingerprint</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-primary text-sm">shield_person</span>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Credenciais Windows (Opcional)</h2>
                </div>
                <div className="space-y-4">
                  <div className="group">
                    <label className="block text-sm font-medium mb-1.5 ml-1 text-slate-700 dark:text-slate-300">Usuário Windows</label>
                    <div className="relative">
                      <input className="w-full h-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-base" placeholder="ex: Administrador" type="text" value={newDevice.win_user} onChange={e => setNewDevice({ ...newDevice, win_user: e.target.value })} />
                    </div>
                  </div>
                  <div className="group">
                    <label className="block text-sm font-medium mb-1.5 ml-1 text-slate-700 dark:text-slate-300">Senha Windows</label>
                    <div className="relative">
                      <input className="w-full h-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-base" placeholder="••••••••" type="password" value={newDevice.win_pass} onChange={e => setNewDevice({ ...newDevice, win_pass: e.target.value })} />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 px-1 italic">* Necessário para comandos remotos se o PC exigir login prévio.</p>
                </div>
              </section>

              <div className="pt-4 pb-12">
                <button type="submit" disabled={loading} className="w-full h-16 bg-primary text-white rounded-2xl font-black text-lg shadow-xl shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest">
                  <span className="material-symbols-outlined">save</span>
                  {loading ? 'Salvando...' : editingDeviceId ? 'Atualizar Dispositivo' : 'Salvar Dispositivo'}
                </button>
                <button type="button" onClick={() => { setView('dashboard'); setEditingDeviceId(null); setNewDevice({ name: '', ip: '', mac: '', type: 'desktop', group_name: 'Geral', win_user: '', win_pass: '' }); }} className="w-full py-4 text-slate-500 dark:text-slate-400 font-bold hover:text-slate-900 transition-colors">Cancelar</button>
              </div>
            </form>
          </motion.div>
        )}
      </main>

      {/* FAB */}
      {view === 'dashboard' && (
        <button onClick={() => setView('add-device')} className="fixed bottom-24 right-6 size-16 bg-primary text-white rounded-full flex items-center justify-center shadow-2xl shadow-primary/40 active:scale-95 hover:scale-105 transition-all z-30">
          <span className="material-symbols-outlined text-4xl">add</span>
        </button>
      )}

      {/* NOTIFICATIONS */}
      <AnimatePresence>
        {status && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-28 left-6 right-6 z-[60] bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-800"
          >
            <span className="material-symbols-outlined text-primary">check_circle</span>
            <span className="font-bold flex-1">{status}</span>
            <button onClick={() => setStatus('')} className="p-1 hover:bg-white/10 rounded-full transition-colors"><span className="material-symbols-outlined text-xs">close</span></button>
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-28 left-6 right-6 z-[60] bg-red-500 text-white p-4 rounded-2xl shadow-2xl flex flex-col gap-2 border border-red-600"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-white">error</span>
              <span className="font-bold flex-1">{error}</span>
              <button onClick={() => setError('')} className="p-1 hover:bg-white/10 rounded-full transition-colors"><span className="material-symbols-outlined text-xs">close</span></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 px-6 pb-8 pt-3 z-40 ios-blur shadow-[0_-4px_20px_0_rgba(0,0,0,0.05)]">
        <div className="flex justify-between items-center max-w-md mx-auto">
          <button onClick={() => setView('dashboard')} className={`flex flex-col items-center gap-1 transition-all ${view === 'dashboard' ? 'text-primary' : 'text-slate-400'}`}>
            <span className={`material-symbols-outlined ${view === 'dashboard' ? 'fill-icon' : ''}`}>dashboard</span>
            <span className="text-[10px] font-bold uppercase tracking-tighter">Nodes</span>
          </button>
          <button onClick={() => setView('logs')} className={`flex flex-col items-center gap-1 transition-all ${view === 'logs' ? 'text-primary' : 'text-slate-400'}`}>
            <span className={`material-symbols-outlined ${view === 'logs' ? 'fill-icon' : ''}`}>history</span>
            <span className="text-[10px] font-bold uppercase tracking-tighter">Histórico</span>
          </button>
          <button onClick={() => setView('timer')} className={`flex flex-col items-center gap-1 transition-all ${view === 'timer' ? 'text-primary' : 'text-slate-400'}`}>
            <span className={`material-symbols-outlined ${view === 'timer' ? 'fill-icon' : ''}`}>schedule</span>
            <span className="text-[10px] font-bold uppercase tracking-tighter">Timer</span>
          </button>
          <button onClick={() => setView('profile')} className={`flex flex-col items-center gap-1 transition-all ${view === 'profile' ? 'text-primary' : 'text-slate-400'}`}>
            <span className={`material-symbols-outlined ${view === 'profile' ? 'fill-icon' : ''}`}>person</span>
            <span className="text-[10px] font-bold uppercase tracking-tighter">Perfil</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

export default App;
