# ❄️ AGRIvault — Storage Intelligence Platform
> Production-grade real-time monitoring and intelligent management of cold storages, potato stores, grain warehouses, and fruit vaults.

---

## 🌟 Architecture Overview

```
                      +---------------------------------------+
                      |         AgriVault Cloud / VPS         |
                      |  - Node.js & TypeScript REST API      |
                      |  - Real-Time WebSocket Telemetry /ws  |
                      |  - Embedded Aedes MQTT Broker :1883   |
                      |  - SQLite WAL / Timescale DB          |
                      |  - Multi-Sensor Health & Alert Engine |
                      |  - Desktop / Mobile PWA Dashboard     |
                      +---------------------------------------+
                                          ▲
                     Internet / VPN (with automatic sync)
                                          ▼
                      +---------------------------------------+
                      |     Raspberry Pi Central Gateway      |
                      |  - Local Wi-Fi Mesh Controller        |
                      |  - Offline SQLite Telemetry Buffer    |
                      |  - Zero Data Loss Replay Queue        |
                      |  - Emergency Local Hysteresis Relay   |
                      +---------------------------------------+
                                          ▲
                              Local Wi-Fi / MQTT
                                          ▼
            +---------------------+               +---------------------+
            |  ESP32 Sensor Node  |               |  ESP32 Sensor Node  |
            |  (Area 1 - Potato)  |               |  (Area 3 - Fruit)   |
            | - DS18B20 Temp Probe|               | - DS18B20 Temp Probe|
            | - MQ-3 VOC/Ethanol  |               | - MQ-3 VOC/Ethanol  |
            | - MQ-135 NH3 / CO2  |               | - MQ-135 NH3 / CO2  |
            | - 5V Relay Module   |               | - 5V Relay Module   |
            +---------------------+               +---------------------+
```

---

## 🚀 Quick Start (1-Click Run on Windows)

