import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { colors, typography, spacing, radius, globalStyles } from '../lib/theme';
import { PressureBox } from '../components/PressureBox';
import { NumPad } from '../components/NumPad';
import { ContextPill } from '../components/ContextPill';
import { DeltaBadge } from '../components/DeltaBadge';
import { useEvent } from '../hooks/useEventContext';
import { supabase } from '../lib/supabase';
import { computeSignalScore, predictHotRounded } from '../lib/recommendations';
import { OpenSession, ActiveEvent } from '../types';
import { useLocationAndWeather } from '../hooks/useLocationAndWeather';
import { useSettings } from '../hooks/useSettings';

type Mode = 'cold' | 'hot';
type HotCorner = 'fl' | 'fr' | 'rl' | 'rr';
type ColdCorner = 'fl' | 'fr' | 'rl' | 'rr';

const CORNER_LABELS: Record<HotCorner, string> = {
  fl: 'Front left',
  fr: 'Front right',
  rl: 'Rear left',
  rr: 'Rear right',
};

const COLD_CORNER_LABELS: Record<ColdCorner, string> = {
  fl: 'Front left',
  fr: 'Front right',
  rl: 'Rear left',
  rr: 'Rear right',
};

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route?: { params?: { mode?: Mode; ambientTempC?: number | null; historic_date?: string } };
};

function roundHalf(v: number): number {
  return Math.round(v * 2) / 2;
}

function coldStoredHint(raw: string): string | null {
  const num = parseFloat(raw);
  if (isNaN(num) || raw.length < 2) return null;
  const rounded = roundHalf(num);
  return rounded !== num ? `stores as ${rounded.toFixed(1)}` : null;
}

function pressureLooksWrong(val: string, unit: 'psi' | 'bar' | 'kpa'): boolean {
  const n = parseFloat(val);
  if (isNaN(n) || val.length < 2) return false;
  if (unit === 'bar') return n < 1.0 || n > 4.1;
  if (unit === 'kpa')  return n < 100  || n > 414;
  return n < 15 || n > 60;
}

