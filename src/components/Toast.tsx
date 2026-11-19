import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, RADII, ThemePalette } from '../theme/tokens';
import { ToastState } from '../types/note';

interface ToastProps {
  toast: ToastState | null;
  theme: ThemePalette;
  bottomOffset: number;
}

export const Toast: React.FC<ToastProps> = ({ toast, theme, bottomOffset }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (!toast) return;

    opacity.setValue(0);
    translateY.setValue(12);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [toast, opacity, translateY]);

  if (!toast) return null;

  const bgColor =
    toast.variant === 'success'
      ? theme.toastSuccessBg
      : toast.variant === 'error'
      ? theme.toastErrorBg
      : theme.toastInfoBg;

  const textColor =
    toast.variant === 'success'
      ? theme.toastSuccessText
      : toast.variant === 'error'
      ? theme.toastErrorText
      : theme.toastInfoText;

  const iconName: keyof typeof Ionicons.glyphMap =
    toast.variant === 'success'
      ? 'checkmark-circle'
      : toast.variant === 'error'
      ? 'alert-circle'
      : 'information-circle';

  return (
    <View
      pointerEvents="none"
      style={[styles.wrapper, { bottom: bottomOffset }]}
    >
      <Animated.View
        style={[
          styles.pill,
          {
            backgroundColor: bgColor,
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <Ionicons name={iconName} size={16} color={textColor} />
        <Text style={[styles.text, { color: textColor }]} numberOfLines={2}>
          {toast.message}
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 100,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADII.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 4,
    maxWidth: '100%',
  },
  text: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    flexShrink: 1,
  },
});
