import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Package, Search, QrCode, X, Move, Trash2, Plus, Info, Check, AlertCircle, Loader2, Map as MapIcon, ChevronRight, CheckCircle2, Printer, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import WarehouseMap from './WarehouseMap';

interface StockItem {
    id: number;
    sku: string;
    product_name: string;
    quantity: number;
}

interface Assignment {
    sku: string;
    x: number;
    y: number;
    spot_id: string;
    status: string;
}

interface DailyPlan {
    id: number;
    date: string;
    token: string;
    assignments: Assignment[];
}

export default function DailyPlanner({ 
    floorSpots: externalFloorSpots, 
    onSpotsUpdate 
}: { 
    floorSpots: any[], 
    onSpotsUpdate: (spots: any[]) => void 
}) {
    const [incomingStock, setIncomingStock] = useState<StockItem[]>([]);
    const [currentPlan, setCurrentPlan] = useState<DailyPlan | null>(null);
    const [loading, setLoading] = useState(true);
    const [draggedItem, setDraggedItem] = useState<StockItem | null>(null);
    const [showQR, setShowQR] = useState(false);
    const [floorSpots, setFloorSpots] = useState<any[]>(externalFloorSpots);
    useEffect(() => {
        setFloorSpots(externalFloorSpots);
    }, [externalFloorSpots]);
    const [addSpotMode, setAddSpotMode] = useState(false);
    const [blocks, setBlocks] = useState<any[]>([]);
    const [mapLoading, setMapLoading] = useState(true);
    const floorSpotsRef = React.useRef<any[]>([]);
    const mapTransformRef = React.useRef({ scale: 1.3, pos: { x: 100, y: 100 } });

    // Predefined Floor Spots (Meters)
    const FLOOR_SPOTS = [
        { id: 'SPOT-1', name: 'Aisle A1 - Floor 1', x: 4, y: 3 },
        { id: 'SPOT-2', name: 'Aisle A1 - Floor 2', x: 6, y: 3 },
        { id: 'SPOT-3', name: 'Aisle A1 - Floor 3', x: 8, y: 3 },
        { id: 'SPOT-4', name: 'Aisle A2 - Floor 1', x: 4, y: 6 },
        { id: 'SPOT-5', name: 'Aisle A2 - Floor 2', x: 6, y: 6 },
        { id: 'SPOT-6', name: 'Aisle A2 - Floor 3', x: 8, y: 6 },
    ];

    useEffect(() => {
        floorSpotsRef.current = floorSpots;
    }, [floorSpots]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [stockRes, planRes, spotsRes] = await Promise.all([
                fetch('http://localhost:8085/incoming-stock'),
                fetch('http://localhost:8085/daily-plan/current'),
                fetch('http://localhost:8085/floor-spots')
            ]);
            
            const stockData = await stockRes.json();
            const planData = await planRes.json();
            const spotsData = await spotsRes.json();
            
            setIncomingStock(stockData);
            setCurrentPlan(planData);
            setFloorSpots(spotsData);
            floorSpotsRef.current = spotsData;

            if (blocks.length === 0) {
                // Fetch static warehouse structure once
                setBlocks([
                    { id: 'r1', x: 200, y: 100, width: 400, height: 60, type: 'rack', name: 'Aisle A1', levels: 5 },
                    { id: 'r2', x: 200, y: 250, width: 400, height: 60, type: 'rack', name: 'Aisle A2', levels: 5 },
                    { id: 'z1', x: 50, y: 50, width: 100, height: 400, type: 'zone', name: 'Loading Dock', color: '#1e3a8a' }
                ]);
                setMapLoading(false);
            }
        } catch (error) {
            console.error("Failed to fetch planner data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleEntityMove = async (sku: string, worldX: number, worldY: number) => {
        if (!currentPlan) return;

        const xM = worldX / 50;
        const yM = worldY / 50;

        // Find nearest spot using Ref to avoid stale closure issues
        let nearestSpot = null;
        let minDistance = 2.0; // 2 meters radius for snap

        console.log(`Checking assignment for SKU ${sku} at (M): ${xM.toFixed(2)}, ${yM.toFixed(2)}`);
        console.log(`Available spots in Ref:`, floorSpotsRef.current.map(s => `${s.id}@(${s.x},${s.y})`));

        floorSpotsRef.current.forEach(spot => {
            const dist = Math.sqrt(Math.pow(spot.x - xM, 2) + Math.pow(spot.y - yM, 2));
            if (dist < minDistance) {
                minDistance = dist;
                nearestSpot = spot;
            }
        });

        if (nearestSpot) {
            console.log(`Found match: ${nearestSpot.id} at dist: ${minDistance.toFixed(2)}m`);
        } else {
            console.warn(`No spot found within ${minDistance}m. Nearest was ${minDistance.toFixed(2)}m away.`);
        }
        const isUnassign = !nearestSpot;

        try {
            console.log(">>> Assignment POST payload:", { plan_id: currentPlan.id, sku, x: nearestSpot.x, y: nearestSpot.y, spot_id: nearestSpot.id });
            const res = await fetch('http://localhost:8085/daily-plan/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan_id: currentPlan.id,
                    sku: sku,
                    x: nearestSpot.x,
                    y: nearestSpot.y,
                    spot_id: nearestSpot.id
                })
            });

            if (res.ok) {
                fetchData();
            }
        } catch (error) {
            console.error("Assignment failed:", error);
        }
    };

    const handleDrop = async (e: React.DragEvent, xPx: number, yPx: number) => {
        if (!draggedItem) return;
        
        // Use the realtime Ref instead of localStorage to avoid lag
        const { scale, pos } = mapTransformRef.current;
        const worldX = (xPx - pos.x) / scale;
        const worldY = (yPx - pos.y) / scale;

        await handleEntityMove(draggedItem.sku, worldX, worldY);
    };

    const handleSpotMove = async (spotId: string, xM: number, yM: number) => {
        const nx = Number(xM);
        const ny = Number(yM);
        if (isNaN(nx) || isNaN(ny)) return;

        // Optimistic update
        const next = floorSpots.map(s => String(s.id) === String(spotId) ? { ...s, x: nx, y: ny } : s);
        setFloorSpots(next);
        onSpotsUpdate(next);
        floorSpotsRef.current = next;

        try {
            // We just send the update. The SSE will broadcast it back to EVERYONE (including us),
            // but since we already updated locally, it will be a seamless sync.
            await fetch(`http://localhost:8085/floor-spots/${spotId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x: nx, y: ny })
            });
            // NO redundant fetchData() here anymore!
        } catch (error) {
            console.error("Failed to move spot:", error);
            // Revert on error only
            fetchData();
        }
    };


    const handleAddSpot = async (xM: number, yM: number) => {
        if (!addSpotMode) return;
        
        try {
            const res = await fetch('http://localhost:8085/floor-spots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x: xM, y: yM })
            });
            
            if (res.ok) {
                fetchData();
                setAddSpotMode(false);
            }
        } catch (error) {
            console.error("Failed to add spot:", error);
        }
    };

    const memoizedAssignments = React.useMemo(() => {
        return currentPlan?.assignments?.map((a: any) => {
            const product = incomingStock.find(s => s.sku === a.sku);
            return { ...a, product_name: product?.product_name || a.sku };
        }) || [];
    }, [currentPlan?.assignments, incomingStock]);

    return (
        <div className="flex-1 flex flex-col h-full bg-[#020617] overflow-hidden p-8 relative">
                    {/* Non-intrusive loading indicator */}
                    {loading && (
                        <div className="absolute top-4 right-4 z-[100] bg-zinc-950/80 border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-2xl">
                            <Loader2 className="animate-spin text-cyan-500" size={12} />
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Syncing...</span>
                        </div>
                    )}
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Daily Stacking Planner</h2>
                    <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-1">
                        Drag arriving stock to assign drop locations on the floor
                    </p>
                </div>
                
                <div className="flex gap-4">
                    <button 
                        onClick={() => setShowQR(true)}
                        className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-cyan-500/50 px-6 py-3 rounded-2xl text-slate-300 font-bold text-sm transition-all"
                    >
                        <QrCode size={18} /> Generate Mission
                    </button>
                    <button 
                        onClick={() => setAddSpotMode(!addSpotMode)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all border ${
                            addSpotMode 
                            ? 'bg-amber-500 border-amber-400 text-black' 
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-amber-500/50'
                        }`}
                    >
                        <MapIcon size={18} /> {addSpotMode ? 'Exit Add Spot' : 'Add Spot'}
                    </button>
                    <button className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-slate-700 px-6 py-3 rounded-2xl text-slate-300 font-bold text-sm transition-all">
                        <Printer size={18} /> Print Map
                    </button>
                </div>
            </header>

            <div className="flex-1 grid grid-cols-12 gap-8 min-h-0">
                {/* Left: Interactive Map */}
                <div className="col-span-8 bg-slate-950 rounded-[40px] border border-slate-800 relative overflow-hidden shadow-2xl group">
                    <div className="absolute top-4 right-4 z-10 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                        <span className="text-[10px] text-white font-bold opacity-70 uppercase tracking-widest leading-none">Drop Target Mode</span>
                    </div>
                    
                    {/* The Map Component */}
                    <div 
                        className="w-full h-full"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            handleDrop(e, e.clientX - rect.left, e.clientY - rect.top);
                        }}
                    >
                        <WarehouseMap 
                            key="stable-warehouse-map"
                            planningMode={true} 
                            plannerSpots={floorSpots} 
                            assignments={memoizedAssignments} 
                            onMapClick={handleAddSpot}
                            onTransformChange={(scale, pos) => {
                                mapTransformRef.current = { scale, pos };
                            }}
                            onSpotMove={handleSpotMove}
                            onAssignmentMove={handleEntityMove}
                            addSpotMode={addSpotMode}
                            blocks={blocks}
                            loading={mapLoading}
                            persistenceKey="planner"
                        />
                    </div>

                    {/* Overlay showing current plan progress */}
                    <div className="absolute bottom-8 left-8 right-8 bg-slate-900/40 backdrop-blur-xl border border-white/10 p-6 rounded-3xl flex items-center justify-between">
                        <div className="flex gap-12">
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Total Items</p>
                                <p className="text-2xl font-black text-white">{incomingStock.length}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Planned Drops</p>
                                <p className="text-2xl font-black text-cyan-400">{currentPlan?.assignments.length || 0}</p>
                            </div>
                        </div>
                        <div className="h-2 w-48 bg-slate-800 rounded-full overflow-hidden">
                            <motion.div 
                                className="h-full bg-cyan-500" 
                                initial={{ width: 0 }}
                                animate={{ width: `${(currentPlan?.assignments.length || 0) / (incomingStock.length || 1) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Right: Arrival List */}
                <div className="col-span-4 flex flex-col gap-4 min-h-0">
                    <div className="bg-slate-900/50 rounded-[32px] border border-slate-800 p-6 flex-1 flex flex-col min-h-0">
                        <div className="flex items-center gap-3 mb-6">
                            <Package size={20} className="text-cyan-400" />
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Expected Inventory</h3>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                            {incomingStock.map((item) => {
                                const isAssigned = currentPlan?.assignments.some(a => a.sku === item.sku);
                                return (
                                    <div 
                                        key={item.id}
                                        draggable
                                        onDragStart={() => setDraggedItem(item)}
                                        className={`group relative p-5 rounded-2xl border transition-all cursor-grab active:cursor-grabbing ${
                                            isAssigned 
                                            ? 'bg-emerald-500/10 border-emerald-500/30' 
                                            : 'bg-slate-800/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">SKU: {item.sku}</span>
                                            {isAssigned && <CheckCircle2 size={14} className="text-emerald-500" />}
                                        </div>
                                        <h4 className="text-lg font-bold text-white leading-tight">{item.product_name}</h4>
                                        <div className="flex items-center gap-4 mt-3">
                                            <div className="text-xs text-slate-500 font-bold">Qty: <span className="text-slate-300">{item.quantity}</span></div>
                                            {isAssigned && (
                                                <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                                                    <MapIcon size={12} /> ASSIGNED
                                                </div>
                                            )}
                                        </div>
                                        
                                        {!isAssigned && (
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <ChevronRight className="text-slate-600" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* QR Code Overlay */}
            <AnimatePresence>
                {showQR && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-xl flex items-center justify-center p-12"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-slate-900 border border-white/10 p-12 rounded-[60px] max-w-lg w-full text-center shadow-2xl"
                        >
                            <div className="bg-white p-8 rounded-[40px] mb-8 inline-block shadow-inner">
                                {/* Placeholder for real QR. In reality we use a lib like qrcode.react */}
                                <div className="w-64 h-64 bg-slate-100 flex items-center justify-center border-4 border-slate-200">
                                    <QrCode size={180} className="text-slate-900" />
                                </div>
                            </div>
                            
                            <h3 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">Mission Ready!</h3>
                            <p className="text-slate-400 mb-8 font-bold leading-relaxed">
                                Share this with your stockers. The session will expire automatically in 12 hours.
                            </p>
                            
                            <div className="bg-slate-950/50 p-6 rounded-3xl border border-white/5 mb-8 text-left">
                                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2">Local Edge Access</p>
                                <p className="text-cyan-500 font-mono text-xs break-all">http://192.168.1.50:8085/portal?t={currentPlan?.token}</p>
                            </div>

                            <button 
                                onClick={() => setShowQR(false)}
                                className="w-full bg-white text-slate-900 p-5 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                Close Dashboard <ArrowRight size={20} />
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
