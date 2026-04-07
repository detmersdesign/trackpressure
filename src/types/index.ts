// ── Garage ────────────────────────────────────────────────────────────────────

export interface GarageVehicle {
  id: string;
  user_id: string;
  vehicle_id: string;
  nickname?: string;
  notes?: string;
  user_year?: number;
  display_order: number;
  created_at: string;
  vehicle?: Vehicle;
  tire_sets?: GarageTireSet[];
}

export interface GarageTireSet {
  id: string;
  garage_vehicle_id: string;
  name: string;
  tire_front_id: string;
  tire_rear_id: string;
  is_default: boolean;
  notes?: string;
  created_at: string;
  tire_front?: Tire;
  tire_rear?: Tire;
}

// ── User settings (stored in AsyncStorage) ───────────────────────────────────

export type PressureUnit    = 'psi' | 'bar' | 'kpa';
export type TemperatureUnit = 'f' | 'c';
export type DistanceUnit    = 'mi' | 'km';

export interface UserSettings {
  pressure_unit:           PressureUnit;
  temperature_unit:        TemperatureUnit;
  distance_unit:           DistanceUnit;
  hot_pressures_visible:   boolean;
  community_contributions: boolean;
  four_corner_cold:        boolean;
  pyrometer_enabled:       boolean;
  pyrometer_gradient:      boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  pressure_unit:           'psi',
  temperature_unit:        'f',
  distance_unit:           'mi',
  hot_pressures_visible:   true,
  community_contributions: true,
  four_corner_cold:        false,
  pyrometer_enabled:       false,
  pyrometer_gradient:      false,
};

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year_start: number;
  year_end?: number;
  chassis_code?: string;
  trim: string;
  oem_pressure_front: number;
  oem_pressure_rear: number;
  silhouette_category?: string;
}

export interface Tire {
  id: string;
  brand: string;
  model: string;
  compound: string;
  width: number;
  aspect_ratio: number;
  rim_diameter: number;
}

export interface TireTarget {
  tire_id: string;
  target_hot_min_psi: number;
  target_hot_max_psi: number;
  target_temp_min_c?: number;
  target_temp_max_c?: number;
  axle: 'front' | 'rear' | 'both';
  source: 'official' | 'community' | 'derived';
}

export interface Track {
  id: string;
  name: string;
  country: string;
  region?: string;
  state?: string;
  latitude: number;
  longitude: number;
  radius_meters?: number;
  configurations: TrackConfig[];
}

export interface TrackConfig {
  id: string;
  track_id: string;
  name: string;
}

// Four individual corner hot readings — all optional since
// drivers may only measure some corners or skip hot entirely.
export interface HotCornerValues {
  hot_fl_psi?: number; // front left
  hot_fr_psi?: number; // front right
  hot_rl_psi?: number; // rear left
  hot_rr_psi?: number; // rear right
}

// Derived axle diagnostics computed from corner values.
export interface AxleAverages {
  hot_front_avg?: number;
  hot_rear_avg?: number;
  front_spread?: number; // FL vs FR delta — camber/alignment signal
  rear_spread?: number;  // RL vs RR delta
  front_soak?: number;   // front avg hot minus cold_front_psi
  rear_soak?: number;    // rear avg hot minus cold_rear_psi
}

export interface PressureEntry {
  id: string;
  user_id: string;
  vehicle_id: string;
  tire_id: string;
  track_id: string;
  track_config_id?: string;
  cold_front_psi: number | null;
  cold_rear_psi: number | null;

  // Four-corner hot readings (preferred path)
  hot_fl_psi?: number | null;
  hot_fr_psi?: number | null;
  hot_rl_psi?: number | null;
  hot_rr_psi?: number | null;

  // Legacy averaged fields — auto-populated from corners before insert
  // so existing community queries continue to work unchanged.
  hot_front_psi?: number | null;
  hot_rear_psi?: number | null;

  cold_fl_psi?: number | null;
  cold_fr_psi?: number | null;
  cold_rl_psi?: number | null;
  cold_rr_psi?: number | null;

