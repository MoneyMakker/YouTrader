import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { styles } from "../../app/styles";

export function BottomSheetPanel({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.bottomSheetBackdrop} onPress={onClose}>
        <Pressable style={styles.bottomSheetCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.bottomSheetTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeCircle}>
              <Text style={styles.closeX}>×</Text>
            </Pressable>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
