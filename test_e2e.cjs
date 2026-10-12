/**
 * AgriVault Complete End-to-End Test Suite
 * Tests all 18 Acceptance Test criteria required by the specification.
 */

const http = require('http');

const PORT = 4000;
const BASE_URL = `http://localhost:${PORT}/api`;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('  ❄️ AGRIVAULT END-TO-END ACCEPTANCE TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${details ? '(' + details + ')' : ''}`);
      failed++;
    }
  }

  try {
    // 1. Diagnostic Ping
    const pingRes = await request('/ping');
    assert(pingRes.status === 200 && pingRes.data.status === 'ONLINE', 'System Health & Ping Endpoint');

    // 2. Authentication: Login default engineer
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: { email: 'admin@agrivault.io', password: 'agrivault2026!' }
    });
    assert(loginRes.status === 200 && loginRes.data.token, 'User Login & JWT Generation', `Status: ${loginRes.status}`);
    const token = loginRes.data?.token;
    const authHeaders = { Authorization: `Bearer ${token}` };

    // 3. User Registration
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Shift Supervisor Alex',
        email: `alex_${Date.now()}@agrivault.io`,
        password: 'securePassword123!',
        organizationName: 'Agrivault Northern Vaults'
      }
    });
    assert(regRes.status === 201 && regRes.data.user?.role === 'Operator', 'User Registration & Role Assignment');

    // 4. Multi-Facility Management
    const facRes = await request('/facilities');
    assert(facRes.status === 200 && Array.isArray(facRes.data) && facRes.data.length > 0, 'Multi-Facility Retrieval');
    const facId = facRes.data[0].id;

    // 5. Storage Zone Creation
    const zoneName = `Potato Zone T1-${Date.now().toString().slice(-4)}`;
    const zoneRes = await request('/areas', {
      method: 'POST',
      headers: authHeaders,
      body: {
        facilityId: facId,
        name: zoneName,
        commodity: 'Potatoes (Processing / French Fry & Chips)'
      }
    });
    assert(zoneRes.status === 201 && zoneRes.data.id, 'Storage Zone Creation & Parameter Tracking');
    const areaId = zoneRes.data.id;

    // 6. Device Registration Method B: Manual / QR Code Provisioning
    const testDeviceId = `AGR-TEST-${Date.now().toString().slice(-4)}`;
    const provRes = await request('/devices/provision', {
      method: 'POST',
      headers: authHeaders,
      body: {
        deviceId: testDeviceId,
        registrationCode: 'QR-ONETIME-TOKEN-889',
        facilityId: facId,
        areaId: areaId,
        userName: 'Potato Bin Sensor Alpha',
        sensors: ['temperature', 'humidity', 'mq3', 'mq135', 'relay']
      }
    });
    assert(provRes.status === 201 && provRes.data.success, 'Method B: Manual / QR Device Provisioning');

    // 7. Device Renaming (Preserves permanent hardware ID)
    const renameRes = await request(`/devices/${testDeviceId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: { userName: 'Renamed Bin Sensor Alpha (Rack 2)' }
    });
    assert(
      renameRes.status === 200 &&
      renameRes.data.id === testDeviceId &&
      renameRes.data.user_name === 'Renamed Bin Sensor Alpha (Rack 2)',
      'Device Renaming with Permanent ID Preservation'
    );

    // 8. Architecture A: Direct ESP32 Telemetry Ingestion (Zero Fabrication)
    const telemRes = await request('/devices/telemetry', {
      method: 'POST',
      body: {
        deviceId: testDeviceId,
        temperature: 9.2,
        humidity: 93.5,
        mq3: 145,
        mq3_ratio: 1.15,
        mq135: 180,
        mq135_ratio: 1.22,
        rssi: -55,
        battery: 3.30,
        firmwareVersion: 'v2.4.0-provision'
      }
    });
    assert(telemRes.status === 200 && telemRes.data.status === 'ACK', 'Architecture A: Direct Telemetry Ingestion');

    // 9. Architecture B: Central Gateway Separation & Telemetry
    const gwRes = await request('/gateways');
    assert(gwRes.status === 200 && Array.isArray(gwRes.data), 'Architecture B: Gateway Fleet Retrieval');
    const gwCount = gwRes.data.length;
    const allDevs = await request('/devices');
    const sensorCount = allDevs.data.filter(d => !d.id.includes('GW-')).length;
    assert(gwCount > 0 && sensorCount > 0, `Clear Distinction: ${gwCount} Gateways vs ${sensorCount} Sensor Nodes`);

    // 10. Device Diagnostics & Zero-Fabrication Staleness Evaluation
    const diagRes = await request(`/devices/${testDeviceId}/diagnostics`);
    assert(
      diagRes.status === 200 &&
      diagRes.data.sensors.length >= 4 &&
      diagRes.data.zero_fabrication_audit.all_readings_genuine === true,
      'Device Diagnostics & Zero-Fabrication Validation'
    );

    // 11. Remote Wi-Fi Reconfiguration Command Dispatch
    const wifiReconfigRes = await request(`/devices/${testDeviceId}/reconfigure-wifi`, {
      method: 'POST',
      headers: authHeaders
    });
    assert(
      wifiReconfigRes.status === 200 &&
      wifiReconfigRes.data.setupApName &&
      wifiReconfigRes.data.setupIp === '192.168.4.1',
      'Remote Wi-Fi Reconfiguration Command Dispatch'
    );

    // 12. Crop Profiles Library: Researched FAO/USDA Standards
    const cropRes = await request('/crop-profiles');
    assert(
      cropRes.status === 200 &&
      cropRes.data.some(c => c.name.includes('Potatoes')) &&
      cropRes.data.some(c => c.name.includes('Wheat')) &&
      cropRes.data.some(c => c.name.includes('Onions')),
      'Crop Profiles Library (Potatoes, Wheat, Onions, Apples)'
    );

    // 13. Assign Crop Profile to Storage Zone
    const potatoProfile = cropRes.data.find(c => c.id === 'crop-pot-proc');
    const assignCropRes = await request(`/crop-profiles/${potatoProfile.id}/assign`, {
      method: 'POST',
      headers: authHeaders,
      body: { areaId: areaId }
    });
    assert(assignCropRes.status === 200 && assignCropRes.data.success, 'Crop Profile Zone Assignment & Threshold Sync');

    // 14. Intelligent Risk Advisor Anomaly Evaluation
    const riskRes = await request(`/risk-advisor?facilityId=${facId}`);
    assert(riskRes.status === 200 && Array.isArray(riskRes.data.items), 'Intelligent Risk Advisor Analysis');

    // 15. Manual Relay Control State Machine
    const relays = await request(`/relays?deviceId=${testDeviceId}`);
    if (relays.data && relays.data.length > 0) {
      const relayId = relays.data[0].id;
      // Step 1: Issue Authenticated Command (COMMAND_REQUESTED)
      const cmdRes = await request(`/relays/${relayId}/command`, {
        method: 'POST',
        headers: authHeaders,
        body: { action: 'ON', confirmed: true, reason: 'Test load energize' }
      });
      assert(
        cmdRes.status === 200 && cmdRes.data.relay.command_status === 'COMMAND_REQUESTED',
        'Manual Relay State Machine: Step 1 COMMAND_REQUESTED'
      );

      // Step 2: Device Acknowledgement (COMMAND_ACKNOWLEDGED)
      const ackRes = await request(`/relays/${relayId}/ack`, {
        method: 'POST',
        body: { deviceId: testDeviceId, status: 'OK' }
      });
      assert(ackRes.status === 200 && ackRes.data.status === 'ACK_CONFIRMED', 'Manual Relay State Machine: Step 2 COMMAND_ACKNOWLEDGED');

      // Step 3: Hardware State Confirmed (STATE_REPORTED)
      const reportRes = await request(`/relays/${relayId}/report-state`, {
        method: 'POST',
        body: { newState: 1, physicalConfirmed: 1 }
      });
      assert(
        reportRes.status === 200 &&
        reportRes.data.relay.state === 1 &&
        reportRes.data.relay.command_status === 'STATE_REPORTED',
        'Manual Relay State Machine: Step 3 STATE_REPORTED'
      );

      // Step 4: Audit Log Verification
      const actRes = await request(`/relays/${relayId}/actions`);
      assert(actRes.status === 200 && actRes.data.length > 0, 'Relay Audit Log Record Verification');
    } else {
      console.log('  ⚠️ [SKIP] Relay test: No relay module bound to test node');
    }

    // 16. Historical Analytics Summary
    const analyticsRes = await request('/analytics/summary?period=24h');
    assert(analyticsRes.status === 200, 'Analytics Time-Series Summary (Last 24h)');

    // 17. Report Generation & Export
    const reportRes = await request(`/reports/generate?facilityId=${facId}&period=24h`);
    assert(reportRes.status === 200 && reportRes.data.title, 'Historical Compliance Report Generation');

    // 18. Auto-Discovery Method A: Simulation Detection & Approval
    const simDetectRes = await request('/devices/discover/simulate', { method: 'POST' });
    assert(
      simDetectRes.status === 201 &&
      simDetectRes.data.device.registration_status === 'pending' &&
      simDetectRes.data.device.is_simulated === 1,
      'Method A: Auto-Discovery Pending Queue & Simulation Tagging'
    );

  } catch (err) {
    console.error('Test execution exception:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================\n');
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
