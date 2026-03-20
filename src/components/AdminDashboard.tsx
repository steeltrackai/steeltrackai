import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Stage, Layer, Rect, Group, Text as KonvaText, Transformer, Image as KonvaImage, Arrow, Line } from 'react-konva';
import { LayoutGrid, Package, Users, BarChart3, Upload, Plus, Trash2, Save, Map as MapIcon, Loader2, Printer, QrCode, Settings, Layers, Box, Shield, Menu, X, ArrowRight, Edit3, Search, Terminal, AlertCircle, Play, Clock, AlertTriangle } from 'lucide-react';
import SetupWizard from './SetupWizard';
import DailyPlanner from './DailyPlanner';
import useImage from 'use-image';
import { supabase } from '../lib/supabaseClient';
import { ArucoMarker } from './ArucoMarker';

interface Pallet {
  id: number;
  pallet_id_tag: string;
  sku_name: string;
  quantity: number;
  erp_quantity: number;
  expiry_date: string;
  status: 'standard' | 'near_expiry' | 'partial' | 'finished';
  created_at?: string;
}

interface Forklift {
  id: string;
  location_x: number;
  location_y: number;
  location_z: number;
  status: string;
  battery: number;
}

interface SafetyEvent {
  id: number;
  event_type: string;
  severity: string;
  timestamp: string;
  details: any;
  forklift_id?: string;
}

interface Pedestrian {
  id: string;
  x: number;
  y: number;
}

interface Block {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'rack' | 'zone' | 'path';
  name: string;
  color?: string;
  levels?: number;
  slots?: number;
  zoneType?: 'vegetables' | 'bakery' | 'other';
  orientation?: 'horizontal' | 'vertical';
  traffic?: 'one-way' | 'two-way';
  trafficDirection?: 'forward' | 'backward';
  rotation?: number;
}

