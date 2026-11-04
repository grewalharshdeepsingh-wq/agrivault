import { Router, Request, Response } from 'express';
import {
  getAutonomousAdjustmentState,
  registerSpoilageFeedback,
  configureAutonomousMind,
  executeGpuSimulation
} from '../engine/autonomousAdaptationEngine.js';

const router = Router();

// GET /api/autonomous-brain/state
router.get(['/', '/state'], (req: Request, res: Response) => {
  try {
    const state = getAutonomousAdjustmentState();
    res.json({
      success: true,
      state
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve autonomous mind state', details: err?.message || String(err) });
  }
});

// POST /api/autonomous-brain/feedback
// Submit raw ground-truth spoilage location feedback
router.post('/feedback', async (req: Request, res: Response) => {
  try {
    const {
      x, y, z,
      spoilageType,
      severity,
      commodity,
      notes,
      reportedBy,
      facilityId,
      areaId
    } = req.body;

    if (x === undefined || y === undefined) {
      res.status(400).json({ error: 'Coordinates x and y are required for spoilage feedback.' });
      return;
    }

    const result = await registerSpoilageFeedback({
      facilityId,
      areaId,
      x: Number(x),
      y: Number(y),
      z: Number(z ?? 1.5),
      spoilageType: spoilageType || 'bacterial_soft_rot',
      severity: Number(severity ?? 0.8),
      commodity: commodity || 'Potato',
      notes,
      reportedBy
    });

    res.json({
      success: true,
      message: 'Raw spoilage feedback ingested. Autonomous Mind adjusted vault values accordingly.',
      ...result
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to ingest spoilage feedback', details: err?.message || String(err) });
  }
});

// POST /api/autonomous-brain/configure
// Toggle autonomous mind, wind flow, or wind velocity/direction
router.post('/configure', async (req: Request, res: Response) => {
  try {
    const { isAutonomousActive, windEnabled, windSpeed, windDirectionDegrees } = req.body;

    const updatedState = await configureAutonomousMind({
      isAutonomousActive,
      windEnabled,
      windSpeed,
      windDirectionDegrees
    });

    res.json({
      success: true,
      message: 'Autonomous Mind configuration updated.',
      state: updatedState
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to configure autonomous mind', details: err?.message || String(err) });
  }
});

// POST /api/autonomous-brain/simulate-gpu
// Directly run the 3D GPU simulation on the local device's GPU
router.post('/simulate-gpu', async (req: Request, res: Response) => {
  try {
    const {
      length,
      width,
      height,
      spoilageX,
      spoilageY,
      spoilageZ,
      spoilageType,
      severity,
      windEnabled,
      windSpeed,
      windDirectionDeg,
      steps
    } = req.body;

    const gpuResult = await executeGpuSimulation({
      length,
      width,
      height,
      spoilageX,
      spoilageY,
      spoilageZ,
      spoilageType,
      severity,
      windEnabled,
      windSpeed,
      windDirectionDeg,
      steps
    });

    res.json({
      success: true,
      simulation: gpuResult
    });
  } catch (err: any) {
    res.status(500).json({ error: 'GPU simulation execution failed', details: err?.message || String(err) });
  }
});

// GET /api/autonomous-brain/gpu-status
router.get('/gpu-status', (req: Request, res: Response) => {
  res.json({
    status: 'ONLINE',
    device: 'NVIDIA GeForce RTX 4050 Laptop GPU',
    vramMb: 6144,
    cudaAvailable: true,
    cudaVersion: '12.4 / 13.1',
    architecture: 'Ada Lovelace (Tensor Cores / FP32 CUDA Cores)',
    virtualEnvironment: 'agrivault/venv (Python 3.12 + PyTorch 2.6.0+cu124)'
  });
});

export default router;
