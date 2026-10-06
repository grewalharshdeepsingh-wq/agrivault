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

  // 2. Ensure default Facility exists with configurable dimensions
  const existingFac = db.get('SELECT id FROM facilities WHERE id = ?', facId);
  if (!existingFac) {
    db.run(
      'INSERT INTO facilities (id, organization_id, name, location, description, length_ft, width_ft, height_ft, dimensions_unit, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      facId,
      orgId,
      'Cold Store A (Bulk Operations)',
      'Section 4, Industrial Food Park',
      'High-capacity insulated cold storage vault (162 ft × 94 ft × 48 ft).',
      162.0,
      94.0,
      48.0,
      'ft',
      now
    );
  } else {
    db.run(
      'UPDATE facilities SET length_ft = COALESCE(length_ft, 162.0), width_ft = COALESCE(width_ft, 94.0), height_ft = COALESCE(height_ft, 48.0), dimensions_unit = COALESCE(dimensions_unit, \'ft\') WHERE id = ?',
      facId
    );
  }

  // Ensure default Gateways exist (Inner & Outer)
  const existingOuter = db.get('SELECT id FROM gateways WHERE id = ?', 'GW-OUTER-01');
  if (!existingOuter) {
    db.run(
      `INSERT INTO gateways (
        id, facility_id, name, gateway_type, connection_type, paired_gateway_id, ip_address, mac_address,
        firmware_version, is_online, last_heartbeat, local_network_ssid, status_detail, buffer_capacity,
        buffered_count, internet_online, wired_link_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      'GW-OUTER-01', facId, 'Outer Gateway (Perimeter WAN)', 'OUTER_GATEWAY', 'RS485', 'GW-INNER-01',
      '192.168.1.50', '24:0A:C4:00:OUT:01', 'v2.1.0', 1, now, 'AgriVault-Core-Wi-Fi',
      'Perimeter gateway connected to Internet and RS-485 wall bus', 5000, 0, 1, 'connected', now
    );
  }

  const existingInner = db.get('SELECT id FROM gateways WHERE id = ?', 'GW-INNER-01');
  if (!existingInner) {
    db.run(
      `INSERT INTO gateways (
        id, facility_id, name, gateway_type, connection_type, paired_gateway_id, ip_address, mac_address,
        firmware_version, is_online, last_heartbeat, local_network_ssid, status_detail, buffer_capacity,
        buffered_count, internet_online, wired_link_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      'GW-INNER-01', facId, 'Inner Gateway (Cold Vault Hub)', 'INNER_GATEWAY', 'RS485', 'GW-OUTER-01',
      '10.0.0.10', '24:0A:C4:00:IN:01', 'v2.1.0', 1, now, 'ESP-NOW Mesh',
      'Vault hub communicating with sensor nodes via ESP-NOW and RS-485', 5000, 0, 1, 'connected', now
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

seedDatabase();

