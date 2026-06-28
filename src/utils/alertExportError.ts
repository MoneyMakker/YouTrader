import { Alert } from "react-native";

export function alertExportError(prefix: string, error: unknown) {
  Alert.alert(prefix, error instanceof Error ? error.message : "Unknown error");
}
