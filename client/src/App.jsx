import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = `http://${window.location.hostname}:3000/api`;

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [view, setView] = useState('dashboard'); // 'dashboard', 'add-device'
  const [devices, setDevices] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // New Device Form
  const [newDevice, setNewDevice] = useState({ name: '', ip: '', mac: '', type: 'desktop', win_user: '', win_pass: '' });

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
      });

      setDevices(prev => prev.map(d => ({
        ...d,
        isOnline: statusMap[d.id] ?? false
      })));
    } catch (err) {
      console.error('Status refresh failed', err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_URL}/login`, { username, password });
      const { token: receivedToken, username: loggedUsername } = response.data;
      localStorage.setItem('token', receivedToken);
      setToken(receivedToken);
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

  const handleAddDevice = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_URL}/devices`, newDevice, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchDevices();
      setView('dashboard');
      setNewDevice({ name: '', ip: '', mac: '', type: 'desktop', win_user: '', win_pass: '' });
      setStatus('Dispositivo adicionado com sucesso!');
    } catch (err) {
      setError('Erro ao adicionar dispositivo');
    } finally {
      setLoading(false);
    }
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
                <input type="text" className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-12 pr-4 focus:ring-2 focus:ring-primary outline-none transition-all" placeholder="admin" value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Senha</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">lock</span>
                <input type="password" className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-12 pr-4 focus:ring-2 focus:ring-primary outline-none transition-all" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
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
          <h1 className="text-xl font-bold tracking-tight">Device Dashboard</h1>
        </div>
        <button onClick={handleLogout} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
          <span className="material-symbols-outlined">logout</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pt-6 pb-24 space-y-4 max-w-2xl mx-auto w-full">
        {view === 'dashboard' ? (
          <>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">Online</p>
                <p className="text-2xl font-bold">{devices.filter(d => d.isOnline).length} <span className="text-sm font-normal text-slate-500">Nodes</span></p>
              </div>
              <div className="bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">Total</p>
                <p className="text-2xl font-bold">{devices.length} <span className="text-sm font-normal text-slate-500">Dispositivos</span></p>
              </div>
            </div>

            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Seus Dispositivos</h3>

            <AnimatePresence>
              {devices.map((device) => (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={device.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm premium-card"
                >
                  <div className="p-4 flex items-start justify-between">
                    <div className="flex gap-4">
                      <div className={`size-12 rounded-lg ${device.isOnline ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'} flex items-center justify-center`}>
                        <span className="material-symbols-outlined text-3xl">
                          {device.type === 'server' ? 'dns' : device.type === 'laptop' ? 'laptop_mac' : 'desktop_windows'}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">{device.name}</h4>
                        <div className="flex items-center gap-1.5">
                          <span className="relative flex h-2 w-2">
                            {device.isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${device.isOnline ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-700'}`}></span>
                          </span>
                          <span className={`text-sm font-medium tracking-tight ${device.isOnline ? 'text-green-500' : 'text-slate-400'}`}>
                            {device.isOnline ? 'Ativo' : 'Offline'}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">{device.ip}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteDevice(device.id)} className="text-slate-400 hover:text-red-500 transition-colors p-2">
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-4 pt-0">
                    <button
                      onClick={() => sendWol(device.mac)}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all text-sm font-semibold shadow-lg ${device.isOnline ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed' : 'bg-primary text-white hover:bg-primary/90 shadow-primary/20'
                        }`}
                      disabled={loading || device.isOnline}
                    >
                      <span className="material-symbols-outlined text-sm">bolt</span> Power On
                    </button>
                    <button
                      onClick={() => sendCommand('shutdown', device.ip, device.id)}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all text-sm font-semibold border ${!device.isOnline ? 'bg-slate-50 dark:bg-slate-950/50 text-slate-300 border-slate-200 dark:border-slate-800 cursor-not-allowed' : 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-red-500/20'
                        }`}
                      disabled={loading || !device.isOnline}
                    >
                      <span className="material-symbols-outlined text-sm">power_settings_new</span> Shutdown
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {devices.length === 0 && (
              <div className="py-20 text-center">
                <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-700 mb-4">devices_other</span>
                <p className="text-slate-500 font-medium">Nenhum dispositivo encontrado</p>
              </div>
            )}
          </>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <header className="flex items-center gap-4 mb-8">
              <button onClick={() => setView('dashboard')} className="size-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-primary">arrow_back_ios_new</span>
              </button>
              <h2 className="text-2xl font-extrabold tracking-tight">Adicionar Dispositivo</h2>
            </header>

            <form onSubmit={handleAddDevice} className="space-y-8">
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-primary text-sm">info</span>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Identidade</h2>
                </div>
                <div className="space-y-4">
                  <div className="group">
                    <label className="block text-sm font-medium mb-1.5 ml-1 text-slate-700 dark:text-slate-300">Apelido da Máquina</label>
                    <input className="w-full h-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-base" placeholder="ex: PC do Quarto" type="text" value={newDevice.name} onChange={e => setNewDevice({ ...newDevice, name: e.target.value })} required />
                  </div>
                  <div className="group">
                    <label className="block text-sm font-medium mb-1.5 ml-1 text-slate-700 dark:text-slate-300">Tipo de Dispositivo</label>
                    <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                      {['desktop', 'laptop', 'server'].map(t => (
                        <label key={t} className={`relative flex flex-col items-center justify-center py-3 rounded-lg cursor-pointer transition-all ${newDevice.type === t ? 'bg-primary text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-white/5'}`}>
                          <input className="hidden" name="device_type" type="radio" value={t} checked={newDevice.type === t} onChange={e => setNewDevice({ ...newDevice, type: e.target.value })} />
                          <span className="material-symbols-outlined mb-1">{t === 'desktop' ? 'desktop_windows' : t === 'laptop' ? 'laptop_mac' : 'dns'}</span>
                          <span className="text-[10px] font-bold uppercase">{t}</span>
                        </label>
                      ))}
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
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 px-1 italic">* Necessário para comandos de desligamento/reinicio remoto se o PC exigir login prévio.</p>
                </div>
              </section>

              <div className="pt-4 pb-12">
                <button type="submit" disabled={loading} className="w-full h-16 bg-primary text-white rounded-2xl font-black text-lg shadow-xl shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest">
                  <span className="material-symbols-outlined">save</span>
                  {loading ? 'Salvando...' : 'Salvar Dispositivo'}
                </button>
                <button type="button" onClick={() => setView('dashboard')} className="w-full py-4 text-slate-500 dark:text-slate-400 font-bold hover:text-slate-900 transition-colors">Cancelar</button>
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
            <button onClick={() => setStatus('')} className="p-1 hover:bg-white/10 rounded-full"><span className="material-symbols-outlined text-xs">close</span></button>
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
              <button onClick={() => setError('')} className="p-1 hover:bg-white/10 rounded-full"><span className="material-symbols-outlined text-xs">close</span></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 px-6 pb-8 pt-3 z-40 ios-blur">
        <div className="flex justify-between items-center max-w-md mx-auto">
          <button onClick={() => setView('dashboard')} className={`flex flex-col items-center gap-1 ${view === 'dashboard' ? 'text-primary' : 'text-slate-400'}`}>
            <span className={`material-symbols-outlined ${view === 'dashboard' ? 'fill-icon' : ''}`}>dashboard</span>
            <span className="text-[10px] font-bold uppercase tracking-tighter">Nodes</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500 opacity-50">
            <span className="material-symbols-outlined">analytics</span>
            <span className="text-[10px] font-bold uppercase tracking-tighter">Logs</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500 opacity-50">
            <span className="material-symbols-outlined">schedule</span>
            <span className="text-[10px] font-bold uppercase tracking-tighter">Timer</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500 opacity-50">
            <span className="material-symbols-outlined">person</span>
            <span className="text-[10px] font-bold uppercase tracking-tighter">Perfil</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

export default App;