export default function QuickLogScreen({ navigation, route }: Props) {
  const { activeEvent, openSession, setActiveTab, setOpenSession, clearOpenSession, setLastEntry, incrementSession } = useEvent();
  const { weather } = useLocationAndWeather();
  const { displayPressure, pressureUnit, inputToPsi, displayTemp, tempUnit, settings } = useSettings();
  const ambientTempC = route?.params?.ambientTempC ?? weather?.temp_c ?? null;
  const fourCornerCold = settings.four_corner_cold;
  const coldStartRef = useRef<number>(Date.now());
  const hotStartRef = useRef<number>(Date.now());

  const mode: Mode = route?.params?.mode === 'hot' ? 'hot' : 'cold';

  // ── Cold state — axle mode ───────────────────────────────
  const [coldValues, setColdValues] = useState({ cf: '', cr: '' });
  const [activeColdField, setActiveColdField] = useState<'cf' | 'cr'>('cf');

  // ── Cold state — four corner mode ────────────────────────
  const [coldCornerValues, setColdCornerValues] = useState<Record<ColdCorner, string>>({
    fl: '', fr: '', rl: '', rr: '',
  });
  const [activeColdCorner, setActiveColdCorner] = useState<ColdCorner>('fl');

  const [savingCold, setSavingCold] = useState(false);

  // Tyre target operating temp fetched from tire_targets — falls back to 60°C
  const [tyreTempC, setTyreTempC] = useState(60);
  useEffect(() => {
    if (!activeEvent?.tire_front?.id) return;
    supabase
      .from('tire_targets')
      .select('target_temp_min_c, target_temp_max_c')
      .eq('tire_id', activeEvent.tire_front.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.target_temp_min_c != null && data?.target_temp_max_c != null) {
          setTyreTempC((data.target_temp_min_c + data.target_temp_max_c) / 2);
        }
      });
  }, [activeEvent?.tire_front?.id]);

  // ── Hot state ────────────────────────────────────────────
  const seedHotValues = useCallback((): Record<HotCorner, number> => {
    if (openSession) {
      const ambientC = openSession.ambient_session_start !== undefined
        ? openSession.ambient_session_start
        : undefined;

      const coldFL = openSession.cold_fl_psi ?? openSession.cold_front_psi;
      const coldFR = openSession.cold_fr_psi ?? openSession.cold_front_psi;
      const coldRL = openSession.cold_rl_psi ?? openSession.cold_rear_psi;
      const coldRR = openSession.cold_rr_psi ?? openSession.cold_rear_psi;

      return {
        fl: ambientC !== undefined ? predictHotRounded(coldFL, ambientC, tyreTempC) : openSession.predicted_hot_fl,
        fr: ambientC !== undefined ? predictHotRounded(coldFR, ambientC, tyreTempC) : openSession.predicted_hot_fr,
        rl: ambientC !== undefined ? predictHotRounded(coldRL, ambientC, tyreTempC) : openSession.predicted_hot_rl,
        rr: ambientC !== undefined ? predictHotRounded(coldRR, ambientC, tyreTempC) : openSession.predicted_hot_rr,
      };
    }
    return { fl: 36.0, fr: 36.0, rl: 33.5, rr: 33.5 };
  }, [openSession]);

  const [hotValues, setHotValues] = useState<Record<HotCorner, number>>(seedHotValues);
  const [activeCorner, setActiveCorner] = useState<HotCorner>('fl');

  useEffect(() => {
    if (openSession) setHotValues(seedHotValues());
  }, [openSession, seedHotValues]);

  useEffect(() => {
    if (mode === 'hot') hotStartRef.current = Date.now();
  }, [mode]);

  const [submitting, setSubmitting] = useState(false);
  const oem = activeEvent?.vehicle ?? null;

  // ── Cold numpad handler ──────────────────────────────────
  function handleColdNumPress(key: string) {
    if (fourCornerCold) {
      setColdCornerValues(prev => {
        const current = prev[activeColdCorner];
        let next: string;
        if (key === '⌫') {
          next = current.slice(0, -1);
        } else if (key === '.') {
          next = current.includes('.') ? current : current + '.';
        } else {
          if (current.length >= 4) return prev;
          next = current + key;
        }
        return { ...prev, [activeColdCorner]: next };
      });
    } else {
      setColdValues(prev => {
        const current = prev[activeColdField];
        let next: string;
        if (key === '⌫') {
          next = current.slice(0, -1);
        } else if (key === '.') {
          next = current.includes('.') ? current : current + '.';
        } else {
          if (current.length >= 4) return prev;
          next = current + key;
        }
        return { ...prev, [activeColdField]: next };
      });
    }
  }

  function coldDeltaPsi(axle: 'front' | 'rear'): number | null {
    const v = axle === 'front' ? parseFloat(coldValues.cf) : parseFloat(coldValues.cr);
    const ref = axle === 'front' ? oem?.oem_pressure_front : oem?.oem_pressure_rear;
    if (!v || !ref) return null;
    return Math.round((v - parseFloat(displayPressure(ref))) * 100) / 100;
  }

  function coldPrediction(): { front: number; rear: number } | null {
    if (fourCornerCold) {
      const fl = parseFloat(coldCornerValues.fl);
      const fr = parseFloat(coldCornerValues.fr);
      const rl = parseFloat(coldCornerValues.rl);
      const rr = parseFloat(coldCornerValues.rr);
      if (isNaN(fl) || isNaN(fr) || isNaN(rl) || isNaN(rr)) return null;
      const avgF = (inputToPsi(roundHalf(fl)) + inputToPsi(roundHalf(fr))) / 2;
      const avgR = (inputToPsi(roundHalf(rl)) + inputToPsi(roundHalf(rr))) / 2;
      const startC = ambientTempC ?? 20;
      return { front: predictHotRounded(avgF, startC, tyreTempC), rear: predictHotRounded(avgR, startC, tyreTempC) };
    }
    const cf = parseFloat(coldValues.cf);
    const cr = parseFloat(coldValues.cr);
    if (isNaN(cf) || isNaN(cr)) return null;
    const startC = ambientTempC ?? 20;
    return {
      front: predictHotRounded(inputToPsi(roundHalf(cf)), startC, tyreTempC),
      rear:  predictHotRounded(inputToPsi(roundHalf(cr)), startC, tyreTempC),
    };
  }

  // ── Save button state ────────────────────────────────────
  const canSaveCold = fourCornerCold
    ? Object.values(coldCornerValues).every(v => v.length > 0)
    : coldValues.cf.length > 0 && coldValues.cr.length > 0;

  function saveBtnLabel(): string {
    if (savingCold) return 'Saving…';
    if (canSaveCold) return 'Save — enter hot pressures after session';
    if (fourCornerCold) {
      if (!coldCornerValues.fl) return 'Enter front left pressure';
      if (!coldCornerValues.fr) return 'Enter front right pressure';
      if (!coldCornerValues.rl) return 'Enter rear left pressure';
      return 'Enter rear right pressure';
    }
    return !coldValues.cf ? 'Enter front axle pressure' : 'Enter rear axle pressure';
  }

  async function handleSaveCold() {
    if (!canSaveCold || !activeEvent) return;
    if (!weather && ambientTempC == null) {
      Alert.alert(
        'Weather not available',
        'Ambient temperature could not be fetched. Session will be saved without weather data — this may affect recommendation accuracy.',
        [
          { text: 'Save anyway', onPress: () => saveCold(activeEvent!) },
          { text: 'Wait', style: 'cancel' },
        ]
      );
      return;
    }
    saveCold(activeEvent);
  }

  async function saveCold(activeEvent: ActiveEvent) {
    setSavingCold(true);

    let coldF: number;
    let coldR: number;
    let coldFL: number | undefined;
    let coldFR: number | undefined;
    let coldRL: number | undefined;
    let coldRR: number | undefined;

    if (fourCornerCold) {
      coldFL = roundHalf(inputToPsi(parseFloat(coldCornerValues.fl)));
      coldFR = roundHalf(inputToPsi(parseFloat(coldCornerValues.fr)));
      coldRL = roundHalf(inputToPsi(parseFloat(coldCornerValues.rl)));
      coldRR = roundHalf(inputToPsi(parseFloat(coldCornerValues.rr)));
      coldF  = roundHalf((coldFL + coldFR) / 2);
      coldR  = roundHalf((coldRL + coldRR) / 2);
    } else {
      coldF = roundHalf(inputToPsi(parseFloat(coldValues.cf)));
      coldR = roundHalf(inputToPsi(parseFloat(coldValues.cr)));
    }

    const session: OpenSession = {
      id:                uuidv4(),
      event:             activeEvent,
      cold_front_psi:    coldF,
      cold_rear_psi:     coldR,
      cold_fl_psi:       coldFL,
      cold_fr_psi:       coldFR,
      cold_rl_psi:       coldRL,
      cold_rr_psi:       coldRR,
      predicted_hot_fl:  predictHotRounded(coldFL ?? coldF, ambientTempC ?? 20, tyreTempC),
      predicted_hot_fr:  predictHotRounded(coldFR ?? coldF, ambientTempC ?? 20, tyreTempC),
      predicted_hot_rl:  predictHotRounded(coldRL ?? coldR, ambientTempC ?? 20, tyreTempC),
      predicted_hot_rr:  predictHotRounded(coldRR ?? coldR, ambientTempC ?? 20, tyreTempC),
      saved_at:          new Date().toISOString(),
      ambient_temp_c:    ambientTempC ?? undefined,
      ambient_source:    ambientTempC != null ? 'auto' : undefined,
      cold_entry_duration_seconds: Math.round((Date.now() - coldStartRef.current) / 1000),
      is_hidden: !settings.community_contributions,
      historic_date: route?.params?.historic_date ?? undefined,
    };

    await setOpenSession(session);
    setSavingCold(false);
    navigation.navigate('ColdSaved');
  }

  // ── Hot stepper handler ──────────────────────────────────
  function handleHotStep(dir: 1 | -1) {
    setHotValues(prev => {
      const current = prev[activeCorner];
      const next = Math.round((current + dir * 0.5) * 10) / 10;
      return { ...prev, [activeCorner]: Math.max(20, Math.min(55, next)) };
    });
  }

  function axleSpread(axle: 'front' | 'rear'): number {
    const a = axle === 'front' ? hotValues.fl : hotValues.rl;
    const b = axle === 'front' ? hotValues.fr : hotValues.rr;
    return Math.abs(Math.round((a - b) * 10) / 10);
  }

  function axleSoak(axle: 'front' | 'rear'): number {
    const avg = axle === 'front'
      ? (hotValues.fl + hotValues.fr) / 2
      : (hotValues.rl + hotValues.rr) / 2;
    const cold = axle === 'front'
      ? (openSession?.cold_front_psi ?? 32)
      : (openSession?.cold_rear_psi  ?? 29);
    return Math.round((avg - cold) * 10) / 10;
  }

  async function handleSubmitHot() {
    if (!openSession || !activeEvent) return;
    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();

    const hotFrontAvg = roundHalf((hotValues.fl + hotValues.fr) / 2);
    const hotRearAvg  = roundHalf((hotValues.rl + hotValues.rr) / 2);

    const entry = {
      user_id:              user?.id,
      cold_front_psi:       openSession.cold_front_psi,
      cold_rear_psi:        openSession.cold_rear_psi,
      cold_fl_psi:          openSession.cold_fl_psi ?? null,
      cold_fr_psi:          openSession.cold_fr_psi ?? null,
      cold_rl_psi:          openSession.cold_rl_psi ?? null,
      cold_rr_psi:          openSession.cold_rr_psi ?? null,
      hot_fl_psi:           hotValues.fl,
      hot_fr_psi:           hotValues.fr,
      hot_rl_psi:           hotValues.rl,
      hot_rr_psi:           hotValues.rr,
      hot_front_psi:        hotFrontAvg,
      hot_rear_psi:         hotRearAvg,
      vehicle_id:           activeEvent.vehicle.id,
      tire_id:              activeEvent.tire_front.id,
      track_id:             activeEvent.track.id,
      session_type:         activeEvent.session_type,
      ambient_temp_c:       openSession.ambient_session_start ?? openSession.ambient_temp_c,
      ambient_temp_end_c:   weather?.temp_c ?? null,
      ambient_source:       openSession.ambient_source as 'auto' | 'manual',
      hot_entry_duration_seconds: Math.round((Date.now() - hotStartRef.current) / 1000),
      cold_entry_duration_seconds: openSession.cold_entry_duration_seconds ?? null,
      is_hidden: openSession.is_hidden ?? !settings.community_contributions,
      created_at: openSession.historic_date ?? new Date().toISOString(),
    };

    const signalScore = computeSignalScore(entry, activeEvent.tire_front.id);

    // Capture context before clearing
    const historicDate  = openSession.historic_date ?? null;
    const historicEvent = historicDate ? {
      vehicle:        activeEvent.vehicle,
      tireFront:      activeEvent.tire_front,
      tireRear:       activeEvent.tire_rear,
      tireSetName:    activeEvent.tire_set_name ?? '',
      selectedTrack:  activeEvent.track,
      selectedConfig: activeEvent.track_config ?? null,
      sessionType:    activeEvent.session_type,
      prefilled:      true,
    } : null;
    const tireLabel   = activeEvent.tire_front.brand + ' ' + activeEvent.tire_front.model;
    const trackConfig = activeEvent.track_config?.name ?? activeEvent.track.name;

    const entryId = uuidv4();
    try {
      await supabase
        .from('pressure_entries')
        .insert({ ...entry, id: entryId, signal_score: signalScore, created_at: historicDate ?? new Date().toISOString() });
    } catch {}

    setLastEntry({ ...entry, id: entryId });
    incrementSession();
    await clearOpenSession();
    setSubmitting(false);

    navigation.navigate('SessionNotes', {
      entryId,
      mode:        'pressures',
      trackConfig,
      tireLabel,
      sessionType: activeEvent.session_type,
      hotFL:       hotValues.fl,
      hotFR:       hotValues.fr,
      hotRL:       hotValues.rl,
      hotRR:       hotValues.rr,
      tempFL: null, tempFR: null, tempRL: null, tempRR: null,
      flInner: null, flMid: null, flOuter: null,
      frInner: null, frMid: null, frOuter: null,
      rlInner: null, rlMid: null, rlOuter: null,
      rrInner: null, rrMid: null, rrOuter: null,
      targetMin:    null,
      targetMax:    null,
      historicDate,
      historicEvent,
    });
  }

  async function handleSkipHot() {
    if (!openSession || !activeEvent) return;
    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();

    const entry = {
      user_id:        user?.id,
      cold_front_psi: openSession.cold_front_psi,
      cold_rear_psi:  openSession.cold_rear_psi,
      cold_fl_psi:    openSession.cold_fl_psi ?? null,
      cold_fr_psi:    openSession.cold_fr_psi ?? null,
      cold_rl_psi:    openSession.cold_rl_psi ?? null,
      cold_rr_psi:    openSession.cold_rr_psi ?? null,
      vehicle_id:     activeEvent.vehicle.id,
      tire_id:        activeEvent.tire_front.id,
      track_id:       activeEvent.track.id,
      session_type:   activeEvent.session_type,
      ambient_temp_c: openSession.ambient_session_start ?? openSession.ambient_temp_c,
      ambient_source: openSession.ambient_source as 'auto' | 'manual',
      hot_entry_duration_seconds: Math.round((Date.now() - hotStartRef.current) / 1000),
      cold_entry_duration_seconds: openSession.cold_entry_duration_seconds ?? null,
      created_at: openSession.historic_date ?? new Date().toISOString(),
    };

    const signalScore = computeSignalScore(entry, activeEvent.tire_front.id);

    // Capture context before clearing
    const historicDateSkip  = openSession.historic_date ?? null;
    const historicEventSkip = historicDateSkip ? {
      vehicle:        activeEvent.vehicle,
      tireFront:      activeEvent.tire_front,
      tireRear:       activeEvent.tire_rear,
      tireSetName:    activeEvent.tire_set_name ?? '',
      selectedTrack:  activeEvent.track,
      selectedConfig: activeEvent.track_config ?? null,
      sessionType:    activeEvent.session_type,
      prefilled:      true,
    } : null;
    const tileLabelSkip   = activeEvent.tire_front.brand + ' ' + activeEvent.tire_front.model;
    const trackConfigSkip = activeEvent.track_config?.name ?? activeEvent.track.name;

    const entryIdSkip = uuidv4();
    try {
      await supabase
        .from('pressure_entries')
        .insert({ ...entry, id: entryIdSkip, signal_score: signalScore });
    } catch {}

    setLastEntry(entry);
    incrementSession();
    await clearOpenSession();
    setSubmitting(false);

    navigation.navigate('SessionNotes', {
      entryId:     entryIdSkip,
      mode:        'pressures',
      trackConfig: trackConfigSkip,
      tireLabel:   tileLabelSkip,
      sessionType: activeEvent.session_type,
      hotFL: null, hotFR: null, hotRL: null, hotRR: null,
      tempFL: null, tempFR: null, tempRL: null, tempRR: null,
      flInner: null, flMid: null, flOuter: null,
      frInner: null, frMid: null, frOuter: null,
      rlInner: null, rlMid: null, rlOuter: null,
      rrInner: null, rrMid: null, rrOuter: null,
      targetMin:    null,
      targetMax:    null,
      historicDate:  historicDateSkip,
      historicEvent: historicEventSkip,
    });
  }

  const dF = coldDeltaPsi('front');
  const dR = coldDeltaPsi('rear');
  const pred = coldPrediction();

  // ── COLD MODE RENDER ─────────────────────────────────────
  if (mode === 'cold') {
    return (
      <SafeAreaView style={globalStyles.screen}>
        <View style={styles.topBar}>
          <View>
            <Text style={typography.subhead}>Before session</Text>
            <Text style={[typography.caption, { color: colors.accent }]}>
              Step 1 of 2 · cold pressures
            </Text>
          </View>
          <TouchableOpacity onPress={() => {
            if (openSession) {
              setActiveTab('history');
              navigation.navigate('HistoryTab');
            } else {
              navigation.navigate('EventSetup');
            }
          }}>
            <Text style={[typography.caption, { color: colors.accent }]}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.pillRow}>
          {activeEvent && (
            <>
              <ContextPill label={activeEvent.track_config?.name ?? activeEvent.track.name} auto />
              <ContextPill label={activeEvent.tire_front.compound} auto={false} />
            </>
          )}
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {fourCornerCold ? (
            // ── Four corner cold entry ──────────────────────
            <>
              <Text style={[typography.caption, {
                textAlign: 'center', color: colors.textMuted, marginBottom: spacing.sm,
              }]}>
                Front of car ↑
              </Text>
              <View style={styles.cornerGrid}>
                {(['fl', 'fr', 'rl', 'rr'] as ColdCorner[]).map(corner => {
                  const val = coldCornerValues[corner];
                  const isActive = activeColdCorner === corner;
                  return (
                    <TouchableOpacity
                      key={corner}
                      style={[styles.coldCornerBox, isActive && styles.coldCornerBoxActive]}
                      onPress={() => setActiveColdCorner(corner)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.coldCornerLabel, isActive && styles.coldCornerLabelActive]}>
                        {COLD_CORNER_LABELS[corner]}
                      </Text>
                      <Text style={[
                        styles.coldCornerVal,
                        { color: pressureLooksWrong(val, settings.pressure_unit)
                            ? colors.danger
                            : isActive
                              ? colors.accent
                              : val.length > 0
                                ? colors.success
                                : colors.textMuted },
                      ]}>
                        {val.length > 0 ? val : '—'}
                      </Text>
                      <Text style={[
                        styles.coldCornerSub,
                        pressureLooksWrong(val, settings.pressure_unit) && { color: colors.danger },
                      ]}>
                        {pressureLooksWrong(val, settings.pressure_unit) ? '⚠ check' : val.length > 0 ? pressureUnit() : 'tap to enter'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : (
            // ── Axle cold entry — vertical layout ───────────
            <>
              <Text style={globalStyles.sectionLabel}>
                Cold pressures — per axle ({pressureUnit()})
              </Text>
              <View style={styles.axleWrap}>
                <View style={styles.axleArrow}>
                  <Text style={styles.axleArrowTop}>↑</Text>
                  <View style={styles.axleArrowLine} />
                  <Text style={styles.axleArrowLabel}>front</Text>
                  <View style={styles.axleArrowLine} />
                </View>
                <View style={styles.axleBoxes}>
                  {(['cf', 'cr'] as const).map(field => {
                    const val    = coldValues[field];
                    const isActive = activeColdField === field;
                    const warn   = pressureLooksWrong(val, settings.pressure_unit);
                    const label  = field === 'cf' ? 'Front axle' : 'Rear axle';
                    const sub    = warn ? '⚠ check value' : coldStoredHint(val) ?? 'both sides';
                    return (
                      <TouchableOpacity
                        key={field}
                        style={[styles.coldCornerBox, isActive && styles.coldCornerBoxActive]}
                        onPress={() => setActiveColdField(field)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.coldCornerLabel, isActive && styles.coldCornerLabelActive]}>
                          {label}
                        </Text>
                        <Text style={[
                          styles.coldCornerVal,
                          { color: warn
                              ? colors.danger
                              : isActive
                                ? colors.accent
                                : val.length > 0
                                  ? colors.success
                                  : colors.textMuted },
                        ]}>
                          {val.length > 0 ? val : '—'}
                        </Text>
                        <Text style={[
                          styles.coldCornerSub,
                          warn && { color: colors.danger },
                        ]}>
                          {sub}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {oem && (dF !== null || dR !== null) && (
                <View style={styles.deltaRow}>
                  <Text style={[typography.caption, { flex: 1 }]}>
                    vs OEM ({displayPressure(oem.oem_pressure_front)} / {displayPressure(oem.oem_pressure_rear)} {pressureUnit()})
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {dF !== null && <DeltaBadge value={dF} label="F" size="sm" />}
                    {dR !== null && <DeltaBadge value={dR} label="R" size="sm" />}
                  </View>
                </View>
              )}
            </>
          )}

          {pred && (
            <View style={styles.predRow}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Predicted hot based on ambient {ambientTempC != null ? `${displayTemp(ambientTempC)}${tempUnit()}` : `20${tempUnit()} (default)`}:
              </Text>
              <Text style={[typography.caption, { color: colors.warning, fontWeight: '600' }]}>
                {' '}F {displayPressure(pred.front)} · R {displayPressure(pred.rear)} {pressureUnit()} per corner
              </Text>
            </View>
          )}

        </ScrollView>

        <NumPad onPress={handleColdNumPress} />

        <View style={styles.submitRow}>
          <TouchableOpacity
            style={[styles.submitBtn, !canSaveCold && styles.submitBtnDisabled]}
            onPress={handleSaveCold}
            disabled={!canSaveCold || savingCold}
          >
            <Text style={[styles.submitBtnText, !canSaveCold && styles.submitBtnTextDisabled]}>
              {saveBtnLabel()}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── HOT MODE RENDER ──────────────────────────────────────
  const activeAxle = activeCorner.startsWith('f') ? 'front' : 'rear';
  const spread = axleSpread(activeAxle);
  const soak   = axleSoak(activeAxle);

  return (
    <SafeAreaView style={globalStyles.screen}>
      <View style={styles.topBar}>
        <View>
          <Text style={typography.subhead}>After session</Text>
          <Text style={[typography.caption, { color: colors.warning }]}>
            Step 2 of 2 · hot pressures — four corners
          </Text>
        </View>
        <TouchableOpacity onPress={() => {
            setActiveTab('history');
            navigation.navigate('HistoryTab');
          }}>
            <Text style={[typography.caption, { color: colors.accent }]}>Cancel</Text>
          </TouchableOpacity>
      </View>

      {openSession && openSession.ambient_session_start === undefined && (
        <View style={[styles.coldRefRow, { justifyContent: 'center' }]}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[typography.caption, { color: colors.textMuted, marginLeft: spacing.sm }]}>
            Updating ambient temperature…
          </Text>
        </View>
      )}
      {openSession && openSession.ambient_session_start !== undefined && (
        <View style={styles.coldRefRow}>
          {[
            { label: 'Cold F', val: openSession.cold_front_psi },
            { label: 'Cold R', val: openSession.cold_rear_psi },
            { label: 'Pred FL/FR', val: openSession.predicted_hot_fl, warm: true },
            { label: 'Pred RL/RR', val: openSession.predicted_hot_rl, warm: true },
            ...(weather ? [{ label: 'Ambient', val: null, temp: weather.temp_c }] : []),
          ].map(({ label, val, warm, temp }: any) => (
            <View key={label} style={styles.refChip}>
              <Text style={styles.refChipLabel}>{label}</Text>
              <Text style={[styles.refChipVal, warm && { color: colors.warning }]}>
                {temp !== undefined ? `${displayTemp(temp)}${tempUnit()}` : displayPressure(val)}
              </Text>
            </View>
          ))}
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Text style={[typography.caption, { textAlign: 'center', marginBottom: spacing.sm, color: colors.textMuted }]}>
          Front of car ↑
        </Text>

        <View style={styles.cornerGrid}>
          {(['fl', 'fr', 'rl', 'rr'] as HotCorner[]).map(corner => {
            const val = hotValues[corner];
            const isActive = activeCorner === corner;
            return (
              <TouchableOpacity
                key={corner}
                style={[styles.cornerBox, isActive && styles.cornerBoxActive]}
                onPress={() => setActiveCorner(corner)}
                activeOpacity={0.7}
              >
                <Text style={[styles.cornerAxis, isActive && styles.cornerAxisActive]}>
                  {CORNER_LABELS[corner]}
                </Text>
                <Text style={[styles.cornerNum, isActive && styles.cornerNumActive]}>
                  {displayPressure(val)}
                </Text>
                <Text style={styles.cornerSub}>{pressureUnit()} hot</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.diagRow}>
          <View style={styles.diagChip}>
            <Text style={styles.diagLabel}>{activeAxle} spread</Text>
            <Text style={[
              styles.diagVal,
              spread <= 0.5 ? styles.diagGood : spread <= 1.5 ? styles.diagWarn : styles.diagBad,
            ]}>
              {displayPressure(spread)} {pressureUnit()}
            </Text>
          </View>
          <View style={styles.diagChip}>
            <Text style={styles.diagLabel}>{activeAxle} soak</Text>
            <Text style={styles.diagVal}>+{displayPressure(soak)} {pressureUnit()}</Text>
          </View>
        </View>

        <View style={styles.stepperWrap}>
          <Text style={[typography.caption, { textAlign: 'center', marginBottom: spacing.sm, color: colors.textSecondary }]}>
            {CORNER_LABELS[activeCorner]} ·{' '}
            predicted{' '}
            <Text style={{ color: colors.warning, fontWeight: '600' }}>
              {(activeCorner.startsWith('f')
                ? openSession?.predicted_hot_fl
                : openSession?.predicted_hot_rl
              ) != null
                ? displayPressure(activeCorner.startsWith('f')
                    ? openSession!.predicted_hot_fl
                    : openSession!.predicted_hot_rl)
                : '—'} {pressureUnit()}
            </Text>
          </Text>

          <View style={styles.stepperRow}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => handleHotStep(-1)}>
              <Text style={styles.stepBtnText}>−</Text>
            </TouchableOpacity>
            <View style={styles.stepDisplay}>
              <Text style={styles.stepDisplayText}>{displayPressure(hotValues[activeCorner])}</Text>
            </View>
            <TouchableOpacity style={styles.stepBtn} onPress={() => handleHotStep(1)}>
              <Text style={styles.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.skipRow} onPress={handleSkipHot} disabled={submitting}>
          <Text style={styles.skipText}>Skip — save cold pressures only</Text>
        </TouchableOpacity>

      </ScrollView>

      <View style={styles.submitRow}>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmitHot}
          disabled={submitting}
        >
          <Text style={[styles.submitBtnText, submitting && styles.submitBtnTextDisabled]}>
            {submitting ? 'Saving…' : 'Complete session'}
          </Text>
        </TouchableOpacity>
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
  pillRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  content: { padding: spacing.lg, paddingBottom: spacing.lg },

  // Axle vertical layout
  axleWrap: {
    flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm, marginBottom: spacing.sm,
  },
  axleArrow: {
    alignItems: 'center', justifyContent: 'center',
    gap: 3, paddingVertical: spacing.sm, width: 16,
  },
  axleArrowTop: { fontSize: 10, color: colors.textMuted },
  axleArrowLine: { flex: 1, width: 0.5, backgroundColor: colors.border },
  axleArrowLabel: {
    fontSize: 9, color: colors.textMuted,
    letterSpacing: 0.04,
    width: 40,
    textAlign: 'center',
  },
  axleBoxes: { flex: 1, gap: spacing.sm },

  // Cold corner grid
  cornerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  coldCornerBox: {
    width: '47%', backgroundColor: colors.bgInput,
    borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border,
    padding: spacing.md,
  },
  coldCornerBoxActive: {
    borderColor: colors.accent, borderWidth: 1.5,
    backgroundColor: colors.accentSubtle,
  },
  coldCornerLabel: {
    fontSize: 10, color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3,
  },
  coldCornerLabelActive: { color: colors.accent },
  coldCornerVal: {
    fontSize: 24, fontWeight: '500', color: colors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
  },
  coldCornerValActive: { color: colors.accent },
  coldCornerSub: { fontSize: 10, color: colors.textMuted, marginTop: 3 },

  // Cold axle mode
  boxRow: { flexDirection: 'row' },
  deltaRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: spacing.md, paddingTop: spacing.md,
    borderTopWidth: 0.5, borderTopColor: colors.border,
  },
  predRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    marginTop: spacing.sm, paddingTop: spacing.sm,
    borderTopWidth: 0.5, borderTopColor: colors.border,
  },

  // Hot reference strip
  coldRefRow: {
    flexDirection: 'row', gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: 4,
    backgroundColor: colors.bgHighlight,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  refChip: {
    flex: 1, backgroundColor: colors.bgCard,
    borderRadius: radius.sm, borderWidth: 0.5, borderColor: colors.border,
    paddingVertical: 4, paddingHorizontal: 4, alignItems: 'center',
  },
  refChipLabel: { fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 1 },
  refChipVal: { fontSize: 11, fontWeight: '500', color: colors.textPrimary, fontVariant: ['tabular-nums'] as any },

  // Hot corner grid
  cornerBox: {
    width: '47%', backgroundColor: colors.bgInput,
    borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border,
    padding: spacing.md,
  },
  cornerBoxActive: {
    borderColor: colors.warning, borderWidth: 1.5,
    backgroundColor: colors.warningSubtle,
  },
  cornerAxis: { fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  cornerAxisActive: { color: colors.warning },
  cornerNum: { fontSize: 26, fontWeight: '500', color: colors.textPrimary, fontVariant: ['tabular-nums'] as any },
  cornerNumActive: { color: colors.warning },
  cornerSub: { fontSize: 10, color: colors.textMuted, marginTop: 3 },

  // Diagnostics
  diagRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  diagChip: {
    flex: 1, backgroundColor: colors.bgCard,
    borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border,
    padding: spacing.md, alignItems: 'center',
  },
  diagLabel: { fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  diagVal: { fontSize: 15, fontWeight: '500', color: colors.textPrimary, fontVariant: ['tabular-nums'] as any },
  diagGood: { color: colors.success },
  diagWarn: { color: colors.warning },
  diagBad:  { color: colors.danger },

  // Stepper
  stepperWrap: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 0.5, borderColor: colors.border, padding: spacing.md,
    marginBottom: spacing.md,
  },
  stepperRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: radius.md, overflow: 'hidden',
    borderWidth: 0.5, borderColor: colors.border,
  },
  stepBtn: {
    flex: 1, backgroundColor: colors.bgHighlight,
    paddingVertical: spacing.lg, alignItems: 'center',
  },
  stepBtnText: { fontSize: 26, fontWeight: '300', color: colors.textPrimary },
  stepDisplay: {
    flex: 2, backgroundColor: colors.warningSubtle,
    borderLeftWidth: 0.5, borderRightWidth: 0.5, borderColor: colors.border,
    paddingVertical: spacing.md, alignItems: 'center',
  },
  stepDisplayText: { fontSize: 26, fontWeight: '500', color: colors.warning, fontVariant: ['tabular-nums'] as any },

  skipRow: { alignItems: 'center', paddingVertical: spacing.sm },
  skipText: { fontSize: 12, color: colors.textSecondary, textDecorationLine: 'underline' },

  submitRow: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderTopWidth: 0.5, borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  submitBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg, paddingVertical: 15,
    alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: colors.bgHighlight },
  submitBtnText: { fontSize: 16, fontWeight: '600', color: '#000' },
  submitBtnTextDisabled: { color: colors.textMuted },
});
