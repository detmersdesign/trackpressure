import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, typography, spacing, radius, globalStyles } from '../lib/theme';
import { TabletNumPad } from '../components/TabletNumPad';
import { useEvent } from '../hooks/useEventContext';
import { useSettings } from '../hooks/useSettings';
import { useLocationAndWeather } from '../hooks/useLocationAndWeather';
import { supabase } from '../lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

type Corner = 'fl' | 'fr' | 'rr' | 'rl';

interface CornerState {
  psi:    number;
  mid:    number | null;
  inner:  number | null;
  outer:  number | null;
  inputting: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Grid display order — mirrors physical car layout viewed from above
const GRID_ORDER: Corner[] = ['fl', 'fr', 'rl', 'rr'];

// Entry sequence — clockwise walk around car
const SEQUENCE: Corner[] = ['fl', 'fr', 'rr', 'rl'];

const LABELS: Record<Corner, string> = {
  fl: 'Front left', fr: 'Front right',
  rl: 'Rear left',  rr: 'Rear right',
};

const LABELS_SHORT: Record<Corner, string> = {
  fl: 'FL', fr: 'FR', rl: 'RL', rr: 'RR',
};

// Left-side tires: inner is physically closer to car centre = right side of card
// Card renders: outer | mid | inner
const IS_LEFT: Record<Corner, boolean> = {
  fl: true, fr: false, rl: true, rr: false,
};

const PSI_SEEDS: Record<Corner, number> = {
  fl: 34.5, fr: 34.0, rl: 31.5, rr: 32.0,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function roundHalf(v: number): number {
  return Math.round(v * 2) / 2;
}

function globalAvg(corners: Record<Corner, CornerState>): number | null {
  const vals: number[] = [];
  GRID_ORDER.forEach(c => {
    const s = corners[c];
    if (s.inner !== null && s.mid !== null && s.outer !== null) {
      vals.push(s.inner, s.mid, s.outer);
    }
  });
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// Returns rgb string relative to global average, ±TEMP_SCALE = full range
function tempToColor(temp: number, avg: number, scale: number): string {
  const ratio = Math.max(0, Math.min(1, 0.5 + (temp - avg) / (scale * 2)));
  if (ratio <= 0.5) {
    const t = ratio * 2;
    return `rgb(${Math.round(40+t*215)},${Math.round(120+t*135)},${Math.round(220+t*35)})`;
  } else {
    const t = (ratio - 0.5) * 2;
    return `rgb(255,${Math.round(255-t*255)},${Math.round(255-t*255)})`;
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function HotGradientEntryScreen({ navigation }: Props) {
  const { activeEvent, openSession, setLastEntry, incrementSession, clearOpenSession } = useEvent();
  const { weather } = useLocationAndWeather();
  const { displayPressure, pressureUnit, displayTemp, tempUnit, inputToPsi, inputToC, settings } = useSettings();
  const hotStartRef = useRef<number>(Date.now());

  // Colour scale: ±10°F from global average = full blue→red
  const tempScale = settings.temperature_unit === 'f' ? 10 : 6;

  // Seed PSI from openSession predictions if available
  const seedPsi = useCallback((c: Corner): number => {
    if (!openSession) return PSI_SEEDS[c];
    const map: Record<Corner, number> = {
      fl: openSession.predicted_hot_fl,
      fr: openSession.predicted_hot_fr,
      rr: openSession.predicted_hot_rr,
      rl: openSession.predicted_hot_rl,
    };
    return map[c];
  }, [openSession]);

  const [corners, setCorners] = useState<Record<Corner, CornerState>>(() => {
    const init: Partial<Record<Corner, CornerState>> = {};
    GRID_ORDER.forEach(c => {
      init[c] = { psi: seedPsi(c), mid: null, inner: null, outer: null, inputting: '' };
    });
    return init as Record<Corner, CornerState>;
  });

  // Re-seed PSI if openSession wasn't available on first mount (cold start race condition)
  const seededRef = useRef(false);
  useEffect(() => {
    if (!openSession || seededRef.current) return;
    seededRef.current = true;
    setCorners(prev => {
      const updated: Partial<Record<Corner, CornerState>> = {};
      GRID_ORDER.forEach(c => {
        updated[c] = { ...prev[c], psi: seedPsi(c) };
      });
      return updated as Record<Corner, CornerState>;
    });
  }, [openSession]);

  const [activeCorner, setActiveCorner] = useState<Corner>('fl');
  const [submitting, setSubmitting]     = useState(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  const avg        = globalAvg(corners);
  const allSeeded  = SEQUENCE.every(c => corners[c].mid !== null);
  const seqIdx     = SEQUENCE.indexOf(activeCorner);
  const npHint     = allSeeded
    ? 'All corners entered — adjust inner/outer as needed'
    : `${LABELS_SHORT[activeCorner]} mid temp — type then confirm`;

  // ── Setters ───────────────────────────────────────────────────────────────
  function setCorner(c: Corner, update: Partial<CornerState>) {
    setCorners(prev => ({ ...prev, [c]: { ...prev[c], ...update } }));
  }

  function activateMid(c: Corner) {
    setActiveCorner(c);
    setCorner(c, { inputting: corners[c].mid !== null ? String(corners[c].mid) : '' });
  }

  function handleNumPress(key: string) {
    const current = corners[activeCorner].inputting;
    let next: string;
    if (key === '⌫') {
      next = current.slice(0, -1);
    } else {
      if (current.length >= 3) return;
      next = current + key;
    }
    setCorner(activeCorner, { inputting: next });
  }

  function handleNumConfirm() {
    const inp = corners[activeCorner].inputting;
    const v   = parseInt(inp);
    const minTemp = settings.temperature_unit === 'f' ? 50 : 10;
    const maxTemp = settings.temperature_unit === 'f' ? 350 : 175;
    if (isNaN(v) || v < minTemp || v > maxTemp) return;
    setCorner(activeCorner, { mid: v, inner: v, outer: v, inputting: '' });
    const idx = SEQUENCE.indexOf(activeCorner);
    if (idx < SEQUENCE.length - 1) {
      const next = SEQUENCE[idx + 1];
      setActiveCorner(next);
      setCorner(next, { inputting: '' });
    }
  }

  function stepPsi(c: Corner, dir: 1 | -1) {
    setCorner(c, { psi: Math.round((corners[c].psi + dir * 0.5) * 10) / 10 });
  }

  function stepEdge(c: Corner, edge: 'inner' | 'outer', dir: 1 | -1) {
    const current = corners[c][edge];
    if (current === null) return;
    setCorner(c, { [edge]: Math.round(current + dir) });
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!activeEvent || !openSession || !allSeeded) return;
    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();

    const hotFL = roundHalf(inputToPsi(corners.fl.psi));
    const hotFR = roundHalf(inputToPsi(corners.fr.psi));
    const hotRL = roundHalf(inputToPsi(corners.rl.psi));
    const hotRR = roundHalf(inputToPsi(corners.rr.psi));

    const entry = {
      user_id:                    user?.id,
      cold_front_psi:             openSession.cold_front_psi,
      cold_rear_psi:              openSession.cold_rear_psi,
      cold_fl_psi:                openSession.cold_fl_psi    ?? null,
      cold_fr_psi:                openSession.cold_fr_psi    ?? null,
      cold_rl_psi:                openSession.cold_rl_psi    ?? null,
      cold_rr_psi:                openSession.cold_rr_psi    ?? null,
      hot_fl_psi:                 hotFL,
      hot_fr_psi:                 hotFR,
      hot_rl_psi:                 hotRL,
      hot_rr_psi:                 hotRR,
      hot_front_psi:              roundHalf((hotFL + hotFR) / 2),
      hot_rear_psi:               roundHalf((hotRL + hotRR) / 2),
      // Tier 1 single temps
      tyre_temp_hot_fl_c:         corners.fl.mid   != null ? inputToC(corners.fl.mid)   : null,
      tyre_temp_hot_fr_c:         corners.fr.mid   != null ? inputToC(corners.fr.mid)   : null,
      tyre_temp_hot_rl_c:         corners.rl.mid   != null ? inputToC(corners.rl.mid)   : null,
      tyre_temp_hot_rr_c:         corners.rr.mid   != null ? inputToC(corners.rr.mid)   : null,
      // Tier 2 inner/mid/outer
      tyre_temp_hot_fl_inner_c:   corners.fl.inner != null ? inputToC(corners.fl.inner) : null,
      tyre_temp_hot_fl_mid_c:     corners.fl.mid   != null ? inputToC(corners.fl.mid)   : null,
      tyre_temp_hot_fl_outer_c:   corners.fl.outer != null ? inputToC(corners.fl.outer) : null,
      tyre_temp_hot_fr_inner_c:   corners.fr.inner != null ? inputToC(corners.fr.inner) : null,
      tyre_temp_hot_fr_mid_c:     corners.fr.mid   != null ? inputToC(corners.fr.mid)   : null,
      tyre_temp_hot_fr_outer_c:   corners.fr.outer != null ? inputToC(corners.fr.outer) : null,
      tyre_temp_hot_rl_inner_c:   corners.rl.inner != null ? inputToC(corners.rl.inner) : null,
      tyre_temp_hot_rl_mid_c:     corners.rl.mid   != null ? inputToC(corners.rl.mid)   : null,
      tyre_temp_hot_rl_outer_c:   corners.rl.outer != null ? inputToC(corners.rl.outer) : null,
      tyre_temp_hot_rr_inner_c:   corners.rr.inner != null ? inputToC(corners.rr.inner) : null,
      tyre_temp_hot_rr_mid_c:     corners.rr.mid   != null ? inputToC(corners.rr.mid)   : null,
      tyre_temp_hot_rr_outer_c:   corners.rr.outer != null ? inputToC(corners.rr.outer) : null,
      // Cold temps from open session if entered
      tyre_temp_cold_fl_c:        openSession.cold_fl_temp_c ?? null,
      tyre_temp_cold_fr_c:        openSession.cold_fr_temp_c ?? null,
      tyre_temp_cold_rl_c:        openSession.cold_rl_temp_c ?? null,
      tyre_temp_cold_rr_c:        openSession.cold_rr_temp_c ?? null,
      vehicle_id:                 activeEvent.vehicle.id,
      tire_id:                    activeEvent.tire_front.id,
      track_id:                   activeEvent.track.id,
      session_type:               activeEvent.session_type,
      ambient_temp_c:             openSession.ambient_session_start ?? openSession.ambient_temp_c,
      ambient_temp_end_c:         weather?.temp_c ?? null,
      ambient_source:             openSession.ambient_source as 'auto' | 'manual',
      hot_entry_duration_seconds:  Math.round((Date.now() - hotStartRef.current) / 1000),
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

  // ── Gradient bar colours ──────────────────────────────────────────────────
  function gradColors(c: Corner): { left: string; mid: string; right: string } | null {
    const s   = corners[c];
    const a   = avg;
    if (s.mid === null || a === null) return null;
    const isLeft   = IS_LEFT[c];
    const leftVal  = isLeft ? (s.outer ?? s.mid) : (s.inner ?? s.mid);
    const rightVal = isLeft ? (s.inner ?? s.mid) : (s.outer ?? s.mid);
    return {
      left:  tempToColor(leftVal,  a, tempScale),
      mid:   tempToColor(s.mid,    a, tempScale),
      right: tempToColor(rightVal, a, tempScale),
    };
  }

  // ── Corner card ───────────────────────────────────────────────────────────
  function CornerCard({ c }: { c: Corner }) {
    const s        = corners[c];
    const isActive = c === activeCorner;
    const isLeft   = IS_LEFT[c];
    const seeded   = s.mid !== null;
    const grad     = gradColors(c);

    function EdgeSection({ edge }: { edge: 'inner' | 'outer' }) {
      const val = s[edge];
      return (
        <View style={styles.edgeCol}>
          <Text style={styles.edgeLabel}>{edge}</Text>
          <TouchableOpacity
            style={[styles.edgeSBtn, !seeded && styles.edgeSBtnDisabled]}
            onPress={() => stepEdge(c, edge, 1)}
            disabled={!seeded}
          >
            <Text style={styles.edgeSBtnText}>+</Text>
          </TouchableOpacity>
          <Text style={[styles.edgeVal, seeded && styles.edgeValOn]}>
            {val !== null ? val : '—'}
          </Text>
          <TouchableOpacity
            style={[styles.edgeSBtn, !seeded && styles.edgeSBtnDisabled]}
            onPress={() => stepEdge(c, edge, -1)}
            disabled={!seeded}
          >
            <Text style={styles.edgeSBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.edgeUnit}>°{settings.temperature_unit.toUpperCase()}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.ccard, isActive && styles.ccardActive]}>
        {/* Header */}
        <View style={styles.ch}>
          <Text style={[styles.clabel, isActive && styles.clabelActive]}>
            {LABELS[c]}
          </Text>
          <Text style={[
            styles.cbadge,
            seeded && { color: colors.success, backgroundColor: colors.successSubtle },
          ]}>
            {seeded ? 'done' : 'enter mid temp'}
          </Text>
        </View>

        {/* PSI stepper */}
        <View style={styles.psiRow}>
          <Text style={styles.psiLabel}>PSI</Text>
          <TouchableOpacity style={styles.sbtn} onPress={() => stepPsi(c, -1)}>
            <Text style={styles.sbtnText}>−</Text>
          </TouchableOpacity>
          <Text style={[styles.stepVal, !isActive && styles.stepValMuted]}>
            {displayPressure(s.psi)}
          </Text>
          <TouchableOpacity style={styles.sbtn} onPress={() => stepPsi(c, 1)}>
            <Text style={styles.sbtnText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Temps — left tire: outer|mid|inner, right tire: inner|mid|outer */}
        <View style={styles.tempsRow}>
          {isLeft ? <EdgeSection edge="outer" /> : <EdgeSection edge="inner" />}

          {/* Mid — numpad entry */}
          <TouchableOpacity
            style={[
              styles.midBox,
              isActive && styles.midBoxActive,
              seeded && !isActive && styles.midBoxSeeded,
            ]}
            onPress={() => activateMid(c)}
          >
            <Text style={styles.midLabel}>Mid</Text>
            <Text style={[
              styles.midVal,
              isActive && { color: colors.warning },
              seeded && !isActive && { color: colors.success },
            ]}>
              {s.inputting.length > 0 && isActive
                ? s.inputting
                : s.mid !== null ? s.mid : '—'}
            </Text>
            <Text style={styles.midUnit}>
              {isActive ? 'numpad active' : seeded ? `°${settings.temperature_unit.toUpperCase()}` : 'tap to enter'}
            </Text>
          </TouchableOpacity>

          {isLeft ? <EdgeSection edge="inner" /> : <EdgeSection edge="outer" />}
        </View>

        {/* Gradient bar */}
        <View style={styles.gradWrap}>
          <View style={styles.gradLabels}>
            <Text style={styles.gradLbl}>{isLeft ? 'outer' : 'inner'}</Text>
            <Text style={styles.gradLbl}>{isLeft ? 'inner' : 'outer'}</Text>
          </View>
          <View style={styles.gradTrack}>
            {grad ? (
              <View
                style={[
                  styles.gradFill,
                  {
                    // React Native doesn't support CSS linear-gradient — simulate with
                    // three overlapping views at left/centre/right positions
                  },
                ]}
              >
                <View style={[styles.gradSeg, { backgroundColor: grad.left }]} />
                <View style={[styles.gradSeg, { backgroundColor: grad.mid }]} />
                <View style={[styles.gradSeg, { backgroundColor: grad.right }]} />
              </View>
            ) : (
              <View style={[styles.gradFill, { backgroundColor: colors.bgHighlight }]} />
            )}
            {/* Mid marker */}
            {seeded && (
              <View style={styles.gradMarker} />
            )}
          </View>
        </View>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={globalStyles.screen}>

      {/* Top bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={typography.subhead}>After session — hot entry</Text>
          <Text style={[typography.caption, { color: colors.warning }]}>
            Pressure + tire gradient · enter mid temp first
          </Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('HistoryTab')}>
          <Text style={[typography.caption, { color: colors.accent }]}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Reference strip */}
      {openSession && (
        <View style={styles.refStrip}>
          {[
            { label: 'Cold F',     val: displayPressure(openSession.cold_front_psi) },
            { label: 'Cold R',     val: displayPressure(openSession.cold_rear_psi) },
            { label: 'Pred FL/FR', val: displayPressure(openSession.predicted_hot_fl), warm: true },
            { label: 'Pred RL/RR', val: displayPressure(openSession.predicted_hot_rl), warm: true },
            ...(weather ? [{ label: 'Ambient', val: `${displayTemp(weather.temp_c)}${tempUnit()}` }] : []),
          ].map(({ label, val, warm }: any) => (
            <View key={label} style={styles.refChip}>
              <Text style={styles.refChipLabel}>{label}</Text>
              <Text style={[styles.refChipVal, warm && { color: colors.warning }]}>{val}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.carLabel}>Front of car ↑</Text>

      {/* 2×2 corner grid */}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {GRID_ORDER.map(c => <CornerCard key={c} c={c} />)}
        </View>

        {/* Global avg label */}
        {avg !== null && (
          <Text style={styles.avgLabel}>
            Colour scale centred on {Math.round(avg)}°{settings.temperature_unit.toUpperCase()} — average of all entered temps
          </Text>
        )}
      </ScrollView>

      {/* Numpad */}
      <View style={styles.numpadHint}>
        <Text style={styles.numpadHintText}>{npHint}</Text>
      </View>
      <TabletNumPad
        onPress={handleNumPress}
        onConfirm={handleNumConfirm}
      />

      {/* Submit */}
      <View style={styles.submitRow}>
        <TouchableOpacity
          style={[styles.submitBtn, (!allSeeded || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!allSeeded || submitting}
        >
          <Text style={[styles.submitBtnText, (!allSeeded || submitting) && styles.submitBtnTextDisabled]}>
            {submitting ? 'Saving…' : 'Complete session'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipRow} onPress={() => navigation.navigate('HistoryTab')}>
          <Text style={styles.skipText}>skip — pressure only</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  refStrip: {
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
  refChipLabel: { fontSize: 8, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 1 },
  refChipVal:   { fontSize: 11, fontWeight: '500', color: colors.textPrimary, fontVariant: ['tabular-nums'] as any },
  carLabel: {
    fontSize: 10, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.sm,
  },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
  },

  // Corner card
  ccard: {
    width: '48.5%',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg, borderWidth: 0.5, borderColor: colors.border,
    padding: spacing.sm,
  },
  ccardActive: {
    borderColor: colors.warning, borderWidth: 1.5,
    backgroundColor: colors.warningSubtle,
  },
  ch: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.sm,
  },
  clabel:       { fontSize: 11, fontWeight: '500', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.05 },
  clabelActive: { color: colors.warning },
  cbadge: {
    fontSize: 9, color: colors.textMuted, backgroundColor: colors.bgHighlight,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10,
  },

  // PSI row
  psiRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: spacing.sm, paddingBottom: spacing.sm,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  psiLabel: { fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', width: 24, letterSpacing: 0.03 },
  sbtn:     { width: 26, height: 26, backgroundColor: colors.bgHighlight, borderRadius: 5, borderWidth: 0.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  sbtnText: { fontSize: 15, color: colors.textPrimary },
  stepVal:      { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '500', color: colors.warning, fontVariant: ['tabular-nums'] as any, backgroundColor: colors.warningSubtle, borderRadius: 5, paddingVertical: 2 },
  stepValMuted: { color: colors.textPrimary, backgroundColor: colors.bgHighlight },

  // Temps row
  tempsRow: { flexDirection: 'row', gap: 5, alignItems: 'stretch', marginBottom: spacing.sm },

  // Edge columns
  edgeCol:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  edgeLabel:       { fontSize: 8, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.03, marginBottom: 2 },
  edgeSBtn:        { width: '100%', height: 22, backgroundColor: colors.bgHighlight, borderRadius: 5, borderWidth: 0.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  edgeSBtnDisabled:{ opacity: 0.2 },
  edgeSBtnText:    { fontSize: 14, color: colors.textPrimary },
  edgeVal:         { fontSize: 16, fontWeight: '500', color: colors.textMuted, fontVariant: ['tabular-nums'] as any, textAlign: 'center', lineHeight: 22 },
  edgeValOn:       { color: colors.textPrimary },
  edgeUnit:        { fontSize: 8, color: colors.textMuted },

  // Mid box
  midBox: {
    flex: 1.2, backgroundColor: colors.bgInput,
    borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border,
    padding: spacing.sm, alignItems: 'center', justifyContent: 'center',
  },
  midBoxActive: { borderColor: colors.warning, backgroundColor: colors.warningSubtle },
  midBoxSeeded: { borderColor: colors.success, backgroundColor: colors.successSubtle },
  midLabel: { fontSize: 8, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.03, marginBottom: 4 },
  midVal:   { fontSize: 18, fontWeight: '500', color: colors.textMuted, fontVariant: ['tabular-nums'] as any },
  midUnit:  { fontSize: 8, color: colors.textMuted, marginTop: 3 },

  // Gradient bar
  gradWrap:   { marginTop: 4 },
  gradLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  gradLbl:    { fontSize: 8, color: colors.textMuted },
  gradTrack:  { height: 6, borderRadius: 3, backgroundColor: colors.bgHighlight, overflow: 'hidden', position: 'relative' },
  gradFill:   { flex: 1, flexDirection: 'row', position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  gradSeg:    { flex: 1 },
  gradMarker: { position: 'absolute', top: -3, left: '50%', marginLeft: -1, width: 3, height: 12, backgroundColor: colors.textPrimary, borderRadius: 2 },

  avgLabel: {
    fontSize: 9, color: colors.textMuted, textAlign: 'center',
    marginTop: spacing.sm, marginBottom: 4,
  },

  // Numpad hint
  numpadHint: {
    paddingHorizontal: spacing.lg, paddingVertical: 4,
    borderTopWidth: 0.5, borderTopColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  numpadHintText: { fontSize: 10, color: colors.warning, textAlign: 'center' },

  // Submit
  submitRow: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderTopWidth: 0.5, borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  submitBtn:         { backgroundColor: colors.success, borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: colors.bgHighlight },
  submitBtnText:         { fontSize: 15, fontWeight: '600', color: '#000' },
  submitBtnTextDisabled: { color: colors.textMuted },
  skipRow: { alignItems: 'center', paddingVertical: spacing.sm },
  skipText: { fontSize: 12, color: colors.textMuted, textDecorationLine: 'underline' },
});
