
export enum EmergencyType {
  NONE = 'NONE',
  FALL_DETECTED = 'FALL_DETECTED',
  IMMOBILITY = 'IMMOBILITY',
  ABNORMAL_HR = 'ABNORMAL_HR',
  MANUAL_SOS = 'MANUAL_SOS'
}

// The internal data structure used by the UI
export interface SensorData {
  timestamp: number;
  heartRate: number; // BPM
  spo2: number; // %
  temperature: number; // Celsius
  accel: { x: number; y: number; z: number }; // m/s^2 or G
  gyro: { x: number; y: number; z: number }; // rad/s
  accelMag: number; // Magnitude in G (calculated by device)
  isBatteryLow: boolean;
}

// The specific JSON format coming from the embedded device (C++ struct match)
export interface EmbeddedSensorJson {
  ts: number;
  hr: number;
  spo2: number;
  // 3-Axis Accel
  accel_x: number;
  accel_y: number;
  accel_z: number;
  // 3-Axis Gyro
  gyro_x: number;
  gyro_y: number;
  gyro_z: number;
  temp: number;
  // Calculated/Status
  accel_mag: number;
  fall: boolean;
  still: boolean;
  button_pressed: boolean;
  hr_alert?: boolean; // Added per C++ update (optional to support older packets)
}

export interface SystemConfig {
  minHeartRate: number;
  maxHeartRate: number;
  fallThresholdG: number;
  immobilityTimeSec: number;
  sensorFrequency: number; // Hz
}

// The JSON payload to send back to the device via MQTT
export interface DeviceConfigPayload {
  min_hr: number;
  max_hr: number;
  fall_g: number;
  immobility_sec: number; 
  frequency_hz: number;
}

export interface AlertEvent {
  id: string;
  type: EmergencyType;
  timestamp: number;
  description: string;
  resolved: boolean;
}
