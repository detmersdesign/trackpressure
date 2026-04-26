import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, typography, spacing, radius, globalStyles } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { useSettings } from '../hooks/useSettings';

// ── Types ─────────────────────────────────────────────────────────────────────

type Corner = 'fl' | 'fr' | 'rl' | 'rr';

const CORNER_LABELS: Record<Corner, string> = {
  fl: 'Front left', fr: 'Front right',
  rl: 'Rear left',  rr: 'Rear right',
};

export interface SessionDetailParams {
  id:            string;
  created_at:    string;
  session_type:  string;
  ambient_temp_c: number | null;
  track_name:    string;
  track_config:  string | null;
  vehicle_label: string;
  tire_label:    string;

  // Cold
  cold_front_psi: number | null;
  cold_rear_psi:  number | null;
  hot_front_psi:  number | null;
  hot_rear_psi:   number | null;
  cold_fl_psi:   number | null;
  cold_fr_psi:   number | null;
  cold_rl_psi:   number | null;
  cold_rr_psi:   number | null;
  cold_fl_temp_c: number | null;
  cold_fr_temp_c: number | null;
  cold_rl_temp_c: number | null;
  cold_rr_temp_c: number | null;

  // Hot pressures
  hot_fl_psi:    number | null;
  hot_fr_psi:    number | null;
  hot_rl_psi:    number | null;
  hot_rr_psi:    number | null;

  // Tier 1 hot temps
  tyre_temp_hot_fl_c: number | null;
  tyre_temp_hot_fr_c: number | null;
  tyre_temp_hot_rl_c: number | null;
  tyre_temp_hot_rr_c: number | null;

  // Tier 2 gradient
  tyre_temp_hot_fl_inner_c: number | null;
  tyre_temp_hot_fl_mid_c:   number | null;
  tyre_temp_hot_fl_outer_c: number | null;
  tyre_temp_hot_fr_inner_c: number | null;
  tyre_temp_hot_fr_mid_c:   number | null;
  tyre_temp_hot_fr_outer_c: number | null;
  tyre_temp_hot_rl_inner_c: number | null;
  tyre_temp_hot_rl_mid_c:   number | null;
  tyre_temp_hot_rl_outer_c: number | null;
  tyre_temp_hot_rr_inner_c: number | null;
  tyre_temp_hot_rr_mid_c:   number | null;
  tyre_temp_hot_rr_outer_c: number | null;

  // Target range for out-of-range highlight
  target_min_psi: number | null;
  target_max_psi: number | null;

  notes: string | null;
  user_id: string | null;
  currentUserId: string | null;
}

type Props = NativeStackScreenProps<any, 'SessionDetail'>;

const SESSION_TYPE_LABELS: Record<string, string> = {
  hpde: 'HPDE', time_attack: 'Time attack', club_race: 'Club race',
  practice: 'Practice', qualifying: 'Qualifying', race: 'Race', other: 'Other',
};

const MAX_NOTES = 280;
const CORNERS: Corner[] = ['fl', 'fr', 'rl', 'rr'];

