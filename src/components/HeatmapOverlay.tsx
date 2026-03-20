import React, { useMemo } from 'react';

interface Point {
  x: number;
  y: number;
  value: number;
}

export default function HeatmapOverlay({ points, width, height }: { points: Point[], width: number, height: number }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    
    // Draw Heatmap
    if (Array.isArray(points)) {
      points.forEach(p => {
          const px = Number(p.x) || 0;
          const py = Number(p.y) || 0;
          const val = Number(p.value) || 0;
          
          const grad = ctx.createRadialGradient(px, py, 0, px, py, 50);
          grad.addColorStop(0, `rgba(255, 0, 0, ${val})`);
          grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
          
          ctx.fillStyle = grad;
          ctx.fillRect(px - 50, py - 50, 100, 100);
      });
    }
  }, [points, width, height]);

  return (
    <canvas 
        ref={canvasRef} 
        width={width} 
        height={height} 
        className="absolute inset-0 pointer-events-none opacity-40 mix-blend-screen"
    />
  );
}

// Fixed missing useEffect import
import { useEffect } from 'react';
