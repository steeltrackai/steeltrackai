import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Wifi, WifiOff, Camera, Map, Battery, BatteryCharging, Package, MapPin, Type, LayoutGrid, Clock, Bell, Settings } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import WarehouseMap from './components/WarehouseMap';
import AdminDashboard from './components/AdminDashboard';
import LocalManagerHub from './components/LocalManagerHub';
import SafetyAuditLog from './components/SafetyAuditLog';
import StockerPortal from './components/StockerPortal';
import { supabase } from './lib/supabaseClient';

type WorkflowState = 'waiting' | 'loading' | 'drop' | 'error';

interface Activity {
  id: string;
  palletId: string;
  location: string;
  timestamp: string;
}

interface PalletDetails {
  skuName: string;
  quantity: number;
  expiryDate: string;
  idTag?: string;
}

interface FCFSSuggestion {
    pallet_id: string;
    created_at: string;
    status: string;
}

interface Task {
  id: string;
  description: string;
}

export default function App() {
  const [palletId, setPalletId] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [state, setState] = useState<WorkflowState>('waiting');
  const [palletDetails, setPalletDetails] = useState<PalletDetails | null>(null);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([
    { id: '1', palletId: 'PLT-1234', location: 'A-01-01', timestamp: '16:45' },
    { id: '2', palletId: 'PLT-5678', location: 'B-02-05', timestamp: '16:40' },
    { id: '3', palletId: 'PLT-9012', location: 'C-03-02', timestamp: '16:35' },
  ]);
  const [tasks] = useState<Task[]>([
    { id: 't1', description: 'Move Pallet #123 from Floor Zone D to Steel Rack A-05' },
    { id: 't2', description: 'Restock Zone B-02' },
  ]);
  const [showTasks, setShowTasks] = useState(false);

  const [fontSizeScale, setFontSizeScale] = useState(1); // 1 = normal, 1.2 = large
  const [safetyAlert, setSafetyAlert] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [battery, setBattery] = useState(85);
  const [view, setView] = useState<'camera' | 'map' | 'admin' | 'server' | 'audit' | 'portal'>('camera');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('t')) {
      setView('portal');
    }
  }, []);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [fcfsSuggestion, setFcfsSuggestion] = useState<FCFSSuggestion | null>(null);
  const [fcfsViolation, setFcfsViolation] = useState<any | null>(null);
  const [showAfterDropChoice, setShowAfterDropChoice] = useState(false);
  const [floorSpots, setFloorSpots] = useState<any[]>([]);

  // Tether this tablet to a specific forklift ID to avoid interference from other fleet units
  const TETHERED_FORKLIFT_ID = 'VISION-PRO';
  const [lastBeepTime, setLastBeepTime] = useState(0);

  // Auto-clear safety alerts and FCFS violations
  useEffect(() => {
    if (safetyAlert) {
      const timer = setTimeout(() => setSafetyAlert(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [safetyAlert]);

  useEffect(() => {
    if (fcfsViolation) {
      const timer = setTimeout(() => setFcfsViolation(null), 8000); // FCFS alert stays longer
      return () => clearTimeout(timer);
    }
  }, [fcfsViolation]);

  // Standard Safety Beep (Web Audio API) - Throttled to 1 beep per 800ms
  const playBeep = (freq = 880, duration = 0.2) => {
    const now = Date.now();
    if (now - lastBeepTime < 800) return;
    setLastBeepTime(now);

    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
        console.warn("Audio Context failed", e);
    }
  };

  // Listen to Local Server Events (SSE)
  useEffect(() => {
    const eventSource = new EventSource('http://localhost:8085/stream');
    
    eventSource.onopen = () => setIsOnline(true);
    eventSource.onerror = () => setIsOnline(false);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!data) return;

        // 1. Safety Alerts & Battery (Tethered to TETHERED_FORKLIFT_ID)
        if (data.event_type === 'forklift') {
            // ONLY listen to OUR forklift to avoid flashing from other fleet units
            if (data.id !== TETHERED_FORKLIFT_ID) return;

            // Sync battery from simulation
            if (typeof data.battery === 'number') {
                setBattery(Math.round(data.battery));
            }

            const hasPedestrian = data.alerts?.some((a: string) => a.toLowerCase().includes('pedestrian'));
            if (hasPedestrian) {
                setSafetyAlert("PEDESTRIAN NEARBY");
                playBeep(440, 0.3); 
                
                // Add to recent activities if it's a new incident
                setRecentActivities(prev => {
                    const isNew = !prev.some(a => a.palletId === "DANGER" && (Date.now() - parseInt(a.id) < 5000));
                    if (isNew) {
                        return [{
                            id: Date.now().toString(),
                            palletId: "DANGER",
                            location: "Human Proximity",
                            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        }, ...prev].slice(0, 5);
                    }
                    return prev;
                });
            } else {
                setSafetyAlert(null);
            }
        }

        // 1b. Real-time FCFS Violation Detection
        if (data.event_type === 'fcfs_violation') {
            setFcfsViolation(data.violation);
            playBeep(220, 0.6); // Lower frequency, longer warning for rotation
        }

        // 1c. Floor Spot Sync (SSE with packed data)
        if (data.event_type === 'floor_spot_update') {
            if (data.data) {
                // Instantly update the spot in the global list
                setFloorSpots(prev => {
                    const spot = data.data;
                    const idx = prev.findIndex(s => String(s.id) === String(spot.id));
                    if (idx !== -1) {
                        const next = [...prev];
                        next[idx] = { ...next[idx], ...spot };
                        return next;
                    } else if (data.action === 'created') {
                        return [...prev, spot];
                    }
                    return prev;
                });
            } else {
                // Fallback for older server versions
                fetch('http://localhost:8085/floor-spots')
                    .then(res => res.json())
                    .then(setFloorSpots);
            }
        }

        // 2. Pallet Detection
        if (data.event_type !== 'pallet') return;

        console.log("Real-time Pallet Detection:", data);
        
        if (data.id) {
          setPalletId(data.id);
        }

        if (typeof data.x === 'number' && typeof data.y === 'number') {
          setLocation(`X:${data.x.toFixed(1)} Y:${data.y.toFixed(1)}`);
        }
        
        if (data.alerts && Array.isArray(data.alerts) && data.alerts.length > 0) {
          setState('error');
        } else {
          setState('loading'); 
          setPalletDetails({ 
            skuName: data.product_name || "Auto Detected SKU", 
            quantity: data.quantity || 1, 
            expiryDate: data.expiry_date || new Date().toLocaleDateString(),
            idTag: data.id
          });

          // Fetch FCFS Suggestion
          fetch(`http://localhost:8085/pallets/suggest/${data.product_name || data.id}`)
            .then(res => res.json())
            .then(suggestion => {
                if (suggestion.pallet_id && suggestion.pallet_id !== data.id) {
                    setFcfsSuggestion(suggestion);
                } else {
                    setFcfsSuggestion(null);
                }
            })
            .catch(err => console.error("FCFS Fetch Error", err));
        }
      } catch (err) {
        console.error("App SSE Parse Error", err);
      }
    };

    // Load initial spots
    fetch('http://localhost:8085/floor-spots')
        .then(res => res.json())
        .then(setFloorSpots)
        .catch(err => console.error("Initial spots fetch failed", err));

    return () => eventSource.close();
  }, []);

  // Simulate workflow state changes (for demonstration)
  useEffect(() => {
    if (state === 'loading' && !palletDetails) {
      // Simulate fetching details once
      setPalletDetails({ skuName: 'Soybean Oil', quantity: 120, expiryDate: '2026-12-31' });
    } else if (state === 'drop') {
      const timer = setTimeout(() => {
        setShowAfterDropChoice(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [state, palletId, location]);

  const handleLifecycleChoice = async (status: 'finished' | 'partial') => {
    if (!palletDetails?.idTag) return;

    try {
        await fetch(`http://localhost:8080/pallets/${palletDetails.idTag}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        // Add to recent activities
        setRecentActivities(prev => [{
            id: Date.now().toString(),
            palletId: palletDetails.idTag!,
            location: status === 'finished' ? 'SOLD OUT' : 'PARTIAL RETURN',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }, ...prev].slice(0, 3));

        // Reset state
        setPalletId(null);
        setLocation(null);
        setPalletDetails(null);
        setFcfsSuggestion(null);
        setShowAfterDropChoice(false);
        setState('waiting');
    } catch (err) {
        console.error("Lifecycle Update Error", err);
    }
  };

  const scale = (base: string) => {
    const sizes: Record<string, string> = {
      'text-4xl': fontSizeScale === 1 ? 'text-4xl' : 'text-5xl',
      'text-7xl': fontSizeScale === 1 ? 'text-7xl' : 'text-8xl',
      'text-3xl': fontSizeScale === 1 ? 'text-3xl' : 'text-4xl',
      'text-xl': fontSizeScale === 1 ? 'text-xl' : 'text-2xl',
      'text-lg': fontSizeScale === 1 ? 'text-lg' : 'text-xl',
      'text-sm': fontSizeScale === 1 ? 'text-sm' : 'text-base',
    };
    return sizes[base] || base;
  };

  const getCardBg = () => {
    if (palletId) return 'bg-[#2D5F36]';
    if (state === 'error') return 'bg-[#8B6B00]';
    return 'bg-zinc-900';
  };

  return (
    <ErrorBoundary>
      <div className="flex h-screen w-screen bg-zinc-950 text-white font-sans overflow-hidden" style={{ fontSize: `${fontSizeScale * 100}%` }}>
        {/* View Router */}
        {view === 'portal' ? (
          <StockerPortal />
        ) : view === 'audit' ? (
          <div className="fixed inset-0 z-[200] bg-zinc-950">
              <SafetyAuditLog onBack={() => setView('server')} />
          </div>
        ) : view === 'server' ? (
          <div className="fixed inset-0 z-[200] bg-zinc-950">
              <LocalManagerHub onBack={() => setView('camera')} onOpenAudit={() => setView('audit')} />
          </div>
        ) : view === 'admin' ? (
          <div className="fixed inset-0 z-[200] bg-zinc-950">
              <AdminDashboard floorSpots={floorSpots} onSpotsUpdate={setFloorSpots} onBack={() => setView('camera')} />
          </div>
        ) : (
          <>
            {/* Left: Main View */}
            <div className="w-1/2 relative bg-zinc-900 border-r border-zinc-800 flex items-center justify-center">
              {view === 'camera' ? (
                <>
                  <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
                    <Camera size={128} />
                  </div>

                  {/* FCFS Violation Driver Alert Overlay */}
                  {fcfsViolation && (
                    <div className="absolute inset-0 z-[100] bg-red-600/90 backdrop-blur-xl flex flex-col items-center justify-center p-12 text-center animate-pulse">
                        <AlertTriangle size={180} className="text-white mb-8" />
                        <h2 className="text-7xl font-black text-white mb-4 tracking-tighter uppercase leading-none">Rotation Error!</h2>
                        <p className="text-4xl text-red-100 font-bold mb-10 max-w-4xl leading-tight">
                          Return current pallet and get pallet <span className="underline decoration-4 underline-offset-8 text-white">{fcfsViolation.older_pallet}</span>
                        </p>
                        
                        <div className="bg-white/20 p-10 rounded-[40px] border border-white/30 backdrop-blur-md mb-12">
                            <p className="text-xl text-white/80 uppercase font-black mb-2 tracking-widest">Go to Location:</p>
                            <p className="text-8xl font-mono font-black text-white border-b-4 border-white inline-block px-4 pb-2">
                                X:{fcfsViolation.older_location?.x?.toFixed(1)} Y:{fcfsViolation.older_location?.y?.toFixed(1)}
                            </p>
                        </div>
                        
                        <p className="text-3xl text-white font-black animate-bounce mt-4 tracking-tight shadow-text">🛑 STOP AND COMPLY WITH ROTATION POLICY</p>
                    </div>
                  )}

                  {/* Pallet Details Overlay */}
                  {palletDetails && (
                    <div className="absolute bottom-4 right-4 bg-zinc-900/80 backdrop-blur-md p-5 rounded-2xl border border-zinc-700 z-20 w-72 shadow-2xl">
                      <h3 className="text-4xl font-bold text-white mb-3 truncate">{palletDetails.skuName}</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                        <div className="flex items-center gap-2 text-zinc-300">
                          <Package size={22} className="text-cyan-400" />
                          <span className="font-bold text-xl">{palletDetails.quantity}</span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-300">
                          <Clock size={22} className="text-cyan-400" />
                          <span className="font-medium text-lg">{palletDetails.expiryDate}</span>
                        </div>
                      </div>

                      {fcfsSuggestion && (
                        <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl mb-4 flex items-start gap-2">
                            <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider leading-none mb-1">Aging Stock Available</p>
                                <p className="text-[11px] text-zinc-300 leading-tight">Pallet <b>{fcfsSuggestion.pallet_id}</b> is older for this SKU. FCFS Priority.</p>
                            </div>
                        </div>
                      )}

                      <button
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-colors"
                        onClick={() => setState('drop')}
                      >
                        Confirm Drop
                      </button>
                    </div>
                  )}

                  {/* Drop Feedback & Choice */}
                  {state === 'drop' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/85 backdrop-blur-sm z-50">
                      {!showAfterDropChoice ? (
                        <CheckCircle2 size={256} className="text-emerald-500 animate-pulse" />
                      ) : (
                        <div className="bg-zinc-900 border border-zinc-700 p-10 rounded-[40px] max-w-xl w-full text-center shadow-2xl">
                            <h2 className="text-4xl font-black mb-4">DROP COMPLETE</h2>
                            <p className="text-zinc-400 text-xl mb-10 italic">"First Come, First Serve" - Verify pallet status:</p>
                            
                            <div className="grid grid-cols-2 gap-6">
                                <button 
                                    onClick={() => handleLifecycleChoice('finished')}
                                    className="bg-emerald-600 hover:bg-emerald-500 p-8 rounded-3xl flex flex-col items-center gap-4 transition-all active:scale-95"
                                >
                                    <CheckCircle2 size={48} />
                                    <span className="text-2xl font-bold">Everything Sold</span>
                                    <span className="text-xs opacity-70">Mark as Finished</span>
                                </button>
                                <button 
                                    onClick={() => handleLifecycleChoice('partial')}
                                    className="bg-zinc-800 hover:bg-zinc-700 p-8 rounded-3xl flex flex-col items-center gap-4 transition-all active:scale-95"
                                >
                                    <Package size={48} className="text-cyan-400" />
                                    <span className="text-2xl font-bold">Partial Return</span>
                                    <span className="text-xs opacity-70">Return to Rack</span>
                                </button>
                            </div>
                            
                            <button 
                                onClick={() => { setShowAfterDropChoice(false); setState('waiting'); }}
                                className="mt-8 text-zinc-500 underline text-sm"
                            >
                                Cancel / Manual Override
                            </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mini-map */}
                  {showMiniMap && (
                    <div className="absolute bottom-4 left-4 w-64 h-48 bg-zinc-900/80 border border-zinc-700 rounded-lg overflow-hidden z-20">
                      <WarehouseMap 
                        width={256} 
                        height={192} 
                        plannerSpots={floorSpots}
                        persistenceKey="mini"
                      />
                    </div>
                  )}
                </>
              ) : (
                <WarehouseMap 
                  plannerSpots={floorSpots}
                  persistenceKey="global"
                />
              )}
            </div>

            {/* Right: Status Panel */}
            <div className="w-1/2 p-10 flex flex-col justify-between">
              <div>
                <div className={`p-6 min-h-[140px] rounded-3xl flex items-center justify-between mb-8 transition-all duration-300 ${safetyAlert ? 'bg-red-600 animate-pulse scale-105 shadow-[0_0_50px_rgba(220,38,38,0.5)]' : 'bg-transparent'}`}>
                  <div className="flex flex-col justify-center">
                    <h1 className={`${scale('text-4xl')} font-bold tracking-tight ${safetyAlert ? 'text-white' : ''} leading-none`}>SteelTrack AI</h1>
                    <div className="h-12 flex items-center"> {/* Stable placeholder for alert */}
                      {safetyAlert && (
                        <div className="flex items-center gap-2 text-white font-black animate-bounce mt-2">
                          <AlertTriangle size={24} className="shrink-0" />
                          <span className="text-xl tracking-tighter leading-tight">{safetyAlert}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3 items-center">
                    <div className="relative">
                      <button
                        className="p-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 transition-colors"
                        onClick={() => setShowTasks(!showTasks)}
                      >
                        <Bell size={32} />
                        {tasks.length > 0 && (
                          <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 rounded-full border-2 border-zinc-950" />
                        )}
                      </button>
                      {showTasks && (
                        <div className="absolute top-full right-0 mt-2 w-80 bg-zinc-800 rounded-2xl p-4 shadow-xl z-30 border border-zinc-700">
                          <h3 className="text-emerald-400 font-bold mb-4">Urgent Tasks</h3>
                          <div className="space-y-2">
                            {tasks.map(task => (
                              <p key={task.id} className="text-sm bg-zinc-900 p-3 rounded-lg">{task.description}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      className="p-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 transition-colors"
                      onClick={() => setView('server')}
                      title="Switch to Server View"
                    >
                      <LayoutGrid size={32} className="text-cyan-400" />
                    </button>
                    <button
                      className="p-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 transition-colors"
                      onClick={() => setView('admin')}
                    >
                      <Settings size={32} />
                    </button>
                    <button
                      className="p-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 transition-colors"
                      onClick={() => setFontSizeScale(prev => prev === 1 ? 1.2 : 1)}
                    >
                      <Type size={32} />
                    </button>
                    <button
                      className={`p-4 rounded-2xl transition-colors ${showMiniMap ? 'bg-emerald-700' : 'bg-zinc-800 hover:bg-zinc-700'}`}
                      onClick={() => setShowMiniMap(!showMiniMap)}
                    >
                      <LayoutGrid size={32} />
                    </button>
                    <button
                      className="p-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 transition-colors"
                      onClick={() => setView(view === 'camera' ? 'map' : 'camera')}
                    >
                      {view === 'camera' ? <Map size={32} /> : <Camera size={32} />}
                    </button>
                    <div className="flex items-center gap-4 px-6 py-3 rounded-full bg-zinc-800">
                      <div className={`flex items-center gap-2 ${isOnline ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isOnline ? <Wifi size={24} /> : <WifiOff size={24} />}
                      </div>
                      <div className="flex items-center gap-2 text-zinc-300">
                        {battery < 20 ? <Battery size={24} className="text-red-500" /> : <BatteryCharging size={24} />}
                        <span className={`${scale('text-xl')} font-bold`}>{battery}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className={`p-8 rounded-3xl border-4 ${getCardBg()} transition-colors duration-300`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4 text-zinc-400">
                        <Package size={32} />
                        <p className={`uppercase ${scale('text-xl')} font-bold tracking-wider`}>Pallet ID</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold"
                          onClick={() => { setState('loading'); setPalletId('PLT-9999'); setLocation('A-01-01'); }}
                        >
                          Simulate Detection
                        </button>
                        <button
                          className="bg-amber-700 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-bold"
                          onClick={() => { setState('error'); setPalletId(null); setLocation(null); }}
                        >
                          Simulate Error
                        </button>
                      </div>
                    </div>
                    <p className={`${scale('text-7xl')} font-sans font-bold tracking-tighter text-white`}>
                      {palletId || (state === 'error' ? 'Detection Error' : <span className="text-zinc-400 text-3xl italic">Point to the Pallet ArUco code</span>)}
                    </p>
                  </div>
                  <div className={`p-8 rounded-3xl border-4 ${getCardBg()} transition-colors duration-300`}>
                    <div className="flex items-center gap-4 text-zinc-400 mb-4">
                      <MapPin size={32} />
                      <p className={`uppercase ${scale('text-xl')} font-bold tracking-wider`}>Location</p>
                    </div>
                    <p className={`${scale('text-7xl')} font-sans font-bold tracking-tighter text-white`}>
                      {location || (state === 'loading' ? 'In Transit' : state === 'error' ? 'Check Camera' : <span className="text-zinc-400 text-3xl italic">Waiting...</span>)}
                    </p>
                  </div>

                  {/* Recent Activity */}
                  <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
                    <div className="flex items-center gap-4 text-zinc-400 mb-4">
                      <Clock size={24} />
                      <p className={`uppercase ${scale('text-lg')} font-bold tracking-wider`}>Recent Activity</p>
                    </div>
                    <div className="space-y-2">
                      {recentActivities.map(activity => (
                        <div key={activity.id} className="flex justify-between items-center bg-zinc-800 p-4 rounded-xl">
                          <span className="font-mono font-bold">{activity.palletId}</span>
                          <span className="text-zinc-400">{activity.location}</span>
                          <span className="text-zinc-500 text-sm">{activity.timestamp}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <button
                className="w-full bg-red-600 hover:bg-red-700 text-white py-10 rounded-3xl text-4xl font-bold flex items-center justify-center gap-6 transition-all shadow-2xl active:scale-95"
                onClick={() => alert('Report Error/Obstacle')}
              >
                <AlertTriangle size={48} />
                REPORT ERROR/OBSTACLE
              </button>
            </div>
          </>
        )}
      </div>
    </ErrorBoundary>
  );
}
