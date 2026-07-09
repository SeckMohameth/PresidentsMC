import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { addDoc, collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { ArrowLeft, Send } from 'lucide-react-native';
import { db } from '@/utils/firebase';
import { AppColors, useThemeColors } from '@/constants/colors';
import { useCrew, useRide } from '@/providers/CrewProvider';
import { getAvatarSource } from '@/utils/avatar';
import { getInitials } from '@/utils/helpers';
import { getFriendlyErrorMessage } from '@/utils/errorMessages';
import { RideMessage, RideStatusKind } from '@/types';

const STATUS_OPTIONS: { key: RideStatusKind; label: string }[] = [
  { key: 'on_my_way', label: 'On my way' },
  { key: 'running_late', label: 'Running late' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'safe', label: 'Safe' },
];

const statusLabel = (status?: RideStatusKind) =>
  STATUS_OPTIONS.find((option) => option.key === status)?.label ?? '';

export default function RideChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { crew, currentUser, getMemberById } = useCrew();
  const { ride, attendeeMembers } = useRide(id || '');

  const [messages, setMessages] = useState<RideMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [eta, setEta] = useState('');
  const [isSending, setIsSending] = useState(false);

  const crewId = crew?.id;
  const rideId = ride?.id;
  const isAttending = !!(ride && currentUser && ride.attendees.includes(currentUser.id));

  useEffect(() => {
    if (!crewId || !rideId) return;
    const messagesQuery = query(
      collection(db, 'crews', crewId, 'rides', rideId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        setMessages(
          snapshot.docs.map((docSnap) => ({ ...(docSnap.data() as Omit<RideMessage, 'id'>), id: docSnap.id }))
        );
      },
      (error) => {
        console.log('[RideChat] Messages listener error:', error);
      }
    );
    return unsubscribe;
  }, [crewId, rideId]);

  // Latest status per attendee, derived from status messages.
  const latestStatuses = useMemo(() => {
    const byUser = new Map<string, RideMessage>();
    for (const message of messages) {
      if (message.type === 'status') byUser.set(message.userId, message);
    }
    return attendeeMembers
      .map((member) => ({ member, status: byUser.get(member.id) }))
      .filter((entry) => !!entry.status);
  }, [messages, attendeeMembers]);

  const invertedMessages = useMemo(() => [...messages].reverse(), [messages]);

  const sendMessage = async (payload: {
    type: 'chat' | 'status';
    text: string;
    status?: RideStatusKind;
    eta?: string;
  }) => {
    if (!crewId || !rideId || !currentUser) return;
    setIsSending(true);
    try {
      await addDoc(collection(db, 'crews', crewId, 'rides', rideId, 'messages'), {
        rideId,
        userId: currentUser.id,
        userName: currentUser.name,
        type: payload.type,
        text: payload.text,
        ...(payload.status ? { status: payload.status } : {}),
        ...(payload.eta ? { eta: payload.eta } : {}),
        createdAt: new Date().toISOString(),
      });
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.log('[RideChat] Send error:', error);
      Alert.alert(
        'Message Not Sent',
        getFriendlyErrorMessage(error, 'Could not send your message. Please try again.')
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleSendChat = async () => {
    const text = draft.trim();
    if (!text || isSending) return;
    setDraft('');
    await sendMessage({ type: 'chat', text: text.slice(0, 1000) });
  };

  const handleSendStatus = async (status: RideStatusKind) => {
    if (isSending) return;
    const etaValue = eta.trim();
    const includeEta = !!etaValue && (status === 'on_my_way' || status === 'running_late');
    const text = includeEta
      ? `${statusLabel(status)} · ETA ${etaValue}`
      : statusLabel(status);
    setEta('');
    await sendMessage({
      type: 'status',
      text,
      status,
      ...(includeEta ? { eta: etaValue } : {}),
    });
  };

  if (!ride) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.emptyText}>This ride is no longer available.</Text>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const renderAvatar = (userId: string, userName: string, size: number) => {
    const member = getMemberById(userId);
    const avatarStyle = { width: size, height: size, borderRadius: size / 2 };
    if (member?.avatar) {
      return (
        <Image
          source={getAvatarSource(member.avatar)}
          style={[styles.avatar, avatarStyle]}
          contentFit="cover"
        />
      );
    }
    return (
      <View style={[styles.avatarPlaceholder, avatarStyle]}>
        <Text style={[styles.avatarInitials, { fontSize: size * 0.38 }]}>
          {getInitials(member?.name || userName)}
        </Text>
      </View>
    );
  };

  const renderMessage = ({ item }: { item: RideMessage }) => {
    if (item.type === 'status') {
      return (
        <View style={styles.statusRow}>
          <View style={styles.statusPill}>
            {renderAvatar(item.userId, item.userName, 18)}
            <Text style={styles.statusText}>
              {item.userName} — {item.text}
            </Text>
          </View>
        </View>
      );
    }
    const isMine = item.userId === currentUser?.id;
    return (
      <View style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
        {!isMine && (
          <View style={styles.bubbleAvatar}>
            {renderAvatar(item.userId, item.userName, 28)}
          </View>
        )}
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
          {!isMine && <Text style={styles.bubbleName}>{item.userName}</Text>}
          <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBack} hitSlop={12}>
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Ride Chat</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{ride.title}</Text>
        </View>
      </View>

      {latestStatuses.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statusStrip}
          contentContainerStyle={styles.statusStripContent}
        >
          {latestStatuses.map(({ member, status }) => (
            <View key={member.id} style={styles.statusChip}>
              {renderAvatar(member.id, member.name, 30)}
              <View style={styles.statusChipBody}>
                <Text style={styles.statusChipName}>{member.name.split(' ')[0]}</Text>
                <Text style={styles.statusChipLabel}>
                  {statusLabel(status?.status)}
                  {status?.eta ? ` · ETA ${status.eta}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <FlatList
        data={invertedMessages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        inverted
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              No messages yet. Check in with the crew before and during the ride.
            </Text>
          </View>
        }
      />

      <View style={[styles.composer, { paddingBottom: insets.bottom + 8 }]}>
        {isAttending && (
          <View style={styles.statusActions}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {STATUS_OPTIONS.map((option) => (
                <Pressable
                  key={option.key}
                  style={styles.statusButton}
                  onPress={() => handleSendStatus(option.key)}
                  disabled={isSending}
                >
                  <Text style={styles.statusButtonText}>{option.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput
              style={styles.etaInput}
              value={eta}
              onChangeText={setEta}
              placeholder="ETA"
              placeholderTextColor={colors.textTertiary}
              maxLength={20}
            />
          </View>
        )}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Message the crew..."
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={1000}
          />
          <Pressable
            style={[styles.sendButton, (!draft.trim() || isSending) && styles.sendButtonDisabled]}
            onPress={handleSendChat}
            disabled={!draft.trim() || isSending}
          >
            <Send size={18} color={colors.onPrimary} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  headerBack: {
    padding: 4,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: colors.textTertiary,
    fontSize: 13,
    marginTop: 2,
  },
  statusStrip: {
    flexGrow: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  statusStripContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingLeft: 6,
    paddingRight: 12,
    paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  statusChipBody: {
    justifyContent: 'center',
  },
  statusChipName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  statusChipLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  avatar: {
    backgroundColor: colors.surfaceElevated,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  emptyWrap: {
    padding: 24,
    alignItems: 'center',
    transform: [{ scaleY: -1 }],
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: 14,
    textAlign: 'center',
  },
  backLink: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  backLinkText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  statusRow: {
    alignItems: 'center',
    marginVertical: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingLeft: 5,
    paddingRight: 10,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    maxWidth: '90%',
  },
  statusText: {
    color: colors.textTertiary,
    fontSize: 12,
    flexShrink: 1,
  },
  bubbleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    gap: 8,
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubbleAvatar: {
    marginBottom: 2,
  },
  bubble: {
    maxWidth: '80%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleTheirs: {
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleName: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  bubbleText: {
    color: colors.text,
    fontSize: 15,
  },
  bubbleTextMine: {
    color: colors.onPrimary,
  },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  statusActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusButton: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  statusButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  etaInput: {
    width: 80,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: colors.text,
    fontSize: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    color: colors.text,
    fontSize: 15,
    maxHeight: 110,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 18,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
