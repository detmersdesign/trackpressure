// useLocationAndWeather — thin wrapper around EventContext location state.
//
// All location/weather fetching now happens in EventProvider via
// prefetchLocation(), which GarageScreen triggers on mount.
// This hook exists purely for backwards compatibility — every screen
// that previously called useLocationAndWeather() continues to work
// unchanged without any modifications.

import { useEvent } from './useEventContext';

export function useLocationAndWeather() {
  const {
    weather,
    nearbyTracks,
    allTracksSorted,
    locationLoading,
    prefetchLocation,
  } = useEvent();

  return {
    weather,
    nearbyTracks,
    allTracksSorted,
    locationError: null,
    loading:       locationLoading,
    prefetchLocation,
  };
}
