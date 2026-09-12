import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { getElderlyRequests } from '../../services/requestService';
import { getCaregiverLinksForElderly } from '../../services/caregiverLinkService';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  subscribeToNotifications,
} from '../../services/notificationService';
import {
  REQUEST_STATUS_LABELS,
  type CompanionshipRequest,
} from '../../types/request';
import type { AppNotification } from '../../types/notification';
import type { ElderlyCaregiverLinkDisplay } from '../../types/caregiver';
import { formatRelativeTime } from '../../utils/time';

interface UpcomingVisit {
  id: string;
  activityType: string;
  scheduledAt: Date;
  status: string;
  volunteer: {
    name: string;
    photoUrl?: string;
    verified: boolean;
    rating?: number;
    experience?: string;
  };
}
interface Reminder {
  id: string;
  message: string;
}

const upcomingVisit: UpcomingVisit | null = null;
const reminders: Reminder[] = [];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
}

// ─── Status pill helper ───────────────────────────────────────────────────────
function statusColor(status: string): { bg: string; text: string } {
  switch (status) {
    case 'pending': return { bg: colors.warningLight, text: '#92400E' };
    case 'accepted': return { bg: colors.infoLight, text: '#075985' };
    case 'scheduled': return { bg: '#EDE9FE', text: '#5B21B6' };
    case 'started': return { bg: '#DCFCE7', text: '#166534' };
    case 'completed': return { bg: colors.successLight, text: '#166534' };
    case 'cancelled': return { bg: colors.errorLight, text: '#991B1B' };
    default: return { bg: colors.surfaceSoft, text: colors.textSecondary };
  }
}

