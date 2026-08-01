import React from "react";
import { Text, View } from "react-native";
import { C } from "../theme";
import { styles } from "../styles";

export function WarningCard({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,69,105,0.25)", backgroundColor: "rgba(255,69,105,0.06)", padding: 13, gap: 6 }}>
      <Text style={[styles.terminalSmallLabel, { color: C.red }]}>{title}</Text>
      <Text style={styles.terminalSub}>{body}</Text>
    </View>
  );
}
