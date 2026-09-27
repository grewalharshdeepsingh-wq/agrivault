import bcrypt from 'bcryptjs';
import { db, initDatabase } from './db.js';

/**
 * Clean Production Seeder:
 * Ensures the basic administrative organization, facility, and login credentials exist.
 * Absolutely NO mock/fake ESPs, NO fake sensor readings, and NO pre-configured fake areas.
 * All areas and devices must be real hardware configured and transmitted by the user.
 */
export function seedDatabase(): void {
  initDatabase();

  const now = new Date().toISOString();
  const orgId = 'org-agrivault-01';
  const facId = 'fac-01';

  // 1. Ensure default Organization exists
  const existingOrg = db.get('SELECT id FROM organizations WHERE id = ?', orgId);
  if (!existingOrg) {
    db.run(
      'INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)',
      orgId,
      'AgriVault Facility Operations',
      now
    );
  }

  // 2. Ensure default Facility exists
  const existingFac = db.get('SELECT id FROM facilities WHERE id = ?', facId);
  if (!existingFac) {
    db.run(
      'INSERT INTO facilities (id, organization_id, name, location, description, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      facId,
      orgId,
      'Primary Cold Storage Facility',
      'Local Operations Vault',
      'Active commercial storage facility monitored by live ESP32 / ESP8266 IoT nodes.',
      now
    );
  }

  // 3. Ensure Admin user exists for authentication
  const existingUser = db.get('SELECT id FROM users WHERE email = ?', 'admin@agrivault.io');
  if (!existingUser) {
    const passwordHash = bcrypt.hashSync('agrivault2026!', 10);
    db.run(
      'INSERT INTO users (id, organization_id, name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      'usr-admin',
      orgId,
      'Facility Engineer',
      'admin@agrivault.io',
      passwordHash,
      'Owner',
      now,
      now
    );
  }

  // 4. PURGE ANY OLD DEMO/MOCK DATA COMPLETELY
  // Purge simulated/mock devices
  db.run(`
    DELETE FROM esp_devices 
    WHERE id IN (
      'ESP32-A7F21', 'ESP32-B8E34', 'ESP32-C9D45', 'ESP32-D1F56', 
      'ESP32-E2A67', 'ESP32-F3B78', 'ESP8266-C4B12', 'ESP8266-TEST-LIVE', 
      'ESP32-TEST-LIVE', 'ESP8266-AUTO-DISCOVER-01'
    )
  `);

  // Purge simulated/mock areas
  db.run(`
    DELETE FROM areas 
    WHERE id IN ('area-01', 'area-02', 'area-03', 'area-04')
  `);

  // Clean any dangling demo records
  db.run('DELETE FROM sensors WHERE device_id NOT IN (SELECT id FROM esp_devices)');
  db.run('DELETE FROM sensor_readings WHERE device_id NOT IN (SELECT id FROM esp_devices)');
  db.run('DELETE FROM relay_devices WHERE device_id NOT IN (SELECT id FROM esp_devices)');
  db.run('DELETE FROM alerts WHERE device_id NOT IN (SELECT id FROM esp_devices)');
  db.run('DELETE FROM alert_events WHERE alert_id NOT IN (SELECT id FROM alerts)');

  console.log('[Seed] Production database ready. Zero mock devices or areas. Pure live mode.');
}

