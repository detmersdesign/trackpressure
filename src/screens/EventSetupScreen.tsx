import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, typography, spacing, radius, globalStyles } from '../lib/theme';
import { ContextPill } from '../components/ContextPill';
import { useLocationAndWeather } from '../hooks/useLocationAndWeather';
import { useEvent } from '../hooks/useEventContext';
import { useSettings } from '../hooks/useSettings';
import { ActiveEvent, SessionType, Vehicle, Tire, Track, TrackConfig } from '../types';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

const SESSION_TYPES: { key: SessionType; label: string }[] = [
  { key: 'hpde',        label: 'HPDE' },
  { key: 'time_attack', label: 'Time attack' },
  //{ key: 'club_race',   label: 'Club race' },
  { key: 'practice',    label: 'Practice' },
  { key: 'qualifying',  label: 'Qualifying' },
  { key: 'race',        label: 'Race' },
];

type Props = NativeStackScreenProps<any, 'EventSetup'>;

export default function EventSetupScreen({ navigation, route }: Props) {
  const { weather, nearbyTracks, allTracksSorted, loading, prefetchLocation  } = useLocationAndWeather();
  const { setActiveEvent } = useEvent();
  const { settings, displayTemp, tempUnit, displayDistance, distanceUnit } = useSettings();

  const vehicle         = route.params?.vehicle;
  const tireFront       = route?.params?.tireFront;
  const tireRear        = route?.params?.tireRear;
  const tireSetName     = route?.params?.tireSetName ?? '';
  const garageCardIndex = route?.params?.garageCardIndex ?? 0;

  const [selectedTrack, setSelectedTrack]   = useState<Track | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<TrackConfig | null>(null);
  const [sessionType, setSessionType]       = useState<SessionType>('hpde');
  const [configExpanded, setConfigExpanded] = useState(false);
  const [trackDropdownOpen, setTrackDropdownOpen] = useState(false);

  const detectedTrack = nearbyTracks[0];

  useEffect(() => {
    prefetchLocation();
  }, []);

  useEffect(() => {
    if (detectedTrack && !selectedTrack) {
      setSelectedTrack(detectedTrack.track);
    }
  }, [nearbyTracks]);

  function handleStart() {
    if (!selectedTrack || !vehicle || !tireFront || !tireRear) return;
    const event: ActiveEvent = {
      vehicle,
      tire_front:   tireFront,
      tire_rear:    tireRear,
      track:        selectedTrack,
      track_config: selectedConfig ?? selectedTrack.configurations[0],
      session_type: sessionType,
      started_at:   new Date().toISOString(),
    };
    setActiveEvent(event);
    if (settings.pyrometer_enabled) {
      navigation.navigate('ColdCornerEntry');
    } else {
      navigation.navigate('QuickLog', { mode: 'cold', ambientTempC: weather?.temp_c ?? null });
    }
  }

  function handleChangeTyres() {
    navigation.navigate('Garage', {
      focusCardIndex:   garageCardIndex,
      openTyreDropdown: true,
    });
  }

  return (
    <SafeAreaView style={globalStyles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <Text style={typography.heading}>Event setup</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Garage')}>
            <Text style={[typography.caption, { color: colors.accent }]}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Read-only car + tire pills */}
        <View style={styles.pillRow}>
          {vehicle && (
            <ContextPill label={`${vehicle.make} ${vehicle.model}`} auto={false} />
          )}
          {tireSetName ? <ContextPill label={tireSetName} auto={false} /> : null}
          <TouchableOpacity onPress={handleChangeTyres}>
            <Text style={styles.changeLink}>Change tires</Text>
          </TouchableOpacity>
        </View>

        {/* Weather */}
        {weather && (
          <View style={styles.pillRow}>
            <ContextPill label={`${displayTemp(weather.temp_c)}${tempUnit()} · ${weather.description}`} auto />
          </View>
        )}

        {/* Track */}
        <Text style={globalStyles.sectionLabel}>Track</Text>
        <View style={globalStyles.card}>
          <View style={styles.autoRow}>
            {loading ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : detectedTrack ? (
              <ContextPill
                label={`GPS: ${detectedTrack.track.name} · ${displayDistance(detectedTrack.distanceKm)} ${distanceUnit()}`}
                auto
              />
            ) : (
              <ContextPill label="No track detected nearby" auto={false} />
            )}
          </View>

          <TouchableOpacity
            style={styles.selectRow}
            onPress={() => setTrackDropdownOpen(!trackDropdownOpen)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.selectLabel}>
                {selectedTrack?.name ?? 'Select track'}
              </Text>
              <Text style={styles.selectSub}>
                {selectedTrack
                  ? `${selectedTrack.state ?? selectedTrack.region ?? ''}, ${selectedTrack.country}`
                  : 'Tap to select'}
              </Text>
            </View>
            <Text style={styles.chevron}>{trackDropdownOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {trackDropdownOpen && (
            <View style={styles.dropdownOptions}>
              {allTracksSorted.length > 0 ? allTracksSorted.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={styles.dropdownOption}
                  onPress={() => {
                    setSelectedTrack(t);
                    setSelectedConfig(null);
                    setTrackDropdownOpen(false);
                  }}
                >
                  <Text style={[
                    styles.dropdownOptionText,
                    selectedTrack?.id === t.id && styles.dropdownOptionActive,
                  ]}>
                    {t.name}
                  </Text>
                  <Text style={styles.dropdownOptionSub}>
                    {t.state}, {t.country}
                  </Text>
                </TouchableOpacity>
              )) : (
                <View style={{ padding: spacing.md }}>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    Loading tracks…
                  </Text>
                </View>
              )}
            </View>
          )}

          {selectedTrack && selectedTrack.configurations.length > 1 && (
            <TouchableOpacity
              style={[styles.selectRow, { marginTop: spacing.sm }]}
              onPress={() => setConfigExpanded(!configExpanded)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[
                  styles.selectLabel,
                  !selectedConfig && { color: colors.textSecondary },
                ]}>
                  {selectedConfig?.name ?? 'Select configuration'}
                </Text>
                <Text style={styles.selectSub}>
                  {selectedTrack.configurations.map(c => c.name).join(' · ')}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          )}

          {configExpanded && selectedTrack?.configurations.map(cfg => (
            <TouchableOpacity
              key={cfg.id}
              style={styles.configOption}
              onPress={() => { setSelectedConfig(cfg); setConfigExpanded(false); }}
            >
              <Text style={[
                styles.configOptionText,
                selectedConfig?.id === cfg.id && styles.configOptionActive,
              ]}>
                {cfg.name}
              </Text>
              {selectedConfig?.id === cfg.id && (
                <Text style={{ color: colors.accent }}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Session type */}
        <Text style={globalStyles.sectionLabel}>Session type</Text>
        <View style={styles.sessionGrid}>
          {SESSION_TYPES.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.sessionChip, sessionType === key && styles.sessionChipActive]}
              onPress={() => setSessionType(key)}
            >
              <Text style={[
                styles.sessionChipText,
                sessionType === key && styles.sessionChipTextActive,
              ]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.startBtn,
            (!selectedTrack || !vehicle) && styles.startBtnDisabled,
          ]}
          onPress={handleStart}
          disabled={!selectedTrack || !vehicle}
        >
          <Text style={[
            styles.startBtnText,
            (!selectedTrack || !vehicle) && styles.startBtnTextDisabled,
          ]}>
            Start session →
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: 40 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.md,
  },
  pillRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    alignItems: 'center', marginBottom: spacing.sm,
  },
  changeLink: {
    fontSize: 12, color: colors.accent,
    textDecorationLine: 'underline',
  },
  autoRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  selectRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgHighlight,
    borderRadius: radius.md, padding: spacing.md,
    borderWidth: 0.5, borderColor: colors.border,
  },
  selectLabel: { ...typography.body, fontWeight: '500' },
  selectSub: { ...typography.caption, marginTop: 2 },
  chevron: { fontSize: 20, color: colors.textMuted, marginLeft: 8 },
  sessionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sessionChip: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: radius.sm, borderWidth: 0.5,
    borderColor: colors.border, backgroundColor: colors.bgCard,
  },
  sessionChipActive: { backgroundColor: colors.accentSubtle, borderColor: colors.accent },
  sessionChipText: { fontSize: 13, color: colors.textSecondary },
  sessionChipTextActive: { color: colors.accent, fontWeight: '500' },
  configOption: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: spacing.sm,
    borderTopWidth: 0.5, borderTopColor: colors.border,
  },
  configOptionText: { fontSize: 14, color: colors.textSecondary },
  configOptionActive: { color: colors.accent, fontWeight: '500' },
  startBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg, paddingVertical: 16,
    alignItems: 'center', marginTop: spacing.xl,
  },
  startBtnDisabled: { backgroundColor: colors.bgHighlight },
  startBtnText: { fontSize: 16, fontWeight: '600', color: '#000' },
  startBtnTextDisabled: { color: colors.textMuted },
  dropdownOptions: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    borderWidth: 0.5, borderColor: colors.accent,
    overflow: 'hidden', marginTop: spacing.sm,
  },
  dropdownOption: {
    padding: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  dropdownOptionText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  dropdownOptionActive: { color: colors.accent },
  dropdownOptionSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
