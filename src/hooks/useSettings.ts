import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserSettings, DEFAULT_SETTINGS } from '../types';

const SETTINGS_KEY = 'trackpressure:user_settings';

export function useSettings(refreshTrigger?: number) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then(raw => {
      if (raw) {
        try { setSettings(JSON.parse(raw)); } catch {}
      }
    });
  }, [refreshTrigger]);  // re-runs when trigger changes

  // ── Pressure ──────────────────────────────────────────────────────────────
  function displayPressure(psi: number): string {
    switch (settings.pressure_unit) {
      case 'bar': return (psi * 0.0689476).toFixed(2);
      case 'kpa': return (psi * 6.89476).toFixed(1);
      default:    return psi.toFixed(1);
    }
  }

  function pressureUnit(): string {
    switch (settings.pressure_unit) {
      case 'bar': return 'bar';
      case 'kpa': return 'kPa';
      default:    return 'PSI';
    }
  }

  // ── Temperature ───────────────────────────────────────────────────────────
  function displayTemp(celsius: number): string {
    switch (settings.temperature_unit) {
      case 'f': return Math.round(celsius * 9/5 + 32).toString();
      default:  return Math.round(celsius).toString();
    }
  }

  function tempUnit(): string {
    return settings.temperature_unit === 'f' ? '°F' : '°C';
  }

  function inputToPsi(val: number): number {
    switch (settings.pressure_unit) {
      case 'bar': return Math.round((val / 0.0689476) * 10) / 10;
      case 'kpa': return Math.round((val / 6.89476) * 10) / 10;
      default:    return val;
    }
  }

  function displayDistance(km: number): string {
    switch (settings.distance_unit) {
      case 'mi': return (km * 0.621371).toFixed(1);
      default:   return km.toFixed(1);
    }
  }

  function distanceUnit(): string {
    return settings.distance_unit === 'mi' ? 'mi' : 'km';
  }

  return {
    settings,
    displayPressure,
    pressureUnit,
    displayTemp,
    tempUnit,
    inputToPsi,
    displayDistance,
    distanceUnit,
  };
}