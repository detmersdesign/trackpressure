import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  ScrollView, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, typography, spacing, radius, globalStyles } from '../lib/theme';
import { supabase } from '../lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = 'bug' | 'feature' | 'data';
type Status   = 'submitted' | 'reviewing' | 'implemented' | 'future_version' | 'declined';

interface FeedbackItem {
  id:          string;
  category:    Category;
  screen:      string | null;
  message:     string;
  status:      Status;
  public_note: string | null;
  created_at:  string;
}

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'bug',     label: 'Bug'     },
  { key: 'feature', label: 'Feature' },
  { key: 'data',    label: 'Data'    },
];

const SCREENS = [
  { value: '',               label: 'Not specific to a screen' },
  { value: 'garage',         label: 'Garage'          },
  { value: 'event_setup',    label: 'Event setup'     },
  { value: 'historic_entry', label: 'Historic entry' },
  { value: 'cold_entry',     label: 'Cold entry'      },
  { value: 'hot_entry',      label: 'Hot entry'       },
  { value: 'confirmation',   label: 'Confirmation'    },
  { value: 'history',        label: 'History'         },
  { value: 'delta_analysis', label: 'Delta analysis'  },
  { value: 'settings',       label: 'Settings'        },
  { value: 'other',          label: 'Other'           },
];

const STATUS_CONFIG: Record<Status, { label: string; color: string }> = {
  submitted:      { label: 'Submitted',     color: colors.textMuted    },
  reviewing:      { label: 'Reviewing',     color: colors.warning      },
  implemented:    { label: 'Implemented',   color: colors.success      },
  future_version: { label: 'Future version',color: colors.accent       },
  declined:       { label: 'Declined',      color: colors.danger       },
};

const CATEGORY_CONFIG: Record<Category, { label: string; color: string; bg: string; border: string }> = {
  bug:     { label: 'Bug',     color: colors.danger,  bg: colors.dangerSubtle,  border: colors.danger  },
  feature: { label: 'Feature', color: colors.accent,  bg: colors.accentSubtle,  border: colors.accent  },
  data:    { label: 'Data',    color: colors.warning, bg: colors.warningSubtle, border: colors.warning },
};

const MAX_LENGTH = 500;

// ── Component ─────────────────────────────────────────────────────────────────

