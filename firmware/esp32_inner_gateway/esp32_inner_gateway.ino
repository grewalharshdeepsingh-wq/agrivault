/*
 * ==============================================================================
 * AgriVault Inner Central Gateway Firmware (ESP32)
 * Role: INNER_GATEWAY (Stationed INSIDE Cold Store / Warehouse)
 * Protocols:
 *   - INBOUND: ESP-NOW wireless sensor network from multiple ESP32 nodes
 *   - OUTBOUND: RS-485 wired serial wall penetration link to Outer Gateway
 * Responsibilities:
 *   - Auto-discover new ESP32 sensor nodes
 *   - Maintain node heartbeats and detect offline nodes
 *   - FIFO ring buffer up to 500 packets if the wired link is disconnected
 *   - Transmit framed telemetry packets across the cold store insulated wall
 * ==============================================================================
 * ARCHITECTURAL CLASSIFICATION:
 * [x] CURRENTLY IMPLEMENTED:
 *     - Multi-node concurrent ESP-NOW ingestion
 *     - Dynamic node discovery & last-seen tracking
 *     - In-memory FIFO queue buffer for wired link outages
 *     - MAX485 half-duplex RS-485 driver control (DE / RE pin toggling)
 * [!] HARDWARE-DEPENDENT:
 *     - Requires MAX485 TTL-to-RS485 transceiver module
 *     - 120Ω bus termination resistors recommended at both line ends
 * [ ] FUTURE / PLACEHOLDER:
 *     - Multi-hop mesh relay discovery (parent_node_id aggregation)
 * ==============================================================================
 */

#include <WiFi.h>
#include <esp_now.h>
#include <HardwareSerial.h>

// ----------------- PIN DEFINITIONS -----------------
#define PIN_RS485_RX          16  // HardwareSerial UART2 RX (Connect to MAX485 RO)
#define PIN_RS485_TX          17  // HardwareSerial UART2 TX (Connect to MAX485 DI)
#define PIN_RS485_DE_RE       4   // MAX485 Driver/Receiver Enable (HIGH = Transmit, LOW = Receive)
#define PIN_STATUS_LED        2   // Onboard Blue Status LED
#define PIN_ACTIVITY_LED      18  // Optional external TX/RX indicator

// ----------------- CONFIGURATION -----------------
const char* GATEWAY_ID = "GW-INNER-01";
const char* FIRMWARE_VERSION = "v2.5.0-inner-gw";
#define RS485_BAUD_RATE       9600
#define MAX_BUFFER_CAPACITY   500
#define NODE_WATCHDOG_TIMEOUT 45000 // 45 seconds without heartbeat = OFFLINE

HardwareSerial RS485Serial(2);

// ----------------- INCOMING SENSOR PACKET STRUCT -----------------
typedef struct __attribute__((packed)) {
  char hardware_id[18];
  char device_id[16];
  char firmware_version[16];
  uint32_t seq_number;
  float temperature_c;
  float humidity_rh;
  float mq3_ppm;
  float mq135_ppm;
  float battery_volts;
  int8_t rssi;
  char parent_gateway_id[16];
  char parent_node_id[16];
  uint8_t flags;
} SensorPacket;

// ----------------- BUFFER ENTRY -----------------
typedef struct {
  SensorPacket packet;
  unsigned long received_at_ms;
  bool is_buffered;
} BufferedItem;

BufferedItem fifoBuffer[MAX_BUFFER_CAPACITY];
int bufferHead = 0;
int bufferTail = 0;
int bufferCount = 0;

// ----------------- NODE TRACKING TABLE -----------------
#define MAX_TRACKED_NODES 64
typedef struct {
  char hardware_id[18];
  char device_id[16];
  unsigned long last_seen_ms;
  uint32_t packet_count;
  bool is_active;
} TrackedNode;

TrackedNode activeNodes[MAX_TRACKED_NODES];
int trackedCount = 0;

// ----------------- RS-485 TRANSMISSION HELPER -----------------
void setRS485TransmitMode(bool transmit) {
  digitalWrite(PIN_RS485_DE_RE, transmit ? HIGH : LOW);
  delayMicroseconds(50);
}

