/*
 * AgriVault ESP #1 — Sensor Sender Config
 *
 * Role: Reads all physical sensors, sends a compact pipe-delimited
 *       data string to ESP #2 over UART (Serial2) every 1 second.
 *
 * Wiring to ESP #2 (Site Forwarder):
 *   ESP #1 TX2 (GPIO 17) ──────► ESP #2 RX (D5 / GPIO 14)
 *   ESP #1 RX2 (GPIO 16) ◄────── ESP #2 TX (D6 / GPIO 12)
 *   ESP #1 GND            ──────► ESP #2 GND   (SHARED GROUND — required)
 */

#ifndef ESP1_CONFIG_H
#define ESP1_CONFIG_H

#include <Arduino.h>

// ── Hardware board type ────────────────────────────────────────────────────
#define BOARD_TYPE          "ESP32-DevKit-V1"   // or "ESP8266-NodeMCU"

// ── Device identity sent inside every packet ──────────────────────────────
// ESP #1 generates a MAC-based ID automatically at runtime (see sketch)
#define FACILITY_ID         "fac-01"
#define FIRMWARE_VERSION    "1.0.0"

// ── Sensor pins (ESP32) ───────────────────────────────────────────────────
#define PIN_DS18B20         4    // 1-Wire temperature probe (add 4.7kΩ pull-up to 3.3V)
#define PIN_MQ3_ANALOG      34   // ADC1_CH6 — Ethanol / VOC (MQ-3)
#define PIN_MQ135_ANALOG    35   // ADC1_CH7 — Ammonia / CO2 (MQ-135)
#define PIN_RELAY           26   // 5V relay output
#define PIN_STATUS_LED      2    // Built-in blue LED

// ── Serial bridge to ESP #2 ───────────────────────────────────────────────
// Uses hardware Serial2 on ESP32 (TX=GPIO17, RX=GPIO16)
// On ESP8266 use SoftwareSerial — see the sketch for the #ifdef
#define BRIDGE_BAUD         115200

// ── Telemetry interval ────────────────────────────────────────────────────
#define TELEMETRY_INTERVAL_MS  1000    // Fire every 1 second

// ── Gas sensor calibration baselines ─────────────────────────────────────
#define MQ3_RL_KOHM         10.0f
#define MQ3_RO              20.0f     // Baseline Rs in clean air for MQ-3
#define MQ135_RL_KOHM       10.0f
#define MQ135_RO            35.0f    // Baseline Rs in clean air for MQ-135

#endif // ESP1_CONFIG_H