export default function FeedbackScreen({ navigation }: Props) {
  const [category,       setCategory]       = useState<Category>('bug');
  const [selectedScreen, setSelectedScreen] = useState<string>('');
  const [message,        setMessage]        = useState('');
  const [submitting,     setSubmitting]     = useState(false);
  const [submissions,    setSubmissions]    = useState<FeedbackItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [screenPickerOpen, setScreenPickerOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data?.user?.id ?? null);
    });
  }, []);

  // ── Load previous submissions ─────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('feedback')
      .select('id, category, screen, message, status, public_note, created_at')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });
    if (data) setSubmissions(data as FeedbackItem[]);
    setLoadingHistory(false);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (message.trim().length < 5) {
      Alert.alert('Too short', 'Please add a bit more detail so we can help.');
      return;
    }
    if (!userId) {
      Alert.alert('Not signed in', 'Please sign in to submit feedback.');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('feedback').insert({
      user_id:  userId,
      category,
      screen:   selectedScreen || null,
      message:  message.trim(),
      status:   'submitted',
    });
    setSubmitting(false);
    if (error) {
      Alert.alert('Something went wrong', 'Please try again.');
      return;
    }
    setMessage('');
    setSelectedScreen('');
    setCategory('bug');
    Alert.alert('Thank you', 'Your feedback has been submitted.');
    loadHistory();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const selectedScreenLabel = SCREENS.find(s => s.value === selectedScreen)?.label
    ?? 'Not specific to a screen';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={globalStyles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[typography.caption, { color: colors.accent }]}>← Garage</Text>
          </TouchableOpacity>
          <Text style={typography.heading}>Feedback</Text>
        </View>

        {/* ── Submit section ─────────────────────────────────────────────── */}
        <Text style={globalStyles.sectionLabel}>Submit feedback</Text>

        {/* Category toggles */}
        <View style={styles.fieldWrap}>
          <Text style={styles.fieldLabel}>Category</Text>
          <View style={styles.catRow}>
            {CATEGORIES.map(({ key, label }) => {
              const cfg    = CATEGORY_CONFIG[key];
              const active = category === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.catBtn,
                    active && {
                      backgroundColor: cfg.bg,
                      borderColor:     cfg.border,
                    },
                  ]}
                  onPress={() => setCategory(key)}
                >
                  <Text style={[
                    styles.catBtnText,
                    active && { color: cfg.color },
                  ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Screen picker */}
        <View style={styles.fieldWrap}>
          <Text style={styles.fieldLabel}>Screen (optional)</Text>
          <TouchableOpacity
            style={styles.pickerBtn}
            onPress={() => setScreenPickerOpen(v => !v)}
          >
            <Text style={styles.pickerBtnText}>{selectedScreenLabel}</Text>
            <Text style={styles.pickerArrow}>{screenPickerOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {screenPickerOpen && (
            <View style={styles.pickerList}>
              {SCREENS.map(s => (
                <TouchableOpacity
                  key={s.value}
                  style={[
                    styles.pickerItem,
                    selectedScreen === s.value && styles.pickerItemActive,
                  ]}
                  onPress={() => {
                    setSelectedScreen(s.value);
                    setScreenPickerOpen(false);
                  }}
                >
                  <Text style={[
                    styles.pickerItemText,
                    selectedScreen === s.value && { color: colors.accent },
                  ]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Message */}
        <View style={styles.fieldWrap}>
          <Text style={styles.fieldLabel}>Your feedback</Text>
          <TextInput
            style={styles.textarea}
            value={message}
            onChangeText={setMessage}
            placeholder="Describe the issue or idea…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={MAX_LENGTH}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{message.length}/{MAX_LENGTH}</Text>
        </View>

        {/* Submit button */}
        <TouchableOpacity
          style={[styles.submitBtn, (submitting || message.trim().length < 5) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || message.trim().length < 5}
        >
          <Text style={[styles.submitBtnText, (submitting || message.trim().length < 5) && styles.submitBtnTextDisabled]}>
            {submitting ? 'Submitting…' : 'Submit'}
          </Text>
        </TouchableOpacity>

        {/* ── Previous submissions ────────────────────────────────────────── */}
        <View style={styles.divider} />

        <View style={styles.prevHeader}>
          <Text style={styles.prevTitle}>Your previous submissions</Text>
          <Text style={styles.prevCount}>{submissions.length} total</Text>
        </View>

        {loadingHistory ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.lg }} />
        ) : submissions.length === 0 ? (
          <Text style={styles.emptyText}>No submissions yet.</Text>
        ) : (
          submissions.map(item => {
            const catCfg    = CATEGORY_CONFIG[item.category as Category];
            const statusCfg = STATUS_CONFIG[item.status as Status] ?? STATUS_CONFIG.submitted;
            return (
              <View key={item.id} style={styles.fbCard}>
                <View style={styles.fbCardTop}>
                  <View style={styles.fbMeta}>
                    <View style={[styles.fbTypeBadge, { backgroundColor: catCfg.bg, borderColor: catCfg.border }]}>
                      <Text style={[styles.fbTypeText, { color: catCfg.color }]}>{catCfg.label}</Text>
                    </View>
                    {item.screen && (
                      <View style={styles.fbScreenBadge}>
                        <Text style={styles.fbScreenText}>
                          {SCREENS.find(s => s.value === item.screen)?.label ?? item.screen}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.fbDate}>{formatDate(item.created_at)}</Text>
                </View>
                <Text style={styles.fbMessage}>{item.message}</Text>
                <View style={styles.fbStatusRow}>
                  <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
                  <Text style={[styles.statusLabel, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                </View>
                {item.public_note && (
                  <Text style={styles.publicNote}>{item.public_note}</Text>
                )}
              </View>
            );
          })
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  topBar: {
    marginBottom: spacing.lg,
  },
  fieldWrap: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
  },

  // Category toggles
  catRow: {
    flexDirection: 'row',
    gap: 8,
  },
  catBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 0.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  catBtnText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },

  // Screen picker
  pickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 0.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  pickerBtnText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  pickerArrow: {
    fontSize: 10,
    color: colors.textMuted,
  },
  pickerList: {
    marginTop: 4,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 0.5,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  pickerItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  pickerItemActive: {
    backgroundColor: colors.accentSubtle,
  },
  pickerItemText: {
    fontSize: 14,
    color: colors.textPrimary,
  },

  // Message
  textarea: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 100,
    lineHeight: 21,
  },
  charCount: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },

  // Submit
  submitBtn: {
    backgroundColor: colors.success,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  submitBtnDisabled: {
    backgroundColor: colors.bgHighlight,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  submitBtnTextDisabled: {
    color: colors.textMuted,
  },

  // Divider
  divider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginVertical: spacing.xl,
  },

  // Previous submissions header
  prevHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  prevTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  prevCount: {
    fontSize: 11,
    color: colors.textMuted,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingTop: spacing.lg,
  },

  // Feedback card
  fbCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  fbCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  fbMeta: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
  },
  fbTypeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 0.5,
  },
  fbTypeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  fbScreenBadge: {
    backgroundColor: colors.bgHighlight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  fbScreenText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  fbDate: {
    fontSize: 10,
    color: colors.textMuted,
    marginLeft: 8,
  },
  fbMessage: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  fbStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 11,
  },
  publicNote: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
    paddingLeft: 14,
  },
});