1. Double-click `run_agrivault.bat` in the `agrivault` root folder.
2. The unified service boots on:
   - **Web / Desktop PWA Dashboard**: [http://localhost:4000](http://localhost:4000)
   - **REST API Endpoints**: [http://localhost:4000/api](http://localhost:4000/api)
   - **Real-Time Telemetry Stream**: `ws://localhost:4000/ws`
   - **Embedded MQTT Broker**: `mqtt://localhost:1883`

---

## 📦 What's Built & Included

```
agrivault/
├── backend/                        # Node.js + TypeScript Server
│   ├── src/
│   │   ├── database/               # node:sqlite WAL mode & PostgreSQL schema
│   │   │   ├── db.ts               # Connection pool, transactions & queries
│   │   │   ├── schema.sql          # 17 Production tables (Orgs, Facilities, Areas, ESPs, Sensors, etc.)
│   │   │   └── seed.ts             # 24-Hour realistic pre-seeded history & entities
│   │   ├── engine/                 # Core Algorithmic Decision Engines
│   │   │   ├── alertEngine.ts      # Deduplication, cooldowns & auto-resolution
│   │   │   ├── storageHealth.ts    # Multi-sensor compound risk analyzer
│   │   │   ├── areaHealthScore.ts  # Mathematical 0-100 score calculation
│   │   │   ├── automationEngine.ts # Relay control with safe deadband hysteresis
│   │   │   └── heartbeatWatchdog.ts# Node/Gateway online/offline tracker
│   │   ├── mqtt/                   # Embedded Aedes MQTT Broker & Topic Router
│   │   │   ├── broker.ts           # TCP port 1883 with authentication
│   │   │   └── handlers.ts         # Telemetry, status, commands & auto-discovery
│   │   ├── websocket/              # Real-Time WebSocket stream (/ws)
│   │   ├── routes/                 # REST API Routers
│   │   ├── simulator/              # Virtual IoT Fleet with 10 physics scenarios
│   │   └── index.ts                # Bootstrap & static PWA server
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── frontend/                       # React 18 + TypeScript + Tailwind CSS PWA
│   ├── public/
│   │   ├── manifest.json           # Desktop & Mobile PWA installation manifest
│   │   ├── sw.js                   # Service worker for offline asset caching
│   │   └── icons/icon.svg          # Crisp vector industrial icon
│   ├── src/
│   │   ├── api/                    # REST client & WebSocket manager
│   │   ├── components/             # Industrial UI Components
│   │   │   ├── Navbar.tsx          # Status chips, telemetry pulse & role switcher
│   │   │   ├── Sidebar.tsx         # Desktop navigation
│   │   │   ├── MobileNav.tsx       # Bottom navigation bar for mobile PWA
│   │   │   ├── AreaCard.tsx        # Zone summary cards with rate of change
│   │   │   ├── AlertBanner.tsx     # Actionable alert banner with causes
│   │   │   └── OnboardingWizard.tsx# 10-Step interactive guided facility setup
│   │   ├── pages/                  # Application Views
│   │   │   ├── Dashboard.tsx       # Executive overview
│   │   │   ├── AreaDetail.tsx      # Recharts deep-dive & multi-sensor analysis
│   │   │   ├── DevicesPage.tsx     # ESP discovery, rename & area mapping
│   │   │   ├── AlertsPage.tsx      # Alert center with causes & actions
│   │   │   ├── ReportsPage.tsx     # Historical report synthesis & CSV export
│   │   │   ├── AutomationPage.tsx  # Relay controls & hysteresis rules
│   │   │   ├── SystemHealthPage.tsx# Diagnostics for DB, MQTT, Gateways & Nodes
│   │   │   ├── SimulationPage.tsx  # 10 Controllable demo scenarios
│   │   │   └── SettingsPage.tsx    # Multi-scope thresholds & RBAC roles
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── gateway/                        # Raspberry Pi Local Controller Service
│   ├── gateway_daemon.py           # Offline SQLite buffer & cloud sync daemon
│   ├── agrivault-gateway.service   # Linux systemd auto-start service
│   └── README.md                   # RPi wiring & deployment guide
│
├── firmware/                       # ESP32 C++ Production Firmware
│   ├── esp32_agrivault_node/
│   │   ├── esp32_agrivault_node.ino# Arduino/PlatformIO sketch with auto-discovery
│   │   ├── config.h                # Pins, Wi-Fi credentials & topics
│   │   └── calibration.h           # Gas curve models & Ro calculations
│   └── README.md                   # Pinout diagram, schematics, pull-up resistors
│
├── docker-compose.yml              # Production multi-container Docker compose
├── Dockerfile.backend              # Backend Docker container
├── Dockerfile.frontend             # Frontend Nginx container
└── run_agrivault.bat               # 1-Click launcher
```

---

## 📡 Hardware Protocol Specification

### MQTT Topics
| Topic Pattern | Direction | Description |
|---|---|---|
| `agrivault/{facilityId}/gateway/{gatewayId}/device/{deviceId}/status` | ESP → Gateway | Node identity, capabilities announcement for auto-discovery |
| `agrivault/{facilityId}/gateway/{gatewayId}/device/{deviceId}/telemetry` | ESP → Gateway | Real-time multi-sensor readings |
| `agrivault/{facilityId}/gateway/{gatewayId}/device/{deviceId}/command` | Gateway → ESP | Remote relay actuation (`SET_RELAY`) |
| `agrivault/{facilityId}/gateway/{gatewayId}/device/{deviceId}/response` | ESP → Gateway | Actuation acknowledgement and state confirmation |

### Telemetry JSON Schema
```json
{
  "deviceId": "ESP32-A7F21",
  "timestamp": "2026-09-23T11:45:00.000Z",
  "temperature": 4.82,
  "humidity": 88.0,
  "co2": 1120,
  "ethylene": 0.04,
  "ammonia": 1.80,
  "ethanol": 0.60,
  "battery": 3.31,
  "rssi": -58,
  "raw": {
    "temperature": 4.82,
    "mq3": 620,
    "mq135": 780
  },
  "is_simulation": false
}
```

---

## ⚡ Hardware Pinout Table

| Sensor / Actuator | Pin | ESP32 Pin | Important Electrical Notes |
|---|---|---|---|
| **DS18B20 Temp Probe** | VCC | **3.3V** | Stainless waterproof probe |
| | GND | **GND** | Common ground rail |
| | DATA | **GPIO 4** | **Requires 4.7kΩ pull-up resistor to 3.3V** |
| **MQ-3 Gas Sensor** | VCC | **5V (VIN)** | Heater requires 5V rail (~150mA) |
| | GND | **GND** | Common ground |
| | AOUT | **GPIO 34** | Analog read (ADC1 Channel 6) |
| **MQ-135 Gas Sensor** | VCC | **5V (VIN)** | Heater requires 5V rail (~150mA) |
| | GND | **GND** | Common ground |
| | AOUT | **GPIO 35** | Analog read (ADC1 Channel 7) |
| **5V Relay Module** | VCC | **5V (VIN)** | Optical isolator power |
| | GND | **GND** | Common ground |
| | IN | **GPIO 26** | Controlled by ESP32 output logic |
| | COM / NO | Load | Fan / Chiller override circuit |

---

## 🛡️ Storage Health Engine & Scientific Interpretation

AgriVault strictly uses **scientifically responsible decision-support language**:
- *"may indicate"*
- *"possible cause"*
- *"investigate"*
- *"potential risk"*

### Multi-Sensor Correlation Examples:
- **Temperature ↑ + Humidity ↑ + CO2 ↑**:
  *Interpretation*: Elevated spoilage risk — accelerated respiration and biological heat in dense storage stacks.
  *Action*: Verify evaporator airflow, check air throw across pallet rows, and inspect stack centers for moisture.
- **Normal Temp + Normal Humidity + Ethylene ↑**:
  *Interpretation*: Physiological ripening or sprouting in storage.
  *Action*: Inspect stored produce for softening or sprouting; activate ethylene scrubbers.
- **Temperature ↑ + CO2 ↑ + Ethanol/VOC ↑**:
  *Interpretation*: Potential anaerobic fermentation or bacterial soft rot within interior pallets.
  *Action*: Measure core temperature with needle probes in suspect bulk boxes.

---

## 🔒 Safe Relay Automation (Hysteresis & Anti-Chatter)

To prevent equipment wear and contact chatter, AgriVault enforces **deadband hysteresis**:
- **Turn ON setpoint**: e.g., Temperature > 6.5°C
- **Turn OFF setpoint**: e.g., Temperature < 4.8°C (1.7°C deadband)
- **Continuous Runtime Cutoff**: Automatically disables relays after 3,600 seconds of continuous operation to protect compressor/motor windings.
- **Cooldown Lock**: Enforces a 300-second lock before toggling a relay again.

---

## 🌐 Raspberry Pi Gateway (Offline Buffer & Sync)

When warehouse internet drops:
1. ESP nodes continue streaming over local Wi-Fi to the Raspberry Pi.
2. The Gateway writes all readings to its local SQLite database (`gateway_buffer.db`).
3. The UI indicates: *"Cloud connection unavailable — Local monitoring active"*.
4. When cloud connectivity returns, all buffered packets are automatically uploaded in timestamp order with **zero data loss**.

---

## 👥 Role-Based Access Control (RBAC)

| Feature / Action | Owner | Admin | Operator | Viewer |
|---|:---:|:---:|:---:|:---:|
| View Live Telemetry & Graphs | ✅ | ✅ | ✅ | ✅ |
| Generate & Export Reports | ✅ | ✅ | ✅ | ✅ |
| Acknowledge Alerts | ✅ | ✅ | ✅ | ❌ |
| Manual Relay Actuation | ✅ | ✅ | ✅ | ❌ |
| Configure Automation Rules | ✅ | ✅ | ❌ | ❌ |
| Edit Threshold Boundaries | ✅ | ✅ | ❌ | ❌ |
| Add / Delete ESP Nodes | ✅ | ✅ | ❌ | ❌ |

---

## 📱 PWA Mobile & Desktop Installation

AgriVault conforms to PWA standards:
- **Desktop (Chrome / Edge / Safari)**: Click the "Install AgriVault" icon in the address bar to install as a standalone desktop window.
- **Mobile (Android / iOS)**: Open `http://<YOUR_IP>:4000` on your smartphone browser and tap **Add to Home screen** / **Install App**.
