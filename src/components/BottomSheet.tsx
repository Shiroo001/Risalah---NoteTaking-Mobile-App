import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RADII, ThemePalette } from '../theme/tokens';

interface BottomSheetProps {
  visible: boolean;
  theme: ThemePalette;
  onClose: () => void;
  animationType?: 'fade' | 'slide';
  avoidKeyboard?: boolean;
  sheetStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  theme,
  onClose,
  animationType = 'fade',
  avoidKeyboard = false,
  sheetStyle,
  children,
}) => {
  const insets = useSafeAreaInsets();

  const content = (
    <Pressable
      style={[styles.overlay, { backgroundColor: theme.overlay }]}
      onPress={onClose}
    >
      <Pressable
        style={[
          styles.sheet,
          {
            backgroundColor: theme.modalBg,
            borderColor: theme.border,
            paddingBottom: Math.max(insets.bottom, 16) + 10,
          },
          sheetStyle,
        ]}
        onPress={(e) => e.stopPropagation()}
      >
        <View style={[styles.handle, { backgroundColor: theme.muted }]} />
        {children}
      </Pressable>
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType={animationType}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: RADII.modal,
    borderTopRightRadius: RADII.modal,
    paddingTop: 10,
    paddingHorizontal: 18,
    borderTopWidth: 1.5,
  },
  handle: {
    width: 32,
    height: 3,
    borderRadius: 1,
    alignSelf: 'center',
    opacity: 0.4,
    marginBottom: 14,
  },
});
