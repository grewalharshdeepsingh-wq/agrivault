import { Sensor } from '../types';

// Food commodity profiles for AgriVault fleet diversification
// Maintains baseline telemetry near the user-assigned rotting data (19°C, 55 CO2)
// while providing realistic biological variations and desynchronized phase cycling.

export interface FoodTypeProfile {
  id: string;
  name: string;
  icon: string;
  category: string;
  baseTemp: number;     // tightly centered near 19°C (18.6°C - 19.5°C)
  baseCo2: number;      // tightly centered near 55 ppm (52 - 62 ppm)
  baseHumidity: number; // near 94.5% RH (88.5% - 95.5%)
  baseAmmonia: number;  // near 6.8 ppm (5.8 - 7.6 ppm)
  baseEthanol: number;  // near 3.8 ppm (2.6 - 4.5 ppm)
  baseEthylene: number; // near 0.24 ppm (0.12 - 0.44 ppm)
  phaseOffset: number;  // radians for sine wave, creating distinct smooth cycling
  description: string;
}

export const FOOD_PROFILES: Record<string, FoodTypeProfile> = {
  potato: {
    id: 'potato',
    name: 'Potatoes (Bulk Cold Store)',
    icon: '🥔',
    category: 'Root Vegetable',
    baseTemp: 19.0,
    baseCo2: 55,
    baseHumidity: 94.5,
    baseAmmonia: 6.8,
    baseEthanol: 3.8,
    baseEthylene: 0.24,
    phaseOffset: 0.0,
    description: 'Tubers undergoing warm decay; anaerobic alcohol fermentation with soft rot risk.'
  },
  apple: {
    id: 'apple',
    name: 'Apples (Crisp Storage)',
    icon: '🍎',
    category: 'Pome Fruit',
    baseTemp: 18.8,
    baseCo2: 58,
    baseHumidity: 93.0,
    baseAmmonia: 6.2,
    baseEthanol: 3.2,
    baseEthylene: 0.38,
    phaseOffset: 1.25,
    description: 'Pome fruit; higher ethylene emission & fungal decay pectin breakdown.'
  },
  onion: {
    id: 'onion',
    name: 'Onions (Cured Storage)',
    icon: '🧅',
    category: 'Allium Bulb',
    baseTemp: 19.4,
    baseCo2: 52,
    baseHumidity: 91.5,
    baseAmmonia: 7.6,
    baseEthanol: 2.9,
    baseEthylene: 0.18,
    phaseOffset: 2.5,
    description: 'Allium bulbs; pungent volatile sulfur & ammonia breakdown vapors.'
  },
  banana: {
    id: 'banana',
    name: 'Bananas (Holding)',
    icon: '🍌',
    category: 'Tropical Fruit',
    baseTemp: 19.2,
    baseCo2: 60,
    baseHumidity: 95.0,
    baseAmmonia: 6.4,
    baseEthanol: 4.1,
    baseEthylene: 0.44,
    phaseOffset: 3.75,
    description: 'Climacteric fruit; rapid ethylene surge, softening & peel decay.'
  },
  tomato: {
    id: 'tomato',
    name: 'Tomatoes (Vine Fresh)',
    icon: '🍅',
    category: 'Nightshade',
    baseTemp: 18.9,
    baseCo2: 56,
    baseHumidity: 93.8,
    baseAmmonia: 6.5,
    baseEthanol: 3.6,
    baseEthylene: 0.30,
    phaseOffset: 4.8,
    description: 'Solanaceous produce; Botrytis decay & watery soft rot.'
  },
  grain: {
    id: 'grain',
    name: 'Wheat / Grain (Silo)',
    icon: '🌾',
    category: 'Cereal Grain',
    baseTemp: 19.5,
    baseCo2: 62,
    baseHumidity: 88.5,
    baseAmmonia: 5.8,
    baseEthanol: 2.6,
    baseEthylene: 0.12,
    phaseOffset: 5.5,
    description: 'Bulk grains; fungal heating hot-spot & respiration CO2 spike.'
  },
  strawberry: {
    id: 'strawberry',
    name: 'Strawberries (Berry Vault)',
    icon: '🍓',
    category: 'Soft Berry',
    baseTemp: 18.6,
    baseCo2: 59,
    baseHumidity: 94.0,
    baseAmmonia: 6.3,
    baseEthanol: 4.5,
    baseEthylene: 0.28,
    phaseOffset: 0.8,
    description: 'Soft berries; gray mold & rapid alcohol fermentation.'
  },
  carrot: {
    id: 'carrot',
    name: 'Carrots (Root Vault)',
    icon: '🥕',
    category: 'Root Vegetable',
    baseTemp: 18.7,
    baseCo2: 54,
    baseHumidity: 95.5,
    baseAmmonia: 6.1,
    baseEthanol: 3.3,
    baseEthylene: 0.22,
    phaseOffset: 2.1,
    description: 'Taproots; high humidity saturation & white mold decay.'
  }
};

