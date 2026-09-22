import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors } from "../theme/colors";
import { REQUEST_STATUS_LABELS, type RequestStatus } from "../types/request";

export function AppBackground({ children }: { children: ReactNode }) {
  return (
    <View style={styles.background}>
      <View pointerEvents="none" style={styles.orbTop} />
      <View pointerEvents="none" style={styles.orbBottom} />
      {children}
    </View>
  );
}

export function RequestHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={10}
        style={styles.headerButton}
        onPress={onBack}
      >
        <Text style={styles.backIcon}>‹</Text>
      </Pressable>
      <Text numberOfLines={1} style={styles.headerTitle}>
        {title}
      </Text>
      <View style={styles.headerButton}>
        <Text style={styles.headerMark}>SL</Text>
      </View>
    </View>
  );
}

const STEPS = ["Activity", "Location", "Date & Time", "Review"];
export function RequestProgress({ current }: { current: number }) {
  return (
    <View
      accessibilityLabel={`Step ${current} of 4, ${STEPS[current - 1]}`}
      style={styles.progress}
    >
      {STEPS.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;
        return (
          <View key={label} style={styles.progressItem}>
            {index > 0 ? (
              <View style={[styles.line, step <= current && styles.lineDone]} />
            ) : null}
            <View
              style={[
                styles.stepCircle,
                (done || active) && styles.stepCircleActive,
              ]}
            >
              <Text
                style={[
                  styles.stepNumber,
                  (done || active) && styles.stepNumberActive,
                ]}
              >
                {done ? "✓" : step}
              </Text>
            </View>
            <Text
              numberOfLines={2}
              style={[styles.stepLabel, active && styles.stepLabelActive]}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function StepHeading({
  step,
  title,
  subtitle,
}: {
  step: number;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.heading}>
      <Text style={styles.eyebrow}>STEP {step} OF 4</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

export function BottomActionBar({
  backLabel,
  nextLabel,
  nextDisabled,
  busy,
  onBack,
  onNext,
}: {
  backLabel: string;
  nextLabel: string;
  nextDisabled?: boolean;
  busy?: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <View style={styles.actions}>
      <Pressable
        accessibilityRole="button"
        style={styles.secondaryButton}
        onPress={onBack}
      >
        <Text style={styles.secondaryText}>{backLabel}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: nextDisabled, busy }}
        disabled={nextDisabled || busy}
        style={[
          styles.primaryButton,
          (nextDisabled || busy) && styles.disabled,
        ]}
        onPress={onNext}
      >
        {busy ? (
          <ActivityIndicator color={colors.textOnPrimary} />
        ) : (
          <Text style={styles.primaryText}>{nextLabel} →</Text>
        )}
      </Pressable>
    </View>
  );
}

export function StatusChip({ status }: { status: RequestStatus }) {
  return (
    <View
      style={[
        styles.statusChip,
        status === "cancelled" && styles.statusCancelled,
        status === "completed" && styles.statusCompleted,
      ]}
    >
      <Text
        style={[
          styles.statusText,
          status === "cancelled" && styles.statusCancelledText,
          status === "completed" && styles.statusCompletedText,
        ]}
      >
        {REQUEST_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  orbTop: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#EEF2FF",
    top: -120,
    right: -95,
  },
  orbBottom: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#F5F3FF",
    bottom: -170,
    left: -140,
  },
  header: {
    minHeight: 68,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  headerButton: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    color: colors.textPrimary,
    fontSize: 40,
    lineHeight: 42,
    fontWeight: "400",
  },
  headerTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  headerMark: { color: colors.primary, fontSize: 14, fontWeight: "900" },
  progress: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  progressItem: { flex: 1, alignItems: "center", position: "relative" },
  line: {
    position: "absolute",
    height: 3,
    backgroundColor: colors.border,
    width: "48%",
    right: "76%",
    top: 18,
  },
  lineDone: { backgroundColor: colors.primary },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.borderDark,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  stepCircleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: "#3730A3",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  stepNumber: { color: colors.textMuted, fontSize: 16, fontWeight: "800" },
  stepNumberActive: { color: colors.textOnPrimary },
  stepLabel: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 7,
    minHeight: 32,
  },
  stepLabelActive: { color: colors.textPrimary, fontWeight: "800" },
  heading: { marginBottom: 22 },
  eyebrow: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "900",
    marginTop: 6,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 17,
    lineHeight: 25,
    marginTop: 7,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.borderDark,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: colors.textSecondary,
    fontSize: 17,
    fontWeight: "800",
  },
  primaryButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3730A3",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryText: { color: colors.textOnPrimary, fontSize: 17, fontWeight: "800" },
  disabled: { opacity: 0.45, shadowOpacity: 0 },
  statusChip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: colors.primaryLight,
  },
  statusText: { color: colors.primaryDark, fontSize: 14, fontWeight: "800" },
  statusCancelled: { backgroundColor: colors.errorLight },
  statusCancelledText: { color: colors.error },
  statusCompleted: { backgroundColor: colors.successLight },
  statusCompletedText: { color: colors.success },
});
