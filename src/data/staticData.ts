import { Vehicle, Tire, TireTarget, Track } from '../types';

export const VEHICLES: Vehicle[] = [
  {
    id: 'v1',
    make: 'Porsche',
    model: '911 GT3 RS',
    year: 2023,
    trim: 'GT3 RS',
    oem_pressure_front: 32.0,
    oem_pressure_rear: 29.0,
  },
  {
    id: 'v2',
    make: 'Porsche',
    model: '911 GT3',
    year: 2023,
    trim: 'GT3',
    oem_pressure_front: 33.0,
    oem_pressure_rear: 30.0,
  },
  {
    id: 'v3',
    make: 'BMW',
    model: 'M4 CS',
    year: 2024,
    trim: 'CS',
    oem_pressure_front: 34.0,
    oem_pressure_rear: 33.0,
  },
  {
    id: 'v4',
    make: 'BMW',
    model: 'M2',
    year: 2023,
    trim: 'Base',
    oem_pressure_front: 33.0,
    oem_pressure_rear: 32.0,
  },
  {
    id: 'v5',
    make: 'Chevrolet',
    model: 'Corvette Z06',
    year: 2023,
    trim: 'Z06',
    oem_pressure_front: 30.0,
    oem_pressure_rear: 27.0,
  },
  {
    id: 'v6',
    make: 'Toyota',
    model: 'GR86',
    year: 2023,
    trim: 'Base',
    oem_pressure_front: 33.0,
    oem_pressure_rear: 33.0,
  },
  {
    id: 'v7',
    make: 'Honda',
    model: 'Civic Type R',
    year: 2023,
    trim: 'Type R',
    oem_pressure_front: 34.0,
    oem_pressure_rear: 33.0,
  },
  {
    id: 'v8',
    make: 'Ford',
    model: 'Mustang GT350',
    year: 2020,
    trim: 'GT350',
    oem_pressure_front: 35.0,
    oem_pressure_rear: 35.0,
  },
];

export const TIRES: Tire[] = [
  { id: 't1', brand: 'Michelin', model: 'Pilot Sport Cup 2 R', compound: 'Cup 2 R', width: 265, aspect_ratio: 35, rim_diameter: 20 },
  { id: 't2', brand: 'Michelin', model: 'Pilot Sport 4S', compound: 'PS4S', width: 265, aspect_ratio: 35, rim_diameter: 20 },
  { id: 't3', brand: 'Bridgestone', model: 'Potenza RE71RS', compound: 'RE71RS', width: 255, aspect_ratio: 40, rim_diameter: 18 },
  { id: 't4', brand: 'Yokohama', model: 'ADVAN A052', compound: 'A052', width: 265, aspect_ratio: 35, rim_diameter: 19 },
  { id: 't5', brand: 'Hankook', model: 'Ventus TD RS4', compound: 'RS4', width: 265, aspect_ratio: 35, rim_diameter: 19 },
  { id: 't6', brand: 'Toyo', model: 'Proxes RR', compound: 'RR', width: 275, aspect_ratio: 35, rim_diameter: 19 },
  { id: 't7', brand: 'Hoosier', model: 'A7', compound: 'A7', width: 275, aspect_ratio: 35, rim_diameter: 18 },
  { id: 't8', brand: 'Continental', model: 'ExtremeContact Force', compound: 'ECF', width: 265, aspect_ratio: 35, rim_diameter: 19 },
];

export const TIRE_TARGETS: TireTarget[] = [
  { tire_id: 't1', target_hot_min_psi: 30.0, target_hot_max_psi: 33.0, target_temp_min_c: 85, target_temp_max_c: 105, axle: 'both', source: 'official' },
  { tire_id: 't2', target_hot_min_psi: 33.0, target_hot_max_psi: 36.0, target_temp_min_c: 80, target_temp_max_c: 100, axle: 'both', source: 'official' },
  { tire_id: 't3', target_hot_min_psi: 34.0, target_hot_max_psi: 38.0, target_temp_min_c: 75, target_temp_max_c: 95,  axle: 'both', source: 'official' },
  { tire_id: 't4', target_hot_min_psi: 32.0, target_hot_max_psi: 36.0, target_temp_min_c: 80, target_temp_max_c: 100, axle: 'both', source: 'official' },
  { tire_id: 't5', target_hot_min_psi: 33.0, target_hot_max_psi: 37.0, target_temp_min_c: 80, target_temp_max_c: 100, axle: 'both', source: 'community' },
  { tire_id: 't6', target_hot_min_psi: 28.0, target_hot_max_psi: 32.0, target_temp_min_c: 90, target_temp_max_c: 110, axle: 'both', source: 'official' },
  { tire_id: 't7', target_hot_min_psi: 26.0, target_hot_max_psi: 30.0, target_temp_min_c: 90, target_temp_max_c: 115, axle: 'both', source: 'official' },
  { tire_id: 't8', target_hot_min_psi: 35.0, target_hot_max_psi: 39.0, target_temp_min_c: 75, target_temp_max_c: 95,  axle: 'both', source: 'community' },
];

