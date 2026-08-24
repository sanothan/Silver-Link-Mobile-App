import { type Href, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { getElderlyRequests } from "../../services/requestService";
import { colors } from "../../theme/colors";
import {
  REQUEST_STATUS_LABELS,
  type CompanionshipRequest,
} from "../../types/request";
type Filter = "active" | "completed" | "cancelled";
export default function MyRequests() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<CompanionshipRequest[]>([]);
  const [filter, setFilter] = useState<Filter>("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(false);
    try {
      setItems(await getElderlyRequests(user.uid));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const filtered = useMemo(
    () =>
      items.filter((item) =>
        filter === "active"
          ? !["completed", "cancelled"].includes(item.status)
          : item.status === filter,
      ),
    [filter, items],
  );
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>My Requests</Text>
        <Pressable
          accessibilityRole="button"
          style={styles.newButton}
          onPress={() => router.push("/(elderly)/request")}
        >
          <Text style={styles.newText}>+ New</Text>
        </Pressable>
      </View>
      <View style={styles.filters}>
        {(["active", "completed", "cancelled"] as Filter[]).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === value }}
            onPress={() => setFilter(value)}
            style={[styles.filter, filter === value && styles.filterActive]}
          >
            <Text
              style={[
                styles.filterText,
                filter === value && styles.filterTextActive,
              ]}
            >
              {value[0].toUpperCase() + value.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>
      {loading ? (
        <Center>
          <ActivityIndicator size="large" color={colors.primary} />
        </Center>
      ) : error ? (
        <Center>
          <Text style={styles.emptyTitle}>
            We couldn&apos;t load your requests.
          </Text>
          <Pressable style={styles.retry} onPress={() => void load()}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </Center>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filtered.length ? (
            filtered.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                style={styles.card}
                onPress={() =>
                  router.push(`/(elderly)/request-details/${item.id}` as Href)
                }
              >
                <Text style={styles.cardTitle}>{item.activityType}</Text>
                <Text style={styles.meta}>
                  {item.preferredDate.toLocaleDateString()} •{" "}
                  {item.preferredTime}
                </Text>
                <Text style={styles.status}>
                  {REQUEST_STATUS_LABELS[item.status]}
                </Text>
                {item.volunteerName ? (
                  <Text style={styles.volunteer}>
                    {item.volunteerName}
                    {item.volunteerVerified ? "  ✓ Verified" : ""}
                  </Text>
                ) : null}
                <Text style={styles.link}>View Details →</Text>
              </Pressable>
            ))
          ) : (
            <Center>
              <Text style={styles.emptyTitle}>No requests here</Text>
              <Text style={styles.emptyText}>Need companionship or help?</Text>
              <Pressable
                style={styles.retry}
                onPress={() => router.push("/(elderly)/request")}
              >
                <Text style={styles.retryText}>Request Help</Text>
              </Pressable>
            </Center>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
function Center({ children }: { children: React.ReactNode }) {
  return <View style={styles.center}>{children}</View>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { color: colors.textPrimary, fontSize: 28, fontWeight: "800" },
  newButton: {
    minHeight: 48,
    paddingHorizontal: 17,
    borderRadius: 13,
    backgroundColor: colors.primary,
    justifyContent: "center",
  },
  newText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: "800" },
  filters: { flexDirection: "row", gap: 8, padding: 20 },
  filter: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  filterActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  filterText: { color: colors.textSecondary, fontSize: 14, fontWeight: "700" },
  filterTextActive: { color: colors.primaryDark },
  list: { paddingHorizontal: 20, paddingBottom: 35, gap: 12, flexGrow: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  cardTitle: { color: colors.textPrimary, fontSize: 19, fontWeight: "800" },
  meta: { color: colors.textSecondary, fontSize: 16, marginTop: 7 },
  status: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 12,
  },
  volunteer: {
    color: colors.success,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 7,
  },
  link: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 15,
  },
  center: {
    flex: 1,
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyText: { color: colors.textSecondary, fontSize: 16, marginTop: 7 },
  retry: {
    minHeight: 52,
    borderRadius: 13,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    justifyContent: "center",
    marginTop: 16,
  },
  retryText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: "800" },
});