// tempToColor mirrors HotGradientEntryScreen
function tempToColor(temp: number, avg: number, scale: number): string {
  const ratio = Math.max(0, Math.min(1, 0.5 + (temp - avg) / (scale * 2)));
  if (ratio <= 0.5) {
    const t = ratio * 2;
    return `rgb(${Math.round(40 + t * 215)},${Math.round(120 + t * 135)},${Math.round(220 + t * 35)})`;
  }
  const t = (ratio - 0.5) * 2;
  return `rgb(255,${Math.round(255 - t * 255)},${Math.round(255 - t * 255)})`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SessionDetailScreen({ navigation, route }: Props) {
  const p = route.params as unknown as SessionDetailParams;
  const { displayPressure, pressureUnit, displayTemp, tempUnit, settings } = useSettings();

  const isPersonal = p.user_id != null && p.currentUserId != null && p.user_id === p.currentUserId;
  const [notes,      setNotes]      = useState(p.notes ?? '');
  const [editingNotes, setEditingNotes] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const inputRef     = useRef<TextInput>(null);
  const scrollRef    = useRef<ScrollView>(null);
  const notesViewRef = useRef<View>(null);

  // ── Display helpers ───────────────────────────────────────────────────────

  function isPressureWarn(val: number | null): boolean {
    if (val == null || p.target_min_psi == null || p.target_max_psi == null) return false;
    return val < p.target_min_psi || val > p.target_max_psi;
  }

  // Determine display mode from available data
  const hasGradient = CORNERS.some(c =>
    p[`tyre_temp_hot_${c}_inner_c` as keyof SessionDetailParams] != null
  );
  const hasPyrometer = !hasGradient && CORNERS.some(c =>
    p[`tyre_temp_hot_${c}_c` as keyof SessionDetailParams] != null
  );
  const hasColdTemps = CORNERS.some(c =>
    p[`cold_${c}_temp_c` as keyof SessionDetailParams] != null
  );

  // Compute avg for gradient color scale
  function gradAvg(): number | null {
    const vals: number[] = [];
    CORNERS.forEach(c => {
      const inner = p[`tyre_temp_hot_${c}_inner_c` as keyof SessionDetailParams] as number | null;
      const mid   = p[`tyre_temp_hot_${c}_mid_c`   as keyof SessionDetailParams] as number | null;
      const outer = p[`tyre_temp_hot_${c}_outer_c`  as keyof SessionDetailParams] as number | null;
      if (inner != null) vals.push(inner);
      if (mid   != null) vals.push(mid);
      if (outer != null) vals.push(outer);
    });
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  function pyroAvg(): number | null {
    const vals = CORNERS.map(c => p[`tyre_temp_hot_${c}_c` as keyof SessionDetailParams] as number | null)
      .filter((v): v is number => v != null);
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  const tempScale = settings.temperature_unit === 'f' ? 10 : 6;

  function gradColor(valC: number | null): string {
    if (valC == null) return colors.textMuted;
    const a = gradAvg();
    if (a == null) return colors.textPrimary;
    return tempToColor(valC, a, tempScale);
  }

  function pyroColor(valC: number | null): string {
    if (valC == null) return colors.textMuted;
    const a = pyroAvg();
    if (a == null) return colors.textPrimary;
    return tempToColor(valC, a, tempScale);
  }

  // ── Notes save ────────────────────────────────────────────────────────────

  async function handleSaveNotes() {
    setSaving(true);
    try {
      await supabase
        .from('pressure_entries')
        .update({ notes: notes.trim() || null })
        .eq('id', p.id);
      setEditingNotes(false);
    } catch {
      Alert.alert('Error', 'Could not save notes. Please try again.');
    }
    setSaving(false);
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderColdCards() {
    // Fall back to axle value when per-corner data not recorded
    const hasCornerCold = p.cold_fl_psi != null || p.cold_fr_psi != null;
    const coldData: { c: Corner; psi: number | null; tempC: number | null; isAxle: boolean }[] = [
      { c: 'fl', psi: p.cold_fl_psi ?? p.cold_front_psi, tempC: p.cold_fl_temp_c, isAxle: !hasCornerCold },
      { c: 'fr', psi: p.cold_fr_psi ?? p.cold_front_psi, tempC: p.cold_fr_temp_c, isAxle: !hasCornerCold },
      { c: 'rl', psi: p.cold_rl_psi ?? p.cold_rear_psi,  tempC: p.cold_rl_temp_c, isAxle: !hasCornerCold },
      { c: 'rr', psi: p.cold_rr_psi ?? p.cold_rear_psi,  tempC: p.cold_rr_temp_c, isAxle: !hasCornerCold },
    ];
    return (
      <View style={styles.grid2}>
        {coldData.map(({ c, psi, tempC, isAxle }) => {
          if (hasColdTemps) {
            return (
              <View key={c} style={styles.pyroBox}>
                <Text style={styles.cornerLabel}>{CORNER_LABELS[c]}</Text>
                <View style={styles.pyroRow}>
                  <Text style={styles.cornerPsi}>
                    {psi != null ? displayPressure(psi) : '—'}
                    <Text style={styles.cornerUnit}> {pressureUnit()}</Text>
                  </Text>
                  {tempC != null && (
                    <Text style={[styles.pyroTemp, { color: pyroColor(tempC) }]}>
                      {Math.round(Number(displayTemp(tempC)))}{tempUnit()}
                    </Text>
                  )}
                  {isAxle && <Text style={styles.axleNote}>axle avg</Text>}
                </View>
              </View>
            );
          }
          return (
            <View key={c} style={styles.cornerCard}>
              <Text style={styles.cornerLabel}>{CORNER_LABELS[c]}</Text>
              <Text style={styles.cornerPsi}>
                {psi != null ? displayPressure(psi) : '—'}
                <Text style={styles.cornerUnit}> {pressureUnit()}</Text>
              </Text>
              {isAxle && <Text style={styles.axleNote}>axle avg</Text>}
            </View>
          );
        })}
      </View>
    );
  }

  function renderHotCards() {
    const gradData: { c: Corner; psi: number|null; inner: number|null; mid: number|null; outer: number|null }[] = [
      { c:'fl', psi:p.hot_fl_psi, inner:p.tyre_temp_hot_fl_inner_c, mid:p.tyre_temp_hot_fl_mid_c, outer:p.tyre_temp_hot_fl_outer_c },
      { c:'fr', psi:p.hot_fr_psi, inner:p.tyre_temp_hot_fr_inner_c, mid:p.tyre_temp_hot_fr_mid_c, outer:p.tyre_temp_hot_fr_outer_c },
      { c:'rl', psi:p.hot_rl_psi, inner:p.tyre_temp_hot_rl_inner_c, mid:p.tyre_temp_hot_rl_mid_c, outer:p.tyre_temp_hot_rl_outer_c },
      { c:'rr', psi:p.hot_rr_psi, inner:p.tyre_temp_hot_rr_inner_c, mid:p.tyre_temp_hot_rr_mid_c, outer:p.tyre_temp_hot_rr_outer_c },
    ];
    const pyroData: { c: Corner; psi: number|null; tempC: number|null }[] = [
      { c:'fl', psi:p.hot_fl_psi, tempC:p.tyre_temp_hot_fl_c },
      { c:'fr', psi:p.hot_fr_psi, tempC:p.tyre_temp_hot_fr_c },
      { c:'rl', psi:p.hot_rl_psi, tempC:p.tyre_temp_hot_rl_c },
      { c:'rr', psi:p.hot_rr_psi, tempC:p.tyre_temp_hot_rr_c },
    ];
    const hasCornerHot = p.hot_fl_psi != null || p.hot_fr_psi != null;
    const pressData: { c: Corner; psi: number|null; isAxle: boolean }[] = [
      { c:'fl', psi:p.hot_fl_psi ?? p.hot_front_psi, isAxle: !hasCornerHot },
      { c:'fr', psi:p.hot_fr_psi ?? p.hot_front_psi, isAxle: !hasCornerHot },
      { c:'rl', psi:p.hot_rl_psi ?? p.hot_rear_psi,  isAxle: !hasCornerHot },
      { c:'rr', psi:p.hot_rr_psi ?? p.hot_rear_psi,  isAxle: !hasCornerHot },
    ];
    if (hasGradient) {
      return (
        <View style={styles.grid2}>
          {gradData.map(({ c, psi, inner, mid, outer }) => {
            const warn  = isPressureWarn(psi);
            const isLeft = c === 'fl' || c === 'rl';
            const strips = isLeft ? [outer, mid, inner] : [inner, mid, outer];
            return (
              <View key={c} style={[styles.gradBox, warn && styles.cornerCardWarn]}>
                <Text style={styles.cornerLabel}>{CORNER_LABELS[c]}</Text>
                <Text style={[styles.gradPsi, warn && { color: colors.warning }]}>
                  {psi != null ? displayPressure(psi) : '—'}
                  <Text style={styles.cornerUnit}> {pressureUnit()}</Text>
                </Text>
                <View style={[styles.gradDivider, warn && { backgroundColor: '#2E1A00' }]} />
                <View style={styles.gradStrips}>
                  {strips.map((v, i) => (
                    <View key={i} style={styles.gradStrip}>
                      <Text style={[styles.gradStripVal, { color: gradColor(v != null ? Number(v) : null) }]}>
                        {v != null ? Math.round(Number(displayTemp(Number(v)))) : '—'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      );
    }

    if (hasPyrometer) {
      return (
        <View style={styles.grid2}>
          {CORNERS.map(c => {
            const psi   = p[`hot_${c}_psi` as keyof SessionDetailParams] as number | null;
            const tempC = p[`tyre_temp_hot_${c}_c` as keyof SessionDetailParams] as number | null;
            const warn  = isPressureWarn(psi);
            return (
              <View key={c} style={[styles.pyroBox, warn && styles.cornerCardWarn]}>
                <Text style={styles.cornerLabel}>{CORNER_LABELS[c]}</Text>
                <View style={styles.pyroRow}>
                  <Text style={[styles.cornerPsi, warn && { color: colors.warning }]}>
                    {psi != null ? displayPressure(psi) : '—'}
                    <Text style={styles.cornerUnit}> {pressureUnit()}</Text>
                  </Text>
                  {tempC != null && (
                    <Text style={[styles.pyroTemp, { color: pyroColor(Number(tempC)) }]}>
                      {Math.round(Number(displayTemp(Number(tempC))))}{tempUnit()}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      );
    }

    return (
      <View style={styles.grid2}>
        {pressData.map(({ c, psi, isAxle }) => {
          const warn = isPressureWarn(psi);
          return (
            <View key={c} style={[styles.cornerCard, warn && styles.cornerCardWarn]}>
              <Text style={styles.cornerLabel}>{CORNER_LABELS[c]}</Text>
              <Text style={[styles.cornerPsi, warn && { color: colors.warning }]}>
                {psi != null ? displayPressure(psi) : '—'}
                <Text style={styles.cornerUnit}> {pressureUnit()}</Text>
              </Text>
              {isAxle && <Text style={styles.axleNote}>axle avg</Text>}
            </View>
          );
        })}
      </View>
    );
  }

  const hotSectionLabel = hasGradient || hasPyrometer
    ? 'Hot pressures & temps'
    : 'Hot pressures';

  const coldSectionLabel = hasColdTemps
    ? 'Cold pressures & temps'
    : 'Cold pressures';

  const hasHotData = CORNERS.some(c => p[`hot_${c}_psi` as keyof SessionDetailParams] != null);

  const dateStr = new Date(p.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <SafeAreaView style={globalStyles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[typography.caption, { color: colors.accent }]}>← History</Text>
          </TouchableOpacity>
        </View>

        {/* Context pills */}
        <View style={styles.ctxRow}>
          <View style={styles.ctxPill}>
            <Text style={styles.ctxPillText}>● {p.track_config ?? p.track_name}</Text>
          </View>
          <View style={styles.ctxGray}>
            <Text style={styles.ctxGrayText}>{p.tire_label}</Text>
          </View>
          <View style={styles.ctxGray}>
            <Text style={styles.ctxGrayText}>{SESSION_TYPE_LABELS[p.session_type] ?? p.session_type}</Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Session meta */}
          <View style={styles.section}>
            <View style={styles.metaRow}>
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>{dateStr}</Text>
              </View>
              {p.ambient_temp_c != null && (
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>
                    {Math.round(Number(displayTemp(p.ambient_temp_c!)))}{tempUnit()}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.carName}>{p.vehicle_label} · {p.track_name}</Text>
            <Text style={styles.carSub}>{p.tire_label}</Text>
          </View>

          {/* Cold section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{coldSectionLabel}</Text>
            {renderColdCards()}
          </View>

          {/* Hot section */}
          {hasHotData && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{hotSectionLabel}</Text>
              {renderHotCards()}
            </View>
          )}

          {/* Notes section */}
          {!isPersonal && (
            <View style={styles.communityNote}>
              <Text style={styles.communityNoteText}>
                Community data — personal notes are not shared.
              </Text>
            </View>
          )}
          {isPersonal && (
            <View
              ref={notesViewRef}
              style={styles.section}
              onLayout={() => {
                if (editingNotes) {
                  notesViewRef.current?.measureLayout(
                    scrollRef.current as any,
                    (_x, y) => { scrollRef.current?.scrollTo({ y, animated: true }); },
                    () => {}
                  );
                }
              }}
            >
            {editingNotes ? (
              <>
                <TextInput
                  ref={inputRef}
                  style={styles.notesInput}
                  multiline
                  maxLength={MAX_NOTES}
                  value={notes}
                  onChangeText={setNotes}
                  textAlignVertical="top"
                  autoFocus
                  placeholder="What did you notice? Setup feel, track conditions…"
                  placeholderTextColor={colors.textMuted}
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
                <View style={styles.notesBtnRow}>
                  <TouchableOpacity
                    style={styles.cancelNotesBtn}
                    onPress={() => { setNotes(p.notes ?? ''); setEditingNotes(false); }}
                  >
                    <Text style={styles.cancelNotesBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveNotesBtn}
                    onPress={handleSaveNotes}
                    disabled={saving}
                  >
                    <Text style={styles.saveNotesBtnText}>
                      {saving ? 'Saving…' : 'Save notes'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.charCount}>{notes.length} / {MAX_NOTES}</Text>
              </>
            ) : (
              <>
                <View style={styles.notesBubble}>
                  {notes.trim().length > 0
                    ? <Text style={styles.notesText}>{notes}</Text>
                    : <Text style={styles.notesEmpty}>No notes for this session.</Text>
                  }
                </View>
                <TouchableOpacity
                  style={styles.editNotesBtn}
                  onPress={() => {
                    setEditingNotes(true);
                    setTimeout(() => inputRef.current?.focus(), 100);
                  }}
                >
                  <Text style={styles.editNotesBtnText}>
                    {notes.trim().length > 0 ? 'Edit notes' : 'Add notes'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  ctxRow: {
    flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap',
    padding: spacing.sm, paddingHorizontal: spacing.lg,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  ctxPill: {
    backgroundColor: colors.successSubtle, borderWidth: 0.5,
    borderColor: colors.success, borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  ctxPillText: { fontSize: 11, color: colors.success },
  ctxGray: {
    backgroundColor: colors.bgHighlight, borderWidth: 0.5,
    borderColor: colors.border, borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  ctxGrayText: { fontSize: 11, color: colors.textMuted },

  section: {
    padding: spacing.lg,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  sectionLabel: {
    fontSize: 10, color: colors.textMuted, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: spacing.sm,
  },

  metaRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm, flexWrap: 'wrap' },
  metaPill: {
    backgroundColor: colors.bgHighlight, borderWidth: 0.5,
    borderColor: colors.border, borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  metaPillText: { fontSize: 11, color: colors.textMuted },
  carName: { fontSize: 13, fontWeight: '500', color: colors.textPrimary },
  carSub:  { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  cornerCard: {
    width: '48%', backgroundColor: colors.bgCard,
    borderWidth: 0.5, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.sm,
  },
  cornerCardWarn: { borderColor: colors.warning, backgroundColor: colors.warningSubtle },
  cornerLabel: {
    fontSize: 9, color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3,
  },
  cornerPsi: { fontSize: 16, fontWeight: '500', color: colors.textPrimary },
  cornerUnit: { fontSize: 9, color: colors.textMuted, fontWeight: '400' },

  // Pyrometer card
  pyroBox: {
    width: '48%', backgroundColor: colors.bgCard,
    borderWidth: 0.5, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.sm,
  },
  pyroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  pyroTemp: { fontSize: 13, fontWeight: '500' },

  // Gradient card
  gradBox: {
    width: '48%', backgroundColor: colors.bgCard,
    borderWidth: 0.5, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.sm,
  },
  gradPsi: { fontSize: 14, fontWeight: '500', color: colors.warning, marginBottom: 4 },
  gradDivider: { height: 0.5, backgroundColor: colors.border, marginBottom: 4 },
  gradStrips: { flexDirection: 'row', gap: 3 },
  gradStrip: {
    flex: 1, backgroundColor: colors.bgInput,
    borderRadius: 3, paddingVertical: 3, alignItems: 'center',
  },
  gradStripVal: { fontSize: 11, fontWeight: '500' },

  // Notes
  notesBubble: {
    backgroundColor: colors.bgCard, borderWidth: 0.5,
    borderColor: colors.border, borderRadius: radius.lg,
    padding: spacing.md, minHeight: 60,
  },
  notesText:  { fontSize: 13, color: colors.textPrimary, lineHeight: 20 },
  notesEmpty: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },

  notesInput: {
    backgroundColor: colors.bgCard, borderWidth: 0.5,
    borderColor: colors.accent, borderRadius: radius.lg,
    padding: spacing.md, fontSize: 13, color: colors.textPrimary,
    lineHeight: 20, minHeight: 100,
  },
  charCount: { fontSize: 11, color: colors.textMuted, textAlign: 'right', marginTop: 4 },

  notesBtnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  saveNotesBtn: {
    flex: 1, backgroundColor: colors.accent,
    borderRadius: radius.lg, paddingVertical: 11, alignItems: 'center',
  },
  saveNotesBtnText: { fontSize: 13, fontWeight: '600', color: '#000' },
  cancelNotesBtn: {
    flex: 1, borderWidth: 0.5, borderColor: colors.border,
    borderRadius: radius.lg, paddingVertical: 11, alignItems: 'center',
  },
  cancelNotesBtnText: { fontSize: 13, color: colors.textMuted },

  editNotesBtn: {
    marginTop: spacing.sm, borderWidth: 0.5,
    borderColor: colors.accent, borderRadius: radius.lg,
    paddingVertical: 10, alignItems: 'center',
  },
  editNotesBtnText: { fontSize: 13, color: colors.accent },
  axleNote: { fontSize: 9, color: colors.textMuted, marginTop: 2, fontStyle: 'italic' },
  communityNote: {
    marginHorizontal: spacing.lg, marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.bgHighlight,
    borderRadius: radius.md,
    borderWidth: 0.5, borderColor: colors.border,
  },
  communityNoteText: { fontSize: 12, color: colors.textMuted, textAlign: 'center', fontStyle: 'italic' },
});
