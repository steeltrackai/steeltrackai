import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text as ThreeText, Box } from '@react-three/drei';
import { Stage, Layer, Rect, Text as KonvaText, Group } from 'react-konva';
import { supabase } from '../lib/supabaseClient';
import { Loader2 } from 'lucide-react';

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

interface Level {
  id: string;
  levelName: string;
  productName?: string;
  status?: 'Standard' | 'NearExpiry' | 'Empty';
}

interface Block {
  id: string;
  x: number;
  y: number;
  name: string;
  levels: Level[];
}

const WarehouseMap2D = ({ blocks }: { blocks: EditorBlock[] }) => (
  <Stage width={800} height={600} className="bg-zinc-900">
    <Layer>
      {blocks.map((block) => (
        <Group key={block.id} x={block.x} y={block.y} rotation={block.rotation || 0}>
          <Rect
            width={block.width}
            height={block.height}
            fill={block.type === 'rack' ? '#71717a' : (block.type === 'zone' ? (block.color || '#3b82f6') : '#52525b')}
            cornerRadius={4}
            opacity={0.8}
          />
          <KonvaText text={block.name} fill="white" fontSize={14} fontStyle="bold" y={-20} />
        </Group>
      ))}
    </Layer>
  </Stage>
);

const WarehouseMap3D = ({ blocks }: { blocks: EditorBlock[] }) => (
  <Canvas camera={{ position: [0, 8, 12], fov: 50 }}>
    <ambientLight intensity={0.6} />
    <pointLight position={[10, 10, 10]} />

    {/* Floor Layout */}
    {/* Rack Area 1 */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-2.5, -0.49, 0]}>
      <planeGeometry args={[3, 20]} />
      <meshStandardMaterial color="#3f3f46" />
    </mesh>
    {/* Corridor */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.49, 0]}>
      <planeGeometry args={[1, 20]} />
      <meshStandardMaterial color="#27272a" />
    </mesh>
    {/* Rack Area 2 */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2.5, -0.49, 0]}>
      <planeGeometry args={[3, 20]} />
      <meshStandardMaterial color="#3f3f46" />
    </mesh>

    {blocks.map((block, i) => (
      <group
        key={block.id}
        position={[(block.x / 40) - 10, 0, (block.y / 40) - 8]}
        rotation={[0, (block.rotation || 0) * (Math.PI / 180), 0]}
      >
        {block.type === 'rack' ? (
          <>
            {/* Rack Structure (4 posts) */}
            <Box args={[0.1, 2, 0.1]} position={[-0.7, 0.5, -0.2]}><meshStandardMaterial color="#52525b" /></Box>
            <Box args={[0.1, 2, 0.1]} position={[0.7, 0.5, -0.2]}><meshStandardMaterial color="#52525b" /></Box>
            <Box args={[0.1, 2, 0.1]} position={[-0.7, 0.5, 0.2]}><meshStandardMaterial color="#52525b" /></Box>
            <Box args={[0.1, 2, 0.1]} position={[0.7, 0.5, 0.2]}><meshStandardMaterial color="#52525b" /></Box>

            {/* Horizontal Beams */}
            {Array.from({ length: block.levels || 1 }).map((_, levelIndex) => (
              <Box key={levelIndex} args={[1.5, 0.1, 0.5]} position={[0, levelIndex * 0.6 + 0.2, 0]}>
                <meshStandardMaterial color="#3f3f46" />
              </Box>
            ))}
          </>
        ) : (
          /* Zone Area */
          <mesh position={[0, -0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[block.width / 40, block.height / 40]} />
            <meshStandardMaterial color={block.color || (block.type === 'zone' ? '#2D5F36' : '#27272a')} transparent opacity={0.5} />
          </mesh>
        )}
        <ThreeText position={[0, 2.5, 0]} fontSize={0.5} color="white">{block.name}</ThreeText>
      </group>
    ))}
    <OrbitControls />
  </Canvas>
);

interface WarehouseMapProps {
  width?: number;
  height?: number;
}

export default function WarehouseMap({ width, height }: WarehouseMapProps) {
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('3D');
  const [blocks, setBlocks] = useState<EditorBlock[]>([]);
  const [loading, setLoading] = useState(true);

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
        setBlocks(data.layout_data as EditorBlock[]);
      }
      setLoading(false);
    }
    loadLayout();

    // Real-time subscription to layout changes
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'warehouse_layout' }, (payload) => {
        if (payload.new && payload.new.layout_data) {
          setBlocks(payload.new.layout_data as EditorBlock[]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="h-full w-full bg-zinc-900 flex items-center justify-center text-zinc-500 gap-2">
        <Loader2 className="animate-spin" /> Fetching Warehouse Data...
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-zinc-900 relative" style={{ width, height }}>
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => setViewMode('2D')}
          className={`p-2 rounded ${viewMode === '2D' ? 'bg-blue-600' : 'bg-zinc-700'} text-white`}
        >
          2D
        </button>
        <button
          onClick={() => setViewMode('3D')}
          className={`p-2 rounded ${viewMode === '3D' ? 'bg-blue-600' : 'bg-zinc-700'} text-white`}
        >
          3D
        </button>
      </div>

      <div className={`h-full w-full ${viewMode === '2D' ? 'block' : 'hidden'}`}>
        <WarehouseMap2D blocks={blocks} />
      </div>

      <div className={`h-full w-full ${viewMode === '3D' ? 'block' : 'hidden'}`}>
        <WarehouseMap3D blocks={blocks} />
      </div>
    </div>
  );
}
