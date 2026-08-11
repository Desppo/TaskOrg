import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/theme/theme";

interface ProgressBarProps {
  completed: number;
  total: number;
  color: string;
  height?: number;
  showLabel?: boolean;
}

export function ProgressBar({ completed, total, color, height = 5, showLabel = true }: ProgressBarProps) {
  const theme = useAppTheme();
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <View style={styles.wrap}>
      <View style={[styles.track, { backgroundColor: theme.surfaceRaised, height }]}>
        <View
          style={[
            styles.fill,
            { backgroundColor: color, width: `${percent}%` as unknown as number, height, borderRadius: height / 2 },
          ]}
        />
      </View>
      {showLabel ? (
        <Text style={[styles.label, { color: theme.textMuted }]}>
          {percent}%{total > 0 ? ` (${completed}/${total})` : ""}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 5 },
  track: { borderRadius: 4, overflow: "hidden", width: "100%" },
  fill: { borderRadius: 4 },
  label: { fontSize: 11, fontWeight: "600" },
});
