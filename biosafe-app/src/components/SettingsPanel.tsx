import React from 'react';
import { SystemConfig, DeviceConfigPayload } from '../types';
import { Settings, Save, Wifi, Server } from 'lucide-react';

interface SettingsPanelProps {
  config: SystemConfig;
  onUpdate: (newConfig: SystemConfig) => void;
  onPublishConfig: (payload: DeviceConfigPayload) => void;
  isConnected: boolean;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ config, onUpdate, onPublishConfig, isConnected }) => {
  
  const handleChange = (key: keyof SystemConfig, value: string) => {
    onUpdate({
      ...config,
      [key]: parseFloat(value)
    });
  };

  const handleSaveAndSend = () => {
    // Exact payload structure for C++ MQTT Callback
    const mqttPayload: DeviceConfigPayload = {
      min_hr: config.minHeartRate,
      max_hr: config.maxHeartRate,
      fall_g: config.fallThresholdG,
      immobility_sec: config.immobilityTimeSec,
      frequency_hz: config.sensorFrequency
    };

    onPublishConfig(mqttPayload);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full overflow-y-auto">
      <div className="flex items-center gap-2 mb-6 text-slate-800">
        <Settings className="w-5 h-5 text-blue-600" />
        <h2 className="font-semibold text-lg">System & Device Configuration</h2>
      </div>

      <div className="space-y-6">
        
        {/* Connection Status Indicator */}
        <div className={`p-3 rounded-lg border flex items-center gap-3 ${isConnected ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
           <Server className="w-5 h-5" />
           <div className="flex-1">
             <p className="text-sm font-bold">{isConnected ? 'MQTT Broker Connected' : 'Broker Disconnected'}</p>
             <p className="text-xs opacity-80">{isConnected ? 'Ready to sync config.' : 'Cannot sync settings.'}</p>
           </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">
            Min Heart Rate Threshold (BPM)
          </label>
          <input
            type="range"
            min="30"
            max="90"
            value={config.minHeartRate}
            onChange={(e) => handleChange('minHeartRate', e.target.value)}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>30 BPM</span>
            <span className="font-bold text-blue-600">{config.minHeartRate} BPM</span>
            <span>90 BPM</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">
            Max Heart Rate Threshold (BPM)
          </label>
          <input
            type="range"
            min="90"
            max="200"
            value={config.maxHeartRate}
            onChange={(e) => handleChange('maxHeartRate', e.target.value)}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>90 BPM</span>
            <span className="font-bold text-red-600">{config.maxHeartRate} BPM</span>
            <span>200 BPM</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              Fall Threshold (G)
            </label>
            <input
              type="number"
              step="0.1"
              value={config.fallThresholdG}
              onChange={(e) => handleChange('fallThresholdG', e.target.value)}
              className="w-full p-2 border rounded-md text-sm border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
            />
             <p className="text-[10px] text-slate-400 mt-1">ESP32 sensitivity.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              Immobility Time (s)
            </label>
            <input
              type="number"
              value={config.immobilityTimeSec}
              onChange={(e) => handleChange('immobilityTimeSec', e.target.value)}
              className="w-full p-2 border rounded-md text-sm border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
            />
             <p className="text-[10px] text-slate-400 mt-1">Time before alert.</p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100">
           <div className="flex items-center gap-2 mb-3">
             <Wifi className="w-4 h-4 text-slate-400" />
             <h3 className="text-sm font-semibold text-slate-700">Transmission Settings</h3>
           </div>
           
           <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              Data Update Frequency (Hz)
            </label>
            <input
              type="number"
              min="0.1"
              max="10"
              step="0.1"
              value={config.sensorFrequency}
              onChange={(e) => handleChange('sensorFrequency', e.target.value)}
              className="w-full p-2 border rounded-md text-sm border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <p className="text-xs text-slate-400 mt-1">Updates per second sent by device.</p>
          </div>
        </div>

        <button 
          onClick={handleSaveAndSend}
          disabled={!isConnected}
          className={`w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-lg transition-colors shadow-lg ${isConnected ? 'bg-slate-800 text-white hover:bg-slate-700 shadow-slate-200' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}
        >
          <Save className="w-4 h-4" />
          {isConnected ? 'Save & Sync to Device' : 'Waiting for Connection...'}
        </button>
        
        <p className="text-center text-[10px] text-slate-400 mt-2">
          Settings are saved to MQTT with "Retain" flag, ensuring the device gets them on boot.
        </p>

      </div>
    </div>
  );
};

export default SettingsPanel;