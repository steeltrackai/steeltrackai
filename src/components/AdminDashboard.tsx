import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Group, Text as KonvaText, Transformer, Image as KonvaImage, Arrow, Line } from 'react-konva';
import { LayoutGrid, Package, Users, BarChart3, Upload, Plus, Trash2, Save, Map as MapIcon, Loader2 } from 'lucide-react';
import useImage from 'use-image';
import { supabase } from '../lib/supabaseClient';

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

export default function AdminDashboard({ onBack }: { onBack: () => void }) {
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

  // Load layout on mount
  useEffect(() => {
    async function loadLayout() {
      const { data, error } = await supabase
        .from('warehouse_layout')
        .select('layout_data')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data && !error) {
        setBlocks(data.layout_data as Block[]);
      }
    }
    loadLayout();
  }, []);

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

  const sortedBlocks = [...blocks].sort((a, b) => {
    const order = { zone: 0, path: 1, rack: 2 };
    return order[a.type] - order[b.type];
  });

  return (
    <div className="flex h-full w-full bg-zinc-950 text-white font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-zinc-900 border-r border-zinc-800 p-6 flex flex-col gap-8">
        <h1 className="text-2xl font-bold text-white">SteelTrack Admin</h1>
        <nav className="space-y-2">
          {['Map Editor', 'Inventory', 'Staff', 'Reports'].map(item => (
            <button
              key={item}
              onClick={() => setActiveNav(item)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${activeNav === item ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'} `}
            >
              {item === 'Map Editor' && <LayoutGrid size={20} />}
              {item === 'Inventory' && <Package size={20} />}
              {item === 'Staff' && <Users size={20} />}
              {item === 'Reports' && <BarChart3 size={20} />}
              {item}
            </button>
          ))}
        </nav>
        <button
          onClick={onBack}
          className="mt-auto w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 p-3 rounded-xl text-zinc-300"
        >
          Back to App
        </button>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex">
        {/* Canvas */}
        <div className="flex-1 p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold">Map Editor</h2>
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
                <input type="number" value={stageSize.width} onChange={(e) => setStageSize(s => ({ ...s, width: parseInt(e.target.value) }))} className="w-16 bg-transparent text-sm text-center" />
                <span className="text-zinc-500">x</span>
                <input type="number" value={stageSize.height} onChange={(e) => setStageSize(s => ({ ...s, height: parseInt(e.target.value) }))} className="w-16 bg-transparent text-sm text-center" />
              </div>
            </div>
          </div>
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-auto h-[calc(100vh-150px)]">
            <Stage
              width={stageSize.width}
              height={stageSize.height}
              scale={{ x: zoom, y: zoom }}
              ref={stageRef}
              onClick={(e) => { if (e.target === e.target.getStage()) setSelectedBlockId(null); }}
              onWheel={(e) => {
                e.evt.preventDefault();
                const scaleBy = 1.1;
                const stage = e.target.getStage();
                const oldScale = stage.scaleX();
                const pointer = stage.getPointerPosition();
                const mousePointTo = {
                  x: (pointer!.x - stage.x()) / oldScale,
                  y: (pointer!.y - stage.y()) / oldScale,
                };
                const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
                setZoom(Math.max(0.5, Math.min(3, newScale)));
              }}
            >
              <Layer>
                {image && <KonvaImage image={image} width={stageSize.width} height={stageSize.height} />}
                {showGrid && Array.from({ length: Math.max(stageSize.width, stageSize.height) / 20 }).map((_, i) => (
                  <React.Fragment key={i}>
                    <Line points={[i * 20, 0, i * 20, stageSize.height]} stroke="#52525b" strokeWidth={1} />
                    <Line points={[0, i * 20, stageSize.width, i * 20]} stroke="#52525b" strokeWidth={1} />
                  </React.Fragment>
                ))}
                {sortedBlocks.map(block => (
                  <Group
                    key={block.id}
                    id={block.id}
                    x={block.x}
                    y={block.y}
                    rotation={block.rotation || 0}
                    draggable
                    onDragEnd={(e) => {
                      const x = Math.round(e.target.x() / 20) * 20;
                      const y = Math.round(e.target.y() / 20) * 20;
                      updateBlock(block.id, { x, y });
                    }}
                    onTransformEnd={(e) => {
                      const node = e.target;
                      const scaleX = node.scaleX();
                      const scaleY = node.scaleY();
                      node.scaleX(1);
                      node.scaleY(1);
                      updateBlock(block.id, {
                        x: Math.round(node.x() / 20) * 20,
                        y: Math.round(node.y() / 20) * 20,
                        width: Math.max(20, Math.round((block.width * scaleX) / 20) * 20),
                        height: Math.max(20, Math.round((block.height * scaleY) / 20) * 20),
                        rotation: Math.round(node.rotation() / 45) * 45,
                      });
                    }}
                    onClick={() => setSelectedBlockId(block.id)}
                  >
                    <Rect
                      width={block.width}
                      height={block.height}
                      fill={
                        block.type === 'rack' ? '#4b5563' :
                          block.type === 'zone' ? (block.color || (block.zoneType === 'vegetables' ? '#dcfce7' : block.zoneType === 'bakery' ? '#fef9c3' : '#e5e7eb')) :
                            '#d4d4d8'
                      }
                      opacity={block.type === 'rack' ? 0.5 : block.type === 'zone' ? 0.8 : 0.6}
                      stroke={
                        selectedBlockId === block.id ? '#3b82f6' :
                          block.type === 'zone' ? '#666' :
                            block.type === 'rack' || block.type === 'path' ? '#000' : 'transparent'
                      }
                      strokeWidth={block.type === 'zone' ? 2 : 1}
                      strokeDash={block.type === 'zone' ? [10, 5] : []}
                      cornerRadius={4}
                    />
                    {block.type === 'rack' && block.levels && Array.from({ length: block.levels - 1 }).map((_, i) => (
                      <Rect
                        key={i}
                        x={0}
                        y={(block.height / block.levels!) * (i + 1)}
                        width={block.width}
                        height={2}
                        fill="rgba(255,255,255,0.3)"
                      />
                    ))}
                    {block.type === 'path' && (
                      <Arrow
                        points={block.traffic === 'one-way'
                          ? (block.trafficDirection === 'forward'
                            ? [0, block.height / 2, block.width, block.height / 2]
                            : [block.width, block.height / 2, 0, block.height / 2])
                          : [0, block.height / 3, block.width, block.height / 3, block.width, (block.height / 3) * 2, 0, (block.height / 3) * 2]
                        }
                        pointerLength={10}
                        pointerWidth={10}
                        fill="white"
                        stroke="white"
                        strokeWidth={2}
                      />
                    )}
                  </Group>
                ))}
                {sortedBlocks.map(block => (
                  <Group
                    key={block.id + '-text'}
                    x={block.type === 'path' ? block.x + block.width - (block.name.length * 8 + 10) : block.x}
                    y={block.type === 'rack' ? block.y + block.height - 20 : block.y}
                    onClick={() => setSelectedBlockId(block.id)}
                  >
                    <Rect
                      width={block.name.length * 8 + 10}
                      height={20}
                      fill="rgba(0,0,0,0.5)"
                      cornerRadius={4}
                    />
                    <KonvaText
                      text={block.name}
                      fill="white"
                      fontSize={12}
                      padding={5}
                    />
                  </Group>
                ))}
                {selectedBlockId && (
                  <Transformer
                    ref={transformerRef}
                    rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
                    boundBoxFunc={(oldBox, newBox) => {
                      if (newBox.width < 20 || newBox.height < 20) return oldBox;
                      return newBox;
                    }}
                  />
                )}
              </Layer>
            </Stage>
          </div>
        </div>

        {/* Properties Panel */}
        <div className="w-80 bg-zinc-900 border-l border-zinc-800 p-6 flex flex-col">
          <h3 className="text-xl font-bold mb-6">Properties</h3>
          {selectedBlock ? (
            <div className="space-y-4 flex-1">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Label</label>
                <input
                  type="text"
                  value={selectedBlock.name}
                  onChange={(e) => updateBlock(selectedBlock.id, { name: e.target.value })}
                  className="w-full bg-zinc-800 p-2 rounded-lg border border-zinc-700"
                />
              </div>

              {selectedBlock.type === 'zone' && (
                <>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Zone Type</label>
                    <select
                      value={selectedBlock.zoneType}
                      onChange={(e) => updateBlock(selectedBlock.id, { zoneType: e.target.value as 'vegetables' | 'bakery' | 'other' })}
                      className="w-full bg-zinc-800 p-2 rounded-lg border border-zinc-700"
                    >
                      <option value="vegetables">Vegetables</option>
                      <option value="bakery">Bakery</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Custom Color</label>
                    <input
                      type="color"
                      value={selectedBlock.color || '#dcfce7'}
                      onChange={(e) => updateBlock(selectedBlock.id, { color: e.target.value })}
                      className="w-full h-10 bg-zinc-800 rounded-lg border border-zinc-700 cursor-pointer"
                    />
                  </div>
                </>
              )}

              {selectedBlock.type === 'path' && (
                <>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Traffic</label>
                    <select
                      value={selectedBlock.traffic}
                      onChange={(e) => updateBlock(selectedBlock.id, { traffic: e.target.value as 'one-way' | 'two-way' })}
                      className="w-full bg-zinc-800 p-2 rounded-lg border border-zinc-700"
                    >
                      <option value="one-way">One-way</option>
                      <option value="two-way">Two-way</option>
                    </select>
                  </div>
                  {selectedBlock.traffic === 'one-way' && (
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Direction</label>
                      <select
                        value={selectedBlock.trafficDirection}
                        onChange={(e) => updateBlock(selectedBlock.id, { trafficDirection: e.target.value as 'forward' | 'backward' })}
                        className="w-full bg-zinc-800 p-2 rounded-lg border border-zinc-700"
                      >
                        <option value="forward">Forward</option>
                        <option value="backward">Backward</option>
                      </select>
                    </div>
                  )}
                </>
              )}

              {selectedBlock.type === 'rack' && (
                <>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Levels</label>
                    <input
                      type="number"
                      min="1" max="5"
                      value={selectedBlock.levels}
                      onChange={(e) => updateBlock(selectedBlock.id, { levels: parseInt(e.target.value) })}
                      className="w-full bg-zinc-800 p-2 rounded-lg border border-zinc-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Slots</label>
                    <input
                      type="number"
                      min="1"
                      value={selectedBlock.slots}
                      onChange={(e) => updateBlock(selectedBlock.id, { slots: parseInt(e.target.value) })}
                      className="w-full bg-zinc-800 p-2 rounded-lg border border-zinc-700"
                    />
                  </div>
                  <div className="mt-8">
                    <label className="block text-sm text-zinc-400 mb-2">3D Preview</label>
                    <div className="w-full h-32 bg-zinc-800 rounded-lg border border-zinc-700 flex items-center justify-center">
                      <Package size={48} className="text-zinc-600" />
                    </div>
                  </div>
                </>
              )}

              <button
                onClick={() => { setBlocks(blocks.filter(b => b.id !== selectedBlock.id)); setSelectedBlockId(null); }}
                className="w-full flex items-center justify-center gap-2 bg-red-900/50 hover:bg-red-900 text-red-200 p-2 rounded-lg mt-4"
              >
                <Trash2 size={16} /> Delete Block
              </button>
            </div>
          ) : (
            <p className="text-zinc-500">Select a block to edit properties.</p>
          )}

          {selectedBlock && (
            <button
              disabled={isSaving}
              onClick={async () => {
                setIsSaving(true);
                const { error } = await supabase
                  .from('warehouse_layout')
                  .insert([{ layout_data: blocks, is_active: true }]);

                setIsSaving(false);
                if (error) {
                  alert('Error saving layout: ' + error.message);
                } else {
                  alert('Layout saved to Supabase!');
                }
              }}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white p-3 rounded-lg mt-auto"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {isSaving ? 'Saving...' : 'Save Layout'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
