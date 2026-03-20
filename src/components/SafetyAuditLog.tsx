import React, { useState, useEffect } from 'react';
import { Shield, Search, Calendar, Filter, Download, ArrowLeft, AlertTriangle } from 'lucide-react';

interface SafetyEvent {
    id: number;
    event_type: string;
    severity: string;
    details: string;
    forklift_id: string;
    timestamp: string;
}

export default function SafetyAuditLog({ onBack }: { onBack: () => void }) {
    const [events, setEvents] = useState<SafetyEvent[]>([]);
    const [filterForklift, setFilterForklift] = useState('All');
    const [filterSeverity, setFilterSeverity] = useState('All');
    const [filterDate, setFilterDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const res = await fetch('http://localhost:8085/safety-events');
                const data = await res.json();
                setEvents(data);
            } catch (error) {
                console.error("Failed to fetch safety events:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchEvents();
    }, []);

    const filteredEvents = events.filter(e => {
        const forkliftId = e.forklift_id || 'Unknown';
        const severity = e.severity || 'low';
        const timestamp = e.timestamp || '';

        const matchesForklift = filterForklift === 'All' || forkliftId === filterForklift;
        const matchesSeverity = filterSeverity === 'All' || severity.toLowerCase() === filterSeverity.toLowerCase();
        const matchesDate = !filterDate || timestamp.startsWith(filterDate);
        const matchesSearch = !searchTerm || 
            (e.event_type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            forkliftId.toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchesForklift && matchesSeverity && matchesDate && matchesSearch;
    });

    const uniqueForklifts = Array.from(new Set(events.map(e => e.forklift_id).filter(Boolean)));

    return (
        <div className="h-screen bg-[#021024] text-white flex flex-col font-sans overflow-hidden">
            {/* Header */}
            <nav className="h-20 border-b border-slate-800 bg-[#021024]/80 backdrop-blur-md px-8 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={onBack}
                        className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-all cursor-pointer text-slate-400"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="bg-rose-600 p-2 rounded-lg shadow-lg shadow-rose-900/40">
                            <Shield size={24} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">Safety <span className="text-rose-400">Audit Journal</span></h1>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Comprehensive Incident Reporting</p>
                        </div>
                    </div>
                </div>

                <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-900/20">
                    <Download size={18} /> Export Data
                </button>
            </nav>

            <main className="flex-1 p-8 overflow-hidden flex flex-col gap-6">
                {/* Filters Bar */}
                <div className="grid grid-cols-12 gap-4 bg-slate-900/40 p-6 rounded-3xl border border-slate-800/60 backdrop-blur-sm shrink-0">
                    <div className="col-span-3">
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2 block">Search Log</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input 
                                type="text"
                                placeholder="Incident or Unit..."
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-rose-500/50 transition-all font-medium"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="col-span-2">
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2 block">Forklift Unit</label>
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <select 
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-rose-500/50 transition-all font-medium appearance-none"
                                value={filterForklift}
                                onChange={(e) => setFilterForklift(e.target.value)}
                            >
                                <option>All</option>
                                {uniqueForklifts.map(id => <option key={id}>{id}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="col-span-2">
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2 block">Severity</label>
                        <select 
                            className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:border-rose-500/50 transition-all font-medium"
                            value={filterSeverity}
                            onChange={(e) => setFilterSeverity(e.target.value)}
                        >
                            <option>All</option>
                            <option>High</option>
                            <option>Low</option>
                        </select>
                    </div>

                    <div className="col-span-2">
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2 block">Incident Date</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input 
                                type="date"
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-rose-500/50 transition-all font-medium"
                                value={filterDate}
                                onChange={(e) => setFilterDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="col-span-3 flex items-end">
                        <button 
                            onClick={() => {setSearchTerm(''); setFilterForklift('All'); setFilterSeverity('All'); setFilterDate('');}}
                            className="text-xs font-bold text-slate-400 hover:text-white px-4 py-2 transition-all"
                        >
                            Clear All Filters
                        </button>
                    </div>
                </div>

                {/* Table View */}
                <div className="flex-1 bg-slate-900/30 rounded-[32px] border border-slate-800/60 overflow-hidden flex flex-col">
                    <div className="overflow-y-auto flex-1 custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-slate-900 z-10">
                                <tr>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">Timestamp</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">Forklift Unit</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">Incident Type</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">Severity</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEvents.length > 0 ? (
                                    filteredEvents.map((event) => {
                                        const eventType = event.event_type || 'Unknown Event';
                                        const isDanger = eventType.includes('DANGER') || eventType.includes('PEDESTRIAN');
                                        return (
                                            <tr key={event.id} className="group hover:bg-slate-800/30 transition-colors">
                                                <td className="px-8 py-5 font-mono text-xs text-slate-400 border-b border-slate-800/50">
                                                    {event.timestamp ? new Date(event.timestamp).toLocaleString() : 'No Timestamp'}
                                                </td>
                                                <td className="px-8 py-5 font-bold text-sm border-b border-slate-800/50">
                                                    <span className="bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">{event.forklift_id || 'N/A'}</span>
                                                </td>
                                                <td className="px-8 py-5 border-b border-slate-800/50">
                                                    <div className="flex items-center gap-2">
                                                        {isDanger && <AlertTriangle size={14} className="text-rose-500" />}
                                                        <span className="font-semibold text-slate-200">{eventType}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5 border-b border-slate-800/50">
                                                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${
                                                        event.severity === 'high' ? 'bg-rose-500 text-white' : 'bg-slate-700 text-slate-300'
                                                    }`}>
                                                        {event.severity || 'low'}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5 text-sm text-slate-400 border-b border-slate-800/50">
                                                    {event.details || 'No additional details.'}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="py-20 text-center text-slate-500 font-bold uppercase tracking-widest italic">
                                            {isLoading ? 'Fetching Audit Data...' : 'No incidents matching filters found.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Footer / Summary */}
                    <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider px-8">
                        <div>Showing {filteredEvents.length} of {events.length} recordings</div>
                        <div className="flex gap-4">
                            <span className="flex items-center gap-2 italic">
                                <div className="w-2 h-2 rounded-full bg-rose-500" /> High Severity: {filteredEvents.filter(e => e.severity === 'high').length}
                            </span>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
