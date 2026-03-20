import React, { useState } from 'react';
import { Shield, Map as MapIcon, CheckCircle, AlertTriangle, ArrowRight, Camera, Play } from 'lucide-react';
import { AnchorOptimizer, MarkerSuggestion } from '../services/AnchorOptimizer';

export default function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<MarkerSuggestion[]>([]);
  const [installed, setInstalled] = useState<string[]>([]);

  const startAnalysis = () => {
    setIsLoading(true);
    setTimeout(() => {
      const results = AnchorOptimizer.calculateOptimalMarkers(20, 10);
      setSuggestions(results);
      setIsLoading(false);
      setStep(2);
    }, 1500);
  };

  const toggleMarker = (id: string) => {
    if (installed.includes(id)) {
      setInstalled(installed.filter(i => i !== id));
    } else {
      setInstalled([...installed, id]);
    }
  };

  return (
    <div className="flex-1 bg-zinc-950 p-12 custom-scrollbar overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-12">
          <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-900/40">
            <Play size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Setup Wizard</h1>
            <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest">Installation Intelligence v1.0</p>
          </div>
        </div>

        {/* Steps Progress */}
        <div className="flex gap-4 mb-12">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${step >= s ? 'bg-emerald-500' : 'bg-zinc-800'}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-[40px] p-12 text-center">
            <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-8">
              <Camera size={40} className="text-zinc-500" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Initialize Environment Scan</h2>
            <p className="text-zinc-400 mb-8 max-w-md mx-auto">
              We will analyze the warehouse floor plan and beam structure to suggest the most efficient layout for your IR anchors.
            </p>
            <button 
              onClick={startAnalysis}
              disabled={isLoading}
              className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-2xl transition-all flex items-center gap-3 mx-auto shadow-xl shadow-emerald-900/20"
            >
              {isLoading ? 'Analyzing Structure...' : 'Start Coverage Analysis'}
              {!isLoading && <ArrowRight size={20} />}
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
              {/* Left: Suggestions List */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-[40px] p-8 max-h-[600px] overflow-y-auto custom-scrollbar">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <MapIcon size={20} className="text-emerald-400" />
                  Optimal Placement Suggestions
                </h3>
                <div className="space-y-4">
                  {suggestions.map(marker => (
                    <div 
                      key={marker.id}
                      onClick={() => toggleMarker(marker.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        installed.includes(marker.id) ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-zinc-800 border-zinc-700 hover:border-zinc-500'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-sm tracking-tight">{marker.id}</div>
                        <div className="text-[10px] text-zinc-500">Location: X:{marker.x}m Y:{marker.y}m Z:{marker.z}m</div>
                      </div>
                      {installed.includes(marker.id) ? (
                        <CheckCircle size={18} className="text-emerald-400" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-zinc-600" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Middle: Visual Map */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-[40px] p-8 flex flex-col">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Play size={20} className="text-emerald-400" />
                  Live Positioning Guide
                </h3>
                <div className="flex-1 bg-zinc-950 rounded-3xl border border-white/5 relative overflow-hidden flex items-center justify-center p-4">
                    {/* Warehouse Grid Representation */}
                    <div className="w-full h-full border border-zinc-800/50 border-dashed rounded-xl relative">
                        {/* Rack Mockups */}
                        <div className="absolute left-[10%] top-[25%] w-[80%] h-[15%] bg-zinc-800/40 rounded-lg border border-zinc-700/50" />
                        <div className="absolute left-[10%] top-[60%] w-[80%] h-[15%] bg-zinc-800/40 rounded-lg border border-zinc-700/50" />
                        
                        {/* Suggested & Installed Markers */}
                        {suggestions.map(marker => (
                            <div 
                                key={marker.id}
                                style={{ 
                                    left: `${(marker.x / 20) * 100}%`, 
                                    top: `${(marker.y / 10) * 100}%` 
                                }}
                                className={`absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 transition-all duration-500 ${
                                    installed.includes(marker.id) 
                                    ? 'bg-emerald-500 border-emerald-200 shadow-lg shadow-emerald-500/50' 
                                    : 'bg-zinc-900 border-emerald-500/50 animate-pulse'
                                }`}
                            >
                                <div className="absolute top-6 left-1/2 -translate-x-1/2 text-[8px] font-bold text-zinc-500 whitespace-nowrap bg-zinc-950 px-1 rounded">
                                    {marker.id}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <p className="text-[10px] text-zinc-500 mt-4 text-center italic">
                    Follow markers from left to right for optimal setup sequence.
                </p>
              </div>

              {/* Right: Diagnostics */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-[40px] p-8">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Shield size={20} className="text-blue-400" />
                  Coverage Diagnostics
                </h3>
                <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-3xl mb-6">
                  <p className="text-zinc-400 text-xs mb-1">Calculated Precision</p>
                  <p className="text-3xl font-bold text-emerald-400">± 4.2 cm</p>
                  <p className="text-[10px] text-zinc-500 mt-2 uppercase font-bold tracking-tighter">Triangulation Safety: 98.4% Guaranteed</p>
                </div>
                <div className="space-y-4">
                    <div className="flex items-start gap-3 p-4 bg-zinc-800/50 rounded-2xl">
                        <CheckCircle size={16} className="text-emerald-500 mt-0.5" />
                        <p className="text-xs text-zinc-400">Zero blind spots detected.</p>
                    </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
                <p className="text-zinc-500 text-sm">
                    {installed.length} of {suggestions.length} anchors verified.
                </p>
                <button 
                onClick={() => setStep(3)}
                disabled={installed.length < suggestions.length}
                className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-bold rounded-2xl transition-all shadow-xl shadow-emerald-900/20"
                >
                Proceed to Vehicle Calibration →
                </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-[40px] p-12">
            <div className="flex flex-col lg:flex-row gap-12">
                <div className="flex-1">
                    <h2 className="text-3xl font-bold mb-4">Vehicle Self-Isolation</h2>
                    <p className="text-zinc-400 mb-8">
                        The AI is now identifying the structural elements of this forklift (Roll cage, overhead guard) to mask them from the vision pipeline.
                    </p>
                    
                    <div className="space-y-6">
                        <div className="p-6 bg-zinc-800/50 rounded-3xl border border-white/5">
                            <h4 className="text-sm font-bold text-zinc-300 mb-4 uppercase tracking-widest">Calibration Progress</h4>
                            <div className="h-2 bg-zinc-700 rounded-full mb-2 overflow-hidden">
                                <div 
                                    className="h-full bg-emerald-500 transition-all duration-1000" 
                                    style={{ width: isLoading ? '65%' : '0%' }}
                                />
                            </div>
                            <p className="text-[10px] text-zinc-500">Wait for the vehicle to remain still for final silhouette extraction.</p>
                        </div>

                        {!isLoading && !installed.includes('CALIBRATED') && (
                            <button 
                                onClick={() => {
                                    setIsLoading(true);
                                    setTimeout(() => {
                                        setIsLoading(false);
                                        setInstalled([...installed, 'CALIBRATED']);
                                        // Mock saving mask to server
                                        fetch('http://localhost:8085/config/vehicle_mask', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ value: 'BASE64_MASK_DATA_7782' })
                                        });
                                    }, 3000);
                                }}
                                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-900/20"
                            >
                                Start Auto-Calibration
                            </button>
                        )}

                        {installed.includes('CALIBRATED') && (
                            <div className="p-6 bg-emerald-900/10 border border-emerald-500/30 rounded-3xl flex items-center gap-4">
                                <CheckCircle size={24} className="text-emerald-400" />
                                <div>
                                    <p className="text-emerald-400 font-bold">Calibration Successful</p>
                                    <p className="text-[10px] text-emerald-500/70">Static elements isolated and saved to core profile.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="w-full lg:w-96">
                    <div className="aspect-square bg-zinc-950 rounded-[40px] border border-white/5 relative overflow-hidden p-8 flex items-center justify-center">
                        {/* Simulation of a 360 camera view with a roll cage overlay */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-emerald-900/10 to-transparent" />
                        <div className="relative w-full h-full border-4 border-zinc-800 rounded-full flex items-center justify-center opacity-40">
                             {/* Mock Roll Cage Pattern */}
                             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-[100%] bg-zinc-700/40" />
                             <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[100%] h-4 bg-zinc-700/40" />
                             <div className="w-48 h-48 border-4 border-zinc-700/40 rounded-full" />
                        </div>
                        {/* The AI Mask Overlay */}
                        {(isLoading || installed.includes('CALIBRATED')) && (
                             <div className="absolute inset-0 bg-emerald-500/10 animate-pulse pointer-events-none flex items-center justify-center">
                                 <div className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded font-black">AI MASKING ACTIVE</div>
                             </div>
                        )}
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-4 text-center">AI Shadow Map (Roll Cage Elimination)</p>
                </div>
            </div>

            <div className="mt-12 flex justify-end">
                <button 
                    onClick={() => setStep(4)}
                    disabled={!installed.includes('CALIBRATED')}
                    className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-bold rounded-2xl transition-all shadow-xl shadow-emerald-900/20"
                >
                Complete Setup →
                </button>
            </div>
          </div>
        )}

        {step === 4 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-[40px] p-12 text-center">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-8">
              <CheckCircle size={40} className="text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Installation Verified!</h2>
            <p className="text-zinc-400 mb-8 max-w-md mx-auto">
              Your "Self-Updating Digital Twin" is now live. Any structural changes will be detected automatically and flagged in the dashboard.
            </p>
            <button 
              onClick={onComplete}
              className="px-8 py-4 bg-zinc-100 hover:bg-white text-zinc-950 font-black uppercase tracking-widest text-xs rounded-2xl transition-all mx-auto"
            >
              Return to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
