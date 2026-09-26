# 🍓 AgriVault Central Gateway (Legacy Reference)

> [!NOTE]
> **No Raspberry Pi Gateway Required:**  
> AgriVault now supports a **direct-to-cloud IoT architecture**. ESP32 and ESP8266 sensor nodes connect directly to your facility Wi-Fi and stream telemetry to the AgriVault server over the Internet via HTTP REST (`POST /api/devices/telemetry`) and direct MQTT (`:1883`).  
> 
> The Raspberry Pi gateway files in this directory are preserved strictly as an optional on-premise local buffer for fully air-gapped industrial installations.

---

## Historical Key Responsibilities (Optional Air-Gapped Deployments)
1. **Local Wi-Fi / Mesh Hub**: Communicates with ESP32 sensor nodes over a dedicated local Wi-Fi SSID.
2. **Offline Data Buffering**: When internet drops in air-gapped setups, stores incoming readings inside local SQLite (`gateway_buffer.db`).
3. **Automatic Cloud Sync**: Once the cloud backend becomes reachable again, replays all buffered time-series records.

---

## 🛠️ Optional Raspberry Pi Installation (Air-Gapped Only)

### Step 1: Install Python Dependencies
```bash
sudo apt update && sudo apt install -y python3 python3-pip sqlite3
```

### Step 2: Copy Gateway Daemon
```bash
sudo mkdir -p /opt/agrivault/gateway
sudo mkdir -p /var/lib/agrivault
sudo cp gateway_daemon.py /opt/agrivault/gateway/
sudo chmod +x /opt/agrivault/gateway/gateway_daemon.py
```

### Step 3: Install & Enable systemd Service
```bash
sudo cp agrivault-gateway.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable agrivault-gateway
sudo systemctl start agrivault-gateway
```

### Step 4: Check Gateway Status & Logs
```bash
sudo systemctl status agrivault-gateway
journalctl -u agrivault-gateway -f
```
