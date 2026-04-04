import React, { useState, useRef } from 'react';
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

// Corner sequence — clockwise walk around car
const CORNERS = ['fl', 'fr', 'rr', 'rl'] as const;
type Corner = typeof CORNERS[number];

const CORNER_LABELS: Record<Corner, string> = {
  fl: 'Front left',
  fr: 'Front right',
  rr: 'Rear right',
  rl: 'Rear left',
};

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function HotCornerEntryScreen({ navigation }: Props) {
  const { openSession } = useEvent();
  const { displayPressure, pressureUnit, displayTemp, tempUnit, settings } = useSettings();

  const [pressures, setPressures] = useState<Record<Corner, string>>({ fl: '', fr: '', rr: '', rl: '' });
  const [temps,     setTemps]     = useState<Record<Corner, string>>({ fl: '', fr: '', rr: '', rl: '' });

  const [activeCorner, setActiveCorner] = useState<Corner>('fl');
  const [activeField,  setActiveField]  = useState<'pressure' | 'temp'>('pressure');
  const hotStartRef = useRef<number>(Date.now());

  // ── Numpad handler ────────────────────────────────────────────────────────
  function handleNumPress(key: string) {
    const setter = activeField === 'pressure' ? setPressures : setTemps;
    setter(prev => {
      const current = prev[activeCorner];
      let next: string;
      if (key === '⌫') {
        next = current.slice(0, -1);
      } else if (key === '.') {
        next = current.includes('.') ? current : current + '.';
      } else {
        if (current.length >= 5) return prev;
        next = current + key;
      }
      return { ...prev, [activeCorner]: next };
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  function handleNext() {
    if (activeField === 'pressure') {
      setActiveField('temp');
      return;
    }
    const idx = CORNERS.indexOf(activeCorner);
    if (idx < CORNERS.length - 1) {
      setActiveCorner(CORNERS[idx + 1]);
      setActiveField('pressure');
    } else {
      navigation.navigate('CornerReview', {
        mode: 'hot',
        pressures,
        temps,
        hotStartedAt: hotStartRef.current,
      });
    }
  }

  function handleSkipCorner() {
    const idx = CORNERS.indexOf(activeCorner);
    if (idx < CORNERS.length - 1) {
      setActiveCorner(CORNERS[idx + 1]);
      setActiveField('pressure');
    } else {
      navigation.navigate('CornerReview', {
        mode: 'hot',
        pressures,
        temps,
        hotStartedAt: hotStartRef.current,
      });
    }
  }

  // ── Can advance ───────────────────────────────────────────────────────────
  const currentVal = activeField === 'pressure'
    ? pressures[activeCorner]
    : temps[activeCorner];
  const canAdvance = currentVal.length > 0 && !isNaN(parseFloat(currentVal));

  function nextLabel(): string {
    if (activeField === 'pressure') return 'Next → temp';
    const idx = CORNERS.indexOf(activeCorner);
    if (idx < CORNERS.length - 1) return `Next corner → ${CORNERS[idx + 1].toUpperCase()}`;
    return 'Review all →';
  }

  function cornerStatus(c: Corner): 'active' | 'done' | 'pending' {
    if (c === activeCorner) return 'active';
    if (pressures[c].length > 0 && temps[c].length > 0) return 'done';
    return 'pending';
  }

  const cornerIdx = CORNERS.indexOf(activeCorner);

  // Prediction for active corner from openSession
  function predictionForCorner(c: Corner): number | null {
    if (!openSession) return null;
    const map: Record<Corner, number> = {
      fl: openSession.predicted_hot_fl,
      fr: openSession.predicted_hot_fr,
      rr: openSession.predicted_hot_rr,
      rl: openSession.predicted_hot_rl,
    };
    return map[c];
  }

  const pred = predictionForCorner(activeCorner);

  return (
    <SafeAreaView style={globalStyles.screen}>
      <View style={styles.topBar}>
        <View>
          <Text style={typography.subhead}>After session</Text>
          <Text style={[typography.caption, { color: colors.warning }]}>
            Corner {cornerIdx + 1} of {CORNERS.length} — {activeCorner.toUpperCase()}
          </Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[typography.caption, { color: colors.accent }]}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.progressRow}>
        {CORNERS.map(c => (
          <View
            key={c}
            style={[
              styles.progressStep,
              cornerStatus(c) === 'done'   && styles.progressDone,
              cornerStatus(c) === 'active' && styles.progressActive,
            ]}
          />
        ))}
        <Text style={styles.progressLabel}>{activeCorner.toUpperCase()}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Car diagram */}
        <View style={styles.carDiagram}>
          <Text style={styles.carArrow}>↑ front</Text>
          <View style={styles.carBody} />
          {CORNERS.map(c => {
            const status = cornerStatus(c);
            return (
              <TouchableOpacity
                key={c}
                style={[
                  styles.cornerDot,
                  styles[`dot_${c}` as keyof typeof styles] as any,
                  status === 'active' && styles.cornerDotActive,
                  status === 'done'   && styles.cornerDotDone,
                ]}
                onPress={() => { setActiveCorner(c); setActiveField('pressure'); }}
              >
                <Text style={[
                  styles.cornerDotText,
                  status === 'active' && styles.cornerDotTextActive,
                  status === 'done'   && styles.cornerDotTextDone,
                ]}>
                  {c.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Prediction hint */}
        {pred !== null && (
          <Text style={styles.predHint}>
            Predicted: {displayPressure(pred)} {pressureUnit()}
          </Text>
        )}

        {/* Active corner entry */}
        <View style={[styles.activeCornerCard, { borderColor: colors.warning }]}>
          <View style={styles.acHeader}>
            <Text style={[styles.acLabel, { color: colors.warning }]}>
              {CORNER_LABELS[activeCorner]}
            </Text>
            <Text style={styles.acStep}>
              {activeField === 'pressure' ? 'Pressure' : 'Temp (required)'}
            </Text>
          </View>

          <View style={styles.fieldToggle}>
            <TouchableOpacity
              style={[
                styles.ftPill,
                activeField === 'pressure' && styles.ftPillActive,
                pressures[activeCorner].length > 0 && activeField !== 'pressure' && styles.ftPillDone,
              ]}
              onPress={() => setActiveField('pressure')}
            >
              <Text style={[
                styles.ftPillText,
                activeField === 'pressure' && styles.ftPillTextActive,
                pressures[activeCorner].length > 0 && activeField !== 'pressure' && styles.ftPillTextDone,
              ]}>
                {pressures[activeCorner].length > 0 && activeField !== 'pressure'
                  ? `${pressureUnit()} ✓` : 'Pressure'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.ftPill,
                activeField === 'temp' && styles.ftPillActive,
                temps[activeCorner].length > 0 && activeField !== 'temp' && styles.ftPillDone,
              ]}
              onPress={() => setActiveField('temp')}
            >
              <Text style={[
                styles.ftPillText,
                activeField === 'temp' && styles.ftPillTextActive,
                temps[activeCorner].length > 0 && activeField !== 'temp' && styles.ftPillTextDone,
              ]}>
                {temps[activeCorner].length > 0 && activeField !== 'temp'
                  ? `${tempUnit()} ✓` : 'Temp'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.acFields}>
            <TouchableOpacity
              style={[
                styles.acField,
                activeField === 'pressure' && styles.acFieldActive,
                pressures[activeCorner].length > 0 && activeField !== 'pressure' && styles.acFieldDone,
              ]}
              onPress={() => setActiveField('pressure')}
            >
              <Text style={styles.acFieldLabel}>Pressure</Text>
              <Text style={[
                styles.acFieldVal,
                activeField === 'pressure' && { color: colors.warning },
                pressures[activeCorner].length > 0 && activeField !== 'pressure' && { color: colors.success },
              ]}>
                {pressures[activeCorner] || '—'}
              </Text>
              <Text style={styles.acFieldUnit}>{pressureUnit()} hot</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.acField,
                activeField === 'temp' && styles.acFieldActive,
                temps[activeCorner].length > 0 && activeField !== 'temp' && styles.acFieldDone,
              ]}
              onPress={() => setActiveField('temp')}
            >
              <Text style={styles.acFieldLabel}>Temp</Text>
              <Text style={[
                styles.acFieldVal,
                activeField === 'temp' && { color: colors.warning },
                temps[activeCorner].length > 0 && activeField !== 'temp' && { color: colors.success },
              ]}>
                {temps[activeCorner] || '—'}
              </Text>
              <Text style={styles.acFieldUnit}>{tempUnit()} required</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      <NumPad onPress={handleNumPress} />

      <View style={styles.submitRow}>
        <TouchableOpacity
          style={[styles.nextBtn, !canAdvance && styles.nextBtnDisabled]}
          onPress={handleNext}
          disabled={!canAdvance}
        >
          <Text style={[styles.nextBtnText, !canAdvance && styles.nextBtnTextDisabled]}>
            {nextLabel()}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipRow} onPress={handleSkipCorner}>
          <Text style={styles.skipText}>skip this corner</Text>
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
  progressRow: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  progressStep:   { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.border },
  progressDone:   { backgroundColor: colors.success },
  progressActive: { backgroundColor: colors.warning },
  progressLabel:  { fontSize: 9, color: colors.textMuted, marginLeft: 4 },

  content: { padding: spacing.lg, paddingBottom: spacing.xl },

  carDiagram: {
    position: 'relative', height: 80, marginBottom: spacing.sm, alignItems: 'center',
  },
  carArrow: { fontSize: 9, color: colors.textMuted, marginBottom: 2, alignSelf: 'center' },
  carBody: {
    width: 48, height: 56, backgroundColor: colors.bgCard,
    borderRadius: 6, borderWidth: 0.5, borderColor: colors.border,
    position: 'absolute', top: 14, left: '50%', marginLeft: -24,
  },
  cornerDot: {
    position: 'absolute', width: 28, height: 28,
    borderRadius: 4, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bgInput,
    alignItems: 'center', justifyContent: 'center',
  },
  cornerDotActive: { borderColor: colors.warning, backgroundColor: colors.warningSubtle },
  cornerDotDone:   { borderColor: colors.success,  backgroundColor: colors.successSubtle },
  cornerDotText:       { fontSize: 8, fontWeight: '500', color: colors.textMuted },
  cornerDotTextActive: { color: colors.warning },
  cornerDotTextDone:   { color: colors.success },
  dot_fl: { top: 10, left: '25%', marginLeft: -14 },
  dot_fr: { top: 10, right: '25%', marginRight: -14 },
  dot_rl: { bottom: 0, left: '25%', marginLeft: -14 },
  dot_rr: { bottom: 0, right: '25%', marginRight: -14 },

  predHint: {
    fontSize: 11, color: colors.warning, textAlign: 'center',
    marginBottom: spacing.sm,
  },

  activeCornerCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, padding: spacing.md, marginBottom: spacing.md,
  },
  acHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.sm,
  },
  acLabel: { fontSize: 14, fontWeight: '500' },
  acStep: {
    fontSize: 10, color: colors.textMuted,
    backgroundColor: colors.bgHighlight,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  fieldToggle: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  ftPill: {
    flex: 1, paddingVertical: 5, alignItems: 'center',
    borderRadius: radius.sm, borderWidth: 0.5, borderColor: colors.border,
    backgroundColor: colors.bgInput,
  },
  ftPillActive: { borderColor: colors.warning, backgroundColor: colors.warningSubtle },
  ftPillDone:   { borderColor: colors.success,  backgroundColor: colors.successSubtle },
  ftPillText:       { fontSize: 11, color: colors.textMuted },
  ftPillTextActive: { color: colors.warning, fontWeight: '500' },
  ftPillTextDone:   { color: colors.success,  fontWeight: '500' },

  acFields: { flexDirection: 'row', gap: spacing.sm },
  acField: {
    flex: 1, backgroundColor: colors.bgInput,
    borderRadius: radius.md, padding: spacing.sm,
    borderWidth: 0.5, borderColor: colors.border,
  },
  acFieldActive: { borderColor: colors.warning },
  acFieldDone:   { borderColor: colors.success },
  acFieldLabel: { fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  acFieldVal:   { fontSize: 20, fontWeight: '500', color: colors.textPrimary, fontVariant: ['tabular-nums'] as any },
  acFieldUnit:  { fontSize: 9, color: colors.textMuted, marginTop: 2 },

  submitRow: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderTopWidth: 0.5, borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  nextBtn: {
    backgroundColor: colors.warning, borderRadius: radius.lg,
    paddingVertical: 14, alignItems: 'center',
  },
  nextBtnDisabled: { backgroundColor: colors.bgHighlight },
  nextBtnText:     { fontSize: 15, fontWeight: '600', color: '#000' },
  nextBtnTextDisabled: { color: colors.textMuted },
  skipRow: { alignItems: 'center', paddingVertical: spacing.sm },
  skipText: { fontSize: 12, color: colors.textMuted, textDecorationLine: 'underline' },
});