const TelemetryWave = ({ color = '#10b981', speed = 2 }) => {
  return (
    <div className="flex items-end gap-[2px] h-4">
      {[...Array(6)].map((_, i) => (
        <motion.div
           key={i}
           animate={{ 
             height: [4, 12, 4],
             opacity: [0.3, 1, 0.3]
           }}
           transition={{ 
             duration: speed, 
             repeat: Infinity, 
             delay: i * 0.15,
             ease: "easeInOut"
           }}
           className="w-1 rounded-full"
           style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
};

export default function AdminDashboard({ 
    onBack,
    floorSpots: externalFloorSpots,
    onSpotsUpdate
}: { 
    onBack: () => void,
    floorSpots: any[],
    onSpotsUpdate: (spots: any[]) => void
}) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState('Map Editor');
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [stageSize, setStageSize] = useState({ width: 1000, height: 800 });
  const [floorPlanUrl, setFloorPlanUrl] = useState<string | null>(null);
  const [image] = useImage(floorPlanUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const transformerRef = useRef<any>(null);
  const stageRef = useRef<any>(null);

  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [isAddingPallet, setIsAddingPallet] = useState(false);
  const [newPallet, setNewPallet] = useState<Partial<Pallet>>({
    pallet_id_tag: '',
    sku_name: '',
    quantity: 1,
    erp_quantity: 1,
    status: 'standard'
  });
  const [forklifts, setForklifts] = useState<Forklift[]>([]);
  const [safetyEvents, setSafetyEvents] = useState<SafetyEvent[]>([]);
  const [pedestrians, setPedestrians] = useState<Pedestrian[]>([]);
  const [safetyStats, setSafetyStats] = useState({
    nearMisses: 0,
    collisionFreeHours: 48,
    operationalHours: 124.5,
    systemHealth: 99.8
  });
  const [fcfsViolation, setFcfsViolation] = useState<{sku: string, current_pallet: string, older_pallet: string} | null>(null);

  useEffect(() => {
    async function loadLayout() {
      const { data, error } = await supabase
        .from('warehouse_layout')
        .select('layout_data')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && !error && data.layout_data) {
        setBlocks(data.layout_data as Block[]);
      }
    }
    loadLayout();

    const loadData = async () => {
      try {
        const [pResp, flResp, seResp, pedResp] = await Promise.all([
          fetch('http://localhost:8085/pallets'),
          fetch('http://localhost:8085/forklifts'),
          fetch('http://localhost:8085/safety-events'),
          fetch('http://localhost:8085/pedestrians')
        ]);
        setPallets(await pResp.json());
        setForklifts(await flResp.json());
        setSafetyEvents(await seResp.json());
        setPedestrians(await pedResp.json());
      } catch (err) { console.error("Local sync error:", err); }
    };
    loadData();
    const interval = setInterval(loadData, 5000);
    
    // Safety Metrics Simulation
    const reportInterval = setInterval(() => {
      setSafetyStats(prev => ({
        ...prev,
        operationalHours: prev.operationalHours + 0.01,
        systemHealth: 98 + Math.random() * 2
      }));
    }, 10000);

    // SSE for Real-time FCFS Rotation Alerts
    const eventSource = new EventSource('http://localhost:8085/stream');
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.fcfs_violation) {
          setFcfsViolation(data.fcfs_violation);
          // Auto-clear after 15 seconds
          setTimeout(() => setFcfsViolation(null), 15000);
        }
      } catch (e) { console.error("SSE parse error", e); }
    };

    return () => {
      clearInterval(interval);
      clearInterval(reportInterval);
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    if (Array.isArray(safetyEvents)) {
      setSafetyStats(prev => ({
        ...prev,
        nearMisses: safetyEvents.filter(e => e?.event_type?.includes('Pedestrian') || e?.event_type?.includes('SAFETY')).length
      }));
    }
  }, [safetyEvents]);

  useEffect(() => {
    if (selectedBlockId && transformerRef.current && stageRef.current) {
      const stage = stageRef.current;
      const selectedNode = stage.findOne('#' + selectedBlockId);
      if (selectedNode) {
        transformerRef.current.nodes([selectedNode]);
        transformerRef.current.getLayer().batchDraw();
      }
    }
  }, [selectedBlockId, blocks]);

  const selectedBlock = blocks.find(b => b.id === selectedBlockId) || null;

  const addBlock = (type: 'rack' | 'zone' | 'path') => {
    const count = blocks.filter(b => b.type === type).length + 1;
    const newBlock: Block = {
      id: Date.now().toString(),
      x: 50,
      y: 50,
      width: type === 'path' ? 200 : 100,
      height: type === 'path' ? 40 : 100,
      type,
      name: type === 'rack' ? `Aisle ${count.toString().padStart(2, '0')} ` : type === 'zone' ? 'New Dept' : 'New Path',
      color: type === 'zone' ? '#dcfce7' : undefined,
      orientation: 'horizontal',
      traffic: 'two-way',
      trafficDirection: 'forward',
      levels: type === 'rack' ? 1 : undefined,
      slots: type === 'rack' ? 10 : undefined,
      zoneType: type === 'zone' ? 'other' : undefined,
    };
    setBlocks([...blocks, newBlock]);
  };

  const updateBlock = (id: string, updates: Partial<Block>) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFloorPlanUrl(URL.createObjectURL(file));
    }
  };

  const handleSavePallet = async () => {
    if (!newPallet.sku_name || !newPallet.pallet_id_tag) return;

    setIsSaving(true);
    const { data, error } = await supabase
      .from('pallets')
      .insert([newPallet])
      .select();

    if (data && !error) {
      setPallets([data[0], ...pallets]);
      setNewPallet({ pallet_id_tag: '', sku_name: '', quantity: 1, erp_quantity: 1, status: 'standard' });
      setIsAddingPallet(false);
    }
    setIsSaving(false);
  };

  const sortedBlocks = [...(blocks || [])].sort((a, b) => {
    const order: Record<string, number> = { zone: 0, path: 1, rack: 2 };
    return (order[a.type] ?? 99) - (order[b.type] ?? 99);
  });
  return (
    <div className="flex h-screen w-full bg-zinc-950 text-white font-sans overflow-hidden">
      {/* Sidebar with Glassmorphism */}
      <motion.div 
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="w-72 bg-zinc-950/40 backdrop-blur-2xl border-r border-white/5 flex flex-col p-6 overflow-y-auto shrink-0 relative z-20"
      >
        <div className="flex items-center gap-3 mb-10 px-2">
          <motion.div 
            whileHover={{ rotate: 15, scale: 1.1 }}
            className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-900/40 cursor-pointer"
          >
            <Shield size={20} className="text-white" />
          </motion.div>
          <span className="font-bold tracking-tight text-xl">SteelTrack <span className="text-emerald-400">Admin</span></span>
        </div>

        <nav className="flex-1 space-y-1">
          {[
            { id: 'Map Editor', icon: <LayoutGrid size={18} /> },
            { id: 'Inventory', icon: <Box size={18} />, sub: 'FCFS Priority' },
            { id: 'Analytics', icon: <BarChart3 size={18} /> },
            { id: 'Planner', icon: <MapIcon size={18} />, label: 'Daily Planner', sub: 'NEW' },
            { id: 'Staff', icon: <Users size={18} /> },
            { id: 'Setup', icon: <Play size={18} />, label: 'Setup Wizard' },
            { id: 'Settings', icon: <Settings size={18} /> },
            { id: 'Logs', icon: <Terminal size={18} /> },
          ].map((item) => (
            <motion.button 
              key={item.id}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveNav(item.id)}
              className={`w-full relative group flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                activeNav === item.id 
                ? 'text-white' 
                : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {activeNav === item.id && (
                <motion.div 
                  layoutId="activeNav"
                  className="absolute inset-0 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-900/40"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              
              <div className="relative flex items-center gap-3 flex-1 z-10 transition-colors">
                <span className={activeNav === item.id ? 'text-white' : 'group-hover:text-emerald-400'}>
                    {item.icon}
                </span>
                <span className="font-semibold text-sm">{item.label || item.id}</span>
              </div>
              
              {item.sub && (
                <span className={`relative z-10 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter ${
                    activeNav === item.id ? 'bg-white/20 text-white' : 'bg-emerald-500/10 text-emerald-500'
                }`}>
                    {item.sub}
                </span>
              )}
            </motion.button>
          ))}
        </nav>

        {/* Footer Stats / Telemetry */}
        <div className="mt-8 p-6 bg-white/[0.02] border border-white/5 rounded-[32px] space-y-4">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Core Status</span>
                <TelemetryWave />
            </div>
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">AI Sync</span>
                <span className="text-xs font-mono text-emerald-400">99.8%</span>
            </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onBack}
          className="mt-6 w-full flex items-center justify-center gap-2 bg-zinc-900/50 hover:bg-zinc-800 p-4 rounded-2xl text-zinc-400 text-[11px] font-black uppercase tracking-widest transition-all border border-white/5"
        >
          Return to Tablet Interface
        </motion.button>
      </motion.div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {activeNav === 'Planner' ? (
            <DailyPlanner floorSpots={externalFloorSpots} onSpotsUpdate={onSpotsUpdate} />
        ) : activeNav === 'Map Editor' ? (
          <div className="flex-1 flex flex-col p-8 overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold">Map Editor</h2>
              {/* Toolbar */}
              <div className="flex gap-4">
                <label className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-lg cursor-pointer">
                  <Upload size={18} /> Upload Floor Plan
                  <input type="file" className="hidden" onChange={handleUpload} accept="image/*" />
                </label>
                <button onClick={() => addBlock('rack')} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg">
                  <Plus size={18} /> Add Rack
                </button>
                <button onClick={() => addBlock('zone')} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-lg">
                  <Plus size={18} /> Add Zone
                </button>
                <button onClick={() => addBlock('path')} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-lg">
                  <MapIcon size={18} /> Add Path
                </button>
                <button onClick={() => setShowGrid(!showGrid)} className={`flex items-center gap-2 px-4 py-2 rounded-lg ${showGrid ? 'bg-zinc-700' : 'bg-zinc-800'} `}>
                  <LayoutGrid size={18} /> {showGrid ? 'Hide' : 'Show'} Grid
                </button>
                <div className="flex items-center gap-2 bg-zinc-800 p-1 rounded-lg">
                  <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-2 hover:bg-zinc-700 rounded">-</button>
                  <span className="text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="p-2 hover:bg-zinc-700 rounded">+</button>
                </div>
                <div className="flex items-center gap-2 bg-zinc-800 p-1 rounded-lg">
                  <input
                    type="number"
                    value={stageSize.width}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 100;
                      setStageSize(s => ({ ...s, width: Math.max(100, val) }));
                    }}
                    className="w-16 bg-transparent text-sm text-center"
                  />
                  <span className="text-zinc-500">x</span>
                  <input
                    type="number"
                    value={stageSize.height}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 100;
                      setStageSize(s => ({ ...s, height: Math.max(100, val) }));
                    }}
                    className="w-16 bg-transparent text-sm text-center"
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 flex gap-8 overflow-hidden">
              <div className="flex-1 bg-zinc-900 rounded-2xl border border-zinc-800 overflow-auto">
                <Stage
                  width={Number(stageSize.width) || 1000}
                  height={Number(stageSize.height) || 800}
                  scale={{ x: zoom, y: zoom }}
                  ref={stageRef}
                  onClick={(e) => {
                    if (e.target === e.target.getStage()) {
                      setSelectedBlockId(null);
                    }
                  }}
                >
                  <Layer>
                    {image && <KonvaImage image={image} width={stageSize.width} height={stageSize.height} opacity={0.5} />}
                    {showGrid && (
                      <Group>
                        {Array.from({ length: Math.ceil(stageSize.width / 50) + 1 }).map((_, i) => (
                          <Line key={`v-${i}`} points={[i * 50, 0, i * 50, stageSize.height]} stroke="#333" strokeWidth={1} />
                        ))}
                        {Array.from({ length: Math.ceil(stageSize.height / 50) + 1 }).map((_, i) => (
                          <Line key={`h-${i}`} points={[0, i * 50, stageSize.width, i * 50]} stroke="#333" strokeWidth={1} />
                        ))}
                      </Group>
                    )}
                    <Group>
                      {sortedBlocks.map((block) => (
                        <Group
                          key={block.id}
                          id={block.id}
                          x={block.x}
                          y={block.y}
                          draggable
                          onDragEnd={(e) => {
                            updateBlock(block.id, {
                              x: e.target.x(),
                              y: e.target.y(),
                            });
                          }}
                          onTransformEnd={(e) => {
                            const node = e.target;
                            updateBlock(block.id, {
                              x: node.x(),
                              y: node.y(),
                              width: Math.max(5, node.width() * node.scaleX()),
                              height: Math.max(5, node.height() * node.scaleY()),
                            });
                            node.scaleX(1);
                            node.scaleY(1);
                          }}
                          onClick={() => setSelectedBlockId(block.id)}
                        >
                          <Rect
                            width={block.width}
                            height={block.height}
                            fill={
                              block.type === 'zone'
                                ? (block.zoneType === 'vegetables' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(168, 85, 247, 0.2)')
                                : block.type === 'path'
                                ? 'rgba(59, 130, 246, 0.1)'
                                : 'rgba(251, 191, 36, 0.3)'
                            }
                            stroke={selectedBlockId === block.id ? '#10b981' : '#444'}
                            strokeWidth={selectedBlockId === block.id ? 2 : 1}
                            cornerRadius={4}
                          />
                          {/* Forklifts */}
                          {forklifts.map((fl) => (
                            <Group key={fl.id} x={fl.location_x * 50} y={fl.location_y * 50}>
                              <Rect
                                width={12}
                                height={12}
                                fill="#fbbf24"
                                cornerRadius={2}
                                rotation={45}
                                shadowBlur={10}
                                shadowColor="#fbbf24"
                              />
                              <KonvaText
                                text={fl.id}
                                x={15}
                                y={-5}
                                fill="#fff"
                                fontSize={10}
                                fontStyle="bold"
                              />
                            </Group>
                          ))}
                          {/* Pedestrians */}
                          {pedestrians.map((p) => (
                            <Group key={p.id} x={p.x * 50} y={p.y * 50}>
                              <Rect
                                width={8}
                                height={8}
                                fill="#ef4444"
                                cornerRadius={4}
                                shadowBlur={5}
                                shadowColor="#ef4444"
                              />
                            </Group>
                          ))}
                        </Group>
                      ))}
                      {selectedBlockId && (
                        <Transformer
                          ref={transformerRef}
                          boundBoxFunc={(oldBox, newBox) => {
                            if (newBox.width < 5 || newBox.height < 5) return oldBox;
                            return newBox;
                          }}
                        />
                      )}
                    </Group>
                  </Layer>
                </Stage>
              </div>

              {/* Sidebar Properties */}
              {selectedBlockId && (
                <div className="w-80 bg-zinc-900 rounded-2xl border border-zinc-800 p-6 overflow-y-auto">
                  <h3 className="text-xl font-bold mb-6">Properties</h3>
                  {/* Property fields */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-zinc-500 uppercase font-bold">Name</label>
                      <input
                        type="text"
                        value={sortedBlocks.find(b => b.id === selectedBlockId)?.name || ''}
                        onChange={(e) => updateBlock(selectedBlockId, { name: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 mt-1"
                      />
                    </div>
                    <button
                      onClick={() => {
                        setBlocks(blocks.filter(b => b.id !== selectedBlockId));
                        setSelectedBlockId(null);
                      }}
                      className="w-full bg-red-950/30 text-red-500 border border-red-900/50 py-2 rounded-lg text-sm mt-4 hover:bg-red-950/50"
                    >
                      Delete Element
                    </button>
                    <button
                        onClick={async () => {
                            setIsSaving(true);
                            await supabase.from('warehouse_layout').insert({ layout_data: blocks, is_active: true });
                            setIsSaving(false);
                        }}
                        disabled={isSaving}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-bold text-sm mt-4 flex items-center justify-center gap-2"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        Save Layout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : activeNav === 'Inventory' ? (
          <div className="flex-1 p-8 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-3xl font-bold">Inventory Management</h2>
              <div className="flex gap-4">
                  <div className="bg-zinc-800/50 px-4 py-2 rounded-xl border border-white/5 flex items-center gap-3">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">FCFS Rotation Active</span>
                  </div>
                  <button 
                    onClick={() => setIsAddingPallet(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/40"
                  >
                    <Plus size={18} /> New Pallet
                  </button>
              </div>
            </div>
            
            <div className="bg-zinc-800/20 border border-white/5 p-4 rounded-2xl mb-8 flex items-center justify-between text-sm">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <Box size={16} className="text-emerald-400" />
                        <span className="text-zinc-300">Total Active: <b>{pallets.length}</b></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Clock size={16} className="text-amber-400" />
                        <span className="text-zinc-300">Oldest Stock: <b>{Math.max(0, ...pallets.map(p => p.created_at ? Math.floor((new Date().getTime() - new Date(p.created_at).getTime()) / (1000 * 3600 * 24)) : 0))} days</b></span>
                    </div>
                </div>
                <p className="text-zinc-500 italic text-xs">Pallets sorted by arrival time (Oldest First)</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto flex-1 pr-2 custom-scrollbar">
              {[...pallets].sort((a,b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()).map((pallet, index) => {
                const daysOld = pallet.created_at ? Math.floor((new Date().getTime() - new Date(pallet.created_at).getTime()) / (1000 * 3600 * 24)) : 0;
                return (
                <div key={pallet.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4 relative group">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-lg font-bold text-white flex items-center gap-2">
                        {pallet.sku_name}
                        {index < 3 && <span className="text-[10px] bg-red-900/40 text-red-500 px-1.5 py-0.5 rounded animate-pulse">AGING</span>}
                      </h4>
                      <p className="text-zinc-400 text-sm">ID: {pallet.pallet_id_tag}</p>
                    </div>
                    <div className="bg-zinc-800 p-2 rounded-lg">
                      <QrCode size={20} className="text-emerald-400" />
                    </div>
                  </div>

                  <div className="flex justify-center bg-white p-4 rounded-xl">
                    <ArucoMarker id={parseInt(pallet.pallet_id_tag.slice(-3)) || 0} size={120} />
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <div className="flex flex-col">
                        <span className="text-zinc-400 text-xs">Qty: {pallet.quantity}</span>
                        <span className="text-zinc-500 text-[10px]">Aging: {daysOld} days</span>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                        pallet.status === 'standard' ? 'bg-emerald-900/30 text-emerald-400' :
                        pallet.status === 'partial' ? 'bg-cyan-900/30 text-cyan-400 border border-cyan-500/30' :
                        pallet.status === 'near_expiry' ? 'bg-amber-900/30 text-amber-400' :
                        'bg-red-900/30 text-red-400'
                      }`}>
                      {pallet.status.toUpperCase()}
                    </span>
                  </div>

                  <button className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 py-2 rounded-lg transition-colors">
                    <Printer size={16} /> Print Label
                  </button>
                </div>
                );
              })}
            </div>

            {/* Add Pallet Modal */}
            {isAddingPallet && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 w-full max-w-md flex flex-col gap-6">
                  <h3 className="text-2xl font-bold">Register Pallet</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Pallet ID Tag (e.g. PLT-123)</label>
                      <input
                        type="text"
                        value={newPallet.pallet_id_tag}
                        onChange={(e) => setNewPallet({ ...newPallet, pallet_id_tag: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 p-3 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">SKU Name</label>
                      <input
                        type="text"
                        value={newPallet.sku_name}
                        onChange={(e) => setNewPallet({ ...newPallet, sku_name: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 p-3 rounded-xl"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-zinc-400 mb-1">Qty (AI)</label>
                        <input
                          type="number"
                          value={newPallet.quantity}
                          onChange={(e) => setNewPallet({ ...newPallet, quantity: parseInt(e.target.value) })}
                          className="w-full bg-zinc-800 border border-zinc-700 p-3 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-zinc-400 mb-1">Qty (ERP)</label>
                        <input
                          type="number"
                          value={newPallet.erp_quantity}
                          onChange={(e) => setNewPallet({ ...newPallet, erp_quantity: parseInt(e.target.value) })}
                          className="w-full bg-zinc-800 border border-zinc-700 p-3 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-zinc-400 mb-1">Status</label>
                        <select
                          value={newPallet.status}
                          onChange={(e) => setNewPallet({ ...newPallet, status: e.target.value as any })}
                          className="w-full bg-zinc-800 border border-zinc-700 p-3 rounded-xl"
                        >
                          <option value="standard">Standard</option>
                          <option value="near_expiry">Near Expiry</option>
                          <option value="empty">Empty</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setIsAddingPallet(false)}
                      className="flex-1 bg-zinc-800 hover:bg-zinc-700 p-4 rounded-2xl"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSavePallet}
                      disabled={isSaving}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 p-4 rounded-2xl disabled:opacity-50"
                    >
                      {isSaving ? 'Registering...' : 'Register'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeNav === 'Analytics' ? (
          <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
            <h2 className="text-3xl font-bold mb-8">Inventory Accuracy Report</h2>

            {/* Safety Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
                <p className="text-zinc-400 text-sm mb-1">Safety Score</p>
                <h3 className="text-4xl font-bold text-emerald-400">{safetyStats.systemHealth.toFixed(1)}%</h3>
                <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active Monitoring
                </p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
                <p className="text-zinc-400 text-sm mb-1">Near-Misses (Today)</p>
                <h3 className="text-4xl font-bold text-white">{safetyStats.nearMisses}</h3>
                <p className="text-xs text-zinc-500 mt-2">Yields & Obstacle Avoided</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
                <p className="text-zinc-400 text-sm mb-1">Collision-Free Time</p>
                <h3 className="text-4xl font-bold text-blue-400">{safetyStats.collisionFreeHours}h</h3>
                <p className="text-xs text-zinc-500 mt-2">Continuous Operation</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
                <p className="text-zinc-400 text-sm mb-1">Total Op Hours</p>
                <h3 className="text-4xl font-bold text-zinc-400">{Math.floor(safetyStats.operationalHours)}h</h3>
                <p className="text-xs text-zinc-500 mt-2">Fleet Total</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
                <p className="text-zinc-400 text-sm mb-1">Global Accuracy</p>
                <h3 className="text-4xl font-bold text-emerald-400">
                  {Math.round((pallets.filter(p => p.quantity === p.erp_quantity).length / (pallets.length || 1)) * 100)}%
                </h3>
                <p className="text-xs text-zinc-500 mt-2">Based on {pallets.length} active pallets</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
                <p className="text-zinc-400 text-sm mb-1">Missing Inventory</p>
                <h3 className="text-4xl font-bold text-red-500">
                  {pallets.reduce((acc, p) => acc + Math.max(0, p.erp_quantity - p.quantity), 0)}
                </h3>
                <p className="text-xs text-zinc-500 mt-2">Items reported by ERP but not seen</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
                <p className="text-zinc-400 text-sm mb-1">Ghost Inventory</p>
                <h3 className="text-4xl font-bold text-amber-500">
                  {pallets.reduce((acc, p) => acc + Math.max(0, p.quantity - p.erp_quantity), 0)}
                </h3>
                <p className="text-xs text-zinc-500 mt-2">Items seen but not in ERP</p>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-zinc-800/50">
                  <tr>
                    <th className="p-4 text-zinc-400 font-medium">SKU Name / Tag</th>
                    <th className="p-4 text-zinc-400 font-medium">System (AI)</th>
                    <th className="p-4 text-zinc-400 font-medium">ERP (Manual)</th>
                    <th className="p-4 text-zinc-400 font-medium">Discrepancy</th>
                    <th className="p-4 text-zinc-400 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {Array.isArray(pallets) && pallets.map(pallet => {
                    const diff = pallet.quantity - pallet.erp_quantity;
                    return (
                      <tr key={pallet.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4">
                          <div className="font-medium">{pallet.sku_name}</div>
                          <div className="text-xs text-zinc-500">{pallet.pallet_id_tag}</div>
                        </td>
                        <td className="p-4 font-bold">{pallet.quantity}</td>
                        <td className="p-4 text-zinc-400">{pallet.erp_quantity}</td>
                        <td className={`p-4 font-bold ${diff === 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-500' : 'text-amber-500'}`}>
                          {diff > 0 ? `+${diff}` : diff}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${diff === 0 ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'
                            }`}>
                            {diff === 0 ? 'Match' : 'Mismatch'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Incident Feed Section */}
            <div className="mt-8">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-2 text-red-400">
                <Users size={24} /> Safety Incident Feed
              </h3>
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
                <table className="w-full text-left">
                   <thead className="bg-zinc-800/50">
                    <tr>
                      <th className="p-4 text-zinc-400 font-medium">Time</th>
                      <th className="p-4 text-zinc-400 font-medium">Forklift</th>
                      <th className="p-4 text-zinc-400 font-medium">Type</th>
                      <th className="p-4 text-zinc-400 font-medium">Severity</th>
                      <th className="p-4 text-zinc-400 font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {Array.isArray(safetyEvents) && safetyEvents.map(event => (
                      <tr key={event.id} className="hover:bg-red-900/10 transition-colors">
                        <td className="p-4 text-zinc-400 text-xs">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="p-4 font-mono text-zinc-300">
                          {event.forklift_id || (event.details?.location ? 'System Sensor' : 'Floor Edge')}
                        </td>
                        <td className="p-4">
                          <span className={`${(event.event_type || '').includes('DANGER') ? 'text-red-500 font-bold' : 'text-amber-500'}`}>
                            {event.event_type}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            event.severity === 'high' ? 'bg-red-900/30 text-red-500' : 'bg-zinc-800 text-zinc-400'
                          }`}>
                            {event.severity}
                          </span>
                        </td>
                        <td className="p-4 text-zinc-500 text-sm">
                          {JSON.stringify(event.details)}
                        </td>
                      </tr>
                    ))}
                    {safetyEvents.length === 0 && (
                      <tr><td colSpan={4} className="p-8 text-center text-zinc-500 italic">No incidents recorded in the last 24h.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeNav === 'Staff' ? (
          <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold">Staff Roster & Safety Certifications</h2>
              <div className="flex gap-4">
                <button className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-lg text-sm">Download Report</button>
                <button className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg text-sm font-bold">+ Add Member</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
                <p className="text-zinc-400 text-sm mb-1">Active Staff</p>
                <h3 className="text-4xl font-bold text-white">12</h3>
                <p className="text-xs text-emerald-400 mt-2">● 8 on floor | 4 on break</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
                <p className="text-zinc-400 text-sm mb-1">Safety Compliance</p>
                <h3 className="text-4xl font-bold text-emerald-400">100%</h3>
                <p className="text-xs text-zinc-500 mt-2">All certifications up to date</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
                <p className="text-zinc-400 text-sm mb-1">Last Safety Drill</p>
                <h3 className="text-4xl font-bold text-blue-400">4d ago</h3>
                <p className="text-xs text-zinc-500 mt-2">Scheduled: April 15th</p>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-zinc-800/50">
                  <tr>
                    <th className="p-4 text-zinc-400 font-medium">Employee</th>
                    <th className="p-4 text-zinc-400 font-medium">Role</th>
                    <th className="p-4 text-zinc-400 font-medium">Certification</th>
                    <th className="p-4 text-zinc-400 font-medium">Status</th>
                    <th className="p-4 text-zinc-400 font-medium">Last Login</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {[
                    { name: 'Ricardo Santos', role: 'Forklift Operator', cert: 'Vision Pro v2', status: 'Active', skill: 'Expert' },
                    { name: 'Ana Oliveira', role: 'Floor Supervisor', cert: 'Safety Lead', status: 'On Break', skill: 'Advanced' },
                    { name: 'Marco Silva', role: 'Inventory Specialist', cert: 'Standard Ops', status: 'Active', skill: 'Intermediate' },
                    { name: 'Juliana Costa', role: 'Forklift Operator', cert: 'Vision Pro v2', status: 'Active', skill: 'Advanced' },
                  ].map((member, i) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-emerald-400">
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <div className="font-medium">{member.name}</div>
                            <div className="text-[10px] text-zinc-500">ID: ST-00{i+1}42</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm">{member.role}</td>
                      <td className="p-4">
                        <span className="text-[10px] bg-zinc-800 px-2 py-1 rounded-full border border-emerald-900/50 text-emerald-400 font-bold">
                          {member.cert}
                        </span>
                      </td>
                      <td className="p-4 text-sm">
                        <span className={`flex items-center gap-1.5 ${member.status === 'Active' ? 'text-emerald-400' : 'text-amber-400'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${member.status === 'Active' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                          {member.status}
                        </span>
                      </td>
                      <td className="p-4 text-zinc-500 text-xs font-mono">2026-03-18 08:{15+i}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeNav === 'Setup' ? (
          <SetupWizard onComplete={() => setActiveNav('Map Editor')} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-500">
            <p className="text-xl">Content for {activeNav} coming soon...</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {fcfsViolation && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[100] bg-red-600/90 backdrop-blur-xl border border-red-400 p-6 rounded-3xl shadow-[0_20px_50px_rgba(220,38,38,0.5)] flex items-center gap-6 text-white min-w-[500px]"
          >
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-xl">
              <AlertTriangle size={32} className="text-red-600 animate-pulse" />
            </div>
            <div className="flex-1">
              <h4 className="text-xl font-black uppercase tracking-tighter">Rotation Error Detected!</h4>
              <p className="text-red-100 text-sm font-medium">
                SKU: <span className="font-bold whitespace-nowrap">{fcfsViolation.sku}</span>
              </p>
              <div className="mt-2 text-[10px] bg-red-900/40 p-2 rounded-lg border border-red-400/20 font-mono">
                <div className="flex justify-between">
                  <span>PICKED:</span> <span className="text-white">{fcfsViolation.current_pallet}</span>
                </div>
                <div className="flex justify-between text-emerald-300 font-bold">
                  <span>PRIORITY (OLDEST):</span> <span>{fcfsViolation.older_pallet}</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setFcfsViolation(null)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <Shield size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
