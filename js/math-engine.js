/**
 * RectifierLab - Core Mathematical & Physics Simulation Engine
 * Piecewise analytical waveform solvers for all 8 converter topologies + semi-converter.
 */

(function(root) {
  'use strict';

  const MathEngine = {};

  // Utility conversions
  const rad = deg => (deg * Math.PI) / 180;
  const deg = rad => (rad * 180) / Math.PI;

  /**
   * Main calculation function
   * @param {Object} params - circuit parameters
   * @returns {Object} calculated waveform arrays, telemetry metrics, and conduction states
   */
  MathEngine.simulate = function(params) {
    const {
      topology = '1p_full',    // '1p_half', '1p_full', '3p_half', '3p_full'
      deviceType = 'thyristor', // 'diode', 'thyristor', 'semi'
      alphaDeg = 45,           // Firing angle in degrees (0..180)
      hasFWD = false,          // Freewheeling diode present
      loadType = 'RL',         // 'R', 'RL', 'RLE'
      R = 20,                  // Resistance in Ohms
      L_mH = 45,               // Inductance in mH
      E_emf = 24,              // Back EMF in Volts
      Vs_rms = 230,            // Source RMS phase voltage
      freq = 50,               // Frequency in Hz
      wtDeg = 0                // Current instantaneous phase angle (0..360)
    } = params;

    const omega = 2 * Math.PI * freq;
    const L = L_mH / 1000;     // Henries
    const Z = Math.sqrt(R * R + (omega * L) * (omega * L));
    const phi = Math.atan2(omega * L, R); // Load impedance angle
    const Vm = Vs_rms * Math.sqrt(2);     // Peak phase voltage
    const alpha = deviceType === 'diode' ? 0 : rad(alphaDeg);

    // Number of points for 2 full AC cycles (720 degrees)
    const NUM_POINTS = 720;
    const pointsPerCycle = 360;
    const wtArray = new Float64Array(NUM_POINTS);
    const vsArray = new Float64Array(NUM_POINTS);
    const vsBArray = new Float64Array(NUM_POINTS);
    const vsCArray = new Float64Array(NUM_POINTS);
    const voArray = new Float64Array(NUM_POINTS);
    const ioArray = new Float64Array(NUM_POINTS);
    const isArray = new Float64Array(NUM_POINTS);
    const vt1Array = new Float64Array(NUM_POINTS);
    const gatePulses = new Uint8Array(NUM_POINTS);

    // Conduction extinction angle beta calculation for RL load
    const beta = computeExtinctionAngle(alpha, phi, topology, hasFWD, deviceType);

    // Build cycle points
    for (let i = 0; i < NUM_POINTS; i++) {
      const theta = (i * 2 * Math.PI) / pointsPerCycle; // wt in radians
      const thetaMod = theta % (2 * Math.PI);
      wtArray[i] = theta;

      // 3-Phase source voltages (Star-connected)
      const va = Vm * Math.sin(theta);
      const vb = Vm * Math.sin(theta - (2 * Math.PI) / 3);
      const vc = Vm * Math.sin(theta + (2 * Math.PI) / 3);
      vsArray[i] = va;
      vsBArray[i] = vb;
      vsCArray[i] = vc;

      // Compute instantaneous values based on topology
      const state = solveInstantaneous({
        topology,
        deviceType,
        alpha,
        beta,
        hasFWD,
        loadType,
        R,
        L,
        Z,
        phi,
        E_emf,
        Vm,
        theta: thetaMod,
        va, vb, vc
      });

      voArray[i] = state.vo;
      ioArray[i] = state.io;
      isArray[i] = state.is;
      vt1Array[i] = state.vt1;
      gatePulses[i] = state.gatePulse ? 1 : 0;
    }

    // Instantaneous evaluation at active wtDeg slider value
    const curTheta = rad(wtDeg % 360);
    const curVa = Vm * Math.sin(curTheta);
    const curVb = Vm * Math.sin(curTheta - (2 * Math.PI) / 3);
    const curVc = Vm * Math.sin(curTheta + (2 * Math.PI) / 3);

    const instState = solveInstantaneous({
      topology,
      deviceType,
      alpha,
      beta,
      hasFWD,
      loadType,
      R,
      L,
      Z,
      phi,
      E_emf,
      Vm,
      theta: curTheta,
      va: curVa,
      vb: curVb,
      vc: curVc
    });

    // Compute Metrics over 1 complete cycle (indices 0 to 359)
    const metrics = computeMetrics({
      voArray,
      ioArray,
      isArray,
      vsArray,
      pointsPerCycle,
      topology,
      deviceType,
      alpha,
      Vm,
      Vs_rms,
      R,
      hasFWD
    });

    return {
      waveforms: {
        wt: wtArray,
        vs: vsArray,
        vsB: vsBArray,
        vsC: vsCArray,
        vo: voArray,
        io: ioArray,
        is: isArray,
        vt1: vt1Array,
        gatePulses
      },
      instantaneous: {
        wtDeg: wtDeg % 360,
        vo: instState.vo,
        io: instState.io,
        is: instState.is,
        vs: curVa,
        devices: instState.deviceStates,
        loopName: instState.loopName,
        isFWDConducting: instState.isFWDConducting
      },
      metrics,
      theory: getTheoreticalModel(topology, deviceType, alpha, Vm, hasFWD, loadType, E_emf)
    };
  };

  /**
   * Approximate extinction angle beta for RL load
   */
  function computeExtinctionAngle(alpha, phi, topology, hasFWD, deviceType) {
    if (topology === '1p_half') {
      if (hasFWD) return Math.PI; // Freewheeling clamps at pi
      // Approximate beta for 1-phase half wave: beta > pi, depends on phi
      let b = Math.PI + phi * 0.75;
      if (b < alpha) b = alpha + 0.1;
      return Math.min(b, 2 * Math.PI - 0.05);
    }
    // For full converters and bridges
    if (deviceType === 'semi' || hasFWD) {
      return Math.PI;
    }
    return Math.PI + alpha;
  }

  /**
   * Solves instantaneous voltages and currents for a given theta (0..2pi)
   */
  function solveInstantaneous(args) {
    const {
      topology, deviceType, alpha, beta, hasFWD, loadType,
      R, L, Z, phi, E_emf, Vm, theta, va, vb, vc
    } = args;

    let vo = 0;
    let io = 0;
    let is = 0;
    let vt1 = 0;
    let gatePulse = false;
    let isFWDConducting = false;
    let loopName = 'No Conduction (Off)';
    const deviceStates = {
      T1: false, T2: false, T3: false, T4: false, T5: false, T6: false,
      D1: false, D2: false, D3: false, D4: false, D5: false, D6: false,
      DFW: false
    };

    const isThyristor = (deviceType === 'thyristor');
    const isSemi = (deviceType === 'semi');

    // -------------------------------------------------------------
    // TOPOLOGY 1: SINGLE-PHASE HALF-WAVE
    // -------------------------------------------------------------
    if (topology === '1p_half') {
      const onStart = alpha;
      const onEnd = (hasFWD && isThyristor) ? Math.PI : (loadType === 'R' ? Math.PI : beta);
      const isRLE = (loadType === 'RLE');

      if (theta >= onStart && theta < onEnd && (!isRLE || va > E_emf)) {
        vo = va;
        deviceStates.T1 = isThyristor;
        deviceStates.D1 = !isThyristor;
        is = Math.max(0, (vo - (isRLE ? E_emf : 0)) / (loadType === 'R' ? R : (L > 0 ? Z * 0.85 : R)));
        io = is;
        vt1 = 0;
        loopName = isThyristor ? 'Thyristor T1 Conduction' : 'Diode D1 Conduction';
      } else if (hasFWD && theta >= Math.PI && theta < beta && !isRLE) {
        // Freewheeling interval
        vo = 0;
        is = 0;
        io = Math.max(0, (Vm / (Z * 1.2)) * Math.exp(-(theta - Math.PI) / (Math.tan(phi) || 1)));
        isFWDConducting = true;
        deviceStates.DFW = true;
        vt1 = va;
        loopName = 'Freewheeling via D_FW';
      } else {
        vo = isRLE ? E_emf : 0;
        io = 0;
        is = 0;
        vt1 = va - (isRLE ? E_emf : 0);
        loopName = isRLE ? 'Off / Clamped to EMF (E)' : 'Off / Blocking';
      }

      gatePulse = isThyristor && Math.abs(theta - alpha) < 0.08;
    }

    // -------------------------------------------------------------
    // TOPOLOGY 2: SINGLE-PHASE FULL-WAVE BRIDGE
    // -------------------------------------------------------------
    else if (topology === '1p_full') {
      const pi = Math.PI;
      const isRLE = (loadType === 'RLE');
      const zEff = (loadType === 'R') ? R : (L > 0 ? Z * 0.9 : R);

      if (isSemi) {
        // Semi-converter (T1, T2 thyristors; D3, D4 or FWD diodes)
        if (theta >= alpha && theta < pi && (!isRLE || va > E_emf)) {
          vo = va;
          is = Math.max(0, (vo - (isRLE ? E_emf : 0)) / zEff);
          io = is;
          deviceStates.T1 = true;
          deviceStates.D2 = true;
          vt1 = 0;
          loopName = 'Bridge Pair T1 + D2 (Positive Half)';
        } else if (theta >= pi && theta < pi + alpha && !isRLE) {
          // Freewheeling action via bridge diodes or FWD
          vo = 0;
          is = 0;
          io = Math.max(0.5, (Vm * 0.6) / zEff);
          deviceStates.D2 = true;
          deviceStates.D4 = true;
          if (hasFWD) {
            isFWDConducting = true;
            deviceStates.DFW = true;
          }
          vt1 = va;
          loopName = hasFWD ? 'Freewheeling via D_FW' : 'Freewheeling via Bridge Diodes';
        } else if (theta >= pi + alpha && theta < 2 * pi && (!isRLE || -va > E_emf)) {
          vo = -va;
          is = -Math.max(0, (vo - (isRLE ? E_emf : 0)) / zEff);
          io = Math.abs(is);
          deviceStates.T3 = true;
          deviceStates.D4 = true;
          vt1 = 2 * va;
          loopName = 'Bridge Pair T3 + D4 (Negative Half)';
        } else {
          // Freewheeling or non-conduction gap
          if (!isRLE) {
            vo = 0;
            is = 0;
            io = Math.max(0.5, (Vm * 0.6) / zEff);
            deviceStates.D2 = true;
            deviceStates.D4 = true;
            if (hasFWD) {
              isFWDConducting = true;
              deviceStates.DFW = true;
            }
            vt1 = va;
            loopName = hasFWD ? 'Freewheeling via D_FW' : 'Freewheeling via Bridge Diodes';
          } else {
            vo = E_emf;
            io = 0;
            is = 0;
            vt1 = va - E_emf;
            loopName = 'Off / Clamped to EMF (E)';
          }
        }
        gatePulse = Math.abs(theta - alpha) < 0.08 || Math.abs(theta - (pi + alpha)) < 0.08;
      }

      else if (!isThyristor) {
        // Pure Diode Bridge (D1, D2, D3, D4)
        if (theta >= 0 && theta < pi) {
          if (!isRLE || va > E_emf) {
            vo = va;
            is = Math.max(0, (vo - (isRLE ? E_emf : 0)) / zEff);
            io = is;
            deviceStates.D1 = true;
            deviceStates.D2 = true;
            vt1 = 0;
            loopName = 'Diode Pair D1 + D2 (Positive Half)';
          } else {
            vo = E_emf;
            io = 0;
            is = 0;
            vt1 = va - E_emf;
            loopName = 'Off / Clamped to EMF (E)';
          }
        } else {
          if (!isRLE || -va > E_emf) {
            vo = -va;
            is = -Math.max(0, (vo - (isRLE ? E_emf : 0)) / zEff);
            io = Math.abs(is);
            deviceStates.D3 = true;
            deviceStates.D4 = true;
            vt1 = 2 * va;
            loopName = 'Diode Pair D3 + D4 (Negative Half)';
          } else {
            vo = E_emf;
            io = 0;
            is = 0;
            vt1 = va - E_emf;
            loopName = 'Off / Clamped to EMF (E)';
          }
        }
      }

      else {
        // Full Controlled Thyristor Bridge (T1, T2, T3, T4)
        if (theta >= alpha && theta < pi + alpha) {
          const rawVo = va;
          if (isRLE && rawVo <= E_emf && L === 0) {
            vo = E_emf;
            io = 0;
            is = 0;
            vt1 = va - E_emf;
            loopName = 'Off / Clamped to EMF (E)';
          } else {
            vo = rawVo;
            if (loadType === 'R' && vo < 0) {
              vo = 0;
              is = 0;
            } else if (hasFWD && vo < 0) {
              vo = 0;
              is = 0;
              isFWDConducting = true;
              deviceStates.DFW = true;
            } else {
              is = Math.max(0, (vo - (isRLE ? E_emf : 0)) / zEff);
              deviceStates.T1 = true;
              deviceStates.T2 = true;
            }
            io = Math.abs(is);
            vt1 = 0;
            loopName = isFWDConducting ? 'Freewheeling via D_FW' : 'Bridge Pair T1 + T2 (Positive Half)';
          }
        } else {
          const rawVo = -va;
          if (isRLE && rawVo <= E_emf && L === 0) {
            vo = E_emf;
            io = 0;
            is = 0;
            vt1 = va - E_emf;
            loopName = 'Off / Clamped to EMF (E)';
          } else {
            vo = rawVo;
            if (loadType === 'R' && vo < 0) {
              vo = 0;
              is = 0;
            } else if (hasFWD && vo < 0) {
              vo = 0;
              is = 0;
              isFWDConducting = true;
              deviceStates.DFW = true;
            } else {
              is = -Math.max(0, (vo - (isRLE ? E_emf : 0)) / zEff);
              deviceStates.T3 = true;
              deviceStates.T4 = true;
            }
            io = Math.abs(is);
            vt1 = 2 * va;
            loopName = isFWDConducting ? 'Freewheeling via D_FW' : 'Bridge Pair T3 + T4 (Negative Half)';
          }
        }
        gatePulse = Math.abs(theta - alpha) < 0.08 || Math.abs(theta - (pi + alpha)) < 0.08;
      }
    }

    // -------------------------------------------------------------
    // TOPOLOGY 3: THREE-PHASE HALF-WAVE (3-PULSE STAR)
    // -------------------------------------------------------------
    else if (topology === '3p_half') {
      const isRLE = (loadType === 'RLE');
      const zEff = (loadType === 'R') ? R : (L > 0 ? Z * 0.95 : R);

      // Natural crossover points occur at pi/6 (30 deg), 5pi/6 (150 deg), 9pi/6 (270 deg)
      const t1Start = (Math.PI / 6) + alpha;
      const t2Start = (5 * Math.PI / 6) + alpha;
      const t3Start = (9 * Math.PI / 6) + alpha;

      let activePhase = 1;
      let rawVo = va;
      if (theta >= t1Start && theta < t2Start) {
        activePhase = 1;
        rawVo = va;
      } else if (theta >= t2Start && theta < t3Start) {
        activePhase = 2;
        rawVo = vb;
      } else {
        activePhase = 3;
        rawVo = vc;
      }

      if (isRLE && rawVo <= E_emf) {
        vo = E_emf;
        io = 0;
        is = 0;
        vt1 = va - E_emf;
        loopName = 'Off / Clamped to EMF (E)';
      } else {
        vo = rawVo;
        if (loadType === 'R' && vo < 0) vo = 0;
        if (hasFWD && vo < 0) {
          vo = 0;
          isFWDConducting = true;
          deviceStates.DFW = true;
          loopName = 'Freewheeling via D_FW';
        } else {
          if (activePhase === 1) {
            deviceStates.T1 = isThyristor;
            deviceStates.D1 = !isThyristor;
            loopName = isThyristor ? 'Thyristor T1 (Phase A)' : 'Diode D1 (Phase A)';
            vt1 = 0;
          } else if (activePhase === 2) {
            deviceStates.T2 = isThyristor;
            deviceStates.D2 = !isThyristor;
            loopName = isThyristor ? 'Thyristor T2 (Phase B)' : 'Diode D2 (Phase B)';
            vt1 = va - vb;
          } else {
            deviceStates.T3 = isThyristor;
            deviceStates.D3 = !isThyristor;
            loopName = isThyristor ? 'Thyristor T3 (Phase C)' : 'Diode D3 (Phase C)';
            vt1 = va - vc;
          }
        }
        io = Math.max(0, (vo - (isRLE ? E_emf : 0)) / zEff);
        is = (activePhase === 1) ? io : 0;
      }

      gatePulse = isThyristor && (
        Math.abs(theta - t1Start) < 0.08 ||
        Math.abs(theta - t2Start) < 0.08 ||
        Math.abs(theta - t3Start) < 0.08
      );
    }

    // -------------------------------------------------------------
    // TOPOLOGY 4: THREE-PHASE FULL-WAVE BRIDGE (6-PULSE GRAETZ)
    // -------------------------------------------------------------
    else if (topology === '3p_full') {
      const isRLE = (loadType === 'RLE');
      const zEff = (loadType === 'R') ? R : (L > 0 ? Z * 0.98 : R);

      const base = (theta - alpha + 2 * Math.PI) % (2 * Math.PI);
      const interval = Math.floor(base / (Math.PI / 3));

      let rawVo = 0;
      let activeUpper = 1; // 1, 3, 5
      let activeLower = 6; // 4, 6, 2
      let activeName = '';

      switch (interval) {
        case 0:
          rawVo = va - vb; activeUpper = 1; activeLower = 6;
          activeName = isThyristor ? 'Pair T1 (Ph A) + T6 (Ph B)' : 'Pair D1 + D6 (Ph A & B)';
          break;
        case 1:
          rawVo = va - vc; activeUpper = 1; activeLower = 2;
          activeName = isThyristor ? 'Pair T1 (Ph A) + T2 (Ph C)' : 'Pair D1 + D2 (Ph A & C)';
          break;
        case 2:
          rawVo = vb - vc; activeUpper = 3; activeLower = 2;
          activeName = isThyristor ? 'Pair T3 (Ph B) + T2 (Ph C)' : 'Pair D3 + D2 (Ph B & C)';
          break;
        case 3:
          rawVo = vb - va; activeUpper = 3; activeLower = 4;
          activeName = isThyristor ? 'Pair T3 (Ph B) + T4 (Ph A)' : 'Pair D3 + D4 (Ph B & A)';
          break;
        case 4:
          rawVo = vc - va; activeUpper = 5; activeLower = 4;
          activeName = isThyristor ? 'Pair T5 (Ph C) + T4 (Ph A)' : 'Pair D5 + D4 (Ph C & A)';
          break;
        case 5:
        default:
          rawVo = vc - vb; activeUpper = 5; activeLower = 6;
          activeName = isThyristor ? 'Pair T5 (Ph C) + T6 (Ph B)' : 'Pair D5 + D6 (Ph C & B)';
          break;
      }

      if (isRLE && rawVo <= E_emf) {
        vo = E_emf;
        io = 0;
        is = 0;
        vt1 = va - vb - E_emf;
        loopName = 'Off / Clamped to EMF (E)';
      } else {
        vo = rawVo;
        if (loadType === 'R' && vo < 0) vo = 0;
        if (hasFWD && vo < 0) {
          vo = 0;
          isFWDConducting = true;
          deviceStates.DFW = true;
          loopName = 'Freewheeling via D_FW';
        } else {
          // Set switches
          deviceStates['T' + activeUpper] = isThyristor;
          deviceStates['D' + activeUpper] = !isThyristor;
          deviceStates['T' + activeLower] = isThyristor;
          deviceStates['D' + activeLower] = !isThyristor;
          loopName = activeName;
          vt1 = (activeUpper === 1) ? 0 : (va - vb);
        }
        io = Math.max(0, (vo - (isRLE ? E_emf : 0)) / zEff);
        is = (activeUpper === 1) ? io : (activeLower === 4 ? -io : 0);
      }
    }

    return {
      vo,
      io,
      is,
      vt1,
      gatePulse,
      isFWDConducting,
      loopName,
      deviceStates
    };
  }

  /**
   * Computes average, RMS, and performance metrics via numerical integration
   */
  function computeMetrics(data) {
    const {
      voArray, ioArray, isArray, vsArray, pointsPerCycle,
      topology, deviceType, alpha, Vm, Vs_rms, R, hasFWD
    } = data;

    let sumVo = 0;
    let sumVoSq = 0;
    let sumIo = 0;
    let sumIoSq = 0;
    let sumIsSq = 0;
    let sumP = 0;

    for (let i = 0; i < pointsPerCycle; i++) {
      const vo = voArray[i];
      const io = ioArray[i];
      const is = isArray[i];

      sumVo += vo;
      sumVoSq += vo * vo;
      sumIo += io;
      sumIoSq += io * io;
      sumIsSq += is * is;
      sumP += vo * io;
    }

    const Vdc = sumVo / pointsPerCycle;
    const Vrms = Math.sqrt(sumVoSq / pointsPerCycle);
    const Idc = sumIo / pointsPerCycle;
    const Irms = Math.sqrt(sumIoSq / pointsPerCycle);
    const Is_rms = Math.sqrt(sumIsSq / pointsPerCycle);
    const Pload = sumP / pointsPerCycle;

    // Line voltage multiplier for 3-phase systems
    const is3P = topology.startsWith('3p');
    const Sin = (is3P ? Math.sqrt(3) * (Vs_rms * Math.sqrt(3)) : Vs_rms) * Is_rms;

    const PF = Sin > 0 ? Math.min(1.0, Math.max(0, Pload / Sin)) : 0;
    const FF = Vdc > 0 ? (Vrms / Vdc) : 0;
    const RF = Vdc > 0 && Vrms >= Vdc ? Math.sqrt(Math.max(0, (Vrms / Vdc) * (Vrms / Vdc) - 1)) : 0;

    // Check conduction continuity
    let isDiscontinuous = false;
    let zeroCount = 0;
    for (let i = 0; i < pointsPerCycle; i++) {
      if (ioArray[i] <= 0.01) zeroCount++;
    }
    isDiscontinuous = zeroCount > 15;

    return {
      Vdc: Math.max(0, Vdc),
      Vrms: Math.max(0, Vrms),
      Idc: Math.max(0, Idc),
      Irms: Math.max(0, Irms),
      Is_rms: Math.max(0, Is_rms),
      Pload: Math.max(0, Pload),
      Sin: Math.max(0, Sin),
      PF: parseFloat(PF.toFixed(3)),
      FF: parseFloat(FF.toFixed(2)),
      RF: parseFloat(RF.toFixed(3)),
      conductionMode: isDiscontinuous ? 'DCM' : 'CCM'
    };
  }

  /**
   * Generates theoretical analytical equations & values
   */
  function getTheoreticalModel(topology, deviceType, alpha, Vm, hasFWD, loadType, E_emf) {
    let formula = '';
    let description = '';
    let idealVdc = 0;

    if (topology === '1p_half') {
      if (deviceType === 'diode') {
        formula = 'V_dc = V_m / π ≈ 0.318 · V_m';
        description = 'Single-Phase Half-Wave Uncontrolled Diode Rectifier';
        idealVdc = Vm / Math.PI;
      } else {
        formula = 'V_dc = (V_m / 2π) · (1 + cos α)';
        description = 'Single-Phase Half-Wave Controlled Converter (with FWD / R Load)';
        idealVdc = (Vm / (2 * Math.PI)) * (1 + Math.cos(alpha));
      }
    } else if (topology === '1p_full') {
      if (deviceType === 'semi' || hasFWD) {
        formula = 'V_dc = (V_m / π) · (1 + cos α)';
        description = '1-Phase Semi-Converter (Half-Controlled Bridge / with FWD)';
        idealVdc = (Vm / Math.PI) * (1 + Math.cos(alpha));
      } else if (deviceType === 'diode') {
        formula = 'V_dc = (2·V_m / π) ≈ 0.636 · V_m';
        description = '1-Phase Full-Wave Uncontrolled Diode Bridge';
        idealVdc = (2 * Vm) / Math.PI;
      } else {
        formula = 'V_dc = (2·V_m / π) · cos α';
        description = '1-Phase Full-Wave Controlled Converter (Continuous Conduction)';
        idealVdc = ((2 * Vm) / Math.PI) * Math.cos(alpha);
      }
    } else if (topology === '3p_half') {
      if (deviceType === 'diode') {
        formula = 'V_dc = (3√3·V_m / 2π) ≈ 0.827 · V_m';
        description = 'Three-Phase Half-Wave 3-Pulse Diode Rectifier';
        idealVdc = (3 * Math.sqrt(3) * Vm) / (2 * Math.PI);
      } else {
        formula = 'V_dc = (3√3·V_m / 2π) · cos α';
        description = 'Three-Phase Half-Wave 3-Pulse Controlled Converter';
        idealVdc = ((3 * Math.sqrt(3) * Vm) / (2 * Math.PI)) * Math.cos(alpha);
      }
    } else if (topology === '3p_full') {
      if (deviceType === 'diode') {
        formula = 'V_dc = (3√3·V_m / π) ≈ 1.654 · V_m';
        description = 'Three-Phase Full-Wave 6-Pulse Diode Bridge (Graetz)';
        idealVdc = (3 * Math.sqrt(3) * Vm) / Math.PI;
      } else {
        formula = 'V_dc = (3√3·V_m / π) · cos α';
        description = 'Three-Phase Full-Wave 6-Pulse Fully Controlled Bridge';
        idealVdc = ((3 * Math.sqrt(3) * Vm) / Math.PI) * Math.cos(alpha);
      }
    }

    if (loadType === 'RLE') {
      description += ` with R-L-E Load (DC Back-EMF E = ${E_emf} V)`;
      formula += ' | I_dc = (V_dc - E) / R';
      if (idealVdc < E_emf) idealVdc = E_emf;
    }

    return {
      formula,
      description,
      idealVdc: Math.max(0, idealVdc)
    };
  }

  root.RectifierMathEngine = MathEngine;

})(typeof window !== 'undefined' ? window : this);
