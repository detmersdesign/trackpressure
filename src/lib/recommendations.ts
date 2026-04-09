import { PressureEntry, TireTarget, Recommendation } from '../types';

// Shared constants for gas law prediction.
// All temperatures are in Celsius internally; Kelvin used for gas law math.
// Defaults are used as fallback when weather/context is unavailable.
const ATM_PSI             = 14.696;
const DEFAULT_AMBIENT_C   = 20;   // 20°C — conservative default
const DEFAULT_TYRE_TEMP_C = 60;   // ~140°F — typical HPDE operating target

function cToKelvin(c: number): number { return c + 273.15; }
function roundHalf(v: number): number  { return Math.round(v * 2) / 2; }

// Predict hot pressure from a cold set using the ideal gas law (Gay-Lussac).
// All temperatures must be in Celsius — converted to Kelvin internally.
// Rounded to the nearest 0.5 PSI so it seeds the stepper on a valid step.
export function predictHotRounded(
  coldPsi: number,
  ambientC: number = DEFAULT_AMBIENT_C,
  tyreTempC: number = DEFAULT_TYRE_TEMP_C
): number {
  const raw = (coldPsi + ATM_PSI) * (cToKelvin(tyreTempC) / cToKelvin(ambientC)) - ATM_PSI;
  return roundHalf(raw);
}

export function isHotInRange(hotPsi: number, target: TireTarget): boolean {
  return hotPsi >= target.target_hot_min_psi && hotPsi <= target.target_hot_max_psi;
}

export function hotDeltaFromRange(hotPsi: number, target: TireTarget): number {
  if (hotPsi < target.target_hot_min_psi) return hotPsi - target.target_hot_min_psi;
  if (hotPsi > target.target_hot_max_psi) return hotPsi - target.target_hot_max_psi;
  return 0;
}

export function computeSignalScore(entry: Partial<PressureEntry>, tireId: string, target?: TireTarget): number {
  let score = 0;

  // Completeness — four-corner data is highest signal, averaged is medium, cold-only is low
  const hasFourCorners = entry.hot_fl_psi !== undefined && entry.hot_fr_psi !== undefined
    && entry.hot_rl_psi !== undefined && entry.hot_rr_psi !== undefined;
  const hasAveragedHot = entry.hot_front_psi !== undefined || entry.hot_rear_psi !== undefined;

  if (entry.cold_front_psi && hasFourCorners) {
    score += 1.3; // Four corners: full picture plus spread diagnostic
  } else if (entry.cold_front_psi && hasAveragedHot) {
    score += 1.0; // Cold + averaged hot: standard complete entry
  } else if (entry.cold_front_psi) {
    score += 0.5; // Cold only
  } else {
    score += 0.3; // Hot only — outcome known but cold set unknown
  }

  // Outcome quality — use front average (or FL as proxy) for range check
  const hotRef = entry.hot_front_psi ?? entry.hot_fl_psi;
  if (target && hotRef !== null) {
    const delta = Math.abs(hotDeltaFromRange(hotRef as number, target));
    if (delta === 0) score *= 1.2;
    else if (delta <= 2) score *= 0.9;
    else score *= 0.6;
  }

  // Contextual richness
  if (entry.ambient_temp_c != null) score += 0.15;
  if (entry.ambient_source === 'auto') score += 0.10;

  return Math.round(score * 1000) / 1000;
}

interface SessionForRecommendation {
  cold_front_psi: number;
  cold_rear_psi:  number;
  ambient_temp_c?: number | null;
  signal_score?:  number | null;
}

export function computeRecommendation(
  personalSessions: SessionForRecommendation[],
  communitySessions: SessionForRecommendation[],
  ambientTempC: number
): Recommendation {
  const personalCount = personalSessions.length;

  // Blend weights based on personal history depth
  let personalWeight: number;
  if (personalCount === 0) personalWeight = 0;
  else if (personalCount < 5) personalWeight = 0.1 + personalCount * 0.04;
  else if (personalCount < 15) personalWeight = 0.3 + (personalCount - 5) * 0.03;
  else if (personalCount < 25) personalWeight = 0.6 + (personalCount - 15) * 0.025;
  else personalWeight = 0.85;

  const communityWeight = 1 - personalWeight;

  // Temperature-weighted interpolation for personal sessions
  function tempWeightedAvg(
    sessions: SessionForRecommendation[],
    key: 'cold_front_psi' | 'cold_rear_psi'
  ): number {
    if (sessions.length === 0) return 0;
    let weightedSum = 0;
    let weightSum = 0;
    for (const s of sessions) {
      const tempDelta = Math.abs((s.ambient_temp_c ?? 20) - ambientTempC);
      const w = (1 / (1 + tempDelta)) * (s.signal_score ?? 1);
      weightedSum += s[key] * w;
      weightSum += w;
    }
    return weightSum > 0 ? Math.round((weightedSum / weightSum) * 10) / 10 : 0;
  }

  const personalFront  = tempWeightedAvg(personalSessions,  'cold_front_psi');
  const personalRear   = tempWeightedAvg(personalSessions,  'cold_rear_psi');
  const communityFront = tempWeightedAvg(communitySessions, 'cold_front_psi');
  const communityRear  = tempWeightedAvg(communitySessions, 'cold_rear_psi');

  const hasCommunity = communitySessions.length > 0;

  const blendedFront =
    personalCount > 0 && hasCommunity
      ? Math.round((personalFront * personalWeight + communityFront * communityWeight) * 10) / 10
      : personalCount > 0
        ? personalFront
        : communityFront;
  const blendedRear =
    personalCount > 0 && hasCommunity
      ? Math.round((personalRear * personalWeight + communityRear * communityWeight) * 10) / 10
      : personalCount > 0
        ? personalRear
        : communityRear;

  return {
    cold_front_psi:   blendedFront,
    cold_rear_psi:    blendedRear,
    personal_weight:  Math.round(personalWeight * 100),
    community_weight: Math.round(communityWeight * 100),
    session_count:    personalCount,
    basis: personalCount === 0 ? 'community' : personalWeight > 0.6 ? 'personal' : 'blended',
  };
}