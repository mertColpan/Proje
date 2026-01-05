
import React from 'react';
import { SensorData, AlertEvent, EmergencyType } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Heart, Activity, UserCheck, AlertOctagon, Droplets, Thermometer, Bell, Clock } from 'lucide-react';

interface HealthDashboardProps {
  data: SensorData[];
  alerts: AlertEvent[];
}

const HealthDashboard: React.FC<HealthDashboardProps> = ({ data, alerts }) => {
  const current = data[data.length - 1] || { 
    heartRate: 0, spo2: 0, temperature: 0, 
    accelMag: 0
  };
  
  // Find the most recent unresolved emergency for the main banner
  const activeEmergency = alerts.find(a => !a.resolved);
  
  // Format data for Recharts
  const chartData = data.slice(-40).map(d => ({
    time: new Date(d.timestamp).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    hr: d.heartRate,
    spo2: d.spo2,
    accelTotal: d.accelMag // Use the calculated magnitude from device
  }));

  // Helper for Alert Colors/Icons
  const getAlertStyle = (type: EmergencyType) => {
    switch (type) {
        case EmergencyType.FALL_DETECTED: return { color: 'bg-red-100 text-red-800 border-red-200', icon: <AlertOctagon className="w-4 h-4 text-red-600" /> };
        case EmergencyType.IMMOBILITY: return { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: <UserCheck className="w-4 h-4 text-orange-600" /> };
        case EmergencyType.ABNORMAL_HR: return { color: 'bg-rose-100 text-rose-800 border-rose-200', icon: <Heart className="w-4 h-4 text-rose-600" /> };
        case EmergencyType.MANUAL_SOS: return { color: 'bg-purple-100 text-purple-800 border-purple-200', icon: <Bell className="w-4 h-4 text-purple-600" /> };
        default: return { color: 'bg-gray-100 text-gray-800', icon: <Bell className="w-4 h-4" /> };
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header Status */}
      <div className={`${activeEmergency ? 'bg-red-100 border-red-200' : 'bg-emerald-50 border-emerald-100'} p-4 rounded-xl border flex items-center justify-between transition-colors duration-500`}>
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-full ${activeEmergency ? 'bg-red-500 text-white animate-pulse-fast' : 'bg-emerald-500 text-white'}`}>
             {activeEmergency ? <AlertOctagon className="w-8 h-8" /> : <UserCheck className="w-8 h-8" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {activeEmergency ? 'EMERGENCY ALERT' : 'Patient Status: STABLE'}
            </h1>
            <p className="text-slate-600">
              {activeEmergency 
                ? `Detected: ${activeEmergency.type.replace('_', ' ')} - Notifying Caregivers...` 
                : 'All vital signs within normal parameters.'}
            </p>
          </div>
        </div>
        {activeEmergency && (
          <div className="text-4xl font-bold text-red-600 animate-pulse">
            SOS
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Heart Rate Card */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 lg:col-span-2">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
              Heart Rate
            </h3>
            <span className="text-2xl font-bold text-slate-800">{current.heartRate.toFixed(1)} <span className="text-sm font-normal text-slate-500">BPM</span></span>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis domain={['dataMin - 10', 'dataMax + 10']} hide />
                <Tooltip />
                <Area type="monotone" dataKey="hr" stroke="#f43f5e" fillOpacity={1} fill="url(#colorHr)" strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SpO2 Card */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Droplets className="w-5 h-5 text-cyan-500" />
              SpO2
            </h3>
            <span className="text-2xl font-bold text-slate-800">{current.spo2.toFixed(1)} <span className="text-sm font-normal text-slate-500">%</span></span>
          </div>
          <div className="h-24">
             <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <YAxis domain={[80, 100]} hide />
                <Line type="monotone" dataKey="spo2" stroke="#06b6d4" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Temperature Card */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Thermometer className="w-5 h-5 text-orange-500" />
              Temp
            </h3>
            <span className="text-2xl font-bold text-slate-800">{current.temperature.toFixed(1)} <span className="text-sm font-normal text-slate-500">°C</span></span>
          </div>
           <div className="flex items-end h-24 pb-2">
             <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-orange-400 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(((current.temperature - 30) / 10) * 100, 100)}%` }}
                ></div>
             </div>
          </div>
        </div>

        {/* Accelerometer Card */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 lg:col-span-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              Real-time Movement (G-Force)
            </h3>
            <span className="text-2xl font-bold text-slate-800">{current.accelMag.toFixed(2)} <span className="text-sm font-normal text-slate-500">G</span></span>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis domain={[0, 4]} hide />
                <Tooltip />
                <Line type="monotone" dataKey="accelTotal" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Alerts Log */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 lg:col-span-4">
           <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-slate-500" />
              <h3 className="font-semibold text-slate-700">Notification History</h3>
           </div>
           
           <div className="max-h-48 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
              {alerts.length === 0 ? (
                 <div className="text-center py-6 text-slate-400 text-sm">No alerts recorded in this session.</div>
              ) : (
                 alerts.map((alert) => {
                     const style = getAlertStyle(alert.type);
                     return (
                         <div key={alert.id} className={`flex items-center justify-between p-3 rounded-lg border ${style.color}`}>
                            <div className="flex items-center gap-3">
                                {style.icon}
                                <div className="flex flex-col">
                                    <span className="font-semibold text-sm">{alert.type.replace(/_/g, ' ')}</span>
                                    <span className="text-xs opacity-90">{alert.description}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 text-xs opacity-70">
                                <Clock className="w-3 h-3" />
                                {new Date(alert.timestamp).toLocaleTimeString()}
                            </div>
                         </div>
                     )
                 })
              )}
           </div>
        </div>

      </div>
    </div>
  );
};

export default HealthDashboard;
