# 📡 AgriVault Universal ESP Node Firmware (ESP8266 & ESP32)

> Production-grade firmware for **ESP8266** (NodeMCU, Wemos D1 Mini) and **ESP32** (DevKit-V1, NodeMCU-32S, ESP-WROOM).  
> Features an unstyled **SoftAP Captive Portal Wi-Fi Setup Wizard**, **Over-The-Air (OTA) updates**, and **direct HTTP/MQTT telemetry streaming** to the AgriVault platform.

---

## 🌟 Key Features

1. **Dual Microcontroller Compatibility**: A single Arduino sketch automatically adapts pins and libraries for both ESP8266 and ESP32.
2. **SoftAP Setup Wizard (Zero Styling / Fast Captive Portal)**:
   - When unconfigured or unable to connect, the ESP broadcasts a Wi-Fi Access Point: `AgriVault-Node-[MAC]`.
   - Captive portal automatically opens `http://192.168.4.1` on your phone or laptop.
   - Clean, lightweight steps to enter your Wi-Fi SSID, Password, and AgriVault Server URL.
   - Saves credentials to persistent flash memory (EEPROM) and reboots into normal monitoring mode.
3. **Dual Over-The-Air (OTA) Updating**:
   - **Local Network OTA (`ArduinoOTA`)**: Wirelessly flash new code directly from Arduino IDE or PlatformIO without USB cables.
   - **Web Browser OTA (`http://<DEVICE_IP>/update`)**: Upload pre-compiled `.bin` firmware files directly via any web browser.
4. **Auto-Discovery by AgriVault**:
   - As soon as the ESP connects to the internet/Wi-Fi and transmits its first packet, AgriVault immediately discovers the device and displays it on the Dashboard.
5. **Dynamic Room & Section Assignment**:
   - Assign discovered ESPs to storage rooms (e.g. Potato Store 1, Fruit Vault B, Cold Room 3) with 1 click.
6. **Physical Button Reset**:
   - Hold the onboard **BOOT / FLASH button (GPIO 0)** for **3 seconds** to clear saved credentials and return to SoftAP setup mode anytime.

---

## 🔌 Hardware Wiring Diagram

### 1. ESP8266 (NodeMCU / Wemos D1 Mini)

| Sensor / Module | Sensor Pin | ESP8266 Pin | Notes |
| :--- | :--- | :--- | :--- |
| **DS18B20 Temp Probe** | VCC (Red) | 3.3V | Digital waterproof probe |
| | GND (Black) | GND | Common Ground |
| | DATA (Yellow) | **D2 (GPIO 4)** | **Requires 4.7kΩ pull-up resistor to 3.3V** |
| **Analog Gas Sensor** (MQ-135 / MQ-3) | AOUT | **A0 (ADC0)** | Analog 0-1V / 0-3.3V |
| | VCC | 5V (Vin) | Heater requires 5V |
| | GND | GND | Common Ground |
| **Relay Module** (Optional) | IN | **D5 (GPIO 14)** | Active HIGH |
| **Status LED** | Onboard | **D4 (GPIO 2)** | Built-in Blue LED |
| **Reset SoftAP** | Pushbutton | **D3 (GPIO 0)** | Onboard FLASH button (Hold 3s) |

---

### 2. ESP32 (DevKit-V1 / 30-Pin / 38-Pin)

| Sensor / Module | Sensor Pin | ESP32 Pin | Notes |
| :--- | :--- | :--- | :--- |
| **DS18B20 Temp Probe** | VCC (Red) | 3.3V | Digital waterproof probe |
| | GND (Black) | GND | Common Ground |
| | DATA (Yellow) | **GPIO 4** | **Requires 4.7kΩ pull-up resistor to 3.3V** |
| **Analog Gas Sensor** (MQ-135) | AOUT | **GPIO 34 (ADC1_CH6)** | ADC1 safe to read while Wi-Fi is active |
| | VCC | 5V (VIN) | Heater requires 5V |
| | GND | GND | Common Ground |
| **Optional 2nd Gas** (MQ-3) | AOUT | **GPIO 35 (ADC1_CH7)** | Ethanol / VOCs |
| **Relay Module** (Optional) | IN | **GPIO 26** | 5V 1-Channel Relay |
| **Status LED** | Onboard | **GPIO 2** | Built-in Blue LED |
| **Reset SoftAP** | Pushbutton | **GPIO 0** | Onboard BOOT button (Hold 3s) |

