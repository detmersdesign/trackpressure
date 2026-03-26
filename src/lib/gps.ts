import { Track } from '../types';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface TrackMatch {
  track: Track;
  distanceKm: number;
}

export function findNearbyTracks(lat: number, lon: number, tracks: Track[], radiusKm = 5): TrackMatch[] {
  return tracks
    .map((track) => ({
      track,
      distanceKm: Math.round(haversineKm(lat, lon, track.latitude, track.longitude) * 10) / 10,
    }))
    .filter((m) => m.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
