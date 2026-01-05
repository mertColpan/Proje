
import React, { useState, useRef, useEffect } from 'react';
import mqtt from 'mqtt';
import { SensorData, SystemConfig, EmergencyType, AlertEvent, EmbeddedSensorJson, DeviceConfigPayload } from './types';
import MqttStatusPanel from './components/WearableSimulator';
import HealthDashboard from './components/HealthDashboard';
import SettingsPanel from './components/SettingsPanel';
import { Bell, Activity, Wifi, WifiOff, LayoutDashboard } from 'lucide-react';

const TOPIC_DATA = 'saglik/sensor_verileri';
const TOPIC_CONFIG = 'saglik/config';

// Initial default URL - user can change this in UI now
const DEFAULT_BROKER_URL = 'ws://localhost:9001'; 

const DEFAULT_CONFIG: SystemConfig = {
  minHeartRate: 40,
  maxHeartRate: 120,
  fallThresholdG: 2.0,
  immobilityTimeSec: 10,
  sensorFrequency: 1
};

const MAX_HISTORY = 50;

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard');
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);
  const [sensorData, setSensorData] = useState<SensorData[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  
  // MQTT State
  const [brokerUrl, setBrokerUrl] = useState<string>(DEFAULT_BROKER_URL);
  const [client, setClient] = useState<mqtt.MqttClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastPacketTime, setLastPacketTime] = useState<number>(0);
  const [lastRawJson, setLastRawJson] = useState<string>("");

  // --- LOGIC REFS (To handle state inside MQTT callback without re-renders) ---
  const configRef = useRef(config);
  configRef.current = config;

  // 1. Warm-up Timer: Don't alert for the first 30s of data
  const firstPacketTimeRef = useRef<number | null>(null);

  // 2. HR Debounce: Require abnormal HR to persist for 5s
  const hrAnomalyStartRef = useRef<number | null>(null);

  // 3. Fall Cooldown: Don't trigger another fall alert for 10s after one occurs
  // This prevents spamming if the sensor values fluctuate rapidly during a fall
  const fallCooldownRef = useRef<number | null>(null);

  // 4. State Latching: Don't spam alerts if the state hasn't changed
  const activeStatesRef = useRef<Record<string, boolean>>({
    [EmergencyType.FALL_DETECTED]: false,
    [EmergencyType.IMMOBILITY]: false,
    [EmergencyType.MANUAL_SOS]: false,
    [EmergencyType.ABNORMAL_HR]: false
  });

  // --- MQTT CONNECTION LOGIC ---
  useEffect(() => {
    if (client) {
        console.log("Closing old connection...");
        client.end();
        setIsConnected(false);
        // Reset Logic Refs on reconnection
        firstPacketTimeRef.current = null;
        hrAnomalyStartRef.current = null;
        fallCooldownRef.current = null;
        activeStatesRef.current = {};
    }

    console.log(`Connecting to MQTT Broker: ${brokerUrl}`);
    
    const mqttClient = mqtt.connect(brokerUrl, {
      clean: true,
      connectTimeout: 4000,
      clientId: 'web_dash_' + Math.random().toString(16).substr(2, 8),
      reconnectPeriod: 5000, 
    });

    mqttClient.on('connect', () => {
      console.log('MQTT Connected Successfully');
      setIsConnected(true);
      mqttClient.subscribe(TOPIC_DATA, (err) => {
        if (err) console.error("Subscribe Error:", err);
        else console.log(`Subscribed to ${TOPIC_DATA}`);
      });
    });

    mqttClient.on('error', (err) => {
      console.error('MQTT Connection Error: ', err);
    });

    mqttClient.on('offline', () => {
        console.log("MQTT Offline");
        setIsConnected(false);
    });

    mqttClient.on('message', (topic, message) => {
      if (topic === TOPIC_DATA) {
        handleIncomingMessage(message.toString());
      }
    });

    setClient(mqttClient);

    return () => {
      mqttClient.end();
    };
  }, [brokerUrl]); 

  const handleBrokerUrlChange = (newUrl: string) => {
    setBrokerUrl(newUrl);
  };

  const handleIncomingMessage = (jsonString: string) => {
    setLastRawJson(jsonString);
    try {
        const parsed: EmbeddedSensorJson = JSON.parse(jsonString);
        const now = Date.now();

        // 1. Initialize First Packet Time
        if (firstPacketTimeRef.current === null) {
            firstPacketTimeRef.current = now;
            console.log("First packet received. System warming up for 30s...");
        }
        
        const newData: SensorData = {
            timestamp: now, 
            heartRate: parsed.hr,
            spo2: parsed.spo2,
            temperature: parsed.temp,
            accel: { 
                x: parsed.accel_x, 
                y: parsed.accel_y, 
                z: parsed.accel_z  
            },
            gyro: { 
                x: parsed.gyro_x, 
                y: parsed.gyro_y, 
                z: parsed.gyro_z 
            },
            accelMag: parsed.accel_mag, 
            isBatteryLow: false
        };

        setLastPacketTime(now);
        setSensorData(prev => {
          const updated = [...prev, newData];
          if (updated.length > MAX_HISTORY) return updated.slice(updated.length - MAX_HISTORY);
          return updated;
        });
        
        // --- EMERGENCY LOGIC ---

        // Check Warm-up Period (30 Seconds)
        if (now - (firstPacketTimeRef.current || now) < 30000) {
            return; // Exit if warming up
        }

        // A. Process Boolean Flags (Fall, Still, SOS) with Latching
        
        // Special logic for FALL: Use Cooldown
        if (parsed.fall) {
            if (!fallCooldownRef.current || (now - fallCooldownRef.current > 10000)) {
                // If no cooldown or cooldown expired (10s passed)
                triggerAlert(EmergencyType.FALL_DETECTED);
                fallCooldownRef.current = now;
            }
        }
        
        processStateAlert(EmergencyType.IMMOBILITY, parsed.still);
        processStateAlert(EmergencyType.MANUAL_SOS, parsed.button_pressed);

        // B. Process Heart Rate with 5s Time Window
        const cfg = configRef.current;
        
        // Condition: Valid HR (>0) AND (Outside Limits OR Device Flagged)
        // We explicitly check hr > 0 to avoid false alarms when sensor is disconnected (0 value)
        const isHrAbnormal = parsed.hr > 0 && (
            parsed.hr > cfg.maxHeartRate || 
            parsed.hr < cfg.minHeartRate || 
            parsed.hr_alert === true
        );

        if (isHrAbnormal) {
            if (hrAnomalyStartRef.current === null) {
                // Start the timer
                hrAnomalyStartRef.current = now;
            } else if (now - hrAnomalyStartRef.current > 5000) {
                // If persisted for > 5 seconds, Trigger Alert
                processStateAlert(EmergencyType.ABNORMAL_HR, true);
            }
        } else {
            // Reset timer if HR goes back to normal OR drops to 0 (sensor error)
            hrAnomalyStartRef.current = null;
            // Clear the alert state
            processStateAlert(EmergencyType.ABNORMAL_HR, false);
        }

    } catch (e) {
        console.error("JSON Parse Error", e);
    }
  };

  // Helper to handle "Alert only on rising edge" (False -> True)
  const processStateAlert = (type: EmergencyType, isTriggered: boolean) => {
      const wasActive = activeStatesRef.current[type];

      if (isTriggered && !wasActive) {
          // New Alert!
          triggerAlert(type);
          activeStatesRef.current[type] = true;
      } else if (!isTriggered && wasActive) {
          // State cleared (back to normal)
          activeStatesRef.current[type] = false;
      }
  };

  const publishConfig = (payload: DeviceConfigPayload) => {
    if (client && isConnected) {
        const payloadStr = JSON.stringify(payload);
        client.publish(TOPIC_CONFIG, payloadStr, { qos: 1, retain: true }, (err) => {
            if (err) console.error("Publish Error", err);
            else {
                alert("Settings synced to device!");
            }
        });
    } else {
        alert("MQTT Not Connected. Cannot sync settings.");
    }
  };

  const triggerAlert = (type: EmergencyType) => {
    setAlerts(prev => {
      const newAlert: AlertEvent = {
        id: Date.now().toString(),
        type,
        timestamp: Date.now(),
        description: getAlertDescription(type),
        resolved: false
      };
      return [newAlert, ...prev];
    });
  };

  const getAlertDescription = (type: EmergencyType): string => {
    switch (type) {
      case EmergencyType.FALL_DETECTED: return "Sudden fall detected (High G-Force)";
      case EmergencyType.IMMOBILITY: return "No movement detected for extended period";
      case EmergencyType.MANUAL_SOS: return "Emergency Button Pressed by User";
      case EmergencyType.ABNORMAL_HR: return "Heart Rate sustained outside safe limits";
      default: return "Unknown Alert";
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-20 bg-white border-r border-slate-200 flex flex-col items-center py-6 gap-8 z-10 shadow-sm">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
           <Activity className="text-white w-6 h-6" />
        </div>
        
        <nav className="flex flex-col gap-6 w-full items-center">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`p-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
              title="Dashboard"
            >
                <LayoutDashboard className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`p-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
              title="Settings"
            >
                <Bell className="w-6 h-6" />
            </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-20">
           <div className="flex flex-col">
             <h1 className="text-xl font-bold text-slate-800">BioSafe Guard</h1>
             <p className="text-xs text-slate-500">Biomedical Safety Monitoring System</p>
           </div>
           
           <div className="flex items-center gap-4">
             <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${isConnected ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {isConnected ? 'System Online' : 'System Offline'}
             </div>
           </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-auto p-6 scroll-smooth">
           {activeTab === 'dashboard' && <HealthDashboard data={sensorData} alerts={alerts} />}
           {activeTab === 'settings' && (
              <SettingsPanel
                config={config}
                onUpdate={setConfig}
                onPublishConfig={publishConfig}
                isConnected={isConnected}
              />
           )}
        </div>
      </main>

      {/* Right Panel: IoT Status */}
      <aside className="w-80 bg-slate-900 border-l border-slate-700 z-10 shadow-xl">
         <MqttStatusPanel
            isConnected={isConnected}
            lastPacketTime={lastPacketTime}
            lastJson={lastRawJson}
            currentUrl={brokerUrl}
            onConnect={handleBrokerUrlChange}
         />
      </aside>
    </div>
  );
}
