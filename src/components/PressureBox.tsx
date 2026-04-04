import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, typography, radius, spacing } from '../lib/theme';

interface Props {
  label: string;
  sublabel: string;
  value: string;
  active: boolean;
  optional?: boolean;
  onPress: () => void;
}

export function PressureBox({ label, sublabel, value, active, optional, onPress }: Props) {
  const isEmpty = !value || value === '';
  return (
    <TouchableOpacity
      style={[styles.box, active && styles.boxActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        {optional && <Text style={styles.optionalTag}>optional</Text>}
        <Text style={[styles.sublabel, active && styles.sublabelActive]}>{sublabel}</Text>
      </View>
      <Text style={[styles.value, isEmpty && styles.valuePlaceholder]}>
        {isEmpty ? '—' : value}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 88,
  },
  boxActive: {
    borderColor: colors.accent,
    borderWidth: 1.5,
    backgroundColor: colors.accentSubtle,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  optionalTag: {
    fontSize: 10,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  value: {
    fontFamily: 'monospace',
    fontSize: 30,
    color: colors.textPrimary,
    lineHeight: 36,
  },
  valuePlaceholder: {
    color: colors.textMuted,
    fontSize: 24,
  },
  sublabel: {
    ...typography.caption,
    marginTop: 4,
    color: colors.textMuted,
  },
  sublabelActive: {
    color: colors.accent,
  },
});
