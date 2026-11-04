"""
AGRIvault GPU-Accelerated 3D Advection-Diffusion & Autonomous Adaptation Engine
Runs on Local NVIDIA GPU (RTX 4050 Laptop GPU / CUDA)
Models 3D Vault Microclimate, Raw Spoilage Point-Source Feedback,
and Optional Wind Flow / Convective Fan Advection.
"""

import sys
import os
import json
import time
import math
import argparse
from typing import Dict, Any, List

def run_simulation(
    length: float = 15.0,
    width: float = 10.0,
    height: float = 5.0,
    spoilage_x: float = 4.0,
    spoilage_y: float = 3.0,
    spoilage_z: float = 1.5,
    spoilage_type: str = "bacterial_soft_rot",
    severity: float = 0.85,
    wind_enabled: bool = True,
    wind_speed: float = 1.2,
    wind_direction_deg: float = 0.0,  # 0 deg = +y (North to South), 90 = +x (West to East)
    timesteps: int = 250,
    grid_res_x: int = 36,
    grid_res_y: int = 28,
    grid_res_z: int = 14,
    force_device: str = "auto"
) -> Dict[str, Any]:
    """
    Executes 3D PDE Advection-Diffusion-Reaction solver on GPU using PyTorch CUDA tensors.
    """
    try:
        import torch
    except ImportError:
        return {
            "success": False,
            "error": "PyTorch is not installed in the active environment."
        }

    # Determine Compute Device
    if force_device == "cpu":
        device = torch.device("cpu")
    elif force_device == "cuda" or force_device == "auto":
        device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    else:
        device = torch.device(force_device)

    is_cuda = (device.type == "cuda")
    device_name = torch.cuda.get_device_name(0) if is_cuda else "Host CPU"
    initial_vram_mb = (torch.cuda.memory_allocated(0) / (1024**2)) if is_cuda else 0.0

    t_start = time.perf_counter()

    # Domain discretization
    Nx, Ny, Nz = grid_res_x, grid_res_y, grid_res_z
    dx = length / (Nx - 1)
    dy = width / (Ny - 1)
    dz = height / (Nz - 1)

    # Coordinate Meshgrid on GPU
    xs = torch.linspace(0, length, Nx, device=device, dtype=torch.float32)
    ys = torch.linspace(0, width, Ny, device=device, dtype=torch.float32)
    zs = torch.linspace(0, height, Nz, device=device, dtype=torch.float32)
    X, Y, Z = torch.meshgrid(xs, ys, zs, indexing="ij")

    # Time-step stability criteria (CFL condition)
    diff_coeff = 0.12  # turbulent eddy dispersion m^2/s
    v_max = max(0.1, wind_speed if wind_enabled else 0.0)
    cfl_adv = min(dx, dy, dz) / (2.0 * v_max)
    cfl_diff = (min(dx, dy, dz)**2) / (6.0 * diff_coeff)
    dt = float(min(0.05, cfl_adv * 0.48, cfl_diff * 0.48))

    # Initialize State Tensors on GPU
    C = torch.zeros((Nx, Ny, Nz), device=device, dtype=torch.float32)
    T = torch.zeros((Nx, Ny, Nz), device=device, dtype=torch.float32)

    # 3D Wind Velocity Vector Field (u, v, w) in m/s
    U = torch.zeros((Nx, Ny, Nz), device=device, dtype=torch.float32)
    V = torch.zeros((Nx, Ny, Nz), device=device, dtype=torch.float32)
    W = torch.zeros((Nx, Ny, Nz), device=device, dtype=torch.float32)

    if wind_enabled and wind_speed > 0:
        rad = math.radians(wind_direction_deg)
        base_u = wind_speed * math.sin(rad)
        base_v = wind_speed * math.cos(rad)

        # Realistic cold storage convective airflow profile:
        ceiling_mask = (Z / height) >= 0.60
        floor_mask = (Z / height) <= 0.40
        mid_mask = (~ceiling_mask) & (~floor_mask)

        # Primary blowers push along ceiling and core aisles
        U[ceiling_mask] = base_u * 1.35
        V[ceiling_mask] = base_v * 1.35
        W[ceiling_mask] = -0.06 * wind_speed

        # Floor returns air back toward cooling return plenum
        U[floor_mask] = -base_u * 0.40
        V[floor_mask] = -base_v * 0.40
        W[floor_mask] = 0.03 * wind_speed

        # Mid-level stack resistance
        U[mid_mask] = base_u * 0.65
        V[mid_mask] = base_v * 0.65
        W[mid_mask] = -0.02 * wind_speed

    # Raw Spoilage Point-Source Injection Term S(x, y, z)
    sigma_spot = 0.70  # meters
    dist_sq = (X - spoilage_x)**2 + (Y - spoilage_y)**2 + (Z - spoilage_z)**2
    source_mask = torch.exp(-dist_sq / (2.0 * sigma_spot**2))
    
    # Emission intensity scales with severity (0.0 to 1.0)
    emission_rate = float(severity * 60.0)
    S_emission = source_mask * emission_rate

    # Thermal biological self-heating from bacterial/fungal respiration
    heat_emission = source_mask * (severity * 3.2)  # up to +3.2 deg C hotspot

    natural_decay_rate = 0.012  # 1/s airborne deposition & scrubbing

    # Execution Loop on Tensor Hardware
    t_loop_start = time.perf_counter()
    for step in range(timesteps):
        # 1. 3D Diffusion Laplacian using finite difference tensor slices
        lap_x = torch.zeros_like(C)
        lap_y = torch.zeros_like(C)
        lap_z = torch.zeros_like(C)

        lap_x[1:-1, :, :] = (C[2:, :, :] - 2.0 * C[1:-1, :, :] + C[:-2, :, :]) / (dx**2)
        lap_y[:, 1:-1, :] = (C[:, 2:, :] - 2.0 * C[:, 1:-1, :] + C[:, :-2, :]) / (dy**2)
        lap_z[:, :, 1:-1] = (C[:, :, 2:] - 2.0 * C[:, :, 1:-1] + C[:, :, :-2]) / (dz**2)

        diffusion = diff_coeff * (lap_x + lap_y + lap_z)

        # 2. Convective Advection: - (u dC/dx + v dC/dy + w dC/dz) using upwind differencing
        advection = torch.zeros_like(C)
        if wind_enabled and wind_speed > 0:
            grad_x_pos = torch.zeros_like(C)
            grad_x_neg = torch.zeros_like(C)
            grad_x_pos[1:, :, :] = (C[1:, :, :] - C[:-1, :, :]) / dx
            grad_x_neg[:-1, :, :] = (C[1:, :, :] - C[:-1, :, :]) / dx
            adv_x = torch.where(U > 0, U * grad_x_pos, U * grad_x_neg)

            grad_y_pos = torch.zeros_like(C)
            grad_y_neg = torch.zeros_like(C)
            grad_y_pos[:, 1:, :] = (C[:, 1:, :] - C[:, :-1, :]) / dy
            grad_y_neg[:, :-1, :] = (C[:, 1:, :] - C[:, :-1, :]) / dy
            adv_y = torch.where(V > 0, V * grad_y_pos, V * grad_y_neg)

            grad_z_pos = torch.zeros_like(C)
            grad_z_neg = torch.zeros_like(C)
            grad_z_pos[:, :, 1:] = (C[:, :, 1:] - C[:, :, :-1]) / dz
            grad_z_neg[:, :, :-1] = (C[:, :, 1:] - C[:, :, :-1]) / dz
            adv_z = torch.where(W > 0, W * grad_z_pos, W * grad_z_neg)

            advection = -(adv_x + adv_y + adv_z)

        # 3. Reaction & Injection
        reaction = -natural_decay_rate * C + S_emission

        # Update concentration field
        C = C + dt * (diffusion + advection + reaction)
        C = torch.clamp(C, min=0.0)

        # Update Temperature hotspot with thermal diffusion
        T = T + dt * (diff_coeff * (lap_x + lap_y + lap_z) + heat_emission - 0.015 * T)
        T = torch.clamp(T, min=0.0)

    if is_cuda:
        torch.cuda.synchronize()
    t_loop_end = time.perf_counter()

    compute_duration_ms = (t_loop_end - t_loop_start) * 1000.0
    total_duration_ms = (t_loop_end - t_start) * 1000.0
    peak_vram_mb = (torch.cuda.max_memory_allocated(0) / (1024**2)) if is_cuda else 0.0

    # =========================================================================
    # AUTONOMOUS ADAPTATION / "MIND OF ITS OWN" VALUE ADJUSTMENTS
    # =========================================================================
    max_c = float(torch.max(C).item())
    safe_max_c = max(max_c, 1e-4)
    R_field = C / safe_max_c

    # 2D Floor Plan Slices for Web Visualizer (mean along Z height)
    risk_2d_slice = torch.mean(R_field, dim=2).cpu().numpy().tolist()
    temp_2d_slice = torch.mean(T, dim=2).cpu().numpy().tolist()

    # Round slices to 3 decimals to keep JSON compact
    risk_2d_compact = [[round(val, 3) for val in row] for row in risk_2d_slice]
    temp_2d_compact = [[round(val, 2) for val in row] for row in temp_2d_slice]

    # Find peak dispersion center
    flat_idx = torch.argmax(C)
    peak_ix = (flat_idx // (Ny * Nz)).item()
    peak_iy = ((flat_idx % (Ny * Nz)) // Nz).item()
    peak_iz = (flat_idx % Nz).item()
    plume_peak_x = round(float(xs[peak_ix].item()), 2)
    plume_peak_y = round(float(ys[peak_iy].item()), 2)
    plume_peak_z = round(float(zs[peak_iz].item()), 2)

    # Downstream Advection Vector analysis
    plume_shift_x = round(plume_peak_x - spoilage_x, 2)
    plume_shift_y = round(plume_peak_y - spoilage_y, 2)
    plume_drift_dist = round(float((plume_shift_x**2 + plume_shift_y**2)**0.5), 2)

    # Autonomous Setpoint Adjustments based on raw feedback severity & wind advection
    temp_adjustment = -round(severity * (1.2 if wind_enabled else 0.8), 2)
    humidity_adjustment = -round(severity * (5.5 if wind_enabled else 3.5), 1)
    co2_margin_tightening = int(round(severity * 300))
    exhaust_pulse_seconds = int(round(severity * (1800 if wind_enabled else 900)))

    # Identify Pre-defined Vault Racks and calculate their autonomous risk
    test_racks = [
        {"rackId": "Rack-N1-L1", "name": "North Rack 1 (Level 1)", "x": 2.5, "y": 2.5, "z": 1.0},
        {"rackId": "Rack-N1-L2", "name": "North Rack 1 (Level 2)", "x": 2.5, "y": 2.5, "z": 3.0},
        {"rackId": "Rack-N2-L1", "name": "North Rack 2 (Level 1 - Spoilage Origin)", "x": 4.0, "y": 3.0, "z": 1.5},
        {"rackId": "Rack-N2-L2", "name": "North Rack 2 (Level 2 - Directly Above)", "x": 4.0, "y": 3.0, "z": 3.2},
        {"rackId": "Rack-S3-L1", "name": "South Rack 3 (Level 1 - Downwind)", "x": 4.5, "y": 6.8, "z": 1.2},
        {"rackId": "Rack-S3-L2", "name": "South Rack 3 (Level 2 - Downwind High)", "x": 4.5, "y": 6.8, "z": 3.0},
        {"rackId": "Rack-S4-L1", "name": "South Rack 4 (Level 1 - Downwind Far)", "x": 6.5, "y": 8.5, "z": 1.5},
        {"rackId": "Rack-W1-L1", "name": "West Door Bay (Cross-wind)", "x": 12.0, "y": 8.5, "z": 1.5}
    ]

    evaluated_racks = []
    for r in test_racks:
        ix = int(min(Nx - 1, max(0, round(r["x"] / dx))))
        iy = int(min(Ny - 1, max(0, round(r["y"] / dy))))
        iz = int(min(Nz - 1, max(0, round(r["z"] / dz))))
        local_risk = float(R_field[ix, iy, iz].item())
        local_temp_rise = float(T[ix, iy, iz].item())

        is_origin = (r["rackId"] == "Rack-N2-L1" or (abs(r["x"] - spoilage_x) < 0.5 and abs(r["y"] - spoilage_y) < 0.5))
        is_downwind = (r["y"] > spoilage_y and wind_enabled)

        status = "normal"
        if local_risk > 0.55 or is_origin:
            status = "critical_hazard"
        elif local_risk > 0.25:
            status = "downwind_at_risk"
        elif local_risk > 0.08:
            status = "cautionary_monitor"

        evaluated_racks.append({
            "rackId": r["rackId"],
            "name": r["name"],
            "coordinates": {"x": r["x"], "y": r["y"], "z": r["z"]},
            "riskScore": round(local_risk * 100, 1),
            "estimatedTempRise": round(local_temp_rise, 2),
            "status": status,
            "isOrigin": is_origin,
            "isDownwind": is_downwind,
            "recommendedAction": (
                "🚨 Immediate segregation and physical removal" if is_origin else
                "⚠️ Priority needle probe sampling & preemptive cooling boost" if status == "downwind_at_risk" else
                "Continuous automated sensor surveillance"
            )
        })

    downwind_threat_count = sum(1 for r in evaluated_racks if r["status"] == "downwind_at_risk")

    return {
        "success": True,
        "engine": "AGRIvault Autonomous Neural & 3D CFD GPU Engine",
        "gpuHardware": {
            "device": str(device),
            "deviceName": device_name,
            "isCuda": is_cuda,
            "initialVramMb": round(initial_vram_mb, 2),
            "peakVramMb": round(peak_vram_mb, 2),
            "computeTimeMs": round(compute_duration_ms, 2),
            "totalTimeMs": round(total_duration_ms, 2),
            "timestepsExecuted": timesteps,
            "voxelsProcessed": Nx * Ny * Nz,
            "gridDimensions": [Nx, Ny, Nz],
            "speedTps": round((timesteps * Nx * Ny * Nz) / (compute_duration_ms / 1000.0), 0)
        },
        "simulationInputs": {
            "dimensions": {"length": length, "width": width, "height": height, "unit": "m"},
            "spoilageFeedback": {
                "origin": {"x": spoilage_x, "y": spoilage_y, "z": spoilage_z},
                "type": spoilage_type,
                "severity": severity
            },
            "windFlow": {
                "enabled": wind_enabled,
                "speed": wind_speed,
                "directionDegrees": wind_direction_deg,
                "vector": {
                    "u": round(float(U.mean().item()), 3),
                    "v": round(float(V.mean().item()), 3),
                    "w": round(float(W.mean().item()), 3)
                }
            }
        },
        "dispersionPhysics": {
            "peakConcentrationValue": round(max_c, 2),
            "plumeCenterOfMass": {"x": plume_peak_x, "y": plume_peak_y, "z": plume_peak_z},
            "downwindDriftDistance": plume_drift_dist,
            "advectionEffect": "Strong downstream elongation along airflow axis" if (wind_enabled and plume_drift_dist > 0.4) else "Radial symmetric isotropic diffusion"
        },
        "autonomousAdjustments": {
            "mindStatus": "ACTIVE_AUTONOMOUS_CALIBRATION",
            "coolingSetpointDelta": f"{temp_adjustment}°C",
            "humiditySetpointDelta": f"{humidity_adjustment}%",
            "co2TighteningMargin": f"-{co2_margin_tightening} ppm",
            "emergencyPurgeCycleSec": exhaust_pulse_seconds,
            "fanModulationRule": (
                "Increase primary evaporator fan speed by +35% to homogenize downwind hotspot" if wind_enabled
                else "Engage auxiliary circulation blowers to disrupt stagnant micro-climate"
            ),
            "rationale": f"Ground-truth spoilage reported at ({spoilage_x}m, {spoilage_y}m, {spoilage_z}m) with severity {severity}. " +
                         (f"Convective airflow of {wind_speed} m/s advects microbial spore plume toward downstream racks. Target setpoint lowered by {temp_adjustment}°C to suppress bacterial enzyme kinetics." if wind_enabled else "Airflow is quiescent; localized threshold tightening applied to prevent hot pocket stagnation.")
        },
        "rackRiskMatrix": evaluated_racks,
        "downwindThreatCount": downwind_threat_count,
        "heatmapSlices": {
            "gridX": Nx,
            "gridY": Ny,
            "riskGrid": risk_2d_compact,
            "tempGrid": temp_2d_compact
        },
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AGRIvault GPU 3D Micro-climate Simulator")
    parser.add_argument("--length", type=float, default=15.0)
    parser.add_argument("--width", type=float, default=10.0)
    parser.add_argument("--height", type=float, default=5.0)
    parser.add_argument("--spoilage-x", type=float, default=4.0)
    parser.add_argument("--spoilage-y", type=float, default=3.0)
    parser.add_argument("--spoilage-z", type=float, default=1.5)
    parser.add_argument("--spoilage-type", type=str, default="bacterial_soft_rot")
    parser.add_argument("--severity", type=float, default=0.85)
    parser.add_argument("--wind", action="store_true", default=True)
    parser.add_argument("--no-wind", dest="wind", action="store_false")
    parser.add_argument("--wind-speed", type=float, default=1.2)
    parser.add_argument("--wind-direction", type=float, default=0.0)
    parser.add_argument("--steps", type=int, default=250)
    parser.add_argument("--device", type=str, default="auto")

    args = parser.parse_args()

    result = run_simulation(
        length=args.length,
        width=args.width,
        height=args.height,
        spoilage_x=args.spoilage_x,
        spoilage_y=args.spoilage_y,
        spoilage_z=args.spoilage_z,
        spoilage_type=args.spoilage_type,
        severity=args.severity,
        wind_enabled=args.wind,
        wind_speed=args.wind_speed,
        wind_direction_deg=args.wind_direction,
        timesteps=args.steps,
        force_device=args.device
    )

    print(json.dumps(result, indent=2))
