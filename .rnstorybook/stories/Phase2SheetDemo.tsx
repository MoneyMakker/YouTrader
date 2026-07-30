import React, { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  YDL_SHEET_SNAP_COMPACT,
  YDL_SHEET_SNAP_EXPANDED,
  YdlBottomSheet,
  YdlBottomSheetModal,
  YdlModalSheetTextInput,
  YdlModalSheetView,
  YdlSheetRoot,
  YdlSheetScrollView,
  YdlSheetTextInput,
  YdlSheetView,
  type YdlBottomSheetModalRef,
  type YdlBottomSheetRef,
  type YdlSheetAppearance,
  type YdlSheetSizing,
} from "../../src/ydl/sheets";

type DemoProps = {
  variant:
    | "fixedCompact"
    | "dynamic"
    | "scrollKeyboard"
    | "modal"
    | "light"
    | "longContent"
    | "largeFont";
};

function DemoShell({
  appearance,
  sizing,
  modal,
  largeFont,
  children,
  title,
}: {
  appearance: YdlSheetAppearance;
  sizing: YdlSheetSizing;
  modal?: boolean;
  largeFont?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  const sheetRef = useRef<YdlBottomSheetRef>(null);
  const modalRef = useRef<YdlBottomSheetModalRef>(null);
  const [open, setOpen] = useState(false);
  const fontScale = largeFont ? 1.35 : 1;

  const openSheet = () => {
    if (modal) {
      setOpen(true);
      modalRef.current?.present();
      return;
    }
    setOpen(true);
    sheetRef.current?.open();
  };

  const closeSheet = () => {
    if (modal) {
      setOpen(false);
      modalRef.current?.dismiss();
      return;
    }
    setOpen(false);
    sheetRef.current?.close();
  };

  return (
    <YdlSheetRoot>
      <View style={[styles.screen, appearance === "light" && styles.screenLight]} testID="sheet-demo-root">
        <Text style={[styles.heading, appearance === "light" && styles.headingLight, { fontSize: 20 * fontScale }]}>
          {title}
        </Text>
        <View style={styles.row}>
          <Pressable accessibilityRole="button" onPress={openSheet} style={styles.btn} testID="sheet-open">
            <Text style={styles.btnLabel}>Open</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={closeSheet} style={styles.btnGhost} testID="sheet-close">
            <Text style={styles.btnGhostLabel}>Close</Text>
          </Pressable>
        </View>

        {modal ? (
          <YdlBottomSheetModal
            ref={modalRef}
            open={open}
            sizing={sizing}
            appearance={appearance}
            accessibilityLabel={title}
            onOpenChange={setOpen}
          >
            {children}
          </YdlBottomSheetModal>
        ) : (
          <YdlBottomSheet
            ref={sheetRef}
            open={open}
            sizing={sizing}
            appearance={appearance}
            accessibilityLabel={title}
            onOpenChange={setOpen}
          >
            {children}
          </YdlBottomSheet>
        )}
      </View>
    </YdlSheetRoot>
  );
}

export function Phase2SheetDemo({ variant }: DemoProps) {
  const body = useMemo(() => {
    switch (variant) {
      case "fixedCompact":
        return (
          <DemoShell
            title="Fixed compact snaps"
            appearance="dark"
            sizing={{ mode: "fixed", snapPoints: YDL_SHEET_SNAP_COMPACT }}
          >
            <YdlSheetView style={styles.pad}>
              <Text style={styles.title}>Compact sheet</Text>
              <Text style={styles.body}>28% / 55% snap points. Pan down to close.</Text>
            </YdlSheetView>
          </DemoShell>
        );
      case "dynamic":
        return (
          <DemoShell
            title="Dynamic content sizing"
            appearance="dark"
            sizing={{ mode: "dynamic", maxDynamicContentSize: 420 }}
          >
            <YdlSheetView style={styles.pad}>
              <Text style={styles.title}>Dynamic height</Text>
              <Text style={styles.body}>Sized to this short content block (capped).</Text>
            </YdlSheetView>
          </DemoShell>
        );
      case "scrollKeyboard":
        return (
          <DemoShell
            title="Scroll + keyboard"
            appearance="dark"
            sizing={{ mode: "fixed", snapPoints: YDL_SHEET_SNAP_EXPANDED, initialSnapIndex: 1 }}
          >
            <YdlSheetScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
              <Text style={styles.title}>Scrollable notes</Text>
              <Text style={styles.body}>Type below. Keyboard-safe TextInput via YDL adapter.</Text>
              <YdlSheetTextInput
                placeholder="Trade note"
                placeholderTextColor="#6B7385"
                style={styles.input}
                accessibilityLabel="Trade note input"
              />
              {Array.from({ length: 12 }).map((_, i) => (
                <Text key={i} style={styles.body}>
                  Scroll row {i + 1}
                </Text>
              ))}
            </YdlSheetScrollView>
          </DemoShell>
        );
      case "modal":
        return (
          <DemoShell
            title="Modal sheet"
            appearance="dark"
            modal
            sizing={{ mode: "fixed", snapPoints: ["45%", "80%"] }}
          >
            <YdlModalSheetView style={styles.pad}>
              <Text style={styles.title}>Modal presentation</Text>
              <Text style={styles.body}>Uses BottomSheetModal behind the YDL adapter.</Text>
              <YdlModalSheetTextInput
                placeholder="Modal field"
                placeholderTextColor="#6B7385"
                style={styles.input}
                accessibilityLabel="Modal field"
              />
            </YdlModalSheetView>
          </DemoShell>
        );
      case "light":
        return (
          <DemoShell
            title="Light appearance"
            appearance="light"
            sizing={{ mode: "fixed", snapPoints: YDL_SHEET_SNAP_COMPACT }}
          >
            <YdlSheetView style={styles.pad}>
              <Text style={[styles.title, styles.titleLight]}>Light sheet</Text>
              <Text style={[styles.body, styles.bodyLight]}>Custom handle + pressable backdrop.</Text>
            </YdlSheetView>
          </DemoShell>
        );
      case "longContent":
        return (
          <DemoShell
            title="Long content"
            appearance="dark"
            sizing={{ mode: "fixed", snapPoints: YDL_SHEET_SNAP_EXPANDED, initialSnapIndex: 2 }}
          >
            <YdlSheetScrollView contentContainerStyle={styles.pad}>
              <Text style={styles.title}>Long journal excerpt</Text>
              {Array.from({ length: 24 }).map((_, i) => (
                <Text key={i} style={styles.body}>
                  Line {i + 1}: review process, risk notes, and next-session focus.
                </Text>
              ))}
            </YdlSheetScrollView>
          </DemoShell>
        );
      case "largeFont":
        return (
          <DemoShell
            title="Large accessibility font"
            appearance="dark"
            largeFont
            sizing={{ mode: "fixed", snapPoints: ["50%", "88%"] }}
          >
            <YdlSheetScrollView contentContainerStyle={styles.pad}>
              <Text style={[styles.title, { fontSize: 24 }]}>Readable sheet</Text>
              <Text style={[styles.body, { fontSize: 18, lineHeight: 28 }]}>
                Larger type to validate spacing under accessibility font scaling.
              </Text>
            </YdlSheetScrollView>
          </DemoShell>
        );
      default: {
        const _exhaustive: never = variant;
        return _exhaustive;
      }
    }
  }, [variant]);

  return body;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#05070B",
    padding: 20,
    gap: 14,
  },
  screenLight: {
    backgroundColor: "#EEF1F6",
  },
  heading: {
    color: "#F4F7FB",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 24,
  },
  headingLight: {
    color: "#0E141D",
  },
  row: { flexDirection: "row", gap: 10 },
  btn: {
    backgroundColor: "#1C2433",
    borderColor: "#2A3447",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  btnLabel: { color: "#7CFFB2", fontWeight: "600" },
  btnGhost: {
    borderColor: "#2A3447",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  btnGhostLabel: { color: "#A7B0C0", fontWeight: "600" },
  pad: { paddingHorizontal: 18, paddingBottom: 28, gap: 10 },
  title: { color: "#F4F7FB", fontSize: 18, fontWeight: "700" },
  titleLight: { color: "#0E141D" },
  body: { color: "#A7B0C0", fontSize: 14, lineHeight: 20 },
  bodyLight: { color: "#4A5568" },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#2A3447",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#F4F7FB",
    backgroundColor: "#121823",
  },
});
