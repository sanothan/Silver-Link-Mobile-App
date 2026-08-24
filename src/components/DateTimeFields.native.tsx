import NativeDateTimePicker from "@expo/ui/community/datetime-picker";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

const toDateText = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
const toTimeText = (value: Date) =>
  `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
export function DateTimeFields({
  date,
  time,
  onDateChange,
  onTimeChange,
}: {
  date: string;
  time: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
}) {
  const [picker, setPicker] = useState<"date" | "time" | null>(null);
  const base = new Date();
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T12:00:00`)
    : base;
  const [hours, minutes] = time.split(":").map(Number);
  const parsedTime = new Date();
  if (Number.isFinite(hours) && Number.isFinite(minutes))
    parsedTime.setHours(hours, minutes, 0, 0);
  return (
    <View>
      <View style={styles.row}>
        <PickerButton
          icon="▣"
          label="Date"
          value={date || "Choose date"}
          onPress={() => setPicker("date")}
        />
        <PickerButton
          icon="◷"
          label="Time"
          value={time || "Choose time"}
          onPress={() => setPicker("time")}
        />
      </View>
      {picker === "date" ? (
        <NativeDateTimePicker
          value={parsedDate}
          mode="date"
          minimumDate={new Date()}
          presentation="dialog"
          onValueChange={(_, selected) => {
            if (selected) onDateChange(toDateText(selected));
            setPicker(null);
          }}
        />
      ) : null}
      {picker === "time" ? (
        <NativeDateTimePicker
          value={parsedTime}
          mode="time"
          presentation="dialog"
          onValueChange={(_, selected) => {
            if (selected) onTimeChange(toTimeText(selected));
            setPicker(null);
          }}
        />
      ) : null}
    </View>
  );
}
function PickerButton({
  icon,
  label,
  value,
  onPress,
}: {
  icon: string;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
      style={styles.button}
      onPress={onPress}
    >
      <Text style={styles.icon}>{icon}</Text>
      <View>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 11, marginBottom: 22 },
  button: {
    flex: 1,
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
    padding: 12,
  },
  icon: { color: colors.primary, fontSize: 24, marginRight: 10 },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: "800" },
  value: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4,
  },
});
