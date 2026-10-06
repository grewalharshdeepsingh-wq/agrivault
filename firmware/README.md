# 📡 AgriVault Industrial Cold Storage IoT Firmware Architecture

> **Production Hardware Reference & Firmware Suite**  
> Tailored for large, sealed cold storage environments (e.g. 162 ft × 94 ft × 48 ft) where radio signals cannot reliably penetrate insulated metallic/composite walls.

---

## 🏛️ 1. Multi-Tier Hardware Architecture

```
[ INSIDE COLD STORE / WAREHOUSE ]                                  [ OUTSIDE FACILITY ]
┌──────────────────────────────┐
│  ESP32 SENSOR NODES          │
│  ├── DS18B20 Temp (Digital)  │
│  ├── DHT11 Humidity (Digital)│
│  ├── MQ-3 Ethanol/VOC        │
│  └── MQ-135 Ammonia/Air      │
└──────────────┬───────────────┘
               │ Local 2.4GHz Wireless
               │ (ESP-NOW Protocol)
               ▼
┌──────────────────────────────┐
│  INNER CENTRAL GATEWAY       │
│  (ESP32: GW-INNER-01)        │
│  - Auto-discovery via MAC    │
│  - Node Heartbeat Watchdog   │
│  - 500-Packet FIFO Buffer    │
└──────────────┬───────────────┘
               │ 
═══════════════╪════════════════════════════════════════════════════════════════════════
               │ WIRED WALL PENETRATION LINK (RS-485 / MAX485 Half-Duplex)
               │ Twisted Pair (A & B) with 120Ω Termination Resistors
═══════════════╪════════════════════════════════════════════════════════════════════════
               │
               ▼
┌──────────────────────────────┐
│  OUTER GATEWAY               │
│  (ESP32: GW-OUTER-01)        │
│  - Receives RS-485 frames    │
│  - 1,000-Packet FIFO Buffer  │
│  - Auto-Flushing on Recovery │
└──────────────┬───────────────┘
               │ Wi-Fi WAN / Ethernet Uplink
               ▼
        [ INTERNET WAN ]
               │
               ▼
┌──────────────────────────────┐
│  AgriVault Cloud / Server    │
│  - Node:3000 / Port 4000     │
│  - REST & MQTT Ingestion     │
│  - Storage Health Engine     │
└──────────────────────────────┘
```

---

## 🚦 2. Architectural Status Delineation

To maintain absolute engineering integrity, the system clearly separates capabilities:

### ✅ Currently Implemented Functionality (Software & Simulator)
1. **Permanent Hardware MAC Identity**: Nodes are keyed permanently by factory ESP32 MAC address (`hardware_id`), decoupled from renamable display names (`user_name`) and physical assignments (`device_code`).
2. **Security Provisioning Workflow**: New nodes enter `PENDING REGISTRATION` upon detection; administrators must authorize and configure physical location before telemetry activates facility health scoring.
3. **6-Tier Facility Hierarchy**: Configurable Cold Store (Length × Width × Height ft) ➔ Zone ➔ Area ➔ Rack ➔ Level ➔ ESP Node ➔ Sensors.
4. **Offline FIFO Buffering**: Inner and Outer gateways maintain queued readings during wired link or WAN outages; upon restoration, readings flush sequentially with original hardware timestamps marked `is_buffered = 1`.
5. **Multi-Sensor Metrics**: DS18B20, DHT11, MQ-3 (ethanol/fermentation VOCs), and MQ-135 (ammonia/hazardous air) are first-class metrics in backend schemas, MQTT handlers, and UI telemetry charts.
6. **2D Cold Store Layout Map**: Visualizes wall insulation boundaries, RS-485 wall link, Inner/Outer Gateways, and live node temperature/gas heatpins.
7. **Simulation Laboratory**: Interactive testbed for WAN outage, RS-485 cable severance, node watchdog timeouts, and gas anomalies clearly tagged `[SIMULATED]`.

### ⚠️ Hardware-Dependent Functionality (Requires Physical Hardware)
1. **ESP-NOW RF Propagation**: Subject to metal racking absorption, pallet density, and ice build-up in physical 162 ft × 94 ft warehouses.
2. **MAX485 Physical Wiring**: Requires correct differential wiring (`A` to `A`, `B` to `B`), DE/RE direction pin toggling, and 120Ω bus terminators at both ends.
3. **Gas Sensor Pre-heating**: MQ-3 and MQ-135 require 5V heater supplies and a 24-48h burn-in time for accurate baseline resistance ($R_0$) calibration.
4. **DS18B20 Pull-up Resistor**: Physical 4.7kΩ resistor between Data line and 3.3V is strictly required for OneWire communication.

### 🔮 Future / Placeholder Functionality
1. **Multi-Hop ESP-NOW Mesh Relay**: `parent_node_id` column and packet field are reserved for future intermediate repeater nodes in ultra-deep cold racks.
2. **Dual-SIM Cellular Fallback**: Secondary LTE-M / NB-IoT modem attached to Outer Gateway UART for remote facilities without reliable Wi-Fi WAN.

---

## 🔌 3. Complete Pinout & Wiring Specifications

### A. ESP32 Sensor Node Inside Cold Store
Located at: `firmware/esp32_sensor_node_espnow/esp32_sensor_node_espnow.ino`

