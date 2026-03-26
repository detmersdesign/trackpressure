import { StyleSheet } from 'react-native';

export const colors = {
  // Core
  bg:            '#0F0F0F',
  bgCard:        '#1A1A1A',
  bgInput:       '#242424',
  bgHighlight:   '#2A2A2A',
  border:        '#2E2E2E',
  borderActive:  '#4A9EFF',

  // Text
  textPrimary:   '#F0EDE8',
  textSecondary: '#8A8880',
  textMuted:     '#565452',
  textInverted:  '#0F0F0F',

  // Accent — single bold blue
  accent:        '#4A9EFF',
  accentDark:    '#1A6FCC',
  accentSubtle:  '#1A2D42',

  // Semantic
  success:       '#3DBE7A',
  successSubtle: '#0F2E1C',
  warning:       '#F5A623',
  warningSubtle: '#2E1F0A',
  danger:        '#E85454',
  dangerSubtle:  '#2E0F0F',

  // Special
  purple:        '#9D7FEA',
  purpleSubtle:  '#1E1530',
};

export const typography = {
  // Display numbers — tabular figures for pressure readings
  numLarge:  { fontFamily: 'monospace', fontSize: 36, color: colors.textPrimary },
  numMedium: { fontFamily: 'monospace', fontSize: 24, color: colors.textPrimary },
  numSmall:  { fontFamily: 'monospace', fontSize: 16, color: colors.textPrimary },

  // UI text
  heading:   { fontSize: 22, fontWeight: '600' as const, color: colors.textPrimary, letterSpacing: -0.3 },
  subhead:   { fontSize: 16, fontWeight: '500' as const, color: colors.textPrimary },
  body:      { fontSize: 14, fontWeight: '400' as const, color: colors.textPrimary, lineHeight: 20 },
  caption:   { fontSize: 12, fontWeight: '400' as const, color: colors.textSecondary },
  label:     { fontSize: 11, fontWeight: '500' as const, color: colors.textSecondary, letterSpacing: 0.6, textTransform: 'uppercase' as const },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
};

export const globalStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  sectionLabel: {
    ...typography.label,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
});