export function getFoodProfile(foodType?: string): FoodTypeProfile {
  if (!foodType) return FOOD_PROFILES.potato;
  const key = foodType.toLowerCase().trim();
  for (const [k, prof] of Object.entries(FOOD_PROFILES)) {
    if (k === key || prof.name.toLowerCase().includes(key) || key.includes(k)) {
      return prof;
    }
  }
  return FOOD_PROFILES.potato;
}

export function getAllFoodProfiles(): FoodTypeProfile[] {
  return Object.values(FOOD_PROFILES);
}

/**
 * Generates continuous smooth sinusoidal cycling telemetry centered near the assigned data (19°C, 55 CO2)
 * with commodity-specific phase shift.
 */
export function getCyclingTelemetryForFood(foodType?: string, phaseShift = 0) {
  const profile = getFoodProfile(foodType);
  const now = Date.now();
  const tSec = now / 1000;
  const phi = profile.phaseOffset + phaseShift;

  const tempNoise = 0.65 * Math.sin((tSec * 2 * Math.PI) / 60 + phi);
  const co2Noise = 3.2 * Math.sin((tSec * 2 * Math.PI) / 45 + 1.0 + phi);
  const humNoise = 1.5 * Math.sin((tSec * 2 * Math.PI) / 75 + 2.0 + phi);
  const nh3Noise = 0.6 * Math.sin((tSec * 2 * Math.PI) / 50 + 0.5 + phi);
  const ethNoise = 0.4 * Math.sin((tSec * 2 * Math.PI) / 40 + 1.5 + phi);
  const ethyleneNoise = 0.04 * Math.sin((tSec * 2 * Math.PI) / 80 + 3.0 + phi);

  return {
    temperature: +(profile.baseTemp + tempNoise).toFixed(1),
    co2: Math.max(0, Math.round(profile.baseCo2 + co2Noise)),
    humidity: Math.min(100, Math.max(0, +(profile.baseHumidity + humNoise).toFixed(1))),
    ammonia: Math.max(0, +(profile.baseAmmonia + nh3Noise).toFixed(2)),
    ethanol: Math.max(0, +(profile.baseEthanol + ethNoise).toFixed(2)),
    ethylene: Math.max(0, +(profile.baseEthylene + ethyleneNoise).toFixed(3)),
    mq3: Math.round(Math.max(50, (profile.baseEthanol + ethNoise) * 480)),
    mq135: Math.round(Math.max(100, (profile.baseAmmonia + nh3Noise) * 330))
  };
}

export function buildFakeSensors(
  deviceId: string,
  areaId: string | null,
  foodType: string,
  phaseShift = 0
): Sensor[] {
  const tele = getCyclingTelemetryForFood(foodType, phaseShift);
  const nowIso = new Date().toISOString();

  const makeSensor = (type: string, name: string, unit: string, pin: string, val: number): Sensor => ({
    id: `sens-${deviceId}-${type}`,
    device_id: deviceId,
    area_id: areaId || '',
    sensor_type: type,
    name,
    unit,
    pin,
    raw_reading: val,
    calibrated_reading: val,
    rate_of_change: 0,
    rate_of_change_period: '30 min',
    calibration_status: 'factory_default',
    confidence_score: 96,
    sensor_health: 'healthy',
    last_reading_time: nowIso
  });

  return [
    makeSensor('temperature', 'Temperature Probe (DS18B20)', '°C', 'GPIO 4', tele.temperature),
    makeSensor('humidity', 'Relative Humidity (DHT11)', '%', 'GPIO 32', tele.humidity),
    makeSensor('co2', 'Respiration & CO2 (MQ-135)', 'ppm', 'GPIO 34', tele.co2),
    makeSensor('ammonia', 'Ammonia & Breakdown (MQ-135)', 'ppm', 'GPIO 34', tele.ammonia),
    makeSensor('ethanol', 'Volatile Ethanol (MQ-3)', 'ppm', 'GPIO 35', tele.ethanol),
    makeSensor('ethylene', 'Ethylene Gas (Senescence)', 'ppm', 'GPIO 25', tele.ethylene),
    makeSensor('mq3', 'Volatiles & Fermentation (MQ-3)', 'ppm', 'GPIO 35', tele.ethanol),
    makeSensor('mq135', 'Air Quality & Respiration (MQ-135)', 'ppm', 'GPIO 34', tele.ammonia)
  ];
}
