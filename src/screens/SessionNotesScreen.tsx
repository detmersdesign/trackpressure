import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, typography, spacing, radius, globalStyles } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { useSettings } from '../hooks/useSettings';
import { useEvent } from '../hooks/useEventContext';

// ── Types ─────────────────────────────────────────────────────────────────────

type Corner = 'fl' | 'fr' | 'rl' | 'rr';

const CORNER_LABELS: Record<Corner, string> = {
  fl: 'Front left',
  fr: 'Front right',
  rl: 'Rear left',
  rr: 'Rear right',
};

const CORNERS: Corner[] = ['fl', 'fr', 'rl', 'rr'];

// tempToColor mirrors HotGradientEntryScreen — blue→white→red relative to avg
function tempToColor(temp: number, avg: number, scale: number): string {
  const ratio = Math.max(0, Math.min(1, 0.5 + (temp - avg) / (scale * 2)));
  if (ratio <= 0.5) {
    const t = ratio * 2;
    return `rgb(${Math.round(40 + t * 215)},${Math.round(120 + t * 135)},${Math.round(220 + t * 35)})`;
  }
  const t = (ratio - 0.5) * 2;
  return `rgb(255,${Math.round(255 - t * 255)},${Math.round(255 - t * 255)})`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SessionNotesParams {
  entryId:     string;

  // Display data for summary cards
  mode:        'pressures' | 'pyrometer' | 'gradient';
  trackConfig: string;
  tireLabel:   string;
  sessionType: string;

  // Hot pressures — all modes
  hotFL:  number | null;
  hotFR:  number | null;
  hotRL:  number | null;
  hotRR:  number | null;

  // Tier 1 temps (pyrometer mode)
  tempFL: number | null;   // display units (°F or °C)
  tempFR: number | null;
  tempRL: number | null;
  tempRR: number | null;

  // Tier 2 gradient (gradient mode) — all in display units
  flInner: number | null; flMid: number | null; flOuter: number | null;
  frInner: number | null; frMid: number | null; frOuter: number | null;
  rlInner: number | null; rlMid: number | null; rlOuter: number | null;
  rrInner: number | null; rrMid: number | null; rrOuter: number | null;

  // Tyre target range for out-of-range highlighting
  targetMin: number | null;
  targetMax: number | null;

  // Historic date flag — if set, navigate back to HistoricEventSetup not Confirmation
  historicDate: string | null;
  historicEvent: object | null;
}

type Props = NativeStackScreenProps<any, 'SessionNotes'>;

const MAX_NOTES = 280;

// ── Component ─────────────────────────────────────────────────────────────────

export default function SessionNotesScreen({ navigation, route }: Props) {
  const params = route.params as unknown as SessionNotesParams;
  const {
    entryId, mode, trackConfig, tireLabel, sessionType,
    hotFL, hotFR, hotRL, hotRR,
    tempFL, tempFR, tempRL, tempRR,
    flInner, flMid, flOuter,
    frInner, frMid, frOuter,
    rlInner, rlMid, rlOuter,
    rrInner, rrMid, rrOuter,
    targetMin, targetMax,
    historicDate, historicEvent,
  } = params;

  const { displayPressure, pressureUnit, displayTemp, tempUnit, settings } = useSettings();
  const { activeEvent, lastEntry, setLastEntry } = useEvent();

  const [notes,   setNotes]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const inputRef   = useRef<TextInput>(null);
  const scrollRef  = useRef<ScrollView>(null);
  const notesViewRef = useRef<View>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function isPressureWarn(val: number | null): boolean {
    if (val == null || targetMin == null || targetMax == null) return false;
    return val < targetMin || val > targetMax;
  }

  // Compute avg of all non-null temps for gradient color scale
  function gradAvg(): number | null {
    const vals = [
      flInner, flMid, flOuter,
      frInner, frMid, frOuter,
      rlInner, rlMid, rlOuter,
      rrInner, rrMid, rrOuter,
    ].filter((v): v is number => v !== null);
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  function gradColor(val: number | null): string {
    if (val === null) return colors.textMuted;
    const a = gradAvg();
    if (a === null) return colors.textPrimary;
    const scale = settings.temperature_unit === 'f' ? 10 : 6;
    return tempToColor(val, a, scale);
  }

  // Tier 1 pyrometer color — same relative logic using all four mid temps
  function pyroAvg(): number | null {
    const vals = [tempFL, tempFR, tempRL, tempRR].filter((v): v is number => v !== null);
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  function pyroColor(val: number | null): string {
    if (val === null) return colors.textMuted;
    const a = pyroAvg();
    if (a === null) return colors.textPrimary;
    const scale = settings.temperature_unit === 'f' ? 10 : 6;
    return tempToColor(val, a, scale);
  }

  // ── Save / skip ───────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    try {
      const trimmed = notes.trim();
      if (trimmed.length > 0) {
        await supabase
          .from('pressure_entries')
          .update({ notes: trimmed })
          .eq('id', entryId);
        setLastEntry({ ...lastEntry, notes: trimmed });
      }
    } catch {}
    setSaving(false);
    navigateNext();
  }

  function handleSkip() {
    navigateNext();
  }

  function navigateNext() {
    if (historicDate && historicEvent) {
      navigation.replace('HistoricEventSetup', historicEvent as any);
    } else {
      navigation.navigate('Confirmation');
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderPressureCards() {
    const corners: { key: Corner; val: number | null }[] = [
      { key: 'fl', val: hotFL },
      { key: 'fr', val: hotFR },
      { key: 'rl', val: hotRL },
      { key: 'rr', val: hotRR },
    ];
    return (
      <View style={styles.grid2}>
        {corners.map(({ key, val }) => {
          const warn = isPressureWarn(val);
          return (
            <View key={key} style={[styles.cornerCard, warn && styles.cornerCardWarn]}>
              <Text style={styles.cornerLabel}>{CORNER_LABELS[key]}</Text>
              <Text style={[styles.cornerPsi, warn && { color: colors.warning }]}>
                {val != null ? displayPressure(val) : '—'}
                <Text style={styles.cornerUnit}> {pressureUnit()}</Text>
              </Text>
            </View>
          );
        })}
      </View>
    );
  }

  function renderPyrometerCards() {
    const corners: { key: Corner; psi: number | null; temp: number | null }[] = [
      { key: 'fl', psi: hotFL, temp: tempFL },
      { key: 'fr', psi: hotFR, temp: tempFR },
      { key: 'rl', psi: hotRL, temp: tempRL },
      { key: 'rr', psi: hotRR, temp: tempRR },
    ];
    return (
      <View style={styles.grid2}>
        {corners.map(({ key, psi, temp }) => {
          const warn = isPressureWarn(psi);
          return (
            <View key={key} style={[styles.cornerCard, warn && styles.cornerCardWarn]}>
              <Text style={styles.cornerLabel}>{CORNER_LABELS[key]}</Text>
              <View style={styles.pyroRow}>
                <Text style={[styles.cornerPsi, warn && { color: colors.warning }]}>
                  {psi != null ? displayPressure(psi) : '—'}
                  <Text style={styles.cornerUnit}> {pressureUnit()}</Text>
                </Text>
                {temp != null && (
                  <Text style={[styles.pyroTemp, { color: pyroColor(temp) }]}>
                    {Math.round(temp)}{tempUnit()}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  function renderGradientCards() {
    // Left tyres: physical layout is outer | mid | inner (outer = left edge of card)
    // Right tyres: inner | mid | outer
    const corners: {
      key: Corner;
      strips: (number | null)[];  // left-to-right as displayed
    }[] = [
      { key: 'fl', strips: [flOuter, flMid, flInner] },
      { key: 'fr', strips: [frInner, frMid, frOuter] },
      { key: 'rl', strips: [rlOuter, rlMid, rlInner] },
      { key: 'rr', strips: [rrInner, rrMid, rrOuter] },
    ];

    return (
      <View style={styles.grid2}>
        {corners.map(({ key, strips }) => (
          <View key={key} style={styles.cornerCard}>
            <Text style={styles.cornerLabel}>{CORNER_LABELS[key]}</Text>
            <View style={styles.gradStrips}>
              {strips.map((val, i) => (
                <View key={i} style={styles.gradStrip}>
                  <Text style={[styles.gradStripVal, { color: gradColor(val) }]}>
                    {val != null ? Math.round(val) : '—'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    );
  }

  const sectionLabel = mode === 'gradient'
    ? 'Tyre temps'
    : mode === 'pyrometer'
    ? 'Hot pressures · temps'
    : 'Hot pressures';

  return (
    <SafeAreaView style={globalStyles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >

        {/* Top bar — title only, no back/skip */}
        <View style={styles.topBar}>
          <Text style={typography.subhead}>Session notes</Text>
        </View>

        {/* Context pills */}
        <View style={styles.ctxRow}>
          <View style={styles.ctxPill}>
            <Text style={styles.ctxPillText}>● {trackConfig}</Text>
          </View>
          <View style={styles.ctxGray}>
            <Text style={styles.ctxGrayText}>{tireLabel}</Text>
          </View>
          <View style={styles.ctxGray}>
            <Text style={styles.ctxGrayText}>{sessionType}</Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Summary cards — hidden when hot was skipped (all null) */}
          {(hotFL != null || hotFR != null || hotRL != null || hotRR != null) && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{sectionLabel}</Text>
              {mode === 'gradient'  && renderGradientCards()}
              {mode === 'pyrometer' && renderPyrometerCards()}
              {mode === 'pressures' && renderPressureCards()}
            </View>
          )}

          {/* Notes input */}
          <View
            ref={notesViewRef}
            style={styles.notesWrap}
            onLayout={() => {
              notesViewRef.current?.measureLayout(
                scrollRef.current as any,
                (_x, y) => { scrollRef.current?.scrollTo({ y, animated: true }); },
                () => {}
              );
            }}
          >
            <Text style={styles.sectionLabel}>Driver notes</Text>
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => inputRef.current?.focus()}
              style={styles.notesArea}
            >
              <TextInput
                ref={inputRef}
                style={styles.notesInput}
                placeholder="What did you notice? Setup feel, track conditions, anything worth remembering…"
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={MAX_NOTES}
                value={notes}
                onChangeText={setNotes}
                textAlignVertical="top"
                autoFocus={false}
                onFocus={() => {
                  setTimeout(() => {
                    notesViewRef.current?.measureLayout(
                      scrollRef.current as any,
                      (_x, y) => { scrollRef.current?.scrollTo({ y, animated: true }); },
                      () => {}
                    );
                  }, 150);
                }}
              />
            </TouchableOpacity>
            <Text style={styles.charCount}>{notes.length} / {MAX_NOTES}</Text>
          </View>
        </ScrollView>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>
              {saving ? 'Saving…' : 'Save & complete'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
            <Text style={styles.skipBtnText}>Skip — no note</Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  ctxRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    flexWrap: 'wrap',
  },
  ctxPill: {
    backgroundColor: colors.successSubtle,
    borderWidth: 0.5,
    borderColor: colors.success,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ctxPillText: { fontSize: 11, color: colors.success },
  ctxGray: {
    backgroundColor: colors.bgHighlight,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ctxGrayText: { fontSize: 11, color: colors.textMuted },

  section: {
    padding: spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  sectionLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cornerCard: {
    width: '48%',
    backgroundColor: colors.bgCard,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  cornerCardWarn: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSubtle,
  },
  cornerLabel: {
    fontSize: 9,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  cornerPsi: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  cornerUnit: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '400',
  },

  // Pyrometer
  pyroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  pyroTemp: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Gradient strips
  gradStrips: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 3,
  },
  gradStrip: {
    flex: 1,
    backgroundColor: colors.bgInput,
    borderRadius: 3,
    paddingVertical: 4,
    alignItems: 'center',
  },
  gradStripVal: {
    fontSize: 11,
    fontWeight: '500',
  },

  // Notes
  notesWrap: {
    padding: spacing.lg,
  },
  notesArea: {
    backgroundColor: colors.bgCard,
    borderWidth: 0.5,
    borderColor: colors.accent,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 160,
  },
  notesInput: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 22,
    minHeight: 140,
  },
  charCount: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: spacing.xs,
  },

  // Actions
  actions: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  skipBtn: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipBtnText: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