---

## 🛠️ Arduino IDE Setup & Flashing

### Step 1: Install Required Libraries in Arduino IDE
Open **Arduino IDE** -> **Sketch** -> **Include Library** -> **Manage Libraries...** and install:
1. `OneWire` by Paul Stoffregen
2. `DallasTemperature` by Miles Burton
3. `ArduinoOTA` (built-in)

### Step 2: Select Board
- For ESP8266: **Tools** -> **Board** -> **ESP8266 Boards** -> **NodeMCU 1.0 (ESP-12E Module)**.
- For ESP32: **Tools** -> **Board** -> **esp32** -> **ESP32 Dev Module**.

### Step 3: Compile and Upload
1. Open [`agrivault_universal_node/agrivault_universal_node.ino`](file:///C:/Users/Harshdeep%20singh/agrivault/firmware/agrivault_universal_node/agrivault_universal_node.ino).
2. Connect your ESP via USB cable and click **Upload**.

---

## 📲 How to Connect to Wi-Fi (Setup Wizard)

1. On first power-up (or if Wi-Fi cannot be reached), the ESP will start an access point:  
   **Wi-Fi SSID**: `AgriVault-Node-XXXX` (e.g. `AgriVault-Node-4A1B`)  
   **Password**: *(Open network, no password required)*
2. Connect to this network on your smartphone, tablet, or laptop.
3. A captive portal screen will appear automatically, or you can open your browser and navigate to:  
   `http://192.168.4.1`
4. Fill in the simple form:
   - **Wi-Fi Network Name (SSID)**: Your home or warehouse Wi-Fi name.
   - **Wi-Fi Password**: Your network password.
   - **AgriVault Server Base URL**: e.g., `http://192.168.1.100:4000` (or your cloud URL).
   - **Friendly Name**: e.g., `Cold Room 01 Probe`.
5. Click **Save and Connect to Network**.
6. The module will store the configuration in flash memory and reboot into your Wi-Fi network.

---

## 🔄 Over-The-Air (OTA) Firmware Updates

Once connected to your Wi-Fi network, you can update the ESP without touching the USB cable:

### Option A: Web Browser OTA (`/update`)
1. In your AgriVault Dashboard or router, find the ESP's IP address (e.g. `192.168.1.145`).
2. Open a web browser and go to:  
   `http://192.168.1.145/update`
3. Click **Choose File** and select your compiled `.bin` file (in Arduino IDE: *Sketch -> Export Compiled Binary*).
4. Click **Flash Firmware Over-The-Air**. The ESP updates and reboots automatically!

### Option B: Arduino IDE Network Port
In Arduino IDE under **Tools** -> **Port**, your module will appear under **Network Ports**:  
`ESP32-XXXXXX at 192.168.1.145`. Select it and click Upload!

---

## 🖥️ Using the Dashboard & Analytics

1. **Auto-Discovery**:
   - As soon as the ESP boots and transmits telemetry, a notification banner appears in the Dashboard:  
     `"1 ESP Module Ready for Setup — Connected to network and transmitting telemetry."`
2. **Card Views (Rooms & Sections)**:
   - Click **+ Add Room / Section** on the Dashboard.
   - Enter room name (e.g. `Potato Store North`) and commodity.
   - Select your discovered ESP module using the checkbox.
   - The room card will immediately show the live temperature, humidity, CO2, and gas readings streaming from your ESP!
3. **Analytics & Statistics Page**:
   - Click **Analytics & Stats** on the sidebar.
   - View comparative multi-room line charts across all your rooms.
   - Inspect statistical distributions: **Minimum, Maximum, Mean Average, Standard Deviation (Drift), and Environmental Stability Score (%)**.
