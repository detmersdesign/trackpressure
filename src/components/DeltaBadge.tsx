import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../lib/theme';

interface Props {
  value: number;
  label?: string;
  size?: 'sm' | 'md';
}

export function DeltaBadge({ value, label, size = 'md' }: Props) {
  const isPos = value > 0;
  const isZero = value === 0;
  const sign = isPos ? '+' : '';
  const text = `${sign}${value.toFixed(1)}`;

  return (
    <View style={[
      styles.badge,
      isZero && styles.neutral,
      isPos && styles.positive,
      !isPos && !isZero && styles.negative,
      size === 'sm' && styles.sm,
    ]}>
      <Text style={[
        styles.text,
        size === 'sm' && styles.textSm,
        isZero && styles.textNeutral,
        isPos && styles.textPositive,
        !isPos && !isZero && styles.textNegative,
      ]}>
        {text}{label ? ` ${label}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  neutral:  { backgroundColor: colors.bgHighlight },
  positive: { backgroundColor: colors.successSubtle },
  negative: { backgroundColor: colors.dangerSubtle },
  text: { fontSize: 12, fontWeight: '600', fontFamily: 'monospace' },
  textSm: { fontSize: 11 },
  textNeutral:  { color: colors.textSecondary },
  textPositive: { color: colors.success },
  textNegative: { color: colors.danger },
});
