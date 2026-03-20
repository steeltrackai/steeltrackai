import { useState, useEffect } from 'react';
import { Users, Key, Globe, Download, Plus, Search, ShieldCheck, ShieldAlert, Activity } from 'lucide-react';

export default function AdminPortal() {
  const [activeTab, setActiveTab] = useState('clients');
  const [clients] = useState([
    { id: '1', name: 'Supermercado Central', location: 'São Paulo, BR', status: 'active', license: 'STEEL-2026-SP' },
    { id: '2', name: 'Hyper Mart Delta', location: 'Toronto, CA', status: 'expired', license: 'STEEL-2025-DELTA' },
  ]);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 text-white p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-10 px-2">
          <Globe className="text-cyan-400" size={32} />
          <h1 className="text-xl font-bold tracking-tight">SteelTrack <span className="text-cyan-400">Global</span></h1>
        </div>
        
        <nav className="space-y-4">
          <button onClick={() => setActiveTab('clients')} className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${activeTab === 'clients' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
            <Users size={20} />
            Clients
          </button>
          <button onClick={() => setActiveTab('licenses')} className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${activeTab === 'licenses' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
            <Key size={20} />
            License Portal
          </button>
          <button onClick={() => setActiveTab('updates')} className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${activeTab === 'updates' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
            <Download size={20} />
            OTA Updates
          </button>
          <button onClick={() => setActiveTab('health')} className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${activeTab === 'health' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
            <Activity size={20} />
            Fleet Health
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-10 overflow-y-auto">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 capitalize">{activeTab}</h2>
            <p className="text-slate-500">Global control center for SteelTrack AI infrastructure.</p>
          </div>
          <button className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors">
            <Plus size={20} /> Add New {activeTab === 'clients' ? 'Client' : 'Target'}
          </button>
        </header>

        {activeTab === 'clients' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="relative w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Search clients, locations, or IDs..." className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20" />
              </div>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-400 text-sm uppercase tracking-wider bg-slate-50">
                  <th className="px-6 py-4 font-semibold">Client Name</th>
                  <th className="px-6 py-4 font-semibold">Location</th>
                  <th className="px-6 py-4 font-semibold">License</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map(client => (
                  <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-5 font-bold text-slate-700">{client.name}</td>
                    <td className="px-6 py-5 text-slate-500">{client.location}</td>
                    <td className="px-6 py-5 font-mono text-sm text-cyan-600 font-semibold">{client.license}</td>
                    <td className="px-6 py-5">
                      {client.status === 'active' ? (
                        <span className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-sm font-bold">
                          <ShieldCheck size={14} /> Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-rose-600 bg-rose-50 px-3 py-1 rounded-full text-sm font-bold">
                          <ShieldAlert size={14} /> Expired
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right font-medium text-cyan-600 hover:text-cyan-700 cursor-pointer">Manage</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Other tabs would be implemented similarly */}
      </div>
    </div>
  );
}