  // Tyre temperatures — Tier 1 (single mid temp per corner)
  tyre_temp_hot_fl_c?: number | null;
  tyre_temp_hot_fr_c?: number | null;
  tyre_temp_hot_rl_c?: number | null;
  tyre_temp_hot_rr_c?: number | null;
  tyre_temp_cold_fl_c?: number | null;
  tyre_temp_cold_fr_c?: number | null;
  tyre_temp_cold_rl_c?: number | null;
  tyre_temp_cold_rr_c?: number | null;

  // Tyre temperatures — Tier 2 (inner/mid/outer per corner)
  tyre_temp_hot_fl_inner_c?: number | null;
  tyre_temp_hot_fl_mid_c?: number | null;
  tyre_temp_hot_fl_outer_c?: number | null;
  tyre_temp_hot_fr_inner_c?: number | null;
  tyre_temp_hot_fr_mid_c?: number | null;
  tyre_temp_hot_fr_outer_c?: number | null;
  tyre_temp_hot_rl_inner_c?: number | null;
  tyre_temp_hot_rl_mid_c?: number | null;
  tyre_temp_hot_rl_outer_c?: number | null;
  tyre_temp_hot_rr_inner_c?: number | null;
  tyre_temp_hot_rr_mid_c?: number | null;
  tyre_temp_hot_rr_outer_c?: number | null;

  ambient_temp_c?: number | null;
  ambient_temp_end_c?: number | null;
  ambient_session_start?: number | null;
  ambient_source?: 'auto' | 'manual';
  session_type: SessionType;
  notes?: string;
  signal_score?: number | null;
  in_target_range?: boolean;
  delta_consistent?: boolean;
  flag_count?: number | null;
  is_outlier?: boolean;
  is_hidden?: boolean;
  cold_entry_duration_seconds?: number | null;
  hot_entry_duration_seconds?: number | null;
  created_at: string;
}

export type SessionType =
  | 'hpde'
  | 'time_attack'
  | 'club_race'
  | 'practice'
  | 'qualifying'
  | 'race'
  | 'other';

export interface ActiveEvent {
  vehicle:        Vehicle;
  tire_front:     Tire;
  tire_rear:      Tire;
  track:          Track;
  track_config?:  TrackConfig;
  session_type:   SessionType;
  started_at:     string;
  tire_set_name?: string;
}

// Persisted to AsyncStorage when cold pressures are saved.
// Survives app backgrounding, screen lock, and other apps.
// Cleared on hot entry completion or explicit discard.
export interface OpenSession {
  id: string;                // uuid generated at cold save time
  event: ActiveEvent;
  cold_front_psi: number;   // already rounded to 0.5 PSI
  cold_rear_psi: number;
  cold_fl_psi?: number;
  cold_fr_psi?: number;
  cold_rl_psi?: number;
  cold_rr_psi?: number;
  cold_fl_temp_c?: number;
  cold_fr_temp_c?: number;
  cold_rl_temp_c?: number;
  cold_rr_temp_c?: number;
  predicted_hot_fl: number; // gas law prediction, rounded to 0.5
  predicted_hot_fr: number;
  predicted_hot_rl: number;
  predicted_hot_rr: number;
  saved_at: string;          // ISO timestamp shown as "X min ago" on banner
  ambient_temp_c?: number;
  ambient_session_start?: number;
  ambient_source?: 'auto' | 'manual';
  cold_started_at?: number;    // Date.now() timestamp, set when cold entry screen mounts
  cold_entry_duration_seconds?: number;  // calculated at cold submit, carried to hot submit
  is_hidden?: boolean;
  historic_date?: string;    // ISO string — if present, used as created_at on insert
}

export interface ConsensusPressure {
  avg_cold_front_psi: number;
  avg_cold_rear_psi: number;
  avg_hot_front_psi?: number;
  avg_hot_rear_psi?: number;
  min_cold_front_psi: number;
  max_cold_front_psi: number;
  min_cold_rear_psi: number;
  max_cold_rear_psi: number;
  sample_count: number;
}

export interface WeatherData {
  temp_c: number;
  description: string;
  source: 'noaa' | 'open-meteo' | 'manual';
}

export interface Recommendation {
  cold_front_psi: number;
  cold_rear_psi: number;
  personal_weight: number;
  community_weight: number;
  session_count: number;
  basis: 'personal' | 'community' | 'blended';
}