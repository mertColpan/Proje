import React, { useState, useEffect } from 'react';
import { Radio, Wifi, Database, Clock, RefreshCw, AlertCircle } from 'lucide-react';

interface MqttStatusPanelProps {
  isConnected: boolean;
  lastPacketTime: number;
  lastJson: string;
  currentUrl: string;
  onConnect: (newUrl: string) => void;
}

const MqttStatusPanel: React.FC<MqttStatusPanelProps> = ({ isConnected, lastPacketTime, lastJson, currentUrl, onConnect }) => {
  const [urlInput, setUrlInput] = useState(currentUrl);

  // Sync internal state if prop changes (e.g. default value from App)
  useEffect(() => {
    setUrlInput(currentUrl);
  }, [currentUrl]);

  const handleConnectClick = () => {
    if (urlInput && (urlInput.startsWith('ws://') || urlInput.startsWith('wss://'))) {
        onConnect(urlInput);
    } else {
        alert("URL must start with 'ws://' or 'wss://' (WebSockets). Browsers cannot connect to tcp:// (1883).");
    }
  };

  return (
    <div className="bg-slate-900 text-white p-6 rounded-none h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
            <Radio className="w-6 h-6 text-teal-400" />
            <h2 className="font-semibold text-lg tracking-wide">IoT Link</h2>
        </div>
        <div className="flex items-center gap-1 text-xs bg-slate-800 px-2 py-1 rounded-full border border-slate-600">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></div>
            <span>{isConnected ? 'ONLINE' : 'OFFLINE'}</span>
        </div>
      </div>

      <div className="space-y-6 flex-1 overflow-y-auto">
        
        {/* Connection Controls */}
        <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
                <Wifi className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-medium text-slate-400">Broker Connection</span>
            </div>
            <div className="space-y-2">
                <input 
                    type="text" 
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-xs text-slate-200 p-2 rounded focus:border-blue-500 outline-none font-mono"
                    placeholder="ws://localhost:9001"
                />
                <button 
                    onClick={handleConnectClick}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-xs font-bold py-2 rounded transition-colors flex items-center justify-center gap-2"
                >
                    <RefreshCw className="w-3 h-3" />
                    {isConnected ? 'Reconnect' : 'Connect'}
                </button>
            </div>
             {!isConnected && (
                <div className="mt-2 flex items-start gap-1 text-[10px] text-red-400 leading-tight">
                    <AlertCircle className="w-3 h-3 min-w-[12px] mt-0.5" />
                    <span>Check Mosquitto Conf. Ensure port 9001 (WebSockets) is enabled and Firewall allows it.</span>
                </div>
            )}
        </div>

        {/* Status Metrics */}
        <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-medium text-slate-400">Last Packet Received</span>
            </div>
            <div className="text-sm font-mono text-slate-200">
                {lastPacketTime > 0 ? new Date(lastPacketTime).toLocaleTimeString() : '--:--:--'}
            </div>
        </div>

        {/* Live Data Stream */}
        <div className="flex-1 flex flex-col min-h-[200px]">
             <div className="flex items-center gap-2 mb-2">
                <Database className="w-4 h-4 text-yellow-400" />
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Incoming Payload</h3>
             </div>
             
             <div className="flex-1 bg-slate-950 text-slate-400 text-[10px] font-mono p-3 rounded-lg border border-slate-800 overflow-hidden relative">
                 <pre className="break-all whitespace-pre-wrap h-full overflow-y-auto custom-scrollbar">
                    {lastJson || "Waiting for data stream..."}
                 </pre>
                 {lastJson && <div className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full animate-ping"></div>}
             </div>
        </div>

      </div>
      
      <div className="mt-auto pt-4 border-t border-slate-800">
        <p className="text-[10px] text-slate-500 text-center">
            Protocol must be <strong>ws://</strong> (WebSockets).<br/>Browser cannot use tcp:// (1883).
        </p>
      </div>
    </div>
  );
};

export default MqttStatusPanel;