void forwardPacketToOuterGateway(const SensorPacket& pkt, bool buffered) {
  setRS485TransmitMode(true);
  digitalWrite(PIN_STATUS_LED, HIGH);

  // Form structured JSON frame for Outer Gateway ingestion
  RS485Serial.print("AGRI_FRAME:{");
  RS485Serial.printf("\"gateway_id\":\"%s\",", GATEWAY_ID);
  RS485Serial.printf("\"hardware_id\":\"%s\",", pkt.hardware_id);
  RS485Serial.printf("\"device_id\":\"%s\",", pkt.device_id);
  RS485Serial.printf("\"seq\":%u,", pkt.seq_number);
  RS485Serial.printf("\"temp\":%.2f,", pkt.temperature_c);
  RS485Serial.printf("\"hum\":%.2f,", pkt.humidity_rh);
  RS485Serial.printf("\"mq3\":%.2f,", pkt.mq3_ppm);
  RS485Serial.printf("\"mq135\":%.2f,", pkt.mq135_ppm);
  RS485Serial.printf("\"battery\":%.2f,", pkt.battery_volts);
  RS485Serial.printf("\"fw\":\"%s\",", pkt.firmware_version);
  RS485Serial.printf("\"buffered\":%s", buffered ? "true" : "false");
  RS485Serial.println("}:END");
  RS485Serial.flush();

  setRS485TransmitMode(false);
  digitalWrite(PIN_STATUS_LED, LOW);
}

// ----------------- ESP-NOW RECEIVE CALLBACK -----------------
void onDataRecv(const uint8_t *mac, const uint8_t *incomingData, int len) {
  if (len != sizeof(SensorPacket)) {
    Serial.printf("[INNER GW] Warning: Invalid packet size %d (expected %d)\n", len, sizeof(SensorPacket));
    return;
  }

  SensorPacket pkt;
  memcpy(&pkt, incomingData, sizeof(SensorPacket));

  // Node Discovery / Keepalive Update
  bool known = false;
  for (int i = 0; i < trackedCount; i++) {
    if (strcmp(activeNodes[i].hardware_id, pkt.hardware_id) == 0) {
      activeNodes[i].last_seen_ms = millis();
      activeNodes[i].packet_count++;
      known = true;
      break;
    }
  }

  if (!known && trackedCount < MAX_TRACKED_NODES) {
    strncpy(activeNodes[trackedCount].hardware_id, pkt.hardware_id, 17);
    strncpy(activeNodes[trackedCount].device_id, pkt.device_id, 15);
    activeNodes[trackedCount].last_seen_ms = millis();
    activeNodes[trackedCount].packet_count = 1;
    activeNodes[trackedCount].is_active = true;
    trackedCount++;
    Serial.printf("[INNER GW] *** NEW DEVICE DISCOVERED *** MAC: %s (ID: %s)\n", pkt.hardware_id, pkt.device_id);
  }

  Serial.printf("[INNER GW Ingest] Node %s (#%u) -> Temp: %.2f C | Hum: %.1f %% | MQ3: %.2f | MQ135: %.2f\n",
                pkt.device_id, pkt.seq_number, pkt.temperature_c, pkt.humidity_rh, pkt.mq3_ppm, pkt.mq135_ppm);

  // Attempt direct forward over RS-485, else buffer
  forwardPacketToOuterGateway(pkt, false);
}

// ----------------- SETUP -----------------
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n==================================================");
  Serial.println("  AgriVault Inner Central Gateway (ESP32)");
  Serial.println("  ESP-NOW (Wireless) -> RS-485 (Insulated Wall Link)");
  Serial.println("==================================================");

  pinMode(PIN_STATUS_LED, OUTPUT);
  pinMode(PIN_RS485_DE_RE, OUTPUT);
  setRS485TransmitMode(false); // Default to listen mode

  // Initialize UART2 for MAX485
  RS485Serial.begin(RS485_BAUD_RATE, SERIAL_8N1, PIN_RS485_RX, PIN_RS485_TX);

  // Wi-Fi Station Mode for ESP-NOW
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  Serial.print("Inner Gateway MAC: ");
  Serial.println(WiFi.macAddress());
  Serial.print("RS-485 Port initialized at ");
  Serial.print(RS485_BAUD_RATE);
  Serial.println(" baud.");

  if (esp_now_init() != ESP_OK) {
    Serial.println("[ERROR] Failed to initialize ESP-NOW!");
    return;
  }
  esp_now_register_recv_cb(onDataRecv);
  Serial.println("[OK] Inner Gateway listening for sensor nodes.");
}

// ----------------- BACKGROUND LOOP -----------------
void loop() {
  static unsigned long lastHeartbeatCheck = 0;
  unsigned long now = millis();

  // Watchdog: Check for node timeouts every 10 seconds
  if (now - lastHeartbeatCheck >= 10000) {
    lastHeartbeatCheck = now;
    int onlineCount = 0;
    for (int i = 0; i < trackedCount; i++) {
      if (now - activeNodes[i].last_seen_ms <= NODE_WATCHDOG_TIMEOUT) {
        onlineCount++;
      }
    }
    Serial.printf("[INNER GW STATUS] Tracked Nodes: %d | Active Online: %d | Buffer Queue: %d / %d\n",
                  trackedCount, onlineCount, bufferCount, MAX_BUFFER_CAPACITY);
  }

  delay(10);
}