| Sensor / Module | Sensor Pin | ESP32 GPIO | Description / Wiring Requirements |
| :--- | :--- | :--- | :--- |
| **DS18B20 Temperature** | VCC (Red) | 3.3V | Digital waterproof stainless probe |
| | GND (Black) | GND | Common Ground |
| | DATA (Yellow) | **GPIO 4** | **CRITICAL: Connect 4.7kΩ pull-up resistor between GPIO 4 and 3.3V** |
| **DHT11 / DHT22 Humidity**| VCC | 3.3V | Digital relative humidity sensor |
| | GND | GND | Common Ground |
| | DATA | **GPIO 5** | Built-in pull-up or external 10kΩ resistor |
| **MQ-3 Gas (Fermentation)**| VCC | 5V (VIN) | Heater requires 5V supply |
| | GND | GND | Common Ground |
| | AOUT (Analog) | **GPIO 34** | ADC1_CH6 (Safe to read concurrently with Wi-Fi) |
| **MQ-135 Gas (Ammonia)** | VCC | 5V (VIN) | Heater requires 5V supply |
| | GND | GND | Common Ground |
| | AOUT (Analog) | **GPIO 35** | ADC1_CH7 (Safe to read concurrently with Wi-Fi) |
| **Status Indicator** | Built-in LED | **GPIO 2** | Flashes on each successful ESP-NOW transmission |

---

### B. Inner Central Gateway (Inside Vault)
Located at: `firmware/esp32_inner_gateway/esp32_inner_gateway.ino`

| Component | Pin | ESP32 GPIO | Notes |
| :--- | :--- | :--- | :--- |
| **MAX485 Module** | VCC | 5V (VIN) | RS-485 transceiver supply |
| | GND | GND | Common Ground |
| | RO (Receiver Output) | **GPIO 16 (RX2)** | UART2 Serial RX |
| | DI (Driver Input) | **GPIO 17 (TX2)** | UART2 Serial TX |
| | DE (Driver Enable) | **GPIO 4** | Tied together with RE |
| | RE (Receiver Enable) | **GPIO 4** | HIGH = Transmit to Outer GW, LOW = Listen |
| | **A (Non-inverting)** | Twisted Pair Line A | Connect to Outer GW Line A (120Ω resistor across A & B) |
| | **B (Inverting)** | Twisted Pair Line B | Connect to Outer GW Line B |

---

### C. Outer Gateway (Outside Vault)
Located at: `firmware/esp32_outer_gateway/esp32_outer_gateway.ino`

| Component | Pin | ESP32 GPIO | Notes |
| :--- | :--- | :--- | :--- |
| **MAX485 Module** | VCC | 5V (VIN) | RS-485 transceiver supply |
| | GND | GND | Common Ground |
| | RO (Receiver Output) | **GPIO 16 (RX2)** | UART2 Serial RX from Inner GW |
| | DI (Driver Input) | **GPIO 17 (TX2)** | UART2 Serial TX |
| | DE / RE | **GPIO 4** | Held LOW to continuously receive from Inner GW |
| | **A** | Twisted Pair Line A | Connect to Inner GW Line A |
| | **B** | Twisted Pair Line B | Connect to Inner GW Line B |
| **WAN Status LED** | Anode | **GPIO 2** | Solid ON = Internet WAN Connected |

---

## 📦 4. Binary & JSON Frame Protocol

### ESP-NOW Raw Packet Structure (Sensor Node ➔ Inner Gateway)
```cpp
typedef struct __attribute__((packed)) {
  char hardware_id[18];       // Factory MAC address: "24:0A:C4:01:02:03"
  char device_id[16];         // Logical ID: "AGR-ESP-001"
  char firmware_version[16];  // e.g. "v2.5.0-espnow"
  uint32_t seq_number;        // Incremental transmission counter
  float temperature_c;        // DS18B20 reading (°C)
  float humidity_rh;          // DHT11 reading (% RH)
  float mq3_ppm;              // MQ-3 alcohol/fermentation VOC reading
  float mq135_ppm;            // MQ-135 ammonia/air quality reading
  float battery_volts;        // Supply voltage
  int8_t rssi;                // Signal strength indicator
  char parent_gateway_id[16]; // "GW-INNER-01"
  char parent_node_id[16];    // Reserved for repeater mesh
  uint8_t flags;              // Bit 0: battery low, Bit 1: sensor fault
} SensorPacket;
```

### Framed RS-485 Serial Protocol (Inner Gateway ➔ Outer Gateway)
```json
AGRI_FRAME:{
  "gateway_id": "GW-INNER-01",
  "hardware_id": "24:0A:C4:01:02:03",
  "device_id": "AGR-ESP-001",
  "seq": 1042,
  "temp": 3.45,
  "hum": 88.20,
  "mq3": 0.42,
  "mq135": 1.15,
  "battery": 3.30,
  "fw": "v2.5.0-espnow",
  "buffered": false
}:END
```

---

## 🛡️ 5. Provisioning Security Flow

1. **Detection**: Inner Gateway receives an ESP-NOW frame from an unrecognized MAC address.
2. **Registration Quarantine**: The node is recorded with `registration_status = 'pending'` and `is_discovered = 1`.
3. **Admin Review**: In AgriVault Dashboard or Fleet page, an amber banner prompts: **"New Hardware Nodes Pending Admin Provisioning"**.
4. **Configuration & Authorization**: The facility manager assigns the physical location (Cold Store, Zone, Rack, Level) and approves the node.
5. **Active Ingestion**: Once authorized (`registration_status = 'active'`), sensor readings stream into room health analytics and trigger automated ventilation relays.
