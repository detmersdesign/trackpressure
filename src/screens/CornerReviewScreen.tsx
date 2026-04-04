import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, typography, spacing, radius, globalStyles } from '../lib/theme';
import { NumPad } from '../components/NumPad';
import { useEvent } from '../hooks/useEventContext';
import { useSettings } from '../hooks/useSettings';
import { useLocationAndWeather } from '../hooks/useLocationAndWeather';
import { predictHotRounded } from '../lib/recommendations';
import { supabase } from '../lib/supabase';
import { OpenSession } from '../types';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

const CORNERS = ['fl', 'fr', 'rr', 'rl'] as const;
type Corner = typeof CORNERS[number];

const CORNER_LABELS: Record<Corner, string> = {
  fl: 'Front left',
  fr: 'Front right',
  rr: 'Rear right',
  rl: 'Rear left',
};

function pressureLooksWrong(val: string): boolean {
  const n = parseFloat(val);
  if (isNaN(n)) return false;
  return n < 15 || n > 60;
}

function tempLooksWrong(val: string, unit: 'f' | 'c'): boolean {
  const n = parseFloat(val);
  if (isNaN(n)) return false;
  return unit === 'f' ? n < 50 || n > 350 : n < 10 || n > 175;
}

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: any;
};

export default function CornerReviewScreen({ navigation, route }: Props) {
  const { mode, pressures: initialPressures, temps: initialTemps, coldStartedAt, hotStartedAt, ambientTempC, historic_date } = route.params;

  // All hooks at top level
  const {
    activeEvent, openSession, setOpenSession,
    clearOpenSession, setLastEntry, incrementSession,
  } = useEvent();
  const { weather } = useLocationAndWeather();
  const { pressureUnit, tempUnit, inputToPsi, inputToC, settings } = useSettings();

  const [pressures, setPressures] = useState<Record<Corner, string>>(initialPressures);
  const [temps,     setTemps]     = useState<Record<Corner, string>>(initialTemps);

  const [editingCorner, setEditingCorner] = useState<Corner | null>(null);
  const [editingField,  setEditingField]  = useState<'pressure' | 'temp'>('pressure');
  const [submitting,    setSubmitting]    = useState(false);
  const hotStartRef = useRef<number>(Date.now());

  useEffect(() => {
    setPressures(route.params.pressures);
    setTemps(route.params.temps);
    setEditingCorner(null);
    setEditingField('pressure');
  }, [route.params]);

  // ── Flagging ──────────────────────────────────────────────────────────────
  function cornerHasWarning(c: Corner): boolean {
    if (pressures[c] && pressureLooksWrong(pressures[c])) return true;
    if (temps[c]     && tempLooksWrong(temps[c], settings.temperature_unit) )         return true;
    return false;
  }

  const anyWarnings = CORNERS.some(c => cornerHasWarning(c));

  // Cold: all pressures required, temps optional
  const coldModeReady = CORNERS.every(c => pressures[c].length > 0);
  // Hot: all pressures AND temps required
  const hotModeReady  = CORNERS.every(c => pressures[c].length > 0 && temps[c].length > 0);
  const canSubmit     = mode === 'cold' ? coldModeReady : hotModeReady;

  // ── Numpad ────────────────────────────────────────────────────────────────
  function handleNumPress(key: string) {
    if (!editingCorner) return;
    const setter = editingField === 'pressure' ? setPressures : setTemps;
    setter(prev => {
      const current = prev[editingCorner];
      let next: string;
      if (key === '⌫') {
        next = current.slice(0, -1);
      } else if (key === '.') {
        next = current.includes('.') ? current : current + '.';
      } else {
        if (current.length >= 5) return prev;
        next = current + key;
      }
      return { ...prev, [editingCorner]: next };
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function roundHalf(v: number) { return Math.round(v * 2) / 2; }

  // ── Submit cold ───────────────────────────────────────────────────────────
  async function handleSubmitCold() {
    if (!activeEvent) return;
    setSubmitting(true);

    const coldFL = roundHalf(inputToPsi(parseFloat(pressures.fl)));
    const coldFR = roundHalf(inputToPsi(parseFloat(pressures.fr)));
    const coldRR = roundHalf(inputToPsi(parseFloat(pressures.rr)));
    const coldRL = roundHalf(inputToPsi(parseFloat(pressures.rl)));
    const coldF  = roundHalf((coldFL + coldFR) / 2);
    const coldR  = roundHalf((coldRR + coldRL) / 2);

    const ambientC = ambientTempC ?? weather?.temp_c;

    // Per-corner prediction: use corner temp if entered, else ambient
    function predictForCorner(coldPsi: number, c: Corner): number {
      const rawTemp = temps[c] ? inputToC(parseFloat(temps[c])) : NaN;
      const tC = !isNaN(rawTemp) ? rawTemp : ambientC;
      if (tC !== undefined) {
        const tF = tC !== undefined ? tC * 9/5 + 32 : undefined;
        return predictHotRounded(coldPsi, tF);
      }
      return predictHotRounded(coldPsi);
    }

    const session: OpenSession = {
      id:               uuidv4(),
      event:            activeEvent,
      cold_front_psi:   coldF,
      cold_rear_psi:    coldR,
      cold_fl_psi:      coldFL,
      cold_fr_psi:      coldFR,
      cold_rl_psi:      coldRL,
      cold_rr_psi:      coldRR,
      cold_fl_temp_c:   temps.fl ? inputToC(parseFloat(temps.fl)) : undefined,
      cold_fr_temp_c:   temps.fr ? inputToC(parseFloat(temps.fr)) : undefined,
      cold_rl_temp_c:   temps.rl ? inputToC(parseFloat(temps.rl)) : undefined,
      cold_rr_temp_c:   temps.rr ? inputToC(parseFloat(temps.rr)) : undefined,
      predicted_hot_fl: predictForCorner(coldFL, 'fl'),
      predicted_hot_fr: predictForCorner(coldFR, 'fr'),
      predicted_hot_rl: predictForCorner(coldRL, 'rl'),
      predicted_hot_rr: predictForCorner(coldRR, 'rr'),
      saved_at:         new Date().toISOString(),
      ambient_temp_c:   ambientC,
      ambient_source:   ambientC !== undefined
        ? (route.params?.ambientTempC != null ? 'manual' : 'auto')
        : undefined,
      cold_entry_duration_seconds: coldStartedAt
        ? Math.round((Date.now() - coldStartedAt) / 1000)
        : undefined,
      historic_date,
    };

    await setOpenSession(session);
    setSubmitting(false);
    navigation.navigate('ColdSaved');
  }

  // ── Submit hot ────────────────────────────────────────────────────────────
  async function handleSubmitHot() {
    if (!activeEvent || !openSession) return;
    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();

    const hotFL = roundHalf(inputToPsi(parseFloat(pressures.fl)));
    const hotFR = roundHalf(inputToPsi(parseFloat(pressures.fr)));
    const hotRR = roundHalf(inputToPsi(parseFloat(pressures.rr)));
    const hotRL = roundHalf(inputToPsi(parseFloat(pressures.rl)));
    const hotFrontAvg = roundHalf((hotFL + hotFR) / 2);
    const hotRearAvg  = roundHalf((hotRL + hotRR) / 2);

    const entry = {
      user_id:              user?.id,
      cold_front_psi:       openSession.cold_front_psi,
      cold_rear_psi:        openSession.cold_rear_psi,
      cold_fl_psi:          openSession.cold_fl_psi    ?? null,
      cold_fr_psi:          openSession.cold_fr_psi    ?? null,
      cold_rl_psi:          openSession.cold_rl_psi    ?? null,
      cold_rr_psi:          openSession.cold_rr_psi    ?? null,
      hot_fl_psi:           hotFL,
      hot_fr_psi:           hotFR,
      hot_rl_psi:           hotRL,
      hot_rr_psi:           hotRR,
      hot_front_psi:        hotFrontAvg,
      hot_rear_psi:         hotRearAvg,
      tyre_temp_hot_fl_c:   temps.fl ? inputToC(parseFloat(temps.fl)) : null,
      tyre_temp_hot_fr_c:   temps.fr ? inputToC(parseFloat(temps.fr)) : null,
      tyre_temp_hot_rl_c:   temps.rl ? inputToC(parseFloat(temps.rl)) : null,
      tyre_temp_hot_rr_c:   temps.rr ? inputToC(parseFloat(temps.rr)) : null,
      tyre_temp_cold_fl_c:  openSession.cold_fl_temp_c ?? null,
      tyre_temp_cold_fr_c:  openSession.cold_fr_temp_c ?? null,
      tyre_temp_cold_rl_c:  openSession.cold_rl_temp_c ?? null,
      tyre_temp_cold_rr_c:  openSession.cold_rr_temp_c ?? null,
      vehicle_id:           activeEvent.vehicle.id,
      tire_id:              activeEvent.tire_front.id,
      track_id:             activeEvent.track.id,
      session_type:         activeEvent.session_type,
      ambient_temp_c:       openSession.ambient_session_start ?? openSession.ambient_temp_c,
      ambient_temp_end_c:   weather?.temp_c ?? null,
      ambient_source:       openSession.ambient_source as 'auto' | 'manual',
      hot_entry_duration_seconds: hotStartedAt
        ? Math.round((Date.now() - hotStartedAt) / 1000)
        : Math.round((Date.now() - hotStartRef.current) / 1000),
      cold_entry_duration_seconds: openSession.cold_entry_duration_seconds ?? null,
      is_hidden: openSession.is_hidden ?? !settings.community_contributions,
      created_at: openSession.historic_date ?? new Date().toISOString(),
    };

    try {
      await supabase.from('pressure_entries').insert(entry);
    } catch {}

    setLastEntry(entry);
    incrementSession();
    await clearOpenSession();
    setSubmitting(false);
    if (openSession.historic_date) {
      navigation.replace('HistoricEventSetup', {
        vehicle:        activeEvent.vehicle,
        tireFront:      activeEvent.tire_front,
        tireRear:       activeEvent.tire_rear,
        tireSetName:    activeEvent.tire_set_name ?? '',
        selectedTrack:  activeEvent.track,
        selectedConfig: activeEvent.track_config ?? null,
        sessionType:    activeEvent.session_type,
        prefilled:      true,
      });
    } else {
      navigation.navigate('Confirmation');
    }
  }

  function handleSubmit() {
    if (mode === 'cold') handleSubmitCold();
    else handleSubmitHot();
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={globalStyles.screen}>
      <View style={styles.topBar}>
        <View>
          <Text style={typography.subhead}>Review entries</Text>
          <Text style={[typography.caption, { color: colors.accent }]}>
            Tap any corner to correct
          </Text>
        </View>
      </View>

      <View style={styles.progressRow}>
        {CORNERS.map(c => (
          <View key={c} style={[styles.progressStep, styles.progressDone]} />
        ))}
        <Text style={styles.progressLabel}>review</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        <Text style={[typography.caption, {
          textAlign: 'center', color: colors.textMuted, marginBottom: spacing.sm,
        }]}>
          Front of car ↑
        </Text>

        {/* Warning banner */}
        {anyWarnings && !editingCorner && (
          <View style={styles.warnBanner}>
            <Text style={styles.warnText}>
              Some values look unusual — tap a flagged corner to correct, or submit as entered.
            </Text>
          </View>
        )}

        {/* Editing a corner */}
        {editingCorner ? (
          <View style={[styles.activeCornerCard, { borderColor: colors.accent }]}>
            <View style={styles.acHeader}>
              <Text style={[styles.acLabel, { color: colors.accent }]}>
                {CORNER_LABELS[editingCorner]}
              </Text>
              <TouchableOpacity
                style={styles.doneEditBtn}
                onPress={() => setEditingCorner(null)}
              >
                <Text style={styles.doneEditText}>Done editing</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.fieldToggle}>
              <TouchableOpacity
                style={[styles.ftPill, editingField === 'pressure' && styles.ftPillActive]}
                onPress={() => setEditingField('pressure')}
              >
                <Text style={[styles.ftPillText, editingField === 'pressure' && styles.ftPillTextActive]}>
                  Pressure
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ftPill, editingField === 'temp' && styles.ftPillActive]}
                onPress={() => setEditingField('temp')}
              >
                <Text style={[styles.ftPillText, editingField === 'temp' && styles.ftPillTextActive]}>
                  Temp
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.acFields}>
              <View style={[styles.acField, editingField === 'pressure' && styles.acFieldActive]}>
                <Text style={styles.acFieldLabel}>Pressure</Text>
                <Text style={[styles.acFieldVal, editingField === 'pressure' && { color: colors.accent }]}>
                  {pressures[editingCorner] || '—'}
                </Text>
                <Text style={styles.acFieldUnit}>{pressureUnit()}</Text>
              </View>
              <View style={[styles.acField, editingField === 'temp' && styles.acFieldActive]}>
                <Text style={styles.acFieldLabel}>Temp</Text>
                <Text style={[styles.acFieldVal, editingField === 'temp' && { color: colors.accent }]}>
                  {temps[editingCorner] || '—'}
                </Text>
                <Text style={styles.acFieldUnit}>{tempUnit()}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.reviewGrid}>
            {(['fl', 'fr', 'rl', 'rr'] as Corner[]).map(c => {
              const hasWarn = cornerHasWarning(c);
              return (
                <TouchableOpacity
                  key={c}
                  style={[styles.rbox, hasWarn && styles.rboxWarn]}
                  onPress={() => { setEditingCorner(c); setEditingField('pressure'); }}
                >
                  <Text style={[styles.rlabel, hasWarn && { color: colors.warning }]}>
                    {CORNER_LABELS[c]}{hasWarn ? ' !' : ''}
                  </Text>
                  <View style={styles.rvals}>
                    <Text style={[styles.rpsi, hasWarn && { color: colors.warning }]}>
                      {pressures[c] || '—'} {pressures[c] ? pressureUnit() : ''}
                    </Text>
                    {temps[c] ? (
                      <Text style={[styles.rtemp, hasWarn && { color: colors.warning }]}>
                        {temps[c]}{tempUnit()}
                      </Text>
                    ) : (
                      <Text style={styles.rtempMissing}>
                        {mode === 'hot' ? 'temp missing' : 'no temp'}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.redit, hasWarn && { color: colors.warning }]}>
                    tap to edit
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

      </ScrollView>

      {editingCorner && <NumPad onPress={handleNumPress} />}

      <View style={styles.submitRow}>
        <TouchableOpacity
          style={[styles.submitBtn, (!canSubmit || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={[styles.submitBtnText, (!canSubmit || submitting) && styles.submitBtnTextDisabled]}>
            {submitting
              ? 'Saving…'
              : mode === 'cold'
                ? 'Save cold pressures'
                : 'Complete session'}
          </Text>
        </TouchableOpacity>
        {anyWarnings && !editingCorner && (
          <TouchableOpacity style={styles.submitAsEnteredRow} onPress={handleSubmit}>
            <Text style={styles.submitAsEnteredText}>submit as entered</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  progressRow: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  progressStep: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.border },
  progressDone: { backgroundColor: colors.success },
  progressLabel: { fontSize: 9, color: colors.textMuted, marginLeft: 4 },

  content: { padding: spacing.lg, paddingBottom: spacing.xl },

  carDiagram: {
    position: 'relative', height: 80, marginBottom: spacing.md, alignItems: 'center',
  },
  carArrow: { fontSize: 9, color: colors.textMuted, marginBottom: 2, alignSelf: 'center' },
  carBody: {
    width: 48, height: 56, backgroundColor: colors.bgCard,
    borderRadius: 6, borderWidth: 0.5, borderColor: colors.border,
    position: 'absolute', top: 14, left: '50%', marginLeft: -24,
  },
  cornerDot: {
    position: 'absolute', width: 28, height: 28,
    borderRadius: 4, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  cornerDotDone:    { borderColor: colors.success, backgroundColor: colors.successSubtle },
  cornerDotWarn:    { borderColor: colors.warning, backgroundColor: colors.warningSubtle },
  cornerDotEditing: { borderColor: colors.accent,  backgroundColor: colors.accentSubtle },
  cornerDotText: { fontSize: 8, fontWeight: '500' },
  dot_fl: { top: 10, left: '25%', marginLeft: -14 },
  dot_fr: { top: 10, right: '25%', marginRight: -14 },
  dot_rl: { bottom: 0, left: '25%', marginLeft: -14 },
  dot_rr: { bottom: 0, right: '25%', marginRight: -14 },

  warnBanner: {
    backgroundColor: colors.warningSubtle, borderRadius: radius.md,
    borderWidth: 0.5, borderColor: colors.warning,
    padding: spacing.md, marginBottom: spacing.md,
  },
  warnText: { fontSize: 12, color: colors.warning, lineHeight: 18 },

  reviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  rbox: {
    width: '47%', backgroundColor: colors.successSubtle,
    borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.success,
    padding: spacing.md,
  },
  rboxWarn: { backgroundColor: colors.warningSubtle, borderColor: colors.warning },
  rlabel: { fontSize: 9, color: colors.success, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  rvals:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 },
  rpsi:   { fontSize: 15, fontWeight: '500', color: colors.success, fontVariant: ['tabular-nums'] as any },
  rtemp:  { fontSize: 12, color: colors.success, opacity: 0.8 },
  rtempMissing: { fontSize: 10, color: colors.textMuted, fontStyle: 'italic' },
  redit:  { fontSize: 9, color: colors.success, opacity: 0.6 },

  activeCornerCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, padding: spacing.md, marginBottom: spacing.md,
  },
  acHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.sm,
  },
  acLabel: { fontSize: 14, fontWeight: '500' },
  doneEditBtn: {
    backgroundColor: colors.accentSubtle, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  doneEditText: { fontSize: 11, color: colors.accent, fontWeight: '500' },
  fieldToggle: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  ftPill: {
    flex: 1, paddingVertical: 5, alignItems: 'center',
    borderRadius: radius.sm, borderWidth: 0.5, borderColor: colors.border,
    backgroundColor: colors.bgInput,
  },
  ftPillActive: { borderColor: colors.accent, backgroundColor: colors.accentSubtle },
  ftPillText:       { fontSize: 11, color: colors.textMuted },
  ftPillTextActive: { color: colors.accent, fontWeight: '500' },
  acFields: { flexDirection: 'row', gap: spacing.sm },
  acField: {
    flex: 1, backgroundColor: colors.bgInput,
    borderRadius: radius.md, padding: spacing.sm,
    borderWidth: 0.5, borderColor: colors.border,
  },
  acFieldActive: { borderColor: colors.accent },
  acFieldLabel: { fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  acFieldVal:   { fontSize: 20, fontWeight: '500', color: colors.textPrimary, fontVariant: ['tabular-nums'] as any },
  acFieldUnit:  { fontSize: 9, color: colors.textMuted, marginTop: 2 },

  submitRow: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderTopWidth: 0.5, borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  submitBtn: {
    backgroundColor: colors.success, borderRadius: radius.lg,
    paddingVertical: 14, alignItems: 'center',
  },
  submitBtnDisabled:     { backgroundColor: colors.bgHighlight },
  submitBtnText:         { fontSize: 15, fontWeight: '600', color: '#000' },
  submitBtnTextDisabled: { color: colors.textMuted },
  submitAsEnteredRow:    { alignItems: 'center', paddingVertical: spacing.sm },
  submitAsEnteredText:   { fontSize: 12, color: colors.textMuted, textDecorationLine: 'underline' },
});
