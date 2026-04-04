import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '../lib/theme';
import { supabase } from '../lib/supabase';

interface Props {
  savedEmail: string | null;
  onSendLink: (email: string) => Promise<{ error: string | null }>;
}

export default function AuthScreen({ savedEmail, onSendLink }: Props) {
  const [email, setEmail]         = useState(savedEmail ?? '');
  const [sending, setSending]     = useState(false);
  const [sent, setSent]           = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [useOther, setUseOther]   = useState(false);
  const [otpCode, setOtpCode]     = useState('');
  const [verifying, setVerifying] = useState(false);

  // Returning user — show simplified prompt
  const isReturning = savedEmail && !useOther;

  async function handleSend() {
    const target = isReturning ? savedEmail : email.trim();
    //console.log('handleSend fired, target:', target);
    if (!target) return;

    setError(null);
    setSending(true);

    const { error } = await onSendLink(target);
    //console.log('onSendLink result:', error);   //testing

    setSending(false);

    if (error) {
      setError(error);
    } else {
      setSent(true);
    }
  }

  async function handleVerify() {
    const target = isReturning ? savedEmail! : email.trim();
    setVerifying(true);
    setError(null);

    const { error } = await supabase.auth.verifyOtp({
      email: target,
      token: otpCode,
      type: 'email',
    });

    setVerifying(false);
    if (error) setError(error.message);
  }

  if (sent) {
    return (
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Text style={styles.icon}>✉️</Text>
          <Text style={styles.heading}>Check your email</Text>
          <Text style={styles.body}>
            We sent a 8-digit code to{'\n'}
            <Text style={{ color: colors.accent }}>
              {isReturning ? savedEmail : email.trim()}
            </Text>
          </Text>

          <View style={[styles.card, { marginTop: spacing.xl }]}>
            <Text style={styles.inputLabel}>Enter your 8-digit code</Text>
            <TextInput
              style={[styles.input, { fontSize: 24, letterSpacing: 8, textAlign: 'center' }]}
              value={otpCode}
              onChangeText={setOtpCode}
              placeholder="- - - - - - - -"
              placeholderTextColor={colors.textMuted}
              keyboardType="default"
              autoCapitalize="characters"
              maxLength={8}
              autoFocus
            />
            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}
            <TouchableOpacity
              style={[styles.primaryBtn, otpCode.length < 8 && styles.primaryBtnDisabled]}
              onPress={handleVerify}
              disabled={verifying || otpCode.length < 8}
              //onPress={() => console.log('BUTTON PRESSED')}
              //disabled={sending}
            >
              {verifying
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.primaryBtnText}>Verify code</Text>
              }
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.secondaryBtn, { marginTop: spacing.xl }]}
            onPress={() => { setSent(false); setOtpCode(''); setError(null); }}
          >
            <Text style={styles.secondaryBtnText}>Back</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Logo / wordmark */}
        <View style={styles.brandRow}>
          <Text style={styles.brandName}>TrackPressure</Text>
          <Text style={styles.brandSub}>Tire data for track drivers</Text>
        </View>

        {/* Returning user prompt */}
        {isReturning ? (
          <View style={styles.card}>
            <Text style={styles.returningLabel}>Welcome back</Text>
            <Text style={styles.returningEmail}>{savedEmail}</Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleSend}
              disabled={sending}
            >
              {sending
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.primaryBtnText}>Send me a sign-in code</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setUseOther(true)}
            >
              <Text style={styles.secondaryBtnText}>Use a different email</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* First time or different email */
          <View style={styles.card}>
            <Text style={styles.inputLabel}>Email address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}
            <TouchableOpacity
              style={[styles.primaryBtn, !email.trim() && styles.primaryBtnDisabled]}
              onPress={handleSend}
              disabled={sending || !email.trim()}
            >
              {sending
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.primaryBtnText}>Send sign-in code</Text>
              }
            </TouchableOpacity>
            {savedEmail && (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setUseOther(false)}
              >
                <Text style={styles.secondaryBtnText}>
                  Back to {savedEmail}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <Text style={styles.footer}>
          No password needed — we'll email you a secure sign-in code.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  brandRow: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  brandSub: {
    ...typography.caption,
    marginTop: 4,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  returningLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 4,
  },
  returningEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xl,
  },
  inputLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  primaryBtnDisabled: {
    backgroundColor: colors.bgHighlight,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  secondaryBtn: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 13,
    color: colors.accent,
  },
  icon: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  heading: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  body: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    ...typography.caption,
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.xl,
  },
});