import React, { useState, useEffect } from 'react';
import { Shield, Eye, MapPin, Package, AlertCircle, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function StockerPortal() {
    const [isHolding, setIsHolding] = useState(false);
    const [plan, setPlan] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [ip, setIp] = useState('192.168.1.X');

    useEffect(() => {
        // Fetch the plan using the token from URL
        const params = new URLSearchParams(window.location.search);
        const token = params.get('t');
        
        if (token) {
            fetch(`http://localhost:8085/daily-plan/current`) // In real usage, validate token
                .then(res => res.json())
                .then(data => {
                    setPlan(data);
                    setLoading(false);
                });
        }
    }, []);

    if (loading) return <div className="h-screen bg-slate-950 flex items-center justify-center text-white">Authenticating Session...</div>;

    return (
        <div className="h-screen bg-slate-950 text-white font-sans flex flex-col relative overflow-hidden select-none">
            {/* Dynamic Watermark Layer */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03] overflow-hidden flex flex-wrap gap-20 p-10 rotate-12">
                {Array.from({ length: 50 }).map((_, i) => (
                    <span key={i} className="text-xl font-black whitespace-nowrap">INTERNAL ONLY - {ip} - {new Date().toLocaleDateString()}</span>
                ))}
            </div>

            {/* Header */}
            <header className="p-6 border-b border-white/10 bg-slate-900/50 backdrop-blur-md z-10 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="bg-cyan-600 p-2 rounded-lg">
                        <Shield size={20} />
                    </div>
                    <div>
                        <h1 className="text-lg font-black tracking-tighter uppercase leading-none">SteelTrack Portal</h1>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Stocker Mission Card</p>
                    </div>
                </div>
                <div className="bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">Active Shift</span>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-6 z-10 relative">
                <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 mb-8 text-center">
                    <AlertCircle className="text-amber-500 mx-auto mb-3" size={32} />
                    <h2 className="text-xl font-bold mb-2">Security Protocol Active</h2>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        Confidential data is obscured. Press and hold the "EYE" icon to view today's stacking locations.
                    </p>
                </div>

                <div className="space-y-4">
                    {plan?.assignments.map((item: any, i: number) => (
                        <div key={i} className="bg-slate-900/40 border border-white/5 p-6 rounded-[32px] flex items-center gap-6">
                            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center shrink-0">
                                <Package size={32} className="text-slate-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest mb-1">SKU: {item.sku}</span>
                                </div>
                                
                                {/* Obscured Content */}
                                <div className="h-6 w-full bg-slate-800/50 rounded-lg overflow-hidden relative">
                                    <AnimatePresence>
                                        {!isHolding ? (
                                            <motion.div 
                                                initial={{ opacity: 0 }} 
                                                animate={{ opacity: 1 }} 
                                                exit={{ opacity: 0 }}
                                                className="absolute inset-0 flex items-center px-3"
                                            >
                                                <div className="h-1.5 w-full bg-slate-700 rounded-full blur-[2px]" />
                                            </motion.div>
                                        ) : (
                                            <motion.div 
                                                initial={{ opacity: 0 }} 
                                                animate={{ opacity: 1 }}
                                                className="absolute inset-0 flex items-center px-3 font-bold text-emerald-400"
                                            >
                                                <MapPin size={14} className="mr-2" /> 
                                                DROP SPOT: {item.spot_id || 'GENERAL FLOOR'}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                <p className="text-[10px] text-slate-600 mt-2 font-bold uppercase tracking-widest">Hold to Reveal Exact Coordinates</p>
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {/* Bottom Interaction Area */}
            <div className="p-8 border-t border-white/10 bg-slate-900/80 backdrop-blur-xl z-20 flex flex-col items-center">
                <button 
                    onMouseDown={() => setIsHolding(true)}
                    onMouseUp={() => setIsHolding(false)}
                    onTouchStart={() => setIsHolding(true)}
                    onTouchEnd={() => setIsHolding(false)}
                    className={`w-24 h-24 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-2xl ${
                        isHolding ? 'bg-cyan-600 shadow-cyan-500/50' : 'bg-slate-800 border border-white/10'
                    }`}
                >
                    {isHolding ? <Eye size={40} className="text-white" /> : <Lock size={40} className="text-slate-500" />}
                </button>
                <p className="mt-4 text-xs font-black uppercase text-slate-500 tracking-[0.2em]">Hold to Decrypt</p>
            </div>

            {/* Expiring Banner */}
            <div className="bg-cyan-600 py-1 px-4 text-center z-30">
                <p className="text-[9px] font-black text-white/80 uppercase tracking-widest italic">
                    Session valid until: {new Date(plan?.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
            </div>
        </div>
    );
}
