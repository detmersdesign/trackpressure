import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, typography, spacing, radius, globalStyles } from '../lib/theme';
import { ContextPill } from '../components/ContextPill';
import { useEvent } from '../hooks/useEventContext';
import { useSettings } from '../hooks/useSettings';
import { ActiveEvent, SessionType, Track, TrackConfig } from '../types';
import { supabase } from '../lib/supabase';

// ── Session types — matches EventSetupScreen (club_race excluded) ──────────
const SESSION_TYPES: { key: SessionType; label: string }[] = [
  { key: 'hpde',        label: 'HPDE'        },
  { key: 'time_attack', label: 'Time attack'  },
  { key: 'practice',    label: 'Practice'     },
  { key: 'qualifying',  label: 'Qualifying'   },
  { key: 'race',        label: 'Race'         },
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

type Props = NativeStackScreenProps<any, 'HistoricEventSetup'>;

export default function HistoricEventSetupScreen({ navigation, route }: Props) {
  const { setActiveEvent } = useEvent();
  const { settings, displayTemp, tempUnit } = useSettings();

  const vehicle     = route.params?.vehicle;
  const tireFront   = route.params?.tireFront;
  const tireRear    = route.params?.tireRear;
  const tireSetName = route.params?.tireSetName ?? '';
  const prefilled   = route.params?.prefilled ?? false;

  // ── Success banner ────────────────────────────────────────────────────────
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!prefilled) return;
    setShowBanner(true);
    Animated.sequence([
      Animated.timing(bannerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(bannerOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => setShowBanner(false));
  }, []);

  // ── Date state ────────────────────────────────────────────────────────────
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [day,   setDay]   = useState(today.getDate());
  const [year,  setYear]  = useState(today.getFullYear());

  // ── Track state ───────────────────────────────────────────────────────────
  const [allTracks,         setAllTracks]         = useState<Track[]>([]);
  const [trackSearch,       setTrackSearch]       = useState('');
  const [selectedTrack,     setSelectedTrack]     = useState<Track | null>(route.params?.selectedTrack ?? null);
  const [selectedConfig,    setSelectedConfig]    = useState<TrackConfig | null>(route.params?.selectedConfig ?? null);
  const [trackDropdownOpen, setTrackDropdownOpen] = useState(false);
  const [configExpanded,    setConfigExpanded]    = useState(false);

  // ── Other state ───────────────────────────────────────────────────────────
  const [sessionType, setSessionType] = useState<SessionType>(route.params?.sessionType ?? 'hpde');
  const [ambientTemp, setAmbientTemp] = useState('');

  // ── Load all tracks sorted by state then name ─────────────────────────────
  useEffect(() => {
    supabase
      .from('tracks')
      .select('*, configurations:track_configurations(*)')
      .order('state', { ascending: true })
      .order('name',  { ascending: true })
      .then(({ data }) => {
        if (data) setAllTracks(data as Track[]);
      });
  }, []);

  // ── Filtered track list ───────────────────────────────────────────────────
  const filteredTracks = trackSearch.trim().length > 0
    ? allTracks.filter(t =>
        t.name.toLowerCase().includes(trackSearch.toLowerCase()) ||
        t.state?.toLowerCase().includes(trackSearch.toLowerCase())
      )
    : allTracks;

  // ── Date helpers ──────────────────────────────────────────────────────────
  function stepMonth(dir: 1 | -1) {
    setMonth(m => { const n = (m + dir + 12) % 12; return n; });
  }
  function stepDay(dir: 1 | -1) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    setDay(d => { let n = d + dir; if (n < 1) n = daysInMonth; if (n > daysInMonth) n = 1; return n; });
  }
  function stepYear(dir: 1 | -1) {
    setYear(y => { const n = y + dir; return n < 2000 || n > today.getFullYear() ? y : n; });
  }

  function historicDateISO(): string {
    const d = new Date(year, month, day, 12, 0, 0);
    return d.toISOString();
  }

  // ── Start ─────────────────────────────────────────────────────────────────
  function handleContinue() {
    if (!selectedTrack || !vehicle || !tireFront || !tireRear) return;

    const ambientC = ambientTemp.trim().length > 0
      ? settings.temperature_unit === 'f'
        ? (parseFloat(ambientTemp) - 32) * 5 / 9
        : parseFloat(ambientTemp)
      : undefined;

    const event: ActiveEvent = {
      vehicle,
      tire_front:    tireFront,
      tire_rear:     tireRear,
      track:         selectedTrack,
      track_config:  selectedConfig ?? selectedTrack.configurations[0],
      session_type:  sessionType,
      started_at:    historicDateISO(),
      tire_set_name: tireSetName,
    };

    setActiveEvent(event);

    if (settings.pyrometer_enabled) {
      navigation.navigate('ColdCornerEntry', {
        historic_date: historicDateISO(),
        ambient_temp_c: ambientC,
      });
    } else {
      navigation.navigate('QuickLog', {
        mode: 'cold',
        historic_date: historicDateISO(),
        ambientTempC: ambientC ?? null,
      });
    }
  }

  const canContinue = !!selectedTrack && !!vehicle && !!tireFront && !!tireRear;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={globalStyles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* Success banner — shown after returning from hot submit */}
        {showBanner && (
          <Animated.View style={[styles.successBanner, { opacity: bannerOpacity }]}>
            <Text style={styles.successBannerText}>Session saved</Text>
          </Animated.View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <Text style={typography.heading}>Log past session</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[typography.caption, { color: colors.accent }]}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Car + tire badge */}
        <View style={styles.pillRow}>
          {vehicle && <ContextPill label={`${vehicle.make} ${vehicle.model}`} auto={false} />}
          {tireSetName ? <ContextPill label={tireSetName} auto={false} /> : null}
        </View>

        {/* ── Date picker ────────────────────────────────────────────────── */}
        <Text style={globalStyles.sectionLabel}>Session date</Text>
        <View style={[globalStyles.card, { marginBottom: spacing.md }]}>
          <View style={styles.dateRow}>

            <View style={styles.datePart}>
              <Text style={styles.datePartLabel}>Month</Text>
              <View style={styles.dateControls}>
                <TouchableOpacity style={styles.dateArrow} onPress={() => stepMonth(-1)}>
                  <Text style={styles.dateArrowText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.dateVal}>{MONTHS[month]}</Text>
                <TouchableOpacity style={styles.dateArrow} onPress={() => stepMonth(1)}>
                  <Text style={styles.dateArrowText}>›</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.datePart}>
              <Text style={styles.datePartLabel}>Day</Text>
              <View style={styles.dateControls}>
                <TouchableOpacity style={styles.dateArrow} onPress={() => stepDay(-1)}>
                  <Text style={styles.dateArrowText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.dateVal}>{String(day).padStart(2, '0')}</Text>
                <TouchableOpacity style={styles.dateArrow} onPress={() => stepDay(1)}>
                  <Text style={styles.dateArrowText}>›</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.datePart}>
              <Text style={styles.datePartLabel}>Year</Text>
              <View style={styles.dateControls}>
                <TouchableOpacity style={styles.dateArrow} onPress={() => stepYear(-1)}>
                  <Text style={styles.dateArrowText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.dateVal}>{year}</Text>
                <TouchableOpacity style={styles.dateArrow} onPress={() => stepYear(1)}>
                  <Text style={styles.dateArrowText}>›</Text>
                </TouchableOpacity>
              </View>
            </View>

          </View>
        </View>

        {/* ── Track ──────────────────────────────────────────────────────── */}
        <Text style={globalStyles.sectionLabel}>Track</Text>
        <View style={globalStyles.card}>
          <TextInput
            style={styles.searchInput}
            value={trackSearch}
            onChangeText={t => { setTrackSearch(t); setTrackDropdownOpen(true); }}
            onFocus={() => setTrackDropdownOpen(true)}
            placeholder="Search by name or state…"
            placeholderTextColor={colors.textMuted}
          />

          {selectedTrack && !trackDropdownOpen && (
            <TouchableOpacity
              style={[styles.selectRow, { marginTop: spacing.sm }]}
              onPress={() => setTrackDropdownOpen(true)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.selectLabel}>{selectedTrack.name}</Text>
                <Text style={styles.selectSub}>{selectedTrack.state}, {selectedTrack.country}</Text>
              </View>
              <Text style={styles.chevron}>▼</Text>
            </TouchableOpacity>
          )}

          {trackDropdownOpen && (
            <View style={styles.dropdownOptions}>
              {filteredTracks.slice(0, 12).map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={styles.dropdownOption}
                  onPress={() => {
                    setSelectedTrack(t);
                    setSelectedConfig(null);
                    setTrackDropdownOpen(false);
                    setTrackSearch('');
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
              ))}
              {filteredTracks.length === 0 && (
                <View style={{ padding: spacing.md }}>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    No tracks found
                  </Text>
                </View>
              )}
            </View>
          )}

          {selectedTrack && selectedTrack.configurations.length > 1 && !trackDropdownOpen && (
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

        {/* ── Session type ────────────────────────────────────────────────── */}
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

        {/* ── Ambient temp ────────────────────────────────────────────────── */}
        <Text style={[globalStyles.sectionLabel, { marginTop: spacing.lg }]}>
          Ambient temperature (optional)
        </Text>
        <View style={[globalStyles.card, { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }]}>
          <TextInput
            style={[styles.ambientInput]}
            value={ambientTemp}
            onChangeText={setAmbientTemp}
            placeholder="e.g. 72"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            maxLength={5}
          />
          <Text style={[typography.body, { color: colors.textMuted }]}>
            °{settings.temperature_unit.toUpperCase()}
          </Text>
        </View>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
          Skip if unknown — won't affect pressure data quality
        </Text>

        {/* ── Continue ────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
        >
          <Text style={[styles.continueBtnText, !canContinue && styles.continueBtnTextDisabled]}>
            Continue to cold entry →
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: 40 },
  successBanner: {
    backgroundColor: colors.successSubtle,
    borderRadius: radius.md,
    borderWidth: 0.5,
    borderColor: colors.success,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  successBannerText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.success,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.md,
  },
  pillRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    alignItems: 'center', marginBottom: spacing.md,
  },

  // Date picker
  dateRow: { flexDirection: 'row', gap: spacing.sm },
  datePart: { flex: 1, alignItems: 'center' },
  datePartLabel: {
    fontSize: 10, color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.04,
    marginBottom: spacing.xs,
  },
  dateControls: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  dateArrow: {
    width: 28, height: 36, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bgHighlight, borderRadius: radius.sm,
    borderWidth: 0.5, borderColor: colors.border,
  },
  dateArrowText: { fontSize: 18, color: colors.textSecondary, lineHeight: 20 },
  dateVal: {
    fontSize: 16, fontWeight: '500', color: colors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
    minWidth: 38, textAlign: 'center',
  },

  // Track search
  searchInput: {
    backgroundColor: colors.bgHighlight,
    borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    fontSize: 14, color: colors.textPrimary,
  },
  selectRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgHighlight,
    borderRadius: radius.md, padding: spacing.md,
    borderWidth: 0.5, borderColor: colors.border,
  },
  selectLabel: { ...typography.body, fontWeight: '500' },
  selectSub: { ...typography.caption, marginTop: 2 },
  chevron: { fontSize: 18, color: colors.textMuted, marginLeft: 8 },
  dropdownOptions: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    borderWidth: 0.5, borderColor: colors.accent,
    overflow: 'hidden', marginTop: spacing.sm,
    maxHeight: 280,
  },
  dropdownOption: {
    padding: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  dropdownOptionText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  dropdownOptionActive: { color: colors.accent },
  dropdownOptionSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  configOption: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: spacing.sm,
    borderTopWidth: 0.5, borderTopColor: colors.border,
  },
  configOptionText: { fontSize: 14, color: colors.textSecondary },
  configOptionActive: { color: colors.accent, fontWeight: '500' },

  // Session type
  sessionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sessionChip: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: radius.sm, borderWidth: 0.5,
    borderColor: colors.border, backgroundColor: colors.bgCard,
  },
  sessionChipActive: { backgroundColor: colors.accentSubtle, borderColor: colors.accent },
  sessionChipText: { fontSize: 13, color: colors.textSecondary },
  sessionChipTextActive: { color: colors.accent, fontWeight: '500' },

  // Ambient temp
  ambientInput: {
    flex: 1, backgroundColor: colors.bgHighlight,
    borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    fontSize: 18, fontWeight: '500', color: colors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
  },

  // Continue button
  continueBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg, paddingVertical: 16,
    alignItems: 'center', marginTop: spacing.xl,
  },
  continueBtnDisabled: { backgroundColor: colors.bgHighlight },
  continueBtnText: { fontSize: 16, fontWeight: '600', color: '#000' },
  continueBtnTextDisabled: { color: colors.textMuted },
});
