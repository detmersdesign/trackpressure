import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, typography, spacing, radius, globalStyles } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { GarageVehicle, GarageTireSet, Tire } from '../types';
import { useSettings } from '../hooks/useSettings';

type Props = NativeStackScreenProps<any, 'EditGarageVehicle'>;

export default function EditGarageVehicleScreen({ navigation, route }: Props) {
  const garageVehicle: GarageVehicle = route.params?.garageVehicle;
  const vehicle  = garageVehicle.vehicle;

  const [nickname, setNickname] = useState(garageVehicle.nickname ?? '');
  const [userYear, setUserYear] = useState(garageVehicle.user_year?.toString() ?? '');
  const [notes, setNotes]       = useState(garageVehicle.notes ?? '');
  const userYearRef = useRef<TextInput>(null);
  const [saving, setSaving]                 = useState(false);
  const [addTyreVisible, setAddTyreVisible] = useState(false);
  const [localTireSets, setLocalTireSets]   = useState<GarageTireSet[]>(garageVehicle.tire_sets ?? []);
  const { displayPressure, pressureUnit } = useSettings();

  // ── All garage vehicles for reordering ───────────────────────────────────
  const [allGarageVehicles, setAllGarageVehicles] = useState<{ id: string; display_order: number }[]>([]);
  const [currentOrder, setCurrentOrder]           = useState(garageVehicle.display_order);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data?.user?.id) return;
      const { data: gvs } = await supabase
        .from('garage_vehicles')
        .select('id, display_order')
        .eq('user_id', data.user.id)
        .order('display_order', { ascending: true });
      if (gvs) setAllGarageVehicles(gvs);
    });
  }, []);

  async function handleMoveUp() {
    const sorted = [...allGarageVehicles].sort((a, b) => a.display_order - b.display_order);
    const idx    = sorted.findIndex(v => v.id === garageVehicle.id);
    if (idx <= 0) return;

    // Swap positions in the sorted array
    const newSorted = [...sorted];
    const temp      = newSorted[idx];
    newSorted[idx]  = newSorted[idx - 1];
    newSorted[idx - 1] = temp;

    // Write new sequential order values based on array position
    await Promise.all(
      newSorted.map((v, i) =>
        supabase.from('garage_vehicles').update({ display_order: i + 1 }).eq('id', v.id)
      )
    );

    // Update local state with new sequential values
    const updated = newSorted.map((v, i) => ({ ...v, display_order: i + 1 }));
    setAllGarageVehicles(updated);
    const newIdx = updated.findIndex(v => v.id === garageVehicle.id);
    setCurrentOrder(newIdx + 1);
  }

  async function handleMoveDown() {
    const sorted = [...allGarageVehicles].sort((a, b) => a.display_order - b.display_order);
    const idx    = sorted.findIndex(v => v.id === garageVehicle.id);
    if (idx < 0 || idx >= sorted.length - 1) return;

    const newSorted = [...sorted];
    const temp      = newSorted[idx];
    newSorted[idx]  = newSorted[idx + 1];
    newSorted[idx + 1] = temp;

    await Promise.all(
      newSorted.map((v, i) =>
        supabase.from('garage_vehicles').update({ display_order: i + 1 }).eq('id', v.id)
      )
    );

    const updated = newSorted.map((v, i) => ({ ...v, display_order: i + 1 }));
    setAllGarageVehicles(updated);
    const newIdx = updated.findIndex(v => v.id === garageVehicle.id);
    setCurrentOrder(newIdx + 1);
  }

  const sorted      = [...allGarageVehicles].sort((a, b) => a.display_order - b.display_order);
  const currentIdx  = sorted.findIndex(v => v.id === garageVehicle.id);
  const canMoveUp   = currentIdx > 0;
  const canMoveDown = currentIdx >= 0 && currentIdx < sorted.length - 1;

  // ── Save nickname + notes ─────────────────────────────────────────────────
  async function handleSave() {
    const parsedYear = parseInt(userYear);
    if (userYear && !isNaN(parsedYear) && vehicle) {
      const validStart = parseInt(`${vehicle.year_start}`);
      const validEnd   = parseInt(`${vehicle.year_end ?? vehicle.year_start}`);
      if (parsedYear < validStart || parsedYear > validEnd) {
        Alert.alert(
          'Invalid year',
          `Please enter a year between ${validStart} and ${validEnd} for this vehicle.`,
          [{ text: 'OK', onPress: () => userYearRef.current?.focus() }]
        );
        return;
      }
    }
    setSaving(true);
    const { error } = await supabase
      .from('garage_vehicles')
      .update({
        nickname:  nickname.trim() || null,
        user_year: !isNaN(parsedYear) ? parsedYear : null,
        notes:     notes.trim()    || null,
      })
      .eq('id', garageVehicle.id);
    setSaving(false);
    if (error) {
      Alert.alert('Error', 'Could not save changes.');
    } else {
      navigation.goBack();
    }
  }

  // ── Set default tire set ──────────────────────────────────────────────────
  async function handleSetDefault(tireSet: GarageTireSet) {
    await supabase
      .from('garage_tire_sets')
      .update({ is_default: true })
      .eq('id', tireSet.id);
    setLocalTireSets(prev =>
      prev.map(ts => ({ ...ts, is_default: ts.id === tireSet.id }))
    );
  }

  // ── Delete tire set ───────────────────────────────────────────────────────
  function handleDeleteTyreSet(tireSet: GarageTireSet) {
    Alert.alert(
      'Delete tire set',
      `Remove "${tireSet.name}" from this car?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('garage_tire_sets').delete().eq('id', tireSet.id);
            setLocalTireSets(prev => prev.filter(ts => ts.id !== tireSet.id));
          },
        },
      ]
    );
  }

  // ── Delete car ────────────────────────────────────────────────────────────
  function handleDeleteCar() {
    const displayName = garageVehicle.nickname ?? `${vehicle?.make} ${vehicle?.model}`;
    Alert.alert(
      'Remove from garage',
      `Remove ${displayName}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('garage_vehicles').delete().eq('id', garageVehicle.id);
            navigation.goBack();
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={globalStyles.screen}>

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[typography.caption, { color: colors.accent }]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={typography.subhead}>Edit car</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          <Text style={[typography.caption, { color: colors.accent, fontWeight: '500' }]}>
            {saving ? 'Saving…' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Vehicle identity + order controls */}
        <View style={styles.vehicleHeader}>
          <View style={styles.vehicleHeaderTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.vehicleName}>
                {vehicle?.year_end
                  ? `${vehicle?.year_start}–${vehicle?.year_end}`
                  : vehicle?.year_start} {vehicle?.make} {vehicle?.model}
              </Text>
              <Text style={styles.vehicleTrim}>{vehicle?.trim}</Text>
              <Text style={styles.vehicleOem}>
                OEM {vehicle ? displayPressure(vehicle.oem_pressure_front) : '—'} / {vehicle ? displayPressure(vehicle.oem_pressure_rear) : '—'} {pressureUnit()}
              </Text>
            </View>
            {allGarageVehicles.length > 1 && (
              <View style={styles.orderControls}>
                <Text style={styles.orderLabel}>
                  {currentIdx + 1} of {sorted.length}
                </Text>
                <TouchableOpacity
                  style={[styles.orderBtn, !canMoveUp && styles.orderBtnDisabled]}
                  onPress={handleMoveUp}
                  disabled={!canMoveUp}
                >
                  <Text style={[styles.orderBtnText, !canMoveUp && { opacity: 0.3 }]}>↑</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.orderBtn, !canMoveDown && styles.orderBtnDisabled]}
                  onPress={handleMoveDown}
                  disabled={!canMoveDown}
                >
                  <Text style={[styles.orderBtnText, !canMoveDown && { opacity: 0.3 }]}>↓</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Nickname */}
        <Text style={styles.fieldLabel}>Nickname</Text>
        <TextInput
          style={styles.input}
          value={nickname}
          onChangeText={setNickname}
          placeholder="e.g. Track GT3"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
          returnKeyType="next"
        />

        {/* My year */}
        <Text style={styles.fieldLabel}>My year</Text>
        <TextInput
          ref={userYearRef}
          style={styles.input}
          value={userYear}
          onChangeText={setUserYear}
          placeholder={vehicle?.year_end
            ? `e.g. ${vehicle.year_start}–${vehicle.year_end}`
            : `${vehicle?.year_start ?? ''}`}
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
          maxLength={4}
          returnKeyType="next"
        />

        {/* Notes */}
        <Text style={styles.fieldLabel}>Notes</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Alignment, torque specs, setup notes…"
          placeholderTextColor={colors.textMuted}
          multiline
        />

        {/* Tire sets */}
        <View style={styles.tyreSetsHeader}>
          <Text style={styles.fieldLabel}>Tyre sets</Text>
          <TouchableOpacity onPress={() => setAddTyreVisible(true)}>
            <Text style={styles.addLink}>+ Add set</Text>
          </TouchableOpacity>
        </View>

        {localTireSets.length === 0 ? (
          <TouchableOpacity
            style={styles.emptyPrompt}
            onPress={() => setAddTyreVisible(true)}
          >
            <Text style={styles.emptyText}>
              No tire sets yet — add one to start logging sessions
            </Text>
          </TouchableOpacity>
        ) : (
          localTireSets.map(ts => (
            <View key={ts.id} style={styles.tyreRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.tyreNameRow}>
                  <Text style={styles.tyreName}>{ts.name}</Text>
                  {ts.is_default && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>default</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.tyreCompound}>
                  {ts.tire_front?.id === ts.tire_rear?.id
                    ? ts.tire_front?.compound
                    : `F: ${ts.tire_front?.compound} · R: ${ts.tire_rear?.compound}`}
                </Text>
              </View>
              <View style={styles.tyreActions}>
                {!ts.is_default && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleSetDefault(ts)}
                  >
                    <Text style={styles.actionBtnText}>Set default</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionBtn, styles.deleteBtn]}
                  onPress={() => handleDeleteTyreSet(ts)}
                >
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* Delete car */}
        <TouchableOpacity style={styles.deleteCarBtn} onPress={handleDeleteCar}>
          <Text style={styles.deleteCarText}>Remove car from garage</Text>
        </TouchableOpacity>

      </ScrollView>

      <AddTyreSetModal
        visible={addTyreVisible}
        garageVehicleId={garageVehicle.id}
        existingTireSets={localTireSets}
        onClose={() => setAddTyreVisible(false)}
        onAdded={(newSet) => {
          setLocalTireSets(prev => [...prev, newSet]);
          setAddTyreVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

// ── Add Tire Set Modal ────────────────────────────────────────────────────────
function TireSearch({
    label, query, onQuery, selected, onSelect, tires,
  }: {
    label: string;
    query: string;
    onQuery: (s: string) => void;
    selected: Tire | null;
    onSelect: (t: Tire) => void;
    tires: Tire[];
  }) {
    const results = filterTires(tires, query);
    return (
      <>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={onQuery}
          placeholder="Search brand or compound…"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <View style={styles.searchResults}>
            {results.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[styles.searchResult, selected?.id === t.id && styles.searchResultSelected]}
                onPress={() => { onSelect(t); onQuery(`${t.brand} ${t.compound}`); }}
              >
                <Text style={[styles.searchResultText, selected?.id === t.id && { color: colors.accent }]}>
                  {t.brand} {t.compound}
                </Text>
                <Text style={styles.searchResultSub}>
                  {t.width}/{t.aspect_ratio}R{t.rim_diameter}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {selected && (
          <View style={styles.selectedChip}>
            <Text style={styles.selectedChipText}>✓ {selected.brand} {selected.compound}</Text>
          </View>
        )}
      </>
    );
}

function filterTires(tires: Tire[], q: string) {
  return tires.filter(t =>
    `${t.brand} ${t.model} ${t.compound}`.toLowerCase().includes(q.toLowerCase())
  );
}

function AddTyreSetModal({
  visible, garageVehicleId, existingTireSets, onClose, onAdded,
}: {
  visible: boolean;
  garageVehicleId: string;
  existingTireSets: GarageTireSet[];
  onClose: () => void;
  onAdded: (ts: GarageTireSet) => void;
}) {
  const [setName, setSetName]             = useState('');
  const [search, setSearch]               = useState('');
  const [selectedTire, setSelectedTire]   = useState<Tire | null>(null);
  const [saving, setSaving]               = useState(false);
  const [tires, setTires]                 = useState<Tire[]>([]);

  useEffect(() => {
    supabase
      .from('tires')
      .select('*')
      .order('brand', { ascending: true })
      .then(({ data }) => {
        if (data) setTires(data as Tire[]);
      });
  }, []);

  function reset() {
    setSetName('');
    setSearch('');
    setSelectedTire(null);
  }

  const hasSelection = selectedTire !== null;
  const isDuplicate  = selectedTire !== null &&
    existingTireSets.some(ts =>
      ts.tire_front_id === selectedTire.id && ts.tire_rear_id === selectedTire.id
    );
  const canSave = hasSelection && !isDuplicate;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('garage_tire_sets')
      .insert({
        garage_vehicle_id: garageVehicleId,
        name:          setName.trim() || selectedTire!.compound,
        tire_front_id: selectedTire!.id,
        tire_rear_id:  selectedTire!.id,
        is_default:    false,
      })
      .select('id, garage_vehicle_id, name, tire_front_id, tire_rear_id, is_default, notes, created_at')
      .single();

    setSaving(false);
    if (!error && data) {
      onAdded({
        ...data,
        tire_front: tires.find(t => t.id === data.tire_front_id),
        tire_rear:  tires.find(t => t.id === data.tire_rear_id),
      } as GarageTireSet);
      reset();
    } else {
      Alert.alert('Error', 'Could not save tire set.');
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[globalStyles.screen, { padding: spacing.lg }]}>
        <View style={styles.modalHeader}>
          <Text style={typography.heading}>Add tire set</Text>
          <TouchableOpacity onPress={() => { reset(); onClose(); }}>
            <Text style={[typography.caption, { color: colors.accent }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.fieldLabel}>Set name</Text>
          <TextInput
            style={styles.input}
            value={setName}
            onChangeText={setSetName}
            placeholder="e.g. Track set (optional — defaults to compound name)"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
          />
          <TireSearch
            label="Tire compound"
            query={search}
            onQuery={setSearch}
            selected={selectedTire}
            onSelect={setSelectedTire}
            tires={tires}
          />
          {isDuplicate && (
            <Text style={{ fontSize: 12, color: colors.danger, marginBottom: spacing.sm }}>
              This compound is already added to this car
            </Text>
          )}
          <TouchableOpacity
            style={[styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave || saving}
          >
            <Text style={[styles.saveBtnText, (!canSave || saving) && styles.saveBtnTextDisabled]}>
              {saving ? 'Saving…' : 'Add tire set'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  container: { padding: spacing.lg, paddingBottom: 40 },
  vehicleHeader: {
    marginBottom: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  vehicleHeaderTop: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
  },
  vehicleName: { fontSize: 20, fontWeight: '500', color: colors.textPrimary },
  vehicleTrim: { ...typography.caption, marginTop: 2 },
  vehicleOem:  { ...typography.caption, color: colors.textMuted, marginTop: 4 },

  orderControls: {
    alignItems: 'center', gap: 4,
  },
  orderLabel: {
    fontSize: 10, color: colors.textMuted, marginBottom: 2,
  },
  orderBtn: {
    width: 32, height: 32, borderRadius: radius.sm,
    borderWidth: 0.5, borderColor: colors.border,
    backgroundColor: colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
  },
  orderBtnDisabled: { opacity: 0.3 },
  orderBtnText: { fontSize: 16, color: colors.textPrimary },

  fieldLabel: {
    fontSize: 11, fontWeight: '500', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: spacing.sm, marginTop: spacing.lg,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border,
    padding: spacing.md, fontSize: 14, color: colors.textPrimary,
  },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  tyreSetsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: spacing.xl,
  },
  addLink: { fontSize: 13, color: colors.accent, fontWeight: '500' },
  emptyPrompt: {
    borderWidth: 0.5, borderColor: colors.border, borderStyle: 'dashed',
    borderRadius: radius.md, padding: spacing.lg,
    alignItems: 'center', marginTop: spacing.sm,
  },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  tyreRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  tyreNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 3 },
  tyreName: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  defaultBadge: {
    backgroundColor: colors.accentSubtle, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 0.5, borderColor: colors.accent,
  },
  defaultBadgeText: { fontSize: 10, color: colors.accent, fontWeight: '500' },
  tyreCompound: { ...typography.caption },
  tyreActions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  actionBtn: {
    paddingHorizontal: spacing.sm, paddingVertical: 5,
    borderRadius: radius.sm, borderWidth: 0.5, borderColor: colors.border,
  },
  actionBtnText: { fontSize: 11, color: colors.textSecondary },
  deleteBtn: { borderColor: colors.danger },
  deleteBtnText: { fontSize: 11, color: colors.danger },
  deleteCarBtn: {
    marginTop: spacing.xxl,
    backgroundColor: colors.dangerSubtle,
    borderRadius: radius.lg, borderWidth: 0.5, borderColor: colors.danger,
    paddingVertical: 14, alignItems: 'center',
  },
  deleteCarText: { fontSize: 15, fontWeight: '500', color: colors.danger },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.lg,
  },
  toggleOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  toggleThumb: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.textMuted },
  toggleThumbOn: { backgroundColor: '#000', alignSelf: 'flex-end' },
  searchResults: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border,
    overflow: 'hidden', marginBottom: spacing.sm,
  },
  searchResult: {
    padding: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  searchResultSelected: { backgroundColor: colors.accentSubtle },
  searchResultText: { fontSize: 13, color: colors.textPrimary, fontWeight: '500' },
  searchResultSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  selectedChip: {
    backgroundColor: colors.accentSubtle,
    borderRadius: radius.sm, borderWidth: 0.5, borderColor: colors.accent,
    padding: spacing.sm, marginBottom: spacing.sm,
  },
  selectedChipText: { fontSize: 12, color: colors.accent, fontWeight: '500' },
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg, paddingVertical: 15,
    alignItems: 'center', marginTop: spacing.xl,
  },
  saveBtnDisabled: { backgroundColor: colors.bgHighlight },
  saveBtnText: { fontSize: 15, fontWeight: '600', color: '#000' },
  saveBtnTextDisabled: { color: colors.textMuted },
});
