import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text as ThreeText, Box, MeshReflectorMaterial, ContactShadows, Environment } from '@react-three/drei';
import { Stage as KStage, Layer as KLayer, Rect as KRect, Text as KText, Group as KGroup, Line as KLine, Circle as KCircle } from 'react-konva';
import { Loader2, Layers, Map as MapIcon, Box as BoxIcon, Flame } from 'lucide-react';
import HeatmapOverlay from './HeatmapOverlay';

interface EditorBlock {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'rack' | 'zone' | 'path';
  name: string;
  levels?: number;
  slots?: number;
  rotation?: number;
  color?: string;
}

interface ForkliftData {
  id: string;
  location_x: number;
  location_y: number;
  location_z: number;
  status: string;
}

interface PedestrianData {
  id: string;
  location_x: number;
  location_y: number;
  location_z: number;
}

interface PalletData {
  id: string;
  pallet_id_tag: string;
  location_x: number;
  location_y: number;
  location_z: number;
  status: string;
}

// Smoothly interpolates 3D position for real-time entities
interface LerpedEntityProps {
  targetPos: [number, number, number];
  children: React.ReactNode;
}

const LerpedEntity: React.FC<LerpedEntityProps> = ({ targetPos, children }) => {
  const meshRef = React.useRef<THREE.Group>(null);
  const [currentPos] = useState(() => new THREE.Vector3(...targetPos));
  
  useFrame(() => {
    if (meshRef.current) {
        const target = new THREE.Vector3(...targetPos);
        currentPos.lerp(target, 0.2);
        meshRef.current.position.copy(currentPos);
    }
  });

  return <group ref={meshRef}>{children}</group>;
};

interface Map2DProps {
  blocks: EditorBlock[];
  pallets: PalletData[]; 
  forklifts: ForkliftData[];
  pedestrians: PedestrianData[];
  planningMode?: boolean;
  plannerSpots?: any[];
  assignments?: any[];
  onMapClick?: (xM: number, yM: number) => void;
  onTransformChange?: (scale: number, pos: { x: number; y: number }) => void;
  onSpotMove?: (spotId: string, xM: number, yM: number) => void;
  onAssignmentMove?: (sku: string, worldX: number, worldY: number) => void;
  addSpotMode?: boolean;
  externalScale?: number;
  externalPos?: { x: number, y: number };
}

