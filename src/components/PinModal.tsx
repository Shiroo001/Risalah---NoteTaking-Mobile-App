import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RADII, ThemePalette } from '../theme/tokens';
import type { PinModalMode } from '../types/note';
import { BottomSheet } from './BottomSheet';

interface PinModalProps {
  visible: boolean;
  mode: PinModalMode;
  currentPin: string;
  theme: ThemePalette;
  onClose: () => void;
  onVerifiedArchive: () => void;
  onSetPin: (newPin: string) => void;
  onRemovePin: () => void;
}

type Step = 'verify-current' | 'enter-new' | 'confirm-new';

const DIGITS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['cancel', '0', 'backspace'],
] as const;

export const PinModal: React.FC<PinModalProps> = ({
  visible,
  mode,
  currentPin,
  theme,
  onClose,
  onVerifiedArchive,
  onSetPin,
  onRemovePin,
}) => {
  const [step, setStep] = useState<Step>('verify-current');
  const [entered, setEntered] = useState('');
  const [firstNewPin, setFirstNewPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    setEntered('');
    setFirstNewPin('');
    setErrorMsg('');
    if (mode === 'setup') {
      setStep('enter-new');
    } else {
      setStep('verify-current');
    }
  }, [visible, mode]);

  const triggerShake = useCallback(
    (message: string) => {
      setErrorMsg(message);
      setEntered('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {}
      );
      shakeAnim.setValue(0);
      Animated.sequence([
        Animated.timing(shakeAnim, {
          toValue: 10,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -10,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 8,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -8,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 50,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [shakeAnim]
  );

  const handleCompletePin = useCallback(
    (code: string) => {
      if (step === 'verify-current') {
        if (code !== currentPin) {
          triggerShake('Incorrect PIN. Please try again.');
          return;
        }
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(() => {});

        if (mode === 'verify-archive') {
          onVerifiedArchive();
          return;
        }
        if (mode === 'remove') {
          onRemovePin();
          return;
        }
        if (mode === 'change') {
          setEntered('');
          setErrorMsg('');
          setStep('enter-new');
          return;
        }
      }

      if (step === 'enter-new') {
        setFirstNewPin(code);
        setEntered('');
        setErrorMsg('');
        setStep('confirm-new');
        Haptics.selectionAsync().catch(() => {});
        return;
      }

      if (step === 'confirm-new') {
        if (code !== firstNewPin) {
          triggerShake('PINs do not match. Try again.');
          setFirstNewPin('');
          setStep('enter-new');
          return;
        }
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(() => {});
        onSetPin(code);
      }
    },
    [
      currentPin,
      firstNewPin,
      mode,
      onRemovePin,
      onSetPin,
      onVerifiedArchive,
      step,
      triggerShake,
    ]
  );

  const handleDigitPress = useCallback(
    (key: string) => {
      if (key === 'cancel') {
        onClose();
        return;
      }
      if (key === 'backspace') {
        Haptics.selectionAsync().catch(() => {});
        setErrorMsg('');
        setEntered((prev) => prev.slice(0, -1));
        return;
      }

      setErrorMsg('');
      Haptics.selectionAsync().catch(() => {});
      setEntered((prev) => {
        if (prev.length >= 4) return prev;
        const next = `${prev}${key}`;
        if (next.length === 4) {
          setTimeout(() => handleCompletePin(next), 90);
        }
        return next;
      });
    },
    [handleCompletePin, onClose]
  );

  const title =
    step === 'verify-current'
      ? mode === 'verify-archive'
        ? 'Unlock Archive'
        : mode === 'remove'
        ? 'Remove Archive PIN'
        : 'Verify Current PIN'
      : step === 'enter-new'
      ? mode === 'change'
        ? 'Enter New PIN'
        : 'Set Archive PIN'
      : 'Confirm 4-Digit PIN';

  const subtitle =
    step === 'verify-current'
      ? mode === 'verify-archive'
        ? 'Enter your 4-digit PIN to access archived notes.'
        : 'Enter your current 4-digit PIN to continue.'
      : step === 'enter-new'
      ? 'Choose a 4-digit numeric PIN to lock your Archive.'
      : 'Re-enter your 4-digit PIN to confirm.';

  return (
    <BottomSheet
      visible={visible}
      theme={theme}
      onClose={onClose}
      sheetStyle={styles.sheetAlign}
    >
      <View
        style={[styles.lockCircle, { backgroundColor: theme.accentLight }]}
      >
            <Ionicons name="lock-closed" size={24} color={theme.accent} />
          </View>

          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            {subtitle}
          </Text>

          {/* 4-Dot Indicator */}
          <Animated.View
            style={[
              styles.dotsRow,
              { transform: [{ translateX: shakeAnim }] },
            ]}
          >
            {[0, 1, 2, 3].map((idx) => {
              const filled = idx < entered.length;
              return (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    {
                      borderColor: errorMsg
                        ? theme.danger
                        : filled
                        ? theme.accent
                        : theme.muted,
                      backgroundColor: filled ? theme.accent : 'transparent',
                    },
                  ]}
                />
              );
            })}
          </Animated.View>

          <View style={styles.errorSlot}>
            {errorMsg.length > 0 && (
              <Text style={[styles.errorText, { color: theme.danger }]}>
                {errorMsg}
              </Text>
            )}
          </View>

          {/* Numeric Keypad */}
          <View style={styles.pad}>
            {DIGITS.map((row, rIdx) => (
              <View key={rIdx} style={styles.padRow}>
                {row.map((key) => {
                  if (key === 'cancel') {
                    return (
                      <Pressable
                        key={key}
                        onPress={() => handleDigitPress(key)}
                        style={({ pressed }) => [
                          styles.padBtn,
                          pressed && { opacity: 0.6 },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel"
                      >
                        <Text
                          style={[styles.cancelText, { color: theme.muted }]}
                        >
                          Cancel
                        </Text>
                      </Pressable>
                    );
                  }
                  if (key === 'backspace') {
                    return (
                      <Pressable
                        key={key}
                        onPress={() => handleDigitPress(key)}
                        style={({ pressed }) => [
                          styles.padBtn,
                          pressed && { opacity: 0.6 },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Backspace"
                      >
                        <Ionicons
                          name="backspace-outline"
                          size={24}
                          color={theme.text}
                        />
                      </Pressable>
                    );
                  }
                  return (
                    <Pressable
                      key={key}
                      onPress={() => handleDigitPress(key)}
                      style={({ pressed }) => [
                        styles.padBtn,
                        styles.digitBtn,
                        {
                          backgroundColor: pressed
                            ? theme.cardHover
                            : theme.card,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Digit ${key}`}
                    >
                      <Text style={[styles.digitText, { color: theme.text }]}>
                        {key}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  sheetAlign: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  lockCircle: {
    width: 52,
    height: 52,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13.5,
    textAlign: 'center',
    marginBottom: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 18,
    marginBottom: 10,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: RADII.pill,
    borderWidth: 2,
  },
  errorSlot: {
    height: 22,
    justifyContent: 'center',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  pad: {
    width: '100%',
    maxWidth: 300,
    gap: 12,
  },
  padRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  padBtn: {
    flex: 1,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitBtn: {
    borderRadius: 18,
  },
  digitText: {
    fontSize: 22,
    fontWeight: '700',
  },
  cancelText: {
    fontSize: 14.5,
    fontWeight: '600',
  },
});
