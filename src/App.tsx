import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Wifi, WifiOff, Camera, Map, Battery, BatteryCharging, Package, MapPin, Type, LayoutGrid, Clock, Bell, Settings } from 'lucide-react';
import WarehouseMap from './components/WarehouseMap';
import AdminDashboard from './components/AdminDashboard';
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

  const [isOnline, setIsOnline] = useState(true);
  const [battery, setBattery] = useState(85);
  const [view, setView] = useState<'camera' | 'map' | 'admin'>('camera');
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [fontSizeScale, setFontSizeScale] = useState(1); // 1 = normal, 1.2 = large

  // Simulate connection status
  useEffect(() => {
    const interval = setInterval(() => {
      setIsOnline(Math.random() > 0.1);
      setBattery(prev => Math.max(10, prev - 1));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Simulate workflow state changes (for demonstration)
  useEffect(() => {
    if (state === 'loading') {
      // Simulate fetching details
      setPalletDetails({ skuName: 'Soybean Oil', quantity: 120, expiryDate: '2026-12-31' });
    } else if (state === 'drop') {
      const timer = setTimeout(() => {
        // Add to recent activities
        if (palletId && location) {
          setRecentActivities(prev => [{
            id: Date.now().toString(),
            palletId,
            location,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }, ...prev].slice(0, 3));
        }
        setPalletId(null);
        setLocation(null);
        setPalletDetails(null);
        setState('waiting');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [state, palletId, location]);

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
    <div className="flex h-screen w-screen bg-zinc-950 text-white font-sans overflow-hidden" style={{ fontSize: `${fontSizeScale * 100}%` }}>
      {/* Left: Main View */}
      <div className={`${view === 'admin' ? 'w-full' : 'w-1/2'} relative bg-zinc-900 border-r border-zinc-800 flex items-center justify-center`}>
        {view === 'admin' ? (
          <AdminDashboard onBack={() => setView('camera')} />
        ) : view === 'camera' ? (
          <>
            <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
              <Camera size={128} />
            </div>

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
                <button
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-colors"
                  onClick={() => setState('drop')}
                >
                  Confirm Drop
                </button>
              </div>
            )}

            {/* Drop Feedback */}
            {state === 'drop' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                <CheckCircle2 size={256} className="text-emerald-500 animate-pulse" />
              </div>
            )}

            {/* Mini-map */}
            {showMiniMap && (
              <div className="absolute bottom-4 left-4 w-64 h-48 bg-zinc-900/80 border border-zinc-700 rounded-lg overflow-hidden z-20">
                <WarehouseMap width={256} height={192} />
              </div>
            )}
          </>
        ) : (
          <WarehouseMap />
        )}
      </div>

      {/* Right: Status Panel */}
      {view !== 'admin' && (
        <div className="w-1/2 p-10 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-12">
              <h1 className={`${scale('text-4xl')} font-bold tracking-tight`}>SteelTrack AI</h1>
              <div className="flex gap-4">
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
      )}
    </div>
  );
}
