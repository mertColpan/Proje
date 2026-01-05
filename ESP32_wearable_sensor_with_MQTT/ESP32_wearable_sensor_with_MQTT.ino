#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include "MAX30100_PulseOximeter.h"
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

// --- Wi-Fi ve MQTT Ayarları ---
const char* ssid = "<wifi_ssid>";
const char* password = "<wifi password>"; 
const char* mqtt_server = "<MQTT_server_ip>"; 
const int mqtt_port = 1883; 
const char* mqtt_client_id = "ESP32_C3_Sensor_Client"; 
const char* mqtt_topic_data = "saglik/sensor_verileri"; 
const char* mqtt_topic_config = "saglik/config"; 

// --- DONANIM PİNLERİ ---
#define I2C_SDA_PIN <your_sda_pin>
#define I2C_SCL_PIN <your_scl_pin>
#define BUTTON_SIGNAL_PIN <your_button_signal_pin>  
#define BUTTON_GND_PIN <your_buton_gnd_pin>  

// Nesneler
PulseOximeter pox;
Adafruit_MPU6050 mpu;
WiFiClient espClient;
PubSubClient client(espClient);

// --- MUTEX ---
SemaphoreHandle_t sensorDataMutex; 
SemaphoreHandle_t i2cMutex;        

// Veri Değişkenleri
volatile float beatAvg = 0;
volatile float oxygenAvg = 0;
volatile unsigned long lastBeatTime = 0;

// MPU Veri Yapıları
sensors_event_t a, g, temp;

// --- DİNAMİK AYARLAR ---
float config_fallThresholdG = 2.0;    
int config_immobilitySec = 10;        
float config_minHR = 40.0;            
float config_maxHR = 120.0;           
unsigned long config_intervalMs = 1000; 

// Algoritma Durumları
bool fallDetected = false;
bool immobilityAlert = false;
unsigned long immobilityStartTime = 0;
bool isMobile = true;
bool buttonLatch = false; // Latch işlemi

// MAX30100 Callback
void onBeatDetected() {
    lastBeatTime = millis();
}

// --- THREAD: NABIZ OKUMA ---
void TaskMax30100(void * parameter) {
    for (;;) {
        if (xSemaphoreTake(i2cMutex, portMAX_DELAY) == pdTRUE) {
            pox.update(); 
            
            if (millis() - lastBeatTime < 2000) {
                if (xSemaphoreTake(sensorDataMutex, 0) == pdTRUE) {
                    beatAvg = pox.getHeartRate();
                    oxygenAvg = pox.getSpO2();
                    xSemaphoreGive(sensorDataMutex);
                }
            } else {
                if (xSemaphoreTake(sensorDataMutex, 0) == pdTRUE) {
                    beatAvg = 0;
                    xSemaphoreGive(sensorDataMutex);
                }
            }
            xSemaphoreGive(i2cMutex);
        }
        vTaskDelay(pdMS_TO_TICKS(5)); 
    }
}

// --- MQTT CONFIG DINLEME ---
void mqttCallback(char* topic, byte* payload, unsigned int length) {
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, payload, length);

    if (!error) {
        if (doc.containsKey("min_hr")) config_minHR = doc["min_hr"];
        if (doc.containsKey("max_hr")) config_maxHR = doc["max_hr"];
        if (doc.containsKey("fall_g")) config_fallThresholdG = doc["fall_g"];
        if (doc.containsKey("immobility_sec")) config_immobilitySec = doc["immobility_sec"];
        
        if (doc.containsKey("frequency_hz")) {
            float freq = doc["frequency_hz"];
            if (freq > 0) {
                config_intervalMs = 1000.0 / freq;
                if (config_intervalMs < 50) config_intervalMs = 50; 
            }
        }
        Serial.println("Ayarlar Guncellendi!");
    }
}

void setup_wifi() {
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("WiFi OK");
}

void reconnect() {
    while (!client.connected()) {
        if (client.connect(mqtt_client_id)) {
            client.subscribe(mqtt_topic_config); 
        } else {
            delay(2000);
        }
    }
}

