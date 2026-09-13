import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { getRequestChat, sendRequestChatMessage, subscribeToRequestChat } from '../../services/chatService';
import { colors } from '../../theme/colors';
import { canChatForStatus, type ChatParticipantRole, type RequestChatMessage } from '../../types/chat';
import type { CompanionshipRequest } from '../../types/request';

export default function RequestChatScreen({ role }: { role: ChatParticipantRole }) {
  const { id, elderlyUserId } = useLocalSearchParams<{ id: string; elderlyUserId?: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [request, setRequest] = useState<CompanionshipRequest | null>(null);
  const [messages, setMessages] = useState<RequestChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState(false);
  const [chatError, setChatError] = useState(false);
  const [canSend, setCanSend] = useState(false);
  const [chatExists, setChatExists] = useState(false);

  const load = useCallback(async () => {
    if (!user || !id || (role === 'caregiver' && !elderlyUserId)) {
      setError(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const result = await getRequestChat(id, user.uid, role, elderlyUserId);
      setRequest(result.request);
      setCanSend(result.canSend);
      setChatExists(Boolean(result.chat));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [elderlyUserId, id, role, user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const chatId = request?.id;
  useEffect(() => {
    if (!chatId || !chatExists) return undefined;
    setChatLoading(true);
    setChatError(false);
    return subscribeToRequestChat(chatId, (items) => {
      setMessages(items);
      setChatLoading(false);
    }, () => {
      setChatLoading(false);
      setChatError(true);
    });
  }, [chatExists, chatId]);

  const readOnlyMessage = useMemo(() => {
    if (!request) return '';
    if (request.status === 'completed') return 'This activity has been completed.';
    if (request.status === 'cancelled') return 'This activity was cancelled.';
    if (!canChatForStatus(request.status)) return 'Messaging is available after a volunteer accepts this activity.';
    if (!request.assignedVolunteerId) return 'A volunteer must be assigned before messaging is available.';
    return '';
  }, [request]);

  const send = async () => {
    if (!user || !id || !text.trim() || !canSend || chatLoading) return;
    setChatLoading(true);
    try {
      await sendRequestChatMessage({ requestId: id, senderId: user.uid, senderRole: role, elderlyUserId, text });
      setText('');
      setChatError(false);
    } catch {
      setChatError(true);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) return <Center><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.helper}>Loading conversation…</Text></Center>;
  if (error || !request) return <Center><Text style={styles.title}>Conversation unavailable</Text><Text style={styles.helper}>We couldn&apos;t load this conversation. Please try again.</Text><Pressable style={styles.primaryButton} onPress={() => void load()}><Text style={styles.primaryText}>Try Again</Text></Pressable></Center>;

  const otherName = role === 'caregiver' ? request.volunteerName || 'Assigned volunteer' : 'Caregiver';
  return <SafeAreaView style={styles.safe} edges={['top']}>
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
      <View style={styles.header}><Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>← Back</Text></Pressable><View style={styles.headerCopy}><Text style={styles.headerTitle}>{otherName}</Text><Text style={styles.headerMeta}>{request.activityType} • {request.status.replace('_', ' ')}</Text></View><View style={styles.spacer} /></View>
      {readOnlyMessage ? <View style={styles.readOnly}><Text style={styles.readOnlyText}>{readOnlyMessage}</Text></View> : null}
      {chatError ? <View style={styles.errorBanner}><Text style={styles.errorText}>Message could not be sent. Please try again.</Text></View> : null}
      {chatLoading && !messages.length ? <Center><ActivityIndicator color={colors.primary} /><Text style={styles.helper}>Loading messages…</Text></Center> : <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.messages, !messages.length && styles.messagesEmpty]}
        renderItem={({ item }) => <MessageBubble item={item} mine={item.senderId === user?.uid} />}
        ListEmptyComponent={<><Text style={styles.emptyTitle}>No messages yet</Text><Text style={styles.helper}>Use this chat to coordinate the activity with the volunteer.</Text></>}
      />}
      {canSend ? <View style={styles.composer}><TextInput accessibilityLabel="Message" value={text} onChangeText={setText} placeholder="Write a message…" placeholderTextColor={colors.textMuted} multiline style={styles.input} /><Pressable accessibilityRole="button" accessibilityLabel="Send message" disabled={!text.trim() || chatLoading} style={[styles.sendButton, (!text.trim() || chatLoading) && styles.disabled]} onPress={() => void send()}><Text style={styles.sendText}>Send</Text></Pressable></View> : null}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function MessageBubble({ item, mine }: { item: RequestChatMessage; mine: boolean }) {
  return <View style={[styles.messageRow, mine && styles.messageRowMine]}><View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}><Text style={[styles.messageText, mine && styles.messageTextMine]}>{item.text}</Text><Text style={[styles.time, mine && styles.timeMine]}>{item.createdAt?.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) ?? 'Sending…'}</Text></View></View>;
}
function Center({ children }: { children: React.ReactNode }) { return <View style={styles.center}>{children}</View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 70, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  headerCopy: { flex: 1, alignItems: 'center' },
  headerTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
  headerMeta: { color: colors.textSecondary, fontSize: 13, marginTop: 3, textTransform: 'capitalize' },
  spacer: { width: 44 },
  readOnly: { margin: 12, padding: 12, borderRadius: 12, backgroundColor: colors.surfaceSoft },
  readOnlyText: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', fontWeight: '700' },
  errorBanner: { marginHorizontal: 12, padding: 10, borderRadius: 10, backgroundColor: colors.errorLight },
  errorText: { color: colors.error, textAlign: 'center', fontSize: 14, fontWeight: '700' },
  messages: { padding: 16, gap: 10, flexGrow: 1, justifyContent: 'flex-end' },
  messagesEmpty: { justifyContent: 'center', alignItems: 'center' },
  messageRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  messageRowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '82%', borderRadius: 17, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  bubbleOther: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 5 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 5 },
  messageText: { color: colors.textPrimary, fontSize: 16, lineHeight: 22 },
  messageTextMine: { color: colors.textOnPrimary },
  time: { color: colors.textMuted, fontSize: 11, alignSelf: 'flex-end' },
  timeMine: { color: '#C7D2FE' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, maxHeight: 100, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, color: colors.textPrimary, fontSize: 16, backgroundColor: colors.background },
  sendButton: { minHeight: 48, paddingHorizontal: 17, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: colors.textOnPrimary, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  title: { color: colors.textPrimary, fontSize: 23, fontWeight: '800', textAlign: 'center' },
  emptyTitle: { color: colors.textPrimary, fontSize: 19, fontWeight: '800', textAlign: 'center' },
  helper: { color: colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  primaryButton: { minHeight: 52, borderRadius: 14, backgroundColor: colors.primary, paddingHorizontal: 24, justifyContent: 'center', marginTop: 16 },
  primaryText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '800' },
});
