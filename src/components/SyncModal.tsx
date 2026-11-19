import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADII, ThemePalette } from '../theme/tokens';
import { fetchRemoteNotes, normalizeSyncBaseUrl } from '../utils/phpSync';
import { BottomSheet } from './BottomSheet';

interface SyncModalProps {
  visible: boolean;
  syncBaseUrl: string;
  theme: ThemePalette;
  onClose: () => void;
  onSaveBaseUrl: (url: string) => void;
  onSyncNow: (baseUrl: string) => Promise<void>;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  visible,
  syncBaseUrl,
  theme,
  onClose,
  onSaveBaseUrl,
  onSyncNow,
}) => {
  const [urlInput, setUrlInput] = useState(syncBaseUrl);
  const [busy, setBusy] = useState<'idle' | 'testing' | 'syncing'>('idle');
  const [statusMsg, setStatusMsg] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!visible) return;
    setUrlInput(syncBaseUrl);
    setStatusMsg(null);
    setBusy('idle');
  }, [syncBaseUrl, visible]);

  const normalized = normalizeSyncBaseUrl(urlInput);

  const runAction = async (mode: 'testing' | 'syncing') => {
    if (!normalized || busy !== 'idle') return;
    setBusy(mode);
    setStatusMsg(null);
    try {
      onSaveBaseUrl(normalized);
      setUrlInput(normalized);
      if (mode === 'testing') {
        const notes = await fetchRemoteNotes(normalized);
        setStatusMsg({
          type: 'ok',
          text: `Connected! Found ${notes.length} note${notes.length === 1 ? '' : 's'} on server.`,
        });
      } else {
        await onSyncNow(normalized);
        setStatusMsg({ type: 'ok', text: 'Sync completed cleanly.' });
      }
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to reach PHP backend on LAN',
      });
    } finally {
      setBusy('idle');
    }
  };

  return (
    <BottomSheet visible={visible} theme={theme} onClose={onClose} avoidKeyboard>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Ionicons name="cloud-upload-outline" size={20} color={theme.accent} />
          <Text style={[styles.title, { color: theme.text }]}>
            LAN PHP Backend Sync
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          style={[styles.closeBtn, { backgroundColor: theme.searchBg }]}
        >
          <Ionicons name="close" size={18} color={theme.text} />
        </Pressable>
      </View>

      <Text style={[styles.desc, { color: theme.muted }]}>
        Optional local LAN server URL for legacy Risalah PHP API (get_notes.php,
        save_note.php, delete_note.php, settings.php).
      </Text>

      <TextInput
        value={urlInput}
        onChangeText={setUrlInput}
        placeholder="http://192.168.1.10/Risalah/api/"
        placeholderTextColor={theme.muted}
        style={[
          styles.input,
          {
            backgroundColor: theme.inputBg,
            color: theme.text,
            borderColor: theme.toolbarBorder,
          },
        ]}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />

      {statusMsg && (
        <View
          style={[
            styles.statusBox,
            {
              backgroundColor:
                statusMsg.type === 'ok' ? theme.accentLight : theme.dangerSoft,
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: statusMsg.type === 'ok' ? theme.accent : theme.danger },
            ]}
          >
            {statusMsg.text}
          </Text>
        </View>
      )}

      <View style={styles.actionsRow}>
        <Pressable
          onPress={() => runAction('testing')}
          disabled={!normalized || busy !== 'idle'}
          style={({ pressed }) => [
            styles.secondaryBtn,
            {
              backgroundColor: theme.searchBg,
              opacity: !normalized || busy !== 'idle' ? 0.45 : pressed ? 0.75 : 1,
            },
          ]}
        >
          {busy === 'testing' ? (
            <ActivityIndicator size="small" color={theme.text} />
          ) : (
            <Text style={[styles.btnText, { color: theme.text }]}>Test</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => runAction('syncing')}
          disabled={!normalized || busy !== 'idle'}
          style={({ pressed }) => [
            styles.primaryBtn,
            {
              backgroundColor: theme.accent,
              opacity: !normalized || busy !== 'idle' ? 0.45 : pressed ? 0.8 : 1,
            },
          ]}
        >
          {busy === 'syncing' ? (
            <ActivityIndicator size="small" color={theme.bg} />
          ) : (
            <Text style={[styles.btnText, { color: theme.bg }]}>Sync Now</Text>
          )}
        </Pressable>
      </View>

      {syncBaseUrl.length > 0 && (
        <Pressable
          onPress={() => {
            setUrlInput('');
            onSaveBaseUrl('');
            setStatusMsg({ type: 'ok', text: 'Sync disabled (offline-only mode).' });
          }}
          style={styles.clearBtn}
          accessibilityRole="button"
        >
          <Text style={[styles.clearText, { color: theme.danger }]}>
            Disconnect Server
          </Text>
        </Pressable>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 17, fontWeight: '700' },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desc: { fontSize: 12.5, lineHeight: 18, marginBottom: 12 },
  input: {
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 14.5,
    borderWidth: 1,
    marginBottom: 12,
  },
  statusBox: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  statusText: { fontSize: 12.5, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 10 },
  secondaryBtn: {
    height: 46,
    paddingHorizontal: 22,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 14.5, fontWeight: '700' },
  clearBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  clearText: { fontSize: 13.5, fontWeight: '600' },
});
