import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Image, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Platform, Image as RNImage } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system/next';
import { colors, typography, spacing, radius, globalStyles } from '../lib/theme';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BUCKET         = 'garage-car-images';
const TARGET_WIDTH   = 1024;
const TARGET_HEIGHT  = 512;
const TIMESTAMP_KEY  = (id: string) => `garage_silhouette_ts:${id}`;
const CACHE_DIR_PATH = `${Paths.document.uri}garage-silhouettes/`;

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: any;
};

export default function EditSilhouetteScreen({ navigation, route }: Props) {
  const { garageVehicleId, vehicleLabel, currentUrl, currentTimestamp } = route.params;

  const [previewUri, setPreviewUri] = useState<string | null>(currentUrl ?? null);
  const [hasCustom,  setHasCustom]   = useState<boolean>(!!currentUrl);
  const [isDirty,    setIsDirty]     = useState(false);
  const [saving,     setSaving]      = useState(false);
  const [removing,   setRemoving]    = useState(false);

  // ── Pick + crop + resize ──────────────────────────────────────────────────

  async function pickImage(source: 'camera' | 'library') {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        source === 'camera'
          ? 'Camera access is required to take a photo.'
          : 'Photo library access is required to choose a photo.'
      );
      return;
    }

    // iOS doesn't reliably enforce aspect ratio in the built-in editor
    // so we skip allowsEditing on iOS and centre-crop manually via manipulator
    const isIOS = Platform.OS === 'ios';
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: !isIOS,
          aspect: [2, 1],
          quality: 1,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: !isIOS,
          aspect: [2, 1],
          quality: 1,
        });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    // Resize to exact 1024×512 PNG
    try {
      const asset = result.assets[0];

      if (isIOS) {
        // Navigate to interactive crop screen — returns croppedUri via route.params on focus
        const { width: srcW, height: srcH } = await new Promise<{ width: number; height: number }>(
          (resolve, reject) => RNImage.getSize(asset.uri, (w, h) => resolve({ width: w, height: h }), reject)
        );
        navigation.navigate('iOSImageCrop', {
          imageUri:    asset.uri,
          imageWidth:  srcW,
          imageHeight: srcH,
          onCropped:   (uri: string) => {
            setPreviewUri(uri);
            setIsDirty(true);
          },
        });
      } else {
        // Android uses system crop UI — just resize the result
        const ctx = ImageManipulator.manipulate(asset.uri);
        ctx.resize({ width: TARGET_WIDTH, height: TARGET_HEIGHT });
        const rendered    = await ctx.renderAsync();
        const manipulated = await rendered.saveAsync({ compress: 1, format: SaveFormat.PNG });
        setPreviewUri(manipulated.uri);
        setIsDirty(true);
      }
    } catch {
      // User cancelled or manipulator failed — do nothing
    }
  }

  // ── Save — upload to Supabase Storage + update garage_vehicles ───────────

  async function handleSave() {
    if (!previewUri || !isDirty) { navigation.goBack(); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const storagePath = `${user.id}/${garageVehicleId}.png`;

      // Read file as base64
      // Read file as base64 and decode to binary for upload
      const base64Response = await fetch(previewUri);
      const blob = await base64Response.blob();
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload  = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, binary, {
          contentType: 'image/png',
          upsert: true,
        });
      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(storagePath);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const now = new Date().toISOString();

      // Update garage_vehicles record
      const { error: dbError } = await supabase
        .from('garage_vehicles')
        .update({
          custom_silhouette_url: publicUrl,
          custom_silhouette_updated_at: now,
        })
        .eq('id', garageVehicleId);
      if (dbError) throw dbError;

      // Clear local cache timestamp so hook re-fetches fresh after garage refetches
      // from Supabase (which will have the new custom_silhouette_updated_at value)
      try {
        await AsyncStorage.removeItem(TIMESTAMP_KEY(garageVehicleId));
        const dir = new Directory(CACHE_DIR_PATH);
        if (!dir.exists) dir.create();
        dir.list().forEach((f: Directory | File) => {
          if (f instanceof File && f.name?.startsWith(garageVehicleId)) f.delete();
        });
      } catch {}

      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'Please try again.');
    }
    setSaving(false);
  }

  // ── Remove custom image ───────────────────────────────────────────────────

  async function handleRemove() {
    Alert.alert(
      'Remove custom photo',
      'This will revert to the stock silhouette. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemoving(true);
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('Not authenticated');

              const storagePath = `${user.id}/${garageVehicleId}.png`;

              await supabase.storage.from(BUCKET).remove([storagePath]);

              await supabase
                .from('garage_vehicles')
                .update({
                  custom_silhouette_url: null,
                  custom_silhouette_updated_at: null,
                })
                .eq('id', garageVehicleId);

              // Clear local cache
              try {
                const cacheDir = new Directory(CACHE_DIR_PATH);
                if (cacheDir.exists) {
                  cacheDir.list().forEach((f: Directory | File) => {
                    if (f instanceof File && f.name?.startsWith(garageVehicleId)) f.delete();
                  });
                }
                await AsyncStorage.removeItem(TIMESTAMP_KEY(garageVehicleId));
              } catch {}

              navigation.goBack();
            } catch (e: any) {
              Alert.alert('Error', e.message ?? 'Please try again.');
            }
            setRemoving(false);
          },
        },
      ]
    );
  }

  const busy = saving || removing;

  return (
    <SafeAreaView style={globalStyles.screen}>

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} disabled={busy}>
          <Text style={[typography.caption, { color: colors.accent }]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={typography.subhead}>Car photo</Text>
        <TouchableOpacity onPress={handleSave} disabled={busy || !isDirty}>
          <Text style={[
            typography.caption,
            { color: isDirty && !busy ? colors.accent : colors.textMuted, fontWeight: '500' },
          ]}>
            {saving ? 'Saving…' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Silhouette preview */}
        <View style={styles.previewWrap}>
          {previewUri ? (
            <Image
              source={{ uri: previewUri  }}
              style={styles.previewImage}
              resizeMode="cover"
              //onError={(e) => Alert.alert('Image error', e.nativeEvent.error)}
            />
          ) : (
            <View style={styles.previewPlaceholder}>
              <Text style={styles.previewPlaceholderText}>No custom photo</Text>
            </View>
          )}
        </View>

        {/* Vehicle label */}
        <Text style={styles.vehicleLabel}>{vehicleLabel}</Text>

        {/* Current status */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Current image</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: hasCustom && !isDirty ? colors.success : colors.textMuted }]} />
            <View>
              <Text style={styles.statusText}>
                {isDirty ? 'New photo selected — not yet saved' : hasCustom ? 'Your photo' : 'Stock silhouette'}
              </Text>
              <Text style={styles.statusSub}>
                {isDirty ? '1024×512 PNG ready to upload' : hasCustom ? 'Saved · 1024×512 PNG' : `${vehicleLabel} category`}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Action buttons */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Replace with</Text>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => pickImage('camera')}
            disabled={busy}
          >
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>◉</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionText}>
                {hasCustom ? 'Take a new photo' : 'Take a photo'}
              </Text>
              <Text style={styles.actionSub}>Use your camera</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => pickImage('library')}
            disabled={busy}
          >
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>⊞</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionText}>
                {hasCustom ? 'Choose from library' : 'Choose from library'}
              </Text>
              <Text style={styles.actionSub}>
                {hasCustom ? 'Replace current photo' : 'Select an existing photo'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* Remove */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.dangerBtn, !hasCustom && { opacity: 0.3 }]}
            onPress={handleRemove}
            disabled={busy || !hasCustom}
          >
            {removing ? (
              <ActivityIndicator size="small" color={colors.danger} style={{ marginRight: 8 }} />
            ) : (
              <View style={styles.actionIcon}>
                <Text style={[styles.actionIconText, { color: colors.danger }]}>✕</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionText, { color: colors.danger }]}>Remove custom photo</Text>
              <Text style={styles.actionSub}>Revert to stock silhouette</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Upload hint */}
        <Text style={styles.hint}>
          Photos are cropped to 2:1 and saved at 1024×512. A copy is stored on your device for fast loading.
        </Text>
      </ScrollView>

      {/* Saving overlay */}
      {saving && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
            Uploading photo…
          </Text>
        </View>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  previewWrap: {
    width: '100%', aspectRatio: 2, backgroundColor: '#0D0D0D',
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  previewImage: { width: '100%', height: '100%' },
  previewPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  previewPlaceholderText: {
    fontSize: 12, color: '#3A3A3A',
  },
  vehicleLabel: {
    fontSize: 12, color: colors.textMuted, textAlign: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  section: { padding: spacing.lg },
  sectionLabel: {
    fontSize: 11, color: colors.textMuted, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.bgHighlight, borderRadius: radius.md,
    borderWidth: 0.5, borderColor: colors.border, padding: spacing.md,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  statusText: { fontSize: 13, color: colors.textPrimary, fontWeight: '500' },
  statusSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  divider: { height: 0.5, backgroundColor: colors.border, marginHorizontal: spacing.lg },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    borderWidth: 0.5, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  dangerBtn: { borderColor: colors.dangerSubtle },
  actionIcon: {
    width: 32, height: 32, borderRadius: radius.sm,
    backgroundColor: colors.bgHighlight,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  actionIconText: { fontSize: 16, color: colors.textPrimary },
  actionText: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
  actionSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  hint: {
    fontSize: 11, color: colors.textMuted, textAlign: 'center',
    paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, lineHeight: 16,
  },
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
});