const WarehouseMap2D = React.memo(({ 
    blocks, pallets, forklifts, pedestrians, 
    planningMode, plannerSpots, assignments, 
    onMapClick, onTransformChange, onSpotMove, onAssignmentMove,
    addSpotMode, externalScale, externalPos 
}: Map2DProps) => {
  const PIXELS_PER_METER = 50;
  const width = 1200;
  const height = 800;

  const [internalScale, setInternalScale] = useState(1);
  const [internalStagePos, setInternalStagePos] = useState({ x: 0, y: 0 });

  const scale = externalScale ?? internalScale;
  const stagePos = externalPos ?? internalStagePos;

  const handleStageClick = (e: any) => {
    if (!onMapClick) return;
    const stage = e.target.getStage();
    if (!stage) return;
    
    // Get pointer position relative to the stage's transforms
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    // Apply inverse transform to get world coordinates
    const worldX = (pointerPos.x - stage.x()) / stage.scaleX();
    const worldY = (pointerPos.y - stage.y()) / stage.scaleY();
    
    onMapClick(worldX / PIXELS_PER_METER, worldY / PIXELS_PER_METER);
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * 1.1 : oldScale / 1.1;
    const limitedScale = Math.max(0.2, Math.min(5, newScale));

    const newPos = {
      x: pointer.x - mousePointTo.x * limitedScale,
      y: pointer.y - mousePointTo.y * limitedScale,
    };

    setScale(limitedScale);
    setInternalStagePos(newPos);
    if (onTransformChange) onTransformChange(limitedScale, newPos);
  };

  const setScale = (val: number) => {
    setInternalScale(val);
  };

  const setStagePos = (val: { x: number, y: number }) => {
    setInternalStagePos(val);
  };

  const stageRef = React.useRef<any>(null);


  const handleDragEnd = (e: any) => {
    const newPos = { x: e.target.x(), y: e.target.y() };
    setInternalStagePos(newPos);
    if (onTransformChange) onTransformChange(scale, newPos);
  };

  return (
    <div className="bg-zinc-950 rounded-xl overflow-hidden shadow-2xl relative" style={{ width, height }}>
      <KStage 
        width={width} 
        height={height} 
        x={stagePos.x}
        y={stagePos.y}
        scaleX={scale}
        scaleY={scale}
        onClick={handleStageClick}
        onWheel={handleWheel}
        draggable
        onDragEnd={handleDragEnd}
        ref={stageRef}
      >
        <KLayer listening={false}>
          {/* Static Layer: Grid & Blocks (rarely change) */}
          {Array.from({ length: 20 }).map((_, i) => (
            <KLine key={`h-${i}`} points={[0, i * 50, width, i * 50]} stroke="#18181b" strokeWidth={1} />
          ))}
          {Array.from({ length: 30 }).map((_, i) => (
            <KLine key={`v-${i}`} points={[i * 50, 0, i * 50, height]} stroke="#18181b" strokeWidth={1} />
          ))}

          {Array.isArray(blocks) && blocks.map((block) => (
            <KGroup key={block.id} x={Number(block.x) || 0} y={Number(block.y) || 0} rotation={Number(block.rotation) || 0}>
               <KRect
                 width={Number(block.width) || 100}
                 height={Number(block.height) || 100}
                 fill={block.type === 'rack' ? '#334155' : (block.type === 'zone' ? (block.color || '#064e3b') : '#18181b')}
                 cornerRadius={4}
                 stroke="#64748b"
                 strokeWidth={2}
               />
               <KText
                 text={block.name || ''}
                 fill="#a1a1aa"
                 fontSize={10}
                 padding={5}
                 width={Number(block.width) || 100}
                 align="center"
                 fontStyle="bold"
               />
             </KGroup>
           ))}
        </KLayer>

        <KLayer>
          {/* Interactive/Dynamic Layer: Spots, assignments, and live entities */}
          {planningMode && plannerSpots && (
            <KGroup>
              {plannerSpots.map((spot: any) => {
                const assignment = assignments?.find((a: any) => String(a.spot_id) === String(spot.id));
                return (
                  <KGroup 
                    key={spot.id} 
                    x={(Number(spot.x) || 0) * 50} 
                    y={(Number(spot.y) || 0) * 50}
                    draggable={addSpotMode}
                    onDragEnd={(e) => {
                        const newX = e.target.x() / 50;
                        const newY = e.target.y() / 50;
                        if (onSpotMove) onSpotMove(spot.id, newX, newY);
                    }}
                  >
                    <KRect
                      width={60}
                      height={60}
                      x={-30}
                      y={-30}
                      stroke={assignment ? "#10b981" : "#ef4444"}
                      strokeWidth={assignment ? 4 : 2}
                      dash={assignment ? [] : [5, 5]}
                      fill={assignment ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.05)"}
                      cornerRadius={8}
                    />
                    <KText
                      text={String(spot.id)}
                      fill={assignment ? "#10b981" : "#ef4444"}
                      fontSize={10}
                      fontStyle="bold"
                      y={34}
                      x={-30}
                      width={60}
                      align="center"
                    />
                    {assignment && (
                      <KGroup 
                        y={-5} 
                        draggable 
                        onDragEnd={(e) => {
                            const absPos = e.target.getAbsolutePosition();
                            // Transform absolute screen/stage position to world coordinates 
                            // by accounting for the stage's own transform
                            const stage = e.target.getStage();
                            if (stage) {
                                const transform = stage.getAbsoluteTransform().copy().invert();
                                const worldPos = transform.point(absPos);
                                if (onAssignmentMove) onAssignmentMove(assignment.sku, worldPos.x, worldPos.y);
                            }
                        }}
                      >
                        <KRect width={48} height={48} x={-24} y={-24} fill="#10b981" cornerRadius={6} shadowBlur={10} shadowColor="#064e3b" />
                        <KText 
                          text={assignment.product_name ? assignment.product_name.substring(0, 15) + '...' : String(assignment.sku).split('-').pop() || ''} 
                          fill="white" 
                          fontSize={8} 
                          fontStyle="bold" 
                          width={44} 
                          x={-22} 
                          y={-18} 
                          align="center" 
                        />
                        <KText 
                          text={assignment.sku} 
                          fill="rgba(255,255,255,0.7)" 
                          fontSize={6} 
                          width={44} 
                          x={-22} 
                          y={10} 
                          align="center" 
                        />
                      </KGroup>
                    )}
                  </KGroup>
                );
              })}
            </KGroup>
          )}

          {/* Live Pallets */}
          {(pallets || []).map(p => (
            <KGroup key={p.id} x={(Number(p.location_x) || 0) * 50} y={(Number(p.location_y) || 0) * 50}>
              <KCircle radius={8} fill={p.status === 'critical' ? '#ef4444' : '#10b981'} shadowBlur={10} shadowColor={p.status === 'critical' ? '#ef4444' : '#10b981'} />
              <KText text={p.pallet_id_tag} fill="white" fontSize={10} y={12} x={-20} width={40} align="center" fontStyle="bold" />
            </KGroup>
          ))}
          {/* Live Pedestrians */}
          {(pedestrians || []).map(p => (
            <KGroup key={p.id} x={(Number(p.location_x) || 0) * 50} y={(Number(p.location_y) || 0) * 50}>
              <KCircle radius={6} fill="#ef4444" shadowBlur={5} shadowColor="#ef4444" />
              <KText text="HUMAN" fill="#ef4444" fontSize={8} y={10} x={-20} width={40} align="center" fontStyle="bold" />
            </KGroup>
          ))}
          {/* Live Forklifts */}
          {(forklifts || []).map(f => (
            <KGroup key={f.id} x={(Number(f.location_x) || 0) * 50} y={(Number(f.location_y) || 0) * 50}>
              <KRect width={24} height={36} fill="#f59e0b" cornerRadius={4} x={-12} y={-18} shadowBlur={5} shadowColor="#f59e0b" />
              <KRect width={12} height={8} fill="#1e293b" x={-6} y={-14} cornerRadius={1} />
              <KText text={f.id} fill="white" fontSize={10} y={20} x={-20} width={40} align="center" fontStyle="bold" />
            </KGroup>
          ))}
        </KLayer>
      </KStage>
    </div>
  );
});

const WarehouseMap3D = React.memo(({ blocks, pallets, forklifts, pedestrians }: { blocks: EditorBlock[], pallets: PalletData[], forklifts: ForkliftData[], pedestrians: PedestrianData[] }) => {
  const PIXELS_PER_METER = 50;
  
  const to3D = (mx: number, mz: number) => {
    const sx = (typeof mx === 'number' && !isNaN(mx)) ? mx : 12;
    const sz = (typeof mz === 'number' && !isNaN(mz)) ? mz : 8;
    return [sx - 12, 0, sz - 8];
  };

  const renderedBlocks = React.useMemo(() => {
    if (!Array.isArray(blocks)) return null;
    return blocks.map((block) => {
        const w = (Number(block.width) || 100) / PIXELS_PER_METER;
        const h = (Number(block.height) || 100) / PIXELS_PER_METER;
        const mx = ((Number(block.x) || 0) + (Number(block.width) || 100) / 2) / PIXELS_PER_METER;
        const mz = ((Number(block.y) || 0) + (Number(block.height) || 100) / 2) / PIXELS_PER_METER;
        const [x3D, _y, z3D] = to3D(mx, mz);

        return (
          <group key={block.id} position={[x3D, 0, z3D]} rotation={[0, -(block.rotation || 0) * (Math.PI / 180), 0]}>
            {block.type === 'rack' ? (
              <>
                <Box args={[w, 0.1, h]} position={[0, 0.05, 0]} castShadow receiveShadow>
                  <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.2} />
                </Box>
                {(() => {
                  const rackHeight = (block.levels || 5) * 0.8 + 0.2;
                  return (
                    <group>
                      <Box args={[0.08, rackHeight, 0.08]} position={[-w / 2 + 0.04, rackHeight / 2, -h / 2 + 0.04]}><meshStandardMaterial color="#475569" /></Box>
                      <Box args={[0.08, rackHeight, 0.08]} position={[w / 2 - 0.04, rackHeight / 2, -h / 2 + 0.04]}><meshStandardMaterial color="#475569" /></Box>
                      <Box args={[0.08, rackHeight, 0.08]} position={[-w / 2 + 0.04, rackHeight / 2, h / 2 - 0.04]}><meshStandardMaterial color="#475569" /></Box>
                      <Box args={[0.08, rackHeight, 0.08]} position={[w / 2 - 0.04, rackHeight / 2, h / 2 - 0.04]}><meshStandardMaterial color="#475569" /></Box>
                    </group>
                  );
                })()}
                {Array.from({ length: block.levels || 5 }).map((_, levelIndex) => (
                  <Box key={levelIndex} args={[w * 0.95, 0.05, h * 0.9]} position={[0, (levelIndex + 1) * 0.8, 0]} receiveShadow>
                    <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.1} />
                  </Box>
                ))}
                <ThreeText position={[0, (block.levels || 5) * 0.8 + 0.5, 0]} fontSize={0.3} color="white" anchorX="center">
                  {block.name}
                </ThreeText>
              </>
            ) : block.type === 'zone' ? (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                <planeGeometry args={[w, h]} />
                <meshStandardMaterial color={block.color || '#166534'} transparent opacity={0.3} />
              </mesh>
            ) : (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
                <planeGeometry args={[w, h]} />
                <meshStandardMaterial color="#334155" transparent opacity={0.2} />
              </mesh>
            )}
          </group>
        );
    });
  }, [blocks]);

  return (
    <Canvas camera={{ position: [20, 20, 20], fov: 45 }} shadows gl={{ powerPreference: 'high-performance', antialias: true }}>
      <color attach="background" args={['#020617']} />
      <fog attach="fog" args={['#020617', 30, 100]} />
      <Environment preset="city" />
      <ambientLight intensity={0.4} />
      <hemisphereLight intensity={0.5} groundColor="#000000" />
      <spotLight position={[30, 40, 30]} angle={0.25} penumbra={1} intensity={2} castShadow shadow-mapSize={[2048, 2048]} />
      <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={100} blur={2} far={10} resolution={1024} color="#000000" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <MeshReflectorMaterial
          blur={[400, 200]}
          resolution={1024}
          mixBlur={1}
          mixStrength={15}
          roughness={1}
          depthScale={1}
          minDepthThreshold={0.5}
          maxDepthThreshold={1.2}
          color="#020617"
          metalness={0.2}
          mirror={0.4}
        />
      </mesh>

      {renderedBlocks}

      {React.useMemo(() => (
        Array.isArray(pallets) && pallets.map((p) => {
          const [x3D, _y, z3D] = to3D(p.location_x || 0, p.location_y || 0);
          return (
            <LerpedEntity key={p.id} targetPos={[x3D, (p.location_z || 0) * 0.8 + 0.3, z3D]}>
              <Box args={[0.6, 0.6, 0.6]} castShadow>
                 <meshStandardMaterial color={p.status === 'critical' ? '#ef4444' : '#3b82f6'} />
              </Box>
            </LerpedEntity>
          );
        })
      ), [pallets])}

      {React.useMemo(() => (
        Array.isArray(forklifts) && forklifts.map((f) => {
          const [x3D, _y, z3D] = to3D(f.location_x || 0, f.location_y || 0);
          return (
            <LerpedEntity key={f.id} targetPos={[x3D, 0.3, z3D]}>
              <Box args={[0.9, 0.6, 1.4]} castShadow receiveShadow>
                <meshStandardMaterial color="#f59e0b" metalness={0.6} roughness={0.3} />
              </Box>
            </LerpedEntity>
          );
        })
      ), [forklifts])}

      {React.useMemo(() => (
        Array.isArray(pedestrians) && pedestrians.map((p) => {
          const [x3D, _y, z3D] = to3D(p.location_x || 0, p.location_y || 0);
          return (
            <LerpedEntity key={p.id} targetPos={[x3D, 0.5, z3D]}>
              <mesh castShadow>
                 <boxGeometry args={[0.3, 1.0, 0.3]} />
                 <meshStandardMaterial color="#ef4444" />
              </mesh>
              <ThreeText position={[0, 0.8, 0]} fontSize={0.2} color="white" anchorX="center">
                HUMAN
              </ThreeText>
            </LerpedEntity>
          );
        })
      ), [pedestrians])}
      <OrbitControls />
    </Canvas>
  );
});

