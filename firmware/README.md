# ⚡ AgriVault ESP32 Node — Hardware Wiring & Flashing Guide

## Bill of Materials per Monitored Zone
1. **ESP32 NodeMCU / DevKit V1** (30-pin or 38-pin)
2. **DS18B20 Stainless Probe** (Waterproof 1-Wire temperature sensor)
3. **4.7kΩ Resistor** (Mandatory pull-up between 3.3V and DS18B20 Data pin)
4. **MQ-3 Gas Sensor Breakout** (Ethanol / Fermentation alcohol detection)
5. **MQ-135 Gas Sensor Breakout** (Ammonia / Air Quality / CO2 proxy)
6. **5V 1-Channel Relay Module** (For ventilation fan or cooling solenoid trigger)
7. **MB102 Solderless Breadboard & Jumper Wires**
8. **5V 2A Micro-USB / DC Power Supply**

---

## 🔌 Hardware Pinout Connection Table

| Sensor / Module | Sensor Pin | ESP32 Pin | Circuit Notes |
|---|---|---|---|
| **DS18B20 Temp Probe** | VCC (Red) | **3.3V** | Requires 3.3V logic |
| | GND (Black) | **GND** | Common ground rail |
| | DATA (Yellow/White) | **GPIO 4** | **Connect 4.7kΩ pull-up resistor to 3.3V** |
| **MQ-3 Gas Sensor** | VCC | **5V (VIN)** | Heater coil requires 5V rail (~150mA) |
| | GND | **GND** | Common ground |
| | AOUT | **GPIO 34** | ADC1 Channel 6 (analog read) |
| **MQ-135 Gas Sensor** | VCC | **5V (VIN)** | Heater coil requires 5V rail (~150mA) |
| | GND | **GND** | Common ground |
| | AOUT | **GPIO 35** | ADC1 Channel 7 (analog read) |
| **5V Relay Module** | VCC | **5V (VIN)** | Powers optical isolator and coil |
| | GND | **GND** | Common ground |
| | IN | **GPIO 26** | Controlled by ESP32 output logic |
| | COM / NO | Load Circuit | Switches fan or circulation blower |
| **Status LED** | Onboard | **GPIO 2** | Fast blink = connecting, Solid = operational |

---

## 🛠️ Arduino IDE Setup
1. Install **ESP32 Board Package** in Arduino IDE (`Tools` -> `Board Manager` -> Search `esp32` by Espressif).
2. Install Required Libraries via Library Manager:
   - `PubSubClient` by Nick O'Leary
   - `DallasTemperature` by Miles Burton
   - `OneWire` by Paul Stoffregen
3. Open `esp32_agrivault_node.ino`.
4. Configure your Wi-Fi SSID and Central Gateway IP in `config.h`.
5. Select Board `DOIT ESP32 DEVKIT V1` and Port, then click **Upload**!