export const TRACKS: Track[] = [
  {
    id: 'tr1',
    name: 'Thunderhill Raceway',
    country: 'USA',
    region: 'CA',
    latitude: 39.5378,
    longitude: -122.3208,
    configurations: [
      { id: 'tc1', track_id: 'tr1', name: 'East course' },
      { id: 'tc2', track_id: 'tr1', name: 'West course' },
      { id: 'tc3', track_id: 'tr1', name: 'Full 5-mile' },
    ],
  },
  {
    id: 'tr2',
    name: 'Laguna Seca',
    country: 'USA',
    region: 'CA',
    latitude: 36.5847,
    longitude: -121.7544,
    configurations: [
      { id: 'tc4', track_id: 'tr2', name: 'Grand Prix' },
    ],
  },
  {
    id: 'tr3',
    name: 'Sonoma Raceway',
    country: 'USA',
    region: 'CA',
    latitude: 38.1613,
    longitude: -122.4544,
    configurations: [
      { id: 'tc5', track_id: 'tr3', name: 'Full course' },
      { id: 'tc6', track_id: 'tr3', name: 'Short course' },
    ],
  },
  {
    id: 'tr4',
    name: 'Circuit of the Americas',
    country: 'USA',
    region: 'TX',
    latitude: 30.1328,
    longitude: -97.6411,
    configurations: [
      { id: 'tc7', track_id: 'tr4', name: 'Full circuit' },
      { id: 'tc8', track_id: 'tr4', name: 'West circuit' },
    ],
  },
  {
    id: 'tr5',
    name: 'Road Atlanta',
    country: 'USA',
    region: 'GA',
    latitude: 34.1495,
    longitude: -83.8141,
    configurations: [
      { id: 'tc9', track_id: 'tr5', name: 'Full circuit' },
    ],
  },
];

// Mock historical sessions for demo.
// Four-corner hot values include realistic left/right spread (0–1.5 PSI)
// to exercise the spread diagnostic on the confirmation and delta analysis screens.
// hot_front_psi / hot_rear_psi are the axle averages, derived from corners,
// kept for backwards-compatible community queries.
export const MOCK_SESSIONS = [
  {
    id: 's1', created_at: '2024-03-08T09:12:00Z',
    ambient_temp_c: 19, session_type: 'hpde', signal_score: 1.43,
    cold_front_psi: 31.0, cold_rear_psi: 29.0,
    // Tight spread — well-balanced setup
    hot_fl_psi: 35.5, hot_fr_psi: 35.5, hot_rl_psi: 33.0, hot_rr_psi: 33.0,
    hot_front_psi: 35.5, hot_rear_psi: 33.0,
  },
  {
    id: 's2', created_at: '2024-03-08T13:45:00Z',
    ambient_temp_c: 22, session_type: 'hpde', signal_score: 1.43,
    cold_front_psi: 31.5, cold_rear_psi: 29.5,
    // Small spread — normal variation
    hot_fl_psi: 36.0, hot_fr_psi: 35.5, hot_rl_psi: 34.0, hot_rr_psi: 33.5,
    hot_front_psi: 35.5, hot_rear_psi: 33.5, // axle averages
  },
  {
    id: 's3', created_at: '2024-01-20T10:30:00Z',
    ambient_temp_c: 15, session_type: 'hpde', signal_score: 1.30,
    cold_front_psi: 30.0, cold_rear_psi: 28.0,
    // Slightly cool day — lower heat soak, tight spread
    hot_fl_psi: 34.5, hot_fr_psi: 34.5, hot_rl_psi: 32.0, hot_rr_psi: 32.0,
    hot_front_psi: 34.5, hot_rear_psi: 32.0,
  },
  {
    id: 's4', created_at: '2023-11-15T11:00:00Z',
    ambient_temp_c: 17, session_type: 'time_attack', signal_score: 1.43,
    cold_front_psi: 30.5, cold_rear_psi: 28.5,
    // 1.0 PSI front spread — worth noting, possibly camber or kerb contact
    hot_fl_psi: 35.5, hot_fr_psi: 34.5, hot_rl_psi: 32.5, hot_rr_psi: 32.5,
    hot_front_psi: 35.0, hot_rear_psi: 32.5,
  },
  {
    id: 's5', created_at: '2023-10-05T09:00:00Z',
    ambient_temp_c: 26, session_type: 'hpde', signal_score: 1.38,
    cold_front_psi: 32.0, cold_rear_psi: 30.0,
    // Warmer day — higher heat soak as expected
    hot_fl_psi: 36.5, hot_fr_psi: 36.5, hot_rl_psi: 34.0, hot_rr_psi: 34.0,
    hot_front_psi: 36.5, hot_rear_psi: 34.0,
  },
  {
    id: 's6', created_at: '2023-08-12T10:15:00Z',
    ambient_temp_c: 31, session_type: 'club_race', signal_score: 1.43,
    cold_front_psi: 32.5, cold_rear_psi: 30.5,
    // Hot day, club race — higher soak, 1.5 PSI rear spread flags an issue
    hot_fl_psi: 37.5, hot_fr_psi: 37.5, hot_rl_psi: 36.0, hot_rr_psi: 34.5,
    hot_front_psi: 37.5, hot_rear_psi: 35.0,
  },
];