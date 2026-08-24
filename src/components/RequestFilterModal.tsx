import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../theme/colors";
import {
  REQUEST_ACTIVITY_TYPES,
  REQUEST_DURATION_OPTIONS,
  type CompanionshipRequest,
} from "../types/request";

export type DateFilter = "any" | "today" | "tomorrow" | "week" | "custom";

export interface RequestFilters {
  activityTypes: string[];
  location: string;
  dateFilter: DateFilter;
  customDate: string;
  durationLabel: string | null;
}

export const EMPTY_FILTERS: RequestFilters = {
  activityTypes: [],
  location: "",
  dateFilter: "any",
  customDate: "",
  durationLabel: null,
};

export function countActiveFilters(filters: RequestFilters): number {
  let count = 0;
  if (filters.activityTypes.length) count += 1;
  if (filters.location.trim()) count += 1;
  if (filters.dateFilter !== "any") count += 1;
  if (filters.durationLabel) count += 1;
  return count;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isWithinNextDays(date: Date, from: Date, days: number): boolean {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  const candidate = new Date(date);
  candidate.setHours(0, 0, 0, 0);
  return candidate >= start && candidate < end;
}

/** Every active category must match — plain client-side AND filtering over the already-loaded, already-pending list. */
export function matchesFilters(
  item: CompanionshipRequest,
  filters: RequestFilters,
): boolean {
  if (
    filters.activityTypes.length &&
    !filters.activityTypes.includes(item.activityType)
  )
    return false;
  if (
    filters.location.trim() &&
    !item.location.toLowerCase().includes(filters.location.trim().toLowerCase())
  )
    return false;
  if (filters.durationLabel && item.durationLabel !== filters.durationLabel)
    return false;
  if (filters.dateFilter !== "any") {
    const today = new Date();
    if (filters.dateFilter === "today") {
      if (!isSameDay(item.preferredDate, today)) return false;
    } else if (filters.dateFilter === "tomorrow") {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (!isSameDay(item.preferredDate, tomorrow)) return false;
    } else if (filters.dateFilter === "week") {
      if (!isWithinNextDays(item.preferredDate, today, 7)) return false;
    } else if (filters.dateFilter === "custom") {
      const valid = /^\d{4}-\d{2}-\d{2}$/.test(filters.customDate);
      if (!valid) return false;
      const chosen = new Date(`${filters.customDate}T00:00:00`);
      if (Number.isNaN(chosen.getTime()) || !isSameDay(item.preferredDate, chosen))
        return false;
    }
  }
  return true;
}

const DATE_OPTIONS: { key: DateFilter; label: string }[] = [
  { key: "any", label: "Any Date" },
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "week", label: "This Week" },
  { key: "custom", label: "Choose Date" },
];

export function RequestFilterModal({
  visible,
  filters,
  onApply,
  onClose,
}: {
  visible: boolean;
  filters: RequestFilters;
  onApply: (filters: RequestFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<RequestFilters>(filters);

  // Re-seed the draft from the last-applied filters every time the sheet opens,
  // so a dismissed-without-applying edit never leaks into the next open.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft(filters);
  }

  const toggleActivity = (item: string) =>
    setDraft((current) => ({
      ...current,
      activityTypes: current.activityTypes.includes(item)
        ? current.activityTypes.filter((entry) => entry !== item)
        : [...current.activityTypes, item],
    }));

  const clearAll = () => setDraft(EMPTY_FILTERS);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close filters"
          style={styles.backdrop}
          onPress={onClose}
        />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Filter Requests</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close filters"
              style={styles.closeButton}
              onPress={onClose}
            >
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.label}>Activity Type</Text>
            <View style={styles.chips}>
              {REQUEST_ACTIVITY_TYPES.map((item) => {
                const selected = draft.activityTypes.includes(item);
                return (
                  <Pressable
                    key={item}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={`${item}${selected ? ", selected" : ""}`}
                    style={[styles.chip, selected && styles.chipActive]}
                    onPress={() => toggleActivity(item)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                      {selected ? "✓ " : ""}
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Location</Text>
            <TextInput
              accessibilityLabel="Filter by location"
              value={draft.location}
              onChangeText={(value) => setDraft((current) => ({ ...current, location: value }))}
              placeholder="e.g. Colombo 05"
              placeholderTextColor={colors.inputPlaceholder}
              style={styles.input}
            />

            <Text style={styles.label}>Date</Text>
            <View style={styles.chips}>
              {DATE_OPTIONS.map((option) => {
                const selected = draft.dateFilter === option.key;
                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={`${option.label}${selected ? ", selected" : ""}`}
                    style={[styles.chip, selected && styles.chipActive]}
                    onPress={() =>
                      setDraft((current) => ({ ...current, dateFilter: option.key }))
                    }
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                      {selected ? "✓ " : ""}
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {draft.dateFilter === "custom" ? (
              <TextInput
                accessibilityLabel="Chosen date, year-month-day"
                value={draft.customDate}
                onChangeText={(value) =>
                  setDraft((current) => ({ ...current, customDate: value }))
                }
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.inputPlaceholder}
                style={styles.input}
              />
            ) : null}

            <Text style={styles.label}>Duration</Text>
            <View style={styles.chips}>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: draft.durationLabel === null }}
                accessibilityLabel={`Any Duration${draft.durationLabel === null ? ", selected" : ""}`}
                style={[styles.chip, draft.durationLabel === null && styles.chipActive]}
                onPress={() => setDraft((current) => ({ ...current, durationLabel: null }))}
              >
                <Text
                  style={[
                    styles.chipText,
                    draft.durationLabel === null && styles.chipTextActive,
                  ]}
                >
                  {draft.durationLabel === null ? "✓ " : ""}Any Duration
                </Text>
              </Pressable>
              {REQUEST_DURATION_OPTIONS.map((option) => {
                const selected = draft.durationLabel === option.label;
                return (
                  <Pressable
                    key={option.label}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={`${option.label}${selected ? ", selected" : ""}`}
                    style={[styles.chip, selected && styles.chipActive]}
                    onPress={() =>
                      setDraft((current) => ({ ...current, durationLabel: option.label }))
                    }
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                      {selected ? "✓ " : ""}
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear all filters"
              style={styles.clearButton}
              onPress={clearAll}
            >
              <Text style={styles.clearText}>Clear All</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Apply filters"
              style={styles.applyButton}
              onPress={() => onApply(draft)}
            >
              <Text style={styles.applyText}>Apply Filters</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    paddingBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: "800" },
  closeButton: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "flex-end" },
  closeText: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  body: { paddingHorizontal: 20 },
  bodyContent: { paddingVertical: 16, gap: 8 },
  label: { color: colors.textPrimary, fontSize: 16, fontWeight: "800", marginTop: 10, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  chip: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: 14,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  chipActive: { borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.primaryLight },
  chipText: { color: colors.textSecondary, fontSize: 15, fontWeight: "700" },
  chipTextActive: { color: colors.primaryDark },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 14,
    backgroundColor: colors.surface,
    paddingHorizontal: 15,
    color: colors.textPrimary,
    fontSize: 16,
    marginTop: 4,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  clearButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: { color: colors.textSecondary, fontSize: 16, fontWeight: "800" },
  applyButton: {
    flex: 2,
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  applyText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: "800" },
});