void setup() {
    Serial.begin(115200);
    
    pinMode(BUTTON_GND_PIN, OUTPUT);
    digitalWrite(BUTTON_GND_PIN, LOW); 

    pinMode(BUTTON_SIGNAL_PIN, INPUT_PULLUP);
    
    sensorDataMutex = xSemaphoreCreateMutex();
    i2cMutex = xSemaphoreCreateMutex();

    Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
    setup_wifi();
    
    client.setServer(mqtt_server, mqtt_port);
    client.setCallback(mqttCallback);
    
    client.setBufferSize(2048);

    if (!mpu.begin()) Serial.println("MPU Hata");
    else {
        mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
        mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    }

    if (!pox.begin()) Serial.println("MAX30100 Hata");
    else {
        pox.setIRLedCurrent(MAX30100_LED_CURR_24MA);
        pox.setOnBeatDetectedCallback(onBeatDetected);
    }

    xTaskCreate(TaskMax30100, "MAX_Task", 4096, NULL, 1, NULL);
}

void loop() {
    if (!client.connected()) reconnect();
    client.loop(); 

    // Buton dinleme 
    if (digitalRead(BUTTON_SIGNAL_PIN) == LOW) {
        buttonLatch = true; // Basıldığını hafızaya al
    }

    static unsigned long lastPrintTime = 0;
    
    // Dinamik Frekans Kontrolü
    if (millis() - lastPrintTime > config_intervalMs) {
        lastPrintTime = millis();

        // 1. MPU Okuma
        if (xSemaphoreTake(i2cMutex, portMAX_DELAY) == pdTRUE) {
            mpu.getEvent(&a, &g, &temp);
            xSemaphoreGive(i2cMutex);
        }

        // 2. Algoritmalar
        float accelMag = sqrt(pow(a.acceleration.x, 2) + pow(a.acceleration.y, 2) + pow(a.acceleration.z, 2));
        float accelG = accelMag / 9.8;

        if (accelG > config_fallThresholdG) fallDetected = true;

        if (abs(accelG - 1.0) < 0.15) {
            if (isMobile) {
                immobilityStartTime = millis();
                isMobile = false;
            } else {
                if (millis() - immobilityStartTime > (config_immobilitySec * 1000)) immobilityAlert = true;
            }
        } else {
            isMobile = true;
            immobilityAlert = false;
        }

        // 3. Nabız Verisi
        float currentBeat = -1.0;
        float currentOxygen = -1.0;

        if (xSemaphoreTake(sensorDataMutex, 100) == pdTRUE) {
            currentBeat = beatAvg;
            currentOxygen = oxygenAvg;
            xSemaphoreGive(sensorDataMutex);
        }

        bool isBeatValid = (currentBeat >= config_minHR && currentBeat <= config_maxHR);
        
        // 4. JSON PAKETİ
        StaticJsonDocument<1024> doc; 
        doc["ts"] = millis();
        doc["hr"] = isBeatValid ? currentBeat : 0;
        doc["spo2"] = currentOxygen;
        
        // MPU Detayları
        doc["accel_x"] = a.acceleration.x; 
        doc["accel_y"] = a.acceleration.y;
        doc["accel_z"] = a.acceleration.z;
        doc["gyro_x"] = g.gyro.x;
        doc["gyro_y"] = g.gyro.y;
        doc["gyro_z"] = g.gyro.z;
        doc["temp"] = temp.temperature;
        
        // Durumlar
        doc["accel_mag"] = accelG; 
        doc["fall"] = fallDetected;
        doc["still"] = immobilityAlert;
        
        doc["button_pressed"] = buttonLatch;

        char jsonBuffer[1024];
        serializeJson(doc, jsonBuffer);

        // Veriyi gönder
        client.publish(mqtt_topic_data, jsonBuffer);
        Serial.print("Gonderildi (" + String(strlen(jsonBuffer)) + " bytes): ");
        Serial.println(jsonBuffer);

        // Gönderim bittişi bayrak temizleme
        fallDetected = false;
        buttonLatch = false; // Butonu sıfırla, yeni basış bekle
    }
}
