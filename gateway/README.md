# 🍓 AgriVault Central Gateway — Raspberry Pi Setup & Guide

The AgriVault Central Gateway runs on a Raspberry Pi (RPi 3B+, 4, 5, or Compute Module) positioned inside or adjacent to the cold storage warehouse.

## Key Responsibilities
1. **Local Wi-Fi / Mesh Hub**: Communicates with ESP32 sensor nodes over a dedicated local Wi-Fi SSID (`AgriVault-Local-Mesh`).
2. **Offline Data Buffering**: When the commercial warehouse internet connection goes down, the Gateway stores all incoming readings inside a local SQLite database (`gateway_buffer.db`).
3. **Automatic Cloud Sync**: Once the cloud backend becomes reachable again, all buffered time-series records are automatically transmitted to the AgriVault Cloud in original chronological order.
4. **Emergency Local Automation**: If temperatures exceed critical limits during an internet outage, the gateway triggers local relays directly without waiting for cloud authorization.

---

## 🛠️ Step-by-Step Raspberry Pi Installation

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
# Stream live logs:
journalctl -u agrivault-gateway -f
```