// ─── Components ───────────────────────────────────────────────────────────────
function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={styles.viewAllButton}
        >
          <Text style={styles.viewAll}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function EmptyCard({
  title,
  body,
  cta,
  onCta,
}: {
  title: string;
  body: string;
  cta?: string;
  onCta?: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.bodyText}>{body}</Text>
      {cta && onCta ? (
        <Pressable accessibilityRole="button" style={styles.outlineButton} onPress={onCta}>
          <Text style={styles.outlineButtonText}>{cta}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ElderlyDashboardScreen() {
  const router = useRouter();
  const { user, profile, profileError, initializing, retryProfile } = useAuth();
  const [activeRequest, setActiveRequest] =
    useState<CompanionshipRequest | null>(null);
  const [updates, setUpdates] = useState<AppNotification[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(true);
  const [updatesError, setUpdatesError] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [caregiverLinks, setCaregiverLinks] = useState<ElderlyCaregiverLinkDisplay[]>([]);
  const displayName = profile?.fullName || user?.displayName || '';
  const firstName = displayName.trim().split(/\s+/)[0];
  const requestHelp = () => router.push('/(elderly)/request');
  const placeholder = (title: string) =>
    Alert.alert(title, 'This feature is being prepared for SilverLink.');

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    setUpdatesLoading(true);
    setUpdatesError(false);
    const [requestsResult, notificationsResult, countResult, caregiverLinksResult] =
      await Promise.allSettled([
        getElderlyRequests(user.uid),
        getNotifications(user.uid, 3),
        getUnreadNotificationCount(user.uid),
        getCaregiverLinksForElderly(user.uid),
      ]);
    if (requestsResult.status === 'fulfilled')
      setActiveRequest(
        requestsResult.value.find(
          (item) => !['completed', 'cancelled'].includes(item.status),
        ) ?? null,
      );
    if (notificationsResult.status === 'fulfilled')
      setUpdates(notificationsResult.value);
    else setUpdatesError(true);
    if (countResult.status === 'fulfilled') setUnreadCount(countResult.value);
    if (caregiverLinksResult.status === 'fulfilled') setCaregiverLinks(caregiverLinksResult.value);
    setUpdatesLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

  useEffect(() => {
    if (!user) return;
    return subscribeToNotifications(
      user.uid,
      (items) => {
        setUpdates(items.slice(0, 3));
        setUnreadCount(items.filter((item) => !item.read).length);
        setUpdatesLoading(false);
        setUpdatesError(false);
      },
      () => setUpdatesError(true),
    );
  }, [user]);

  const openUpdate = async (item: AppNotification) => {
    if (!item.read) {
      setUpdates((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, read: true } : entry,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
      await markNotificationRead(item.id).catch(() => void loadDashboard());
    }
    if (item.requestId)
      router.push(`/(elderly)/request-details/${item.requestId}` as Href);
  };
  const connectedCaregiver = caregiverLinks.find((item) => item.status === 'accepted');
  const pendingCaregiverCount = caregiverLinks.filter((item) => item.status === 'pending').length;

  // ── Loading / error states ──
  if (initializing)
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your dashboard…</Text>
        </View>
      </SafeAreaView>
    );
  if (profileError)
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>We couldn&apos;t load your information.</Text>
          <Text style={styles.errorText}>Please try again.</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.retryButton}
            onPress={() => void retryProfile()}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>
              {greeting()}
              {firstName ? `, ${firstName}` : ''}
            </Text>
            <Text style={styles.subtitle}>How can we support you today?</Text>
          </View>

          {/* Notification bell */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open alerts${unreadCount ? `, ${unreadCount} unread` : ''}`}
            style={styles.bell}
            onPress={() => router.push('/(elderly)/alerts')}
          >
            <Text style={styles.bellText}>✉</Text>
            {unreadCount ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            ) : null}
          </Pressable>

          {/* Avatar */}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(elderly)/profile')}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>
              {(firstName || 'S').charAt(0).toUpperCase()}
            </Text>
          </Pressable>
        </View>

        {/* ── Hero — Request Help ── */}
        <Pressable
          accessibilityRole="button"
          style={styles.hero}
          onPress={requestHelp}
        >
          {/* Decorative orb */}
          <View pointerEvents="none" style={styles.heroOrb} />

          <View style={styles.heroTop}>
            <View style={styles.heroIconBox}>
              <Text style={styles.heroIconText}>♡</Text>
            </View>
            <View style={styles.heroChip}>
              <Text style={styles.heroChipText}>Available now</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>
            Request Companionship or Help
          </Text>
          <Text style={styles.heroText}>
            Choose the help you need and a suitable time.
          </Text>

          <View style={styles.heroButton}>
            <Text style={styles.heroButtonText}>Request Help</Text>
            <Text style={styles.heroArrow}>→</Text>
          </View>
        </Pressable>

        {/* ── Your Next Visit ── */}
        <View style={styles.section}>
          <SectionHeader title="Your Next Visit" />
          {upcomingVisit ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{upcomingVisit.activityType}</Text>
              <Text style={styles.bodyText}>
                {upcomingVisit.scheduledAt.toLocaleString()}
              </Text>
              <View style={styles.personRow}>
                <View style={styles.personAvatar}>
                  <Text style={styles.personAvatarText}>
                    {upcomingVisit.volunteer.name.charAt(0)}
                  </Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.smallLabel}>VOLUNTEER</Text>
                  <Text style={styles.personName}>
                    {upcomingVisit.volunteer.name}
                  </Text>
                  {upcomingVisit.volunteer.verified ? (
                    <Text style={styles.verified}>✓ Verified volunteer</Text>
                  ) : null}
                </View>
              </View>
              <Text style={styles.status}>Status: {upcomingVisit.status}</Text>
            </View>
          ) : (
            <EmptyCard
              title="No visits scheduled"
              body="Would you like some companionship or help today?"
              cta="Request Help"
              onCta={requestHelp}
            />
          )}
        </View>

        {/* ── Quick Actions ── */}
        <View style={styles.section}>
          <SectionHeader title="Quick Actions" />
          <View style={styles.quickGrid}>
            <QuickAction
              symbol="+"
              label="Request Help"
              emphasis
              onPress={requestHelp}
            />
            <QuickAction
              symbol="▣"
              label="My Visits"
              onPress={() => router.push('/(elderly)/visits')}
            />
            <QuickAction
              symbol="✉"
              label="Alerts"
              onPress={() => router.push('/(elderly)/alerts')}
            />
            <QuickAction
              symbol="○"
              label="My Profile"
              onPress={() => router.push('/(elderly)/profile')}
            />
          </View>
        </View>

        {/* ── Recent Updates ── */}
        <View style={styles.section}>
          <SectionHeader
            title="Recent Updates"
            action="View All"
            onAction={() => router.push('/(elderly)/alerts')}
          />
          {updatesLoading ? (
            <View style={styles.updateState}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.bodyText}>Loading updates…</Text>
            </View>
          ) : updatesError ? (
            <View style={styles.card}>
              <Text style={styles.emptyTitle}>
                We couldn&apos;t load your notifications.
              </Text>
              <Text style={styles.bodyText}>Please try again.</Text>
              <Pressable
                accessibilityRole="button"
                style={styles.textButton}
                onPress={() => void loadDashboard()}
              >
                <Text style={styles.textButtonText}>Try Again</Text>
              </Pressable>
            </View>
          ) : updates.length ? (
            <View style={styles.updateList}>
              {updates.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.read ? 'Read' : 'Unread'} update. ${item.title}. ${item.message}`}
                  style={[styles.updateCard, !item.read && styles.updateUnread]}
                  onPress={() => void openUpdate(item)}
                >
                  {!item.read && <View style={styles.updateAccent} />}
                  <View style={styles.updateBody}>
                    <View style={styles.updateHeading}>
                      <Text style={styles.updateTitle}>{item.title}</Text>
                      {!item.read ? (
                        <View style={styles.unreadDot} />
                      ) : null}
                    </View>
                    <Text style={styles.updateMessage}>{item.message}</Text>
                    <Text style={styles.updateTime}>
                      {formatRelativeTime(item.createdAt)}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <EmptyCard
              title="No updates yet."
              body="Important request updates will appear here."
            />
          )}
        </View>

        {/* ── My Requests ── */}
        <View style={styles.section}>
          <SectionHeader
            title="My Requests"
            action="View All"
            onAction={() => router.push('/(elderly)/visits')}
          />
          {activeRequest ? (
            <Pressable
              accessibilityRole="button"
              style={styles.card}
              onPress={() =>
                router.push(
                  `/(elderly)/request-details/${activeRequest.id}` as Href,
                )
              }
            >
              <Text style={styles.cardTitle}>{activeRequest.activityType}</Text>
              <Text style={styles.bodyText}>
                {activeRequest.preferredDate.toLocaleDateString()} at{' '}
                {activeRequest.preferredTime}
              </Text>
              {(() => {
                const sc = statusColor(activeRequest.status);
                return (
                  <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.statusPillText, { color: sc.text }]}>
                      {REQUEST_STATUS_LABELS[activeRequest.status]}
                    </Text>
                  </View>
                );
              })()}
              <Text style={styles.textButtonText}>View Details →</Text>
            </Pressable>
          ) : (
            <EmptyCard
              title="No active requests."
              body="Need some companionship or help?"
              cta="Request Help"
              onCta={requestHelp}
            />
          )}
        </View>

        {/* ── Family / Caregiver ── */}
        <View style={styles.section}>
          <SectionHeader title="Family / Caregiver" />
          <View style={[styles.card, styles.caregiverCard]}>
            {profile?.caregiverId || connectedCaregiver ? (
              <>
                <Text style={styles.emptyTitle}>
                  {connectedCaregiver?.caregiverName || 'Caregiver connected'}
                </Text>
                <Text style={styles.bodyText}>
                  Connected Caregiver · A linked caregiver can receive important visit updates.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  style={styles.textButton}
                  onPress={() => router.push('/(elderly)/caregiver-connections' as Href)}
                >
                  <Text style={styles.textButtonText}>View Connection →</Text>
                </Pressable>
              </>
            ) : pendingCaregiverCount ? (
              <>
                <Text style={styles.emptyTitle}>Caregiver connection request</Text>
                <Text style={styles.bodyText}>
                  You have {pendingCaregiverCount} request{pendingCaregiverCount === 1 ? '' : 's'} waiting for your response.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  style={styles.outlineButton}
                  onPress={() => router.push('/(elderly)/caregiver-connections' as Href)}
                >
                  <Text style={styles.outlineButtonText}>Review Request</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.emptyTitle}>Stay Connected</Text>
                <Text style={styles.bodyText}>
                  Link a family member or caregiver so they can receive
                  important visit updates.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  style={styles.outlineButton}
                  onPress={() => router.push('/(elderly)/caregiver-connections' as Href)}
                >
                  <Text style={styles.outlineButtonText}>Link Caregiver</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* ── Your Safety Matters ── */}
        <View style={styles.section}>
          <SectionHeader title="Your Safety Matters" />
          <View style={[styles.card, styles.safetyCard]}>
            {[
              '✓ Volunteers can be verified',
              '✓ Important caregiver visit updates',
              '✓ Easy access to report concerns',
            ].map((item) => (
              <Text key={item} style={styles.safetyItem}>
                {item}
              </Text>
            ))}
            <Pressable
              accessibilityRole="button"
              style={styles.textButton}
              onPress={() => placeholder('Safety Help')}
            >
              <Text style={styles.textButtonText}>Safety Help →</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Reminders ── */}
        <View style={styles.section}>
          <SectionHeader title="Reminders" />
          {reminders.length ? (
            <View style={styles.card}>
              {reminders.map((item) => (
                <View key={item.id} style={styles.reminder}>
                  <View style={styles.reminderDot} />
                  <Text style={[styles.bodyText, styles.flex]}>
                    {item.message}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <EmptyCard
              title="No reminders right now."
              body="We'll show important visit updates here."
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── QuickAction ──────────────────────────────────────────────────────────────
function QuickAction({
  symbol,
  label,
  onPress,
  emphasis = false,
}: {
  symbol: string;
  label: string;
  onPress: () => void;
  emphasis?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      style={[styles.quickAction, emphasis && styles.quickActionEmphasis]}
      onPress={onPress}
    >
      <View style={[styles.quickIconBox, emphasis && styles.quickIconBoxEmphasis]}>
        <Text style={[styles.quickSymbol, emphasis && styles.quickSymbolEmphasis]}>
          {symbol}
        </Text>
      </View>
      <Text style={[styles.quickLabel, emphasis && styles.quickLabelEmphasis]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 36 },

  /* Loading / Error */
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
  },
  loadingText: { color: colors.textSecondary, fontSize: 17 },
  errorTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: '800',
    textAlign: 'center',
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: 17,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 54,
    minWidth: 160,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  retryText: { color: colors.textOnPrimary, fontSize: 17, fontWeight: '800' },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
    gap: 10,
  },
  headerText: { flex: 1 },
  greeting: {
    color: colors.textPrimary,
    fontSize: 26,
    lineHeight: 33,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 3,
  },

  /* Bell */
  bell: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  bellText: { color: colors.primary, fontSize: 22, fontWeight: '900' },
  badge: {
    position: 'absolute',
    right: -5,
    top: -5,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 4,
    backgroundColor: colors.error,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.textOnPrimary, fontSize: 11, fontWeight: '900' },

  /* Avatar */
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary + '30',
  },
  avatarText: { color: colors.primary, fontSize: 20, fontWeight: '800' },

  /* Hero */
  hero: {
    backgroundColor: colors.primary,
    borderRadius: 26,
    padding: 24,
    marginBottom: 28,
    shadowColor: '#3730A3',
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
    overflow: 'hidden',
  },
  heroOrb: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -60,
    right: -50,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  heroIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconText: {
    color: colors.textOnPrimary,
    fontSize: 30,
    lineHeight: 36,
  },
  heroChip: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  heroChipText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '700',
  },
  heroTitle: {
    color: colors.textOnPrimary,
    fontSize: 23,
    lineHeight: 30,
    fontWeight: '800',
    maxWidth: 300,
  },
  heroText: {
    color: '#C7D2FE',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
    maxWidth: 290,
  },
  heroButton: {
    minHeight: 52,
    marginTop: 20,
    backgroundColor: colors.surface,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heroButtonText: { color: colors.primaryDark, fontSize: 17, fontWeight: '800' },
  heroArrow: { color: colors.primaryDark, fontSize: 20 },

  /* Section */
  section: { marginBottom: 26 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
  },
  viewAllButton: { minHeight: 40, justifyContent: 'center', paddingLeft: 12 },
  viewAll: { color: colors.primary, fontSize: 15, fontWeight: '800' },

  /* Card */
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
    gap: 8,
  },

  /* Updates */
  updateList: { gap: 10 },
  updateCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    flexDirection: 'row',
    minHeight: 110,
  },
  updateUnread: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  updateAccent: {
    width: 4,
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  updateBody: { flex: 1, padding: 16, gap: 4 },
  updateHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  updateTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '900',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  updateMessage: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
  },
  updateTime: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  updateState: {
    minHeight: 100,
    borderRadius: 17,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },

  /* Quick actions */
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickAction: {
    width: '47%',
    minHeight: 110,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    gap: 10,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  quickActionEmphasis: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  quickIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickIconBoxEmphasis: { backgroundColor: 'rgba(79,70,229,0.14)' },
  quickSymbol: { color: colors.textSecondary, fontSize: 24, fontWeight: '800' },
  quickSymbolEmphasis: { color: colors.primary },
  quickLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  quickLabelEmphasis: { color: colors.primaryDark },

  /* Caregiver / Safety cards */
  caregiverCard: { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' },
  safetyCard: { backgroundColor: colors.primaryLight, borderColor: '#C7D2FE' },

  /* Card internals */
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '800',
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
  },
  bodyText: { color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
  outlineButton: {
    minHeight: 50,
    alignSelf: 'flex-start',
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.primary,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  outlineButtonText: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  textButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  textButtonText: { color: colors.primary, fontSize: 15, fontWeight: '800' },

  /* Status pill */
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusPillText: { fontSize: 14, fontWeight: '800' },

  /* Person row */
  personRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  personAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.infoLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  personAvatarText: { color: colors.info, fontSize: 20, fontWeight: '800' },
  smallLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  personName: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 2,
  },
  verified: { color: colors.success, fontSize: 14, fontWeight: '700', marginTop: 3 },
  status: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 10 },

  /* Safety */
  safetyItem: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },

  /* Reminder */
  reminder: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  reminderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 10,
    marginRight: 10,
  },

  flex: { flex: 1 },
});
