import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, typography, spacing, radius, globalStyles } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route?: { params?: { prefillMake?: string; prefillModel?: string; userId?: string } };
};

const MAX_NOTES = 200;

export default function RequestVehicleScreen({ navigation, route }: Props) {
  const prefillMake  = route?.params?.prefillMake  ?? '';
  const prefillModel = route?.params?.prefillModel ?? '';
  const userId       = route?.params?.userId       ?? null;

  const [make,        setMake]        = useState(prefillMake);
  const [model,       setModel]       = useState(prefillModel);
  const [year,        setYear]        = useState('');
  const [trim,        setTrim]        = useState('');
  const [notes,       setNotes]       = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [submittedData, setSubmittedData] = useState<{
    make: string; model: string; year: string; trim: string;
  } | null>(null);

  const scrollRef   = useRef<ScrollView>(null);
  const notesRef    = useRef<View>(null);

  const canSubmit = make.trim().length > 0 && model.trim().length > 0 && year.trim().length === 4;

  async function handleSubmit() {
    const parsedYear = parseInt(year);
    if (isNaN(parsedYear) || parsedYear < 1950 || parsedYear > new Date().getFullYear() + 1) {
      Alert.alert('Invalid year', 'Please enter a valid 4-digit model year.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id ?? userId;
      if (!uid) throw new Error('Not authenticated');

      // Insert into vehicles with is_custom = true
      const vehicleId = uuidv4();
      const { error: vehicleError } = await supabase
        .from('vehicles')
        .insert({
          id:                 vehicleId,
          make:               make.trim(),
          model:              model.trim(),
          year_start:         parsedYear,
          year_end:           parsedYear,
          trim:               trim.trim() || 'Base',
          oem_pressure_front: 32.0,  // placeholder — reconciled by admin
          oem_pressure_rear:  32.0,
          silhouette_category: 'generic',
          is_custom:          true,
          requested_by:       uid,
        });

      if (vehicleError) throw vehicleError;

      // Add to user's garage immediately
      const { error: garageError } = await supabase
        .from('garage_vehicles')
        .insert({
          user_id:       uid,
          vehicle_id:    vehicleId,
          display_order: 999,
        });

      if (garageError) throw garageError;

      // Log the request for admin tracking
      await supabase
        .from('vehicle_requests')
        .insert({
          vehicle_id:   vehicleId,
          requested_by: uid,
          make:         make.trim(),
          model:        model.trim(),
          year:         parsedYear,
          trim:         trim.trim() || null,
          notes:        notes.trim() || null,
          status:       'pending',
        });

      setSubmittedData({ make: make.trim(), model: model.trim(), year, trim: trim.trim() });
      setSubmitted(true);

    } catch (e) {
      Alert.alert('Error', 'Could not submit request. Please try again.');
    }
    setSubmitting(false);
  }

  // ── Success state ─────────────────────────────────────────────────────────

  if (submitted && submittedData) {
    return (
      <SafeAreaView style={globalStyles.screen}>
        <ScrollView contentContainerStyle={styles.successContainer} showsVerticalScrollIndicator={false}>

          <View style={styles.successIcon}>
            <Text style={styles.successIconText}>✓</Text>
          </View>

          <Text style={styles.successTitle}>Request submitted</Text>
          <Text style={styles.successBody}>
            Your {submittedData.make} {submittedData.model} has been added to your garage.
            We'll review and officially add it to the database — your logged data will carry over automatically.
          </Text>

          <View style={globalStyles.card}>
            <Text style={[typography.label, { marginBottom: spacing.sm }]}>Added to your garage</Text>
            {[
              { label: 'Make',  val: submittedData.make },
              { label: 'Model', val: submittedData.model },
              { label: 'Year',  val: submittedData.year },
              ...(submittedData.trim ? [{ label: 'Trim', val: submittedData.trim }] : []),
            ].map(({ label, val }) => (
              <View key={label} style={styles.summaryRow}>
                <Text style={typography.caption}>{label}</Text>
                <Text style={styles.summaryVal}>{val}</Text>
              </View>
            ))}
            <View style={[styles.summaryRow, { marginTop: spacing.sm }]}>
              <Text style={typography.caption}>Status</Text>
              <View style={styles.pendingTag}>
                <Text style={styles.pendingTagText}>Pending review</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoBoxText}>
              Start logging sessions now using your new vehicle. You'll be notified once it's officially added.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              navigation.navigate('EditGarageVehicle', { autoOpenTyreModal: true });
            }}
          >
            <Text style={styles.primaryBtnText}>Add tyre set & go →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate('GarageTab')}
          >
            <Text style={styles.secondaryBtnText}>Go to garage</Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Form state ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={globalStyles.screen}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: spacing.md }}>
            <Text style={[typography.caption, { color: colors.accent }]}>← Back</Text>
          </TouchableOpacity>

          <Text style={typography.heading}>Can't find your car?</Text>
          <Text style={[typography.caption, { marginTop: 2, marginBottom: spacing.md }]}>
            Submit it for addition to TrackPressure
          </Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoBoxText}>
              <Text style={{ color: colors.accent, fontWeight: '500' }}>You can start logging immediately. </Text>
              Your vehicle will be added to your garage right away. Once officially reviewed and added, all your logged data carries over automatically — nothing changes on your end.
            </Text>
          </View>

          {/* Make */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Make</Text>
            <TextInput
              style={styles.input}
              value={make}
              onChangeText={setMake}
              placeholder="e.g. Lotus"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
            />
          </View>

          {/* Model */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Model</Text>
            <TextInput
              style={styles.input}
              value={model}
              onChangeText={setModel}
              placeholder="e.g. Emira"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
            />
          </View>

          {/* Year + Trim row */}
          <View style={styles.rowFields}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Year</Text>
              <TextInput
                style={styles.input}
                value={year}
                onChangeText={setYear}
                placeholder="2024"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                maxLength={4}
              />
            </View>
            <View style={[styles.field, { flex: 1.5 }]}>
              <Text style={styles.fieldLabel}>Trim / variant <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput
                style={styles.input}
                value={trim}
                onChangeText={setTrim}
                placeholder="V6, RS, Base…"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Notes */}
          <View
            ref={notesRef}
            style={styles.field}
            onLayout={() => {}}
          >
            <Text style={styles.fieldLabel}>
              Anything else useful? <Text style={styles.optional}>(optional)</Text>
            </Text>
            <TextInput
              style={styles.textarea}
              value={notes}
              onChangeText={setNotes}
              placeholder="Engine, market variant, special edition details…"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={MAX_NOTES}
              textAlignVertical="top"
              onFocus={() => {
                setTimeout(() => {
                  notesRef.current?.measureLayout(
                    scrollRef.current as any,
                    (_x, y) => { scrollRef.current?.scrollTo({ y, animated: true }); },
                    () => {}
                  );
                }, 150);
              }}
            />
            <Text style={styles.charCount}>{notes.length} / {MAX_NOTES}</Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting || !canSubmit}
          >
            <Text style={[styles.primaryBtnText, !canSubmit && styles.primaryBtnTextDisabled]}>
              {submitting ? 'Submitting…' : 'Submit request'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { padding: spacing.lg, paddingBottom: 40 },
  successContainer: { padding: spacing.lg, paddingBottom: 40, alignItems: 'stretch' },

  // Info box
  infoBox: {
    backgroundColor: 'rgba(0,163,255,0.07)',
    borderWidth: 0.5, borderColor: 'rgba(0,163,255,0.25)',
    borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.sm,
  },
  infoBoxText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },

  // Form fields
  field:       { marginBottom: spacing.md },
  fieldLabel:  { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.sm },
  optional:    { fontSize: 10, color: colors.textMuted, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic' },
  rowFields:   { flexDirection: 'row', gap: spacing.sm },
  input: {
    backgroundColor: colors.bgCard, borderWidth: 0.5, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md,
    fontSize: 14, color: colors.textPrimary,
  },
  textarea: {
    backgroundColor: colors.bgCard, borderWidth: 0.5, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md,
    fontSize: 13, color: colors.textPrimary,
    minHeight: 80, lineHeight: 19,
  },
  charCount: { fontSize: 10, color: colors.textMuted, textAlign: 'right', marginTop: 4 },

  // Buttons
  primaryBtn: {
    backgroundColor: colors.accent, borderRadius: radius.lg,
    paddingVertical: 14, alignItems: 'center', marginTop: spacing.sm,
  },
  primaryBtnDisabled: { backgroundColor: colors.bgHighlight },
  primaryBtnText: { fontSize: 15, fontWeight: '600', color: '#000' },
  primaryBtnTextDisabled: { color: colors.textMuted },
  secondaryBtn: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg,
    paddingVertical: 13, alignItems: 'center', marginTop: spacing.sm,
  },
  secondaryBtnText: { fontSize: 14, color: colors.textSecondary },
  cancelBtn:     { paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  cancelBtnText: { fontSize: 13, color: colors.textMuted, textDecorationLine: 'underline' },

  // Success state
  successIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.successSubtle,
    borderWidth: 0.5, borderColor: colors.success,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: spacing.md, marginTop: spacing.lg,
  },
  successIconText: { fontSize: 22, color: colors.success, fontWeight: '700' },
  successTitle: {
    fontSize: 20, fontWeight: '500', color: colors.textPrimary,
    textAlign: 'center', marginBottom: spacing.sm,
  },
  successBody: {
    fontSize: 13, color: colors.textMuted, textAlign: 'center',
    lineHeight: 20, marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  summaryVal: { fontSize: 13, color: colors.textPrimary, fontWeight: '500' },
  pendingTag: {
    backgroundColor: 'rgba(255,160,0,0.12)',
    borderWidth: 0.5, borderColor: 'rgba(255,160,0,0.3)',
    borderRadius: 10, paddingHorizontal: 9, paddingVertical: 2,
  },
  pendingTagText: { fontSize: 10, color: '#ffa040', fontWeight: '500' },
});