interface WarehouseMapProps {
  width?: number;
  height?: number;
  showHeatmap?: boolean;
  planningMode?: boolean;
  plannerSpots?: any[];
  assignments?: any[];
  onMapClick?: (xM: number, yM: number) => void;
  onTransformChange?: (scale: number, pos: { x: number; y: number }) => void;
  onSpotMove?: (spotId: string, xM: number, yM: number) => void;
  onAssignmentMove?: (sku: string, worldX: number, worldY: number) => void;
  addSpotMode?: boolean;
  scale?: number;
  pos?: { x: number, y: number };
  viewMode?: '2D' | '3D';
  onViewModeChange?: (mode: '2D' | '3D') => void;
  blocks?: EditorBlock[];
  loading?: boolean;
  key?: string | number;
  persistenceKey?: string;
}
export default function WarehouseMap({ 
    width = 1200, 
    height = 800, 
    planningMode, 
    plannerSpots, 
    assignments, 
    onMapClick,
    onTransformChange,
    onSpotMove,
    onAssignmentMove,
    addSpotMode,
    scale,
    pos,
    viewMode: externalViewMode,
    onViewModeChange,
    blocks: externalBlocks,
    loading: externalLoading,
    persistenceKey = 'default'
}: WarehouseMapProps) {
  const [internalViewMode, setInternalViewMode] = useState<'2D' | '3D'>('2D');
  const viewMode = externalViewMode || internalViewMode;

  const setViewMode = (mode: '2D' | '3D') => {
    setInternalViewMode(mode);
    if (onViewModeChange) onViewModeChange(mode);
  };
  const [internalBlocks, setInternalBlocks] = useState<EditorBlock[]>([]);
  const [internalLoading, setInternalLoading] = useState(true);
  const blocks = externalBlocks || internalBlocks;
  const loading = externalLoading !== undefined ? externalLoading : internalLoading;
  const [showHeatmap, setShowHeatmap] = useState(false);
  const hasAutoCentered = React.useRef(false);

  const [telemetry, setTelemetry] = useState({
    pallets: [] as PalletData[],
    forklifts: [] as ForkliftData[],
    pedestrians: [] as PedestrianData[]
  });
  const [_telemetryHz, setTelemetryHz] = useState(0);

  useEffect(() => {
    let localEventCount = 0;
    const interval = setInterval(() => {
        setTelemetryHz(localEventCount);
        localEventCount = 0;
    }, 1000);

    async function loadData() {
      if (externalBlocks) {
          setInternalLoading(false);
          return;
      }
      try {
        const pRes = await fetch('http://localhost:8085/pallets').catch(() => null);
        const fRes = await fetch('http://localhost:8085/forklifts').catch(() => null);
        
        if (pRes?.ok || fRes?.ok) {
            const pData = pRes?.ok ? await pRes.json() : [];
            const fData = fRes?.ok ? await fRes.json() : [];
            setTelemetry({
                pallets: Array.isArray(pData) ? pData : [],
                forklifts: Array.isArray(fData) ? fData : [],
                pedestrians: []
            });
        }

        setInternalBlocks([
            { id: 'r1', x: 200, y: 100, width: 400, height: 60, type: 'rack', name: 'Aisle A1', levels: 5 },
            { id: 'r2', x: 200, y: 250, width: 400, height: 60, type: 'rack', name: 'Aisle A2', levels: 5 },
            { id: 'z1', x: 50, y: 50, width: 100, height: 400, type: 'zone', name: 'Loading Dock', color: '#1e3a8a' }
        ]);
      } catch (e) {
        console.error("Local load failed", e);
      } finally {
        setInternalLoading(false);
      }
    }
    
    loadData();

    const eventSource = new EventSource('http://localhost:8085/stream');
    
    let pendingForklifts: any[] = [];
    let pendingPallets: any[] = [];
    let pendingPedestrians: any[] = [];
    
    const flushThrottle = setInterval(() => {
        if (pendingForklifts.length > 0 || pendingPallets.length > 0 || pendingPedestrians.length > 0) {
            setTelemetry(prev => {
                let nextPallets = [...prev.pallets];
                let nextForklifts = [...prev.forklifts];
                let nextPedestrians = [...prev.pedestrians];

                if (pendingForklifts.length > 0) {
                    pendingForklifts.forEach(data => {
                        const idx = nextForklifts.findIndex(f => f.id === data.id);
                        if (idx !== -1) nextForklifts[idx] = { ...nextForklifts[idx], ...data };
                        else nextForklifts.push({ ...data, status: 'active' });
                    });
                    pendingForklifts = [];
                }

                if (pendingPallets.length > 0) {
                    pendingPallets.forEach(data => {
                        const idx = nextPallets.findIndex(p => p.pallet_id_tag === data.id);
                        if (idx !== -1) nextPallets[idx] = { ...nextPallets[idx], ...data };
                        else nextPallets.push({ id: String(Date.now()), pallet_id_tag: String(data.id), ...data });
                    });
                    pendingPallets = [];
                }

                if (pendingPedestrians.length > 0) {
                    pendingPedestrians.forEach(data => {
                        const idx = nextPedestrians.findIndex(p => p.id === data.id);
                        if (idx !== -1) nextPedestrians[idx] = { ...nextPedestrians[idx], ...data };
                        else nextPedestrians.push({ ...data });
                    });
                    pendingPedestrians = [];
                }

                return { pallets: nextPallets, forklifts: nextForklifts, pedestrians: nextPedestrians };
            });
        }
    }, 100); 

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (!data || typeof data.x !== 'number' || typeof data.y !== 'number') return;
            
            localEventCount++;
            
            const item = {
                id: data.id,
                location_x: Number(data.x) || 0,
                location_y: Number(data.y) || 0,
                location_z: Number(data.z) || 0,
                status: (data.alerts && data.alerts.length > 0) ? 'critical' : 'stable'
            };

            if (data.event_type === 'forklift') {
                pendingForklifts.push(item);
            } else if (data.event_type === 'pallet') {
                pendingPallets.push(item);
            } else if (data.event_type === 'pedestrian') {
                pendingPedestrians.push(item);
            }
        } catch (e) {
            console.error("Map SSE Parse Error", e);
        }
    };

    return () => {
        clearInterval(interval);
        clearInterval(flushThrottle);
        eventSource.close();
    };
  }, []);

  // Viewport Persistence Hub
  const [internalScale, setInternalScale] = useState(() => {
    const saved = localStorage.getItem(`${persistenceKey}_map_scale`);
    const val = Number(saved);
    return isNaN(val) || val <= 0 ? 1 : val;
  });
  
  const [internalPos, setInternalPos] = useState(() => {
    try {
        const saved = localStorage.getItem(`${persistenceKey}_map_pos`);
        if (!saved) return { x: 0, y: 0 };
        const parsed = JSON.parse(saved);
        if (isNaN(parsed.x) || isNaN(parsed.y)) return { x: 0, y: 0 };
        return parsed;
    } catch {
        return { x: 0, y: 0 };
    }
  });

  const handleTransformChangeInternal = (newScale: number, newPos: { x: number, y: number }) => {
    if (isNaN(newScale) || isNaN(newPos.x) || isNaN(newPos.y)) return;
    setInternalScale(newScale);
    setInternalPos(newPos);
    localStorage.setItem(`${persistenceKey}_map_scale`, String(newScale));
    localStorage.setItem(`${persistenceKey}_map_pos`, JSON.stringify(newPos));
    if (onTransformChange) onTransformChange(newScale, newPos);
  };

  const centerOnSpots = () => {
    if (!plannerSpots || plannerSpots.length === 0) return;
    // Calculate bounding box of spots
    const xs = plannerSpots.map(s => Number(s.x) * 50);
    const ys = plannerSpots.map(s => Number(s.y) * 50);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    const newPos = {
        x: (width / 2) - (centerX * internalScale),
        y: (height / 2) - (centerY * internalScale)
    };
    handleTransformChangeInternal(1.3, newPos);
  };

  // Auto-center on first load if we are at 0,0 and have spots
  useEffect(() => {
    const isDefault = internalPos.x === 0 && internalPos.y === 0;
    if (isDefault && plannerSpots && plannerSpots.length > 0 && !hasAutoCentered.current) {
        hasAutoCentered.current = true;
        centerOnSpots();
    }
  }, [plannerSpots?.length]);

  return (
    <div className="h-full w-full bg-[#020617] relative rounded-3xl overflow-hidden border border-slate-800 shadow-2xl" style={{ width, height }}>
      {loading && (
        <div className="absolute inset-0 z-[60] bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center text-zinc-400 gap-2 font-bold uppercase tracking-widest text-xs">
          <Loader2 className="animate-spin text-cyan-500" size={20} /> Initializing Digital Twin...
        </div>
      )}
      <div className="h-full w-full relative">
          <WarehouseMap2D 
              blocks={blocks} 
              pallets={telemetry.pallets} 
              forklifts={telemetry.forklifts} 
              pedestrians={telemetry.pedestrians}
              planningMode={planningMode}
              plannerSpots={plannerSpots}
              assignments={assignments}
              onMapClick={onMapClick}
              onTransformChange={handleTransformChangeInternal}
              onSpotMove={onSpotMove}
              onAssignmentMove={onAssignmentMove}
              addSpotMode={addSpotMode}
              externalScale={scale || internalScale}
              externalPos={pos || internalPos}
          />
      </div>

          <div className="absolute top-4 left-4 z-50 flex gap-2">
            <button 
                onClick={centerOnSpots}
                className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700 text-[10px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors uppercase tracking-widest shadow-xl flex items-center gap-2"
            >
                <MapIcon size={12} /> Center Map
            </button>
            <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700 text-[10px] font-bold text-slate-500 uppercase tracking-widest shadow-xl flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                V7.2 - 8085
            </div>
          </div>
    </div>
  );
}
