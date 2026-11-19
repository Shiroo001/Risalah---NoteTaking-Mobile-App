import React from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, RADII, THEME_OPTIONS, ThemePalette } from '../theme/tokens';
import type { ThemeMode, ViewMode } from '../types/note';
import { BottomSheet } from './BottomSheet';

const LOGO_ASSET = require('../../assets/logo.png');

interface SettingsModalProps {
  visible: boolean;
  theme: ThemePalette;
  themeMode: ThemeMode;
  viewMode: ViewMode;
  hasArchivePin: boolean;
  syncBaseUrl: string;
  activeCount: number;
  archivedCount: number;
  deletedCount: number;
  onClose: () => void;
  onRequestArchive: () => void;
  onOpenActiveNotes: () => void;
  onOpenTrash: () => void;
  onSelectTheme: (mode: ThemeMode) => void;
  onSetupPin: () => void;
  onChangePin: () => void;
  onRemovePin: () => void;
  onExportBackup: () => void;
  onImportBackup: () => void;
  onOpenSync: () => void;
  onResetAppData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  theme,
  themeMode,
  viewMode,
  hasArchivePin,
  syncBaseUrl,
  activeCount,
  archivedCount,
  deletedCount,
  onClose,
  onRequestArchive,
  onOpenActiveNotes,
  onOpenTrash,
  onSelectTheme,
  onSetupPin,
  onChangePin,
  onRemovePin,
  onExportBackup,
  onImportBackup,
  onOpenSync,
  onResetAppData,
}) => {
  const confirmReset = () => {
    Alert.alert(
      'Reset App Data?',
      'This will permanently erase all notes, archive, trash, and your Archive PIN from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: () => {
            onClose();
            onResetAppData();
          },
        },
      ]
    );
  };

  return (
    <BottomSheet
      visible={visible}
      theme={theme}
      onClose={onClose}
      sheetStyle={styles.sheetMax}
    >
      <View style={styles.headerRow}>
            <View
              style={[
                styles.avatarLarge,
                { borderColor: theme.cardBorder },
              ]}
            >
              <Image source={LOGO_ASSET} style={styles.logoImg} />
            </View>
            <View style={styles.headerMeta}>
              <Text style={[styles.appName, { color: theme.text }]}>
                Risalah
              </Text>
              <Text style={[styles.appSub, { color: theme.muted }]}>
                Minimalist Smart Note-Taker
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.searchBg }]}
              accessibilityRole="button"
              accessibilityLabel="Close settings"
            >
              <Ionicons name="close" size={18} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.scrollBody}
          >
            {/* Spaces & Appearance */}
            <Text style={[styles.sectionTitle, { color: theme.muted }]}>
              WORKSPACE
            </Text>
            <View style={[styles.sectionCard, { backgroundColor: theme.card }]}>
              {viewMode === 'archive' ? (
                <SettingRow
                  icon="document-text-outline"
                  label="All Notes"
                  badge={String(activeCount)}
                  theme={theme}
                  onPress={() => {
                    onClose();
                    onOpenActiveNotes();
                  }}
                />
              ) : (
                <SettingRow
                  icon={hasArchivePin ? 'lock-closed-outline' : 'archive-outline'}
                  label="Archive"
                  badge={String(archivedCount)}
                  theme={theme}
                  onPress={() => {
                    onClose();
                    onRequestArchive();
                  }}
                />
              )}

              <View
                style={[styles.divider, { backgroundColor: theme.border }]}
              />

              <SettingRow
                icon="trash-outline"
                label="Trash"
                badge={String(deletedCount)}
                theme={theme}
                onPress={() => {
                  onClose();
                  onOpenTrash();
                }}
              />
            </View>

            {/* Theme Picker */}
            <Text style={[styles.sectionTitle, { color: theme.muted }]}>
              THEME
            </Text>
            <View style={styles.themeGrid}>
              {THEME_OPTIONS.map((opt) => {
                const selected = themeMode === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => onSelectTheme(opt.id)}
                    style={({ pressed }) => [
                      styles.themeTile,
                      {
                        backgroundColor: theme.card,
                        borderColor: selected ? theme.accent : theme.cardBorder,
                        borderWidth: selected ? 1.5 : 1,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${opt.label} theme`}
                  >
                    <View
                      style={[
                        styles.themeSwatch,
                        {
                          backgroundColor: opt.previewBg,
                          borderColor: opt.isDark
                            ? 'rgba(255,255,255,0.16)'
                            : 'rgba(17,17,17,0.14)',
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.swatchAccentBar,
                          { backgroundColor: opt.previewAccent },
                        ]}
                      />
                      <View
                        style={[
                          styles.swatchCard,
                          { backgroundColor: opt.previewCard },
                        ]}
                      />
                    </View>
                    <View style={styles.themeTileFooter}>
                      <Text
                        style={[
                          styles.themeTileLabel,
                          { color: selected ? theme.accent : theme.text },
                        ]}
                        numberOfLines={1}
                      >
                        {opt.label}
                      </Text>
                      {selected && (
                        <Ionicons
                          name="checkmark"
                          size={13}
                          color={theme.accent}
                        />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Security (Archive PIN) */}
            <Text style={[styles.sectionTitle, { color: theme.muted }]}>
              ARCHIVE SECURITY
            </Text>
            <View style={[styles.sectionCard, { backgroundColor: theme.card }]}>
              {!hasArchivePin ? (
                <SettingRow
                  icon="keypad-outline"
                  label="Set Archive PIN"
                  value="Off"
                  theme={theme}
                  onPress={() => {
                    onClose();
                    onSetupPin();
                  }}
                />
              ) : (
                <>
                  <SettingRow
                    icon="key-outline"
                    label="Change Archive PIN"
                    value="Active"
                    theme={theme}
                    onPress={() => {
                      onClose();
                      onChangePin();
                    }}
                  />
                  <View
                    style={[styles.divider, { backgroundColor: theme.border }]}
                  />
                  <SettingRow
                    icon="lock-open-outline"
                    label="Remove Archive PIN"
                    danger
                    theme={theme}
                    onPress={() => {
                      onClose();
                      onRemovePin();
                    }}
                  />
                </>
              )}
            </View>

            {/* Backup & Restore */}
            <Text style={[styles.sectionTitle, { color: theme.muted }]}>
              BACKUP & RESTORE
            </Text>
            <View style={[styles.sectionCard, { backgroundColor: theme.card }]}>
              <SettingRow
                icon="download-outline"
                label="Export Notes (.json)"
                theme={theme}
                onPress={() => {
                  onClose();
                  onExportBackup();
                }}
              />
              <View
                style={[styles.divider, { backgroundColor: theme.border }]}
              />
              <SettingRow
                icon="push-outline"
                label="Import Notes (.json)"
                theme={theme}
                onPress={() => {
                  onClose();
                  onImportBackup();
                }}
              />
              <View
                style={[styles.divider, { backgroundColor: theme.border }]}
              />
              <SettingRow
                icon="cloud-upload-outline"
                label="LAN PHP Backend Sync"
                value={syncBaseUrl ? 'Configured' : 'Off'}
                theme={theme}
                onPress={() => {
                  onClose();
                  onOpenSync();
                }}
              />
            </View>

            {/* Danger Zone */}
            <Text style={[styles.sectionTitle, { color: theme.muted }]}>
              DATA
            </Text>
            <View style={[styles.sectionCard, { backgroundColor: theme.card }]}>
              <SettingRow
                icon="nuclear-outline"
                label="Reset App Data"
                danger
                theme={theme}
                onPress={confirmReset}
              />
            </View>

            {/* App Info */}
            <View style={styles.infoFooter}>
              <Text style={[styles.infoText, { color: theme.muted }]}>
                Risalah Mobile v1.0.0 • {activeCount + archivedCount + deletedCount}{' '}
                total notes ({activeCount} active, {archivedCount} archived,{' '}
                {deletedCount} trash)
              </Text>
            </View>
          </ScrollView>
    </BottomSheet>
  );
};

interface SettingRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  badge?: string;
  danger?: boolean;
  theme: ThemePalette;
  onPress: () => void;
}

const SettingRow: React.FC<SettingRowProps> = ({
  icon,
  label,
  value,
  badge,
  danger,
  theme,
  onPress,
}) => (
  <Pressable
    onPress={onPress}
    android_ripple={{ color: theme.ripple }}
    style={({ pressed }) => [
      styles.row,
      pressed && { backgroundColor: theme.cardHover },
    ]}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <View style={styles.rowLeft}>
      <View
        style={[
          styles.rowIconWrap,
          {
            backgroundColor: danger ? theme.dangerSoft : theme.accentLight,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={danger ? theme.danger : theme.accent}
        />
      </View>
      <Text
        style={[
          styles.rowLabel,
          { color: danger ? theme.danger : theme.text },
        ]}
      >
        {label}
      </Text>
    </View>
    {badge !== undefined ? (
      <View style={[styles.countPill, { backgroundColor: theme.accentLight }]}>
        <Text style={[styles.countText, { color: theme.accent }]}>{badge}</Text>
      </View>
    ) : value !== undefined ? (
      <View style={styles.valueRow}>
        <Text style={[styles.rowValue, { color: theme.muted }]}>{value}</Text>
        <Ionicons name="chevron-forward" size={16} color={theme.muted} />
      </View>
    ) : (
      <Ionicons name="chevron-forward" size={16} color={theme.muted} />
    )}
  </Pressable>
);

const styles = StyleSheet.create({
  sheetMax: {
    maxHeight: '86%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  avatarLarge: {
    width: 42,
    height: 42,
    borderRadius: RADII.card,
    overflow: 'hidden',
    borderWidth: 1,
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
  headerMeta: {
    flex: 1,
  },
  appName: {
    fontFamily: FONTS.serif,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  appSub: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    letterSpacing: 0.6,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: RADII.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    flexGrow: 0,
  },
  sectionTitle: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginLeft: 2,
    marginTop: 14,
    marginBottom: 6,
  },
  sectionCard: {
    borderRadius: RADII.card,
    borderWidth: 1,
    borderColor: 'rgba(127, 127, 127, 0.2)',
    overflow: 'hidden',
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  themeTile: {
    width: '31.2%',
    borderRadius: RADII.card,
    padding: 7,
    gap: 6,
  },
  themeSwatch: {
    height: 36,
    borderRadius: 2,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 4,
    justifyContent: 'space-between',
  },
  swatchAccentBar: {
    width: 18,
    height: 3,
    borderRadius: 1,
  },
  swatchCard: {
    height: 16,
    borderRadius: 2,
  },
  themeTileFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 2,
  },
  themeTileLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    fontWeight: '700',
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowValue: {
    fontFamily: FONTS.mono,
    fontSize: 11.5,
    fontWeight: '600',
  },
  countPill: {
    minWidth: 26,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADII.pill,
    alignItems: 'center',
  },
  countText: {
    fontFamily: FONTS.mono,
    fontSize: 11.5,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginHorizontal: 14,
  },
  infoFooter: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 6,
  },
  infoText: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontWeight: '500',
    textAlign: 'center',
  },
});
