import React, { useState, useEffect } from 'react';
import { Activity, Shield, Package, AlertCircle, Clock, Map as MapIcon, Settings } from 'lucide-react';
import WarehouseMap from './WarehouseMap';

export default function LocalManagerHub({ onBack, onOpenAudit }: { onBack?: () => void, onOpenAudit?: () => void }) {
  const [stats, setStats] = useState({
    totalScans: 0,
    activeAlerts: 0,
    systemHealth: '100%',
    lastUpdate: 'Just now'
  });
  const [isOnline, setIsOnline] = useState(true);

  const [alerts, setAlerts] = useState([
    { id: 1, type: 'Safety', msg: 'Pedestrian detected in Zone B', time: '10:42 AM', severity: 'high' },
    { id: 2, type: 'Inventory', msg: 'Pallet PLT-882 detected at A-01', time: '10:40 AM', severity: 'low' },
  ]);

  const [showSafetyOnly, setShowSafetyOnly] = useState(false);

    useEffect(() => {
        // Initial fetch of safety history
        const fetchHistory = async () => {
            try {
                const res = await fetch('http://localhost:8085/safety-events');
                const data = await res.json();
                const history = data.map((e: any) => ({
                    id: e.id,
                    type: 'Safety',
                    msg: `${e.event_type} - ${e.forklift_id || 'System Sensor'}`,
                    time: new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    severity: e.severity === 'high' ? 'high' : 'low'
                }));
                setAlerts(prev => [...prev, ...history].slice(0, 20));
                
                // Initialize safety event count from today's history
                setStats(prev => ({ ...prev, activeAlerts: history.length }));
            } catch (e) {}
        };
        fetchHistory();

        const eventSource = new EventSource('http://localhost:8085/stream');
        
        eventSource.onopen = () => setIsOnline(true);
        eventSource.onerror = () => setIsOnline(false);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (!data) return;

                // Update Total Inventory
                if (data.event_type === 'pallet' && data.id) {
                    setStats(prev => ({ ...prev, totalScans: prev.totalScans + 1 }));
                }

                // Add real-time alerts
                if (data.alerts && Array.isArray(data.alerts) && data.alerts.length > 0) {
                    const newAlerts = data.alerts.map((msg: string, i: number) => ({
                        id: Date.now() + i,
                        type: data.event_type === 'forklift' ? 'Safety' : 'Inventory',
                        msg: `${msg} - ${data.id || 'System Sensor'}`,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        severity: msg.includes('PEDESTRIAN') || msg.includes('DANGER') ? 'high' : 'low'
                    }));
                    
                    setAlerts(prev => [...newAlerts, ...prev].slice(0, 20));
                    if (data.alerts.some((m: string) => m.includes('PEDESTRIAN'))) {
                        setStats(prev => ({ ...prev, activeAlerts: prev.activeAlerts + 1 }));
                    }
                }
            } catch (err) {
                console.error("Manager Hub SSE Error", err);
            }
        };

        return () => eventSource.close();
    }, []);

    return (
        <div className="h-screen bg-[#020617] text-white flex flex-col font-sans overflow-hidden">
            {/* Top Navigation - Fixed height */}
            <nav className="h-20 border-b border-slate-800 bg-[#020617]/80 backdrop-blur-md sticky top-0 z-50 px-8 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-cyan-600 p-2 rounded-lg shadow-lg shadow-cyan-900/40">
                            <Shield size={24} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">SteelTrack <span className="text-cyan-400">Store Manager</span></h1>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Local Edge Server - Store #442</p>
                        </div>
                    </div>
                    
                    {onBack && (
                        <button 
                            onClick={onBack}
                            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-bold text-slate-400 uppercase tracking-widest transition-all cursor-pointer"
                        >
                            ← Return to Tablet
                        </button>
                    )}
                </div>

                <div className="flex gap-6 items-center">
                    <div className="flex flex-col items-end">
                        <span className="text-xs text-slate-500 font-bold uppercase">System Status</span>
                        <span className={`${isOnline ? 'text-emerald-400' : 'text-rose-500'} text-sm font-bold flex items-center gap-1.5`}>
                            <div className={`w-2 h-2 ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'} rounded-full`} /> 
                            {isOnline ? 'ENGINE ONLINE' : 'ENGINE DISCONNECTED'}
                        </span>
                    </div>
                    <button className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-all cursor-pointer relative z-[60]">
                        <Settings size={20} className="text-slate-400" />
                    </button>
                </div>
            </nav>

            {/* Main Area - Explicit height for children to scroll */}
            <main className="flex-1 p-8 grid grid-cols-12 gap-8 overflow-hidden h-[calc(100vh-80px)]">
                {/* Left Column: Stats & Alerts */}
                <div className="col-span-3 flex flex-col gap-6 max-h-full overflow-y-auto pr-4 custom-scrollbar">
                    <div className="flex flex-col gap-4 shrink-0">
                        <StatCard title="Total Inventory" value={stats.totalScans} icon={<Package className="text-cyan-400" />} />
                        <StatCard title="Safety Events" value={stats.activeAlerts} icon={<AlertCircle className="text-rose-400" />} />
                        <StatCard title="Edge Health" value={stats.systemHealth} icon={<Activity className="text-emerald-400" />} />
                    </div>

                    <div className="bg-slate-900/50 rounded-3xl border border-slate-800 p-8 flex flex-col items-center justify-center text-center gap-4 shrink-0 min-h-[340px]">
                        <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center">
                            <Shield size={32} className="text-rose-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-emerald-400 mb-1 font-sans animate-pulse">Safety System ACTIVE 🦾</h3>
                            <p className="text-xs text-slate-500 leading-relaxed max-w-[180px]">Autonomous monitoring is live. All incidents are logged in your central journal.</p>
                        </div>
                        {onOpenAudit && (
                            <button 
                                onClick={onOpenAudit}
                                className="mt-4 px-6 py-3 bg-rose-600 hover:bg-rose-500 text-xs font-black uppercase tracking-widest rounded-xl text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-900/20 cursor-pointer"
                            >
                                View Safety Journal →
                            </button>
                        )}
                    </div>

                    {/* Quick Feed Card to fill space if needed */}
                    <div className="bg-slate-900/30 rounded-3xl border border-slate-800/50 p-6 shrink-0">
                        <div className="flex items-center gap-3 mb-4">
                            <Clock size={16} className="text-slate-500" />
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live Activity</h4>
                        </div>
                        <div className="space-y-3">
                            {alerts.slice(0, 3).map(alert => (
                                <div key={alert.id} className="flex flex-col gap-1">
                                    <span className="text-[10px] text-slate-500 font-mono">{alert.time}</span>
                                    <p className="text-xs text-slate-300 truncate">{alert.msg}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

        {/* Right Column: Interactive Digital Twin */}
        <div className="col-span-9 bg-slate-950 rounded-[40px] border border-slate-800 relative overflow-hidden shadow-inner h-full">
            <WarehouseMap />
        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) {
    return (
        <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 flex items-center gap-4 hover:border-slate-700 transition-all group">
            <div className="p-3 bg-slate-950 rounded-2xl group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</p>
                <p className="text-3xl font-bold tracking-tighter mt-1">{value}</p>
            </div>
        </div>
    );
}
