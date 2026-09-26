#ifndef AGRIVAULT_CALIBRATION_H
#define AGRIVAULT_CALIBRATION_H

#include <Arduino.h>

// Calibration parameters for broad gas sensors (MQ-3 and MQ-135)
// IMPORTANT: These provide indicative engineering estimates, not lab-grade chromatography.
struct GasCalibration {
    float rl_value = 10.0;     // Load resistance in kOhms (standard breakout board)
    float mq3_ro = 20.0;       // Clean air baseline resistance for MQ-3
    float mq135_ro = 35.0;     // Clean air baseline resistance for MQ-135
};

extern GasCalibration gasCal;

// Converts raw 12-bit ADC value (0-4095) on ESP32 to Sensor Resistance (Rs)
inline float calculateSensorResistance(int rawAdc, float rl) {
    if (rawAdc <= 0) return rl * 1000.0;
    float vOut = (rawAdc / 4095.0) * 3.3;
    if (vOut >= 3.3) return 0.1;
    // Rs = ((Vcc - Vout) * RL) / Vout
    float rs = ((3.3 - vOut) * rl) / vOut;
    return rs > 0 ? rs : 0.1;
}

// MQ-3 Ethanol/VOC curve estimate: ppm = a * (Rs/Ro)^b
inline float estimateMQ3EthanolPpm(int rawAdc) {
    float rs = calculateSensorResistance(rawAdc, gasCal.rl_value);
    float ratio = rs / gasCal.mq3_ro;
    // Curve parameters for alcohol: a = 0.4, b = -1.45
    float ppm = 0.4 * pow(ratio, -1.45);
    return constrain(ppm, 0.05, 50.0);
}

// MQ-135 Ammonia (NH3) curve estimate: ppm = a * (Rs/Ro)^b
inline float estimateMQ135AmmoniaPpm(int rawAdc) {
    float rs = calculateSensorResistance(rawAdc, gasCal.rl_value);
    float ratio = rs / gasCal.mq135_ro;
    // Curve parameters for NH3: a = 1.02, b = -1.8
    float ppm = 1.02 * pow(ratio, -1.8);
    return constrain(ppm, 0.1, 100.0);
}

// MQ-135 CO2 surrogate estimate in ppm
inline float estimateMQ135CO2Ppm(int rawAdc) {
    float rs = calculateSensorResistance(rawAdc, gasCal.rl_value);
    float ratio = rs / gasCal.mq135_ro;
    // Base ambient CO2 ~ 420 ppm up to 3000 ppm
    float ppm = 110.0 * pow(ratio, -2.2) + 400.0;
    return constrain(ppm, 400.0, 5000.0);
}

#endif // AGRIVAULT_CALIBRATION_H
