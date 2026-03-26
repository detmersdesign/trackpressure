import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../lib/theme';

interface Props {
  label: string;
  auto?: boolean;
}

export function ContextPill({ label, auto = true }: Props) {
  return (
    <View style={[styles.pill, auto ? styles.pillAuto : styles.pillManual]}>
      {auto && <View style={styles.dot} />}
      <Text style={[styles.text, auto ? styles.textAuto : styles.textManual]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 4,
  },
  pillAuto: {
    backgroundColor: '#0F2E1C',
    borderWidth: 0.5,
    borderColor: '#1D9E75',
  },
  pillManual: {
    backgroundColor: colors.bgHighlight,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginRight: 5,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
  textAuto: {
    color: colors.success,
  },
  textManual: {
    color: colors.textSecondary,
  },
});
