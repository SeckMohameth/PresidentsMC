import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { Camera, Copy, RefreshCcw, Shield, Star, UserMinus, UserPlus } from 'lucide-react-native';
import { AppColors, useThemeColors } from '@/constants/colors';
import { useCrew } from '@/providers/CrewProvider';
import { CrewMember, JoinRequest } from '@/types';

const INVITE_EXPIRATION_OPTIONS = [
  { label: 'Never', value: 'never' },
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
] as const;

type InviteExpirationOption = (typeof INVITE_EXPIRATION_OPTIONS)[number]['value'];

function expiresAtForOption(option: InviteExpirationOption) {
  if (option === 'never') return null;
  const hours = option === '24h' ? 24 : option === '7d' ? 24 * 7 : 24 * 30;
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function getInviteExpirationLabel(expiresAt: string | null) {
  if (!expiresAt) return 'Never expires';
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return 'Expiration unavailable';
  return `Expires ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

export default function AdminSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    crew,
    members,
    joinRequests,
    approveJoinRequest,
    denyJoinRequest,
    removeMember,
    setMemberRole,
    updateCrewSettings,
    getInviteSettings,
    updateInviteSettings,
    isAdmin,
    isOwner,
    isBillingRequired,
    isSubscriptionActive,
    canManageJoinRequests,
  } = useCrew();

  const [name, setName] = useState(crew?.name || '');
  const [description, setDescription] = useState(crew?.description || '');
  const [logoUrl, setLogoUrl] = useState(crew?.logoUrl || '');
  const [requiresApproval, setRequiresApproval] = useState(crew?.requiresApproval ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteExpiresAt, setInviteExpiresAt] = useState<string | null>(null);
  const [inviteExpirationOption, setInviteExpirationOption] =
    useState<InviteExpirationOption>('never');
  const [isInviteExpirationDirty, setIsInviteExpirationDirty] = useState(false);
  const [isInviteLoading, setIsInviteLoading] = useState(false);
  const [isInviteSaving, setIsInviteSaving] = useState(false);

  useEffect(() => {
    if (!crew) return;
    setName(crew.name || '');
    setDescription(crew.description || '');
    setLogoUrl(crew.logoUrl || '');
    setRequiresApproval(crew.requiresApproval ?? true);
  }, [crew]);

  const pendingRequests = useMemo(
    () => joinRequests.filter((request) => request.status === 'pending'),
    [joinRequests]
  );

  useEffect(() => {
    let isActive = true;
    if (!isAdmin) return;

    setIsInviteLoading(true);
    getInviteSettings()
      .then((settings) => {
        if (!isActive) return;
        setInviteCode(settings.inviteCode);
        setInviteExpiresAt(settings.expiresAt);
        setInviteExpirationOption('never');
        setIsInviteExpirationDirty(false);
      })
      .catch((error) => {
        if (__DEV__) {
          console.log('[AdminSettings] Invite settings load error:', error);
        }
      })
      .finally(() => {
        if (!isActive) return;
        setIsInviteLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [getInviteSettings, isAdmin]);

  const pickLogo = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant photo permissions to select a club logo.');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setLogoUrl(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!crew) return;
    setIsSaving(true);
    try {
      await updateCrewSettings({
        name: name.trim() || crew.name,
        description: description.trim(),
        logoUrl,
        requiresApproval,
      });
      Alert.alert('Saved', 'Club settings updated.');
    } catch (error: any) {
      const message =
        error?.message === 'SUBSCRIPTION_INACTIVE'
          ? 'Subscription inactive. Renew to manage crew settings.'
          : 'Unable to save settings right now.';
      Alert.alert('Error', message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async (request: JoinRequest) => {
    try {
      await approveJoinRequest(request);
    } catch {
      Alert.alert('Error', 'Unable to approve this request right now.');
    }
  };

  const handleDeny = async (request: JoinRequest) => {
    try {
      await denyJoinRequest(request);
    } catch {
      Alert.alert('Error', 'Unable to deny this request right now.');
    }
  };

  const handleRemove = (member: CrewMember) => {
    Alert.alert('Remove Member', `Remove ${member.name} from the crew?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMember(member.id);
          } catch (error: any) {
            const message =
              error?.message === 'OWNER_REMOVE_NOT_ALLOWED'
                ? 'You cannot remove the current owner.'
                : 'Unable to remove this member right now.';
            Alert.alert('Error', message);
          }
        },
      },
    ]);
  };

  const toggleOfficer = async (member: CrewMember) => {
    try {
      await setMemberRole(member.id, member.role === 'officer' ? 'member' : 'officer');
    } catch (error: any) {
      const message =
        error?.message === 'OWNER_ROLE_LOCKED'
          ? 'The owner role cannot be changed.'
          : 'Unable to update this member role.';
      Alert.alert('Error', message);
    }
  };

  const saveInviteSettings = async ({ rotate }: { rotate: boolean }) => {
    setIsInviteSaving(true);
    try {
      const expiresAt = expiresAtForOption(inviteExpirationOption);
      const settings = await updateInviteSettings({
        inviteCode: rotate ? undefined : inviteCode,
        expiresAt: isInviteExpirationDirty ? expiresAt : inviteExpiresAt,
      });
      setInviteCode(settings.inviteCode);
      setInviteExpiresAt(settings.expiresAt);
      setIsInviteExpirationDirty(false);
      Alert.alert('Invite Updated', rotate ? 'A new invite code is ready.' : 'Invite settings saved.');
    } catch (error: any) {
      const message =
        error?.message === 'INVITE_CODE_TAKEN'
          ? 'That invite code is already taken.'
          : error?.message === 'INVITE_CODE_LENGTH'
            ? 'Invite codes must be 4 to 16 letters or numbers.'
            : 'Unable to update invite settings right now.';
      Alert.alert('Error', message);
    } finally {
      setIsInviteSaving(false);
    }
  };

  const copyInviteCode = async () => {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
    Alert.alert('Copied', 'Invite code copied.');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.title}>Admin Settings</Text>
          <View style={styles.backButton} />
        </View>

        {isBillingRequired && !isOwner && !isSubscriptionActive && (
          <View style={styles.banner}>
            <Shield size={16} color={colors.warning} />
            <Text style={styles.bannerText}>
              Subscription inactive. Admin actions are locked until the club subscription is active.
            </Text>
          </View>
        )}

        {canManageJoinRequests && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Join Requests</Text>
          {pendingRequests.length === 0 ? (
            <Text style={styles.emptyText}>No pending requests.</Text>
          ) : (
            pendingRequests.map((request) => (
              <View key={request.id} style={styles.requestRow}>
                <View style={styles.requestInfo}>
                  <View style={styles.requestNameRow}>
                    <Text style={styles.memberName}>{request.userName}</Text>
                    <View style={styles.pendingPill}>
                      <Text style={styles.pendingPillText}>Pending</Text>
                    </View>
                  </View>
                  <Text style={styles.memberMeta}>{request.userEmail}</Text>
                </View>
                <View style={styles.rowActions}>
                  <Pressable style={[styles.iconButton, styles.approveButton]} onPress={() => handleApprove(request)}>
                    <UserPlus size={16} color={colors.created} />
                  </Pressable>
                  <Pressable style={[styles.iconButton, styles.denyButton]} onPress={() => handleDeny(request)}>
                    <UserMinus size={16} color={colors.deleted} />
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
        )}

        {isAdmin && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Club Settings</Text>
            <Pressable style={styles.logoRow} onPress={pickLogo}>
              {logoUrl ? (
                <Image source={{ uri: logoUrl }} style={styles.logo} contentFit="cover" />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Camera size={18} color={colors.text} />
                </View>
              )}
              <Text style={styles.logoText}>Change club logo</Text>
            </Pressable>

            <Text style={styles.label}>Club Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Club name"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="Club description"
              placeholderTextColor={colors.textTertiary}
              multiline
            />

            <View style={styles.switchRow}>
              <Text style={styles.label}>Require Approval</Text>
              <Switch
                value={requiresApproval}
                onValueChange={setRequiresApproval}
                trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
                thumbColor={colors.text}
              />
            </View>

            <Pressable style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
              <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Settings'}</Text>
            </Pressable>
          </View>
        )}

        {isAdmin && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Invite Code</Text>
            <Text style={styles.helperText}>
              Members can join with this code. Rotate it anytime or set it to expire.
            </Text>

            <View style={styles.inviteCodeBox}>
              <TextInput
                style={styles.inviteInput}
                value={isInviteLoading ? 'Loading...' : inviteCode}
                onChangeText={(value) => setInviteCode(value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                editable={!isInviteLoading && !isInviteSaving}
                autoCapitalize="characters"
                placeholder="INVITE"
                placeholderTextColor={colors.textTertiary}
                maxLength={16}
              />
              <Pressable style={styles.iconButton} onPress={copyInviteCode} disabled={!inviteCode}>
                <Copy size={16} color={colors.text} />
              </Pressable>
            </View>
            <Text style={styles.inviteExpiryText}>{getInviteExpirationLabel(inviteExpiresAt)}</Text>

            <View style={styles.expirationOptions}>
              {INVITE_EXPIRATION_OPTIONS.map((option) => {
                const selected = inviteExpirationOption === option.value;
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.expirationChip, selected && styles.expirationChipSelected]}
                    onPress={() => {
                      setInviteExpirationOption(option.value);
                      setIsInviteExpirationDirty(true);
                    }}
                    disabled={isInviteSaving}
                  >
                    <Text
                      style={[
                        styles.expirationChipText,
                        selected && styles.expirationChipTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.inviteActions}>
              <Pressable
                style={[styles.secondaryActionButton, isInviteSaving && styles.disabledAction]}
                onPress={() => saveInviteSettings({ rotate: true })}
                disabled={isInviteSaving}
              >
                <RefreshCcw size={16} color={colors.text} />
                <Text style={styles.secondaryActionText}>Rotate</Text>
              </Pressable>
              <Pressable
                style={[styles.saveButton, styles.inviteSaveButton, isInviteSaving && styles.disabledAction]}
                onPress={() => saveInviteSettings({ rotate: false })}
                disabled={isInviteSaving}
              >
                <Text style={styles.saveButtonText}>
                  {isInviteSaving ? 'Saving...' : 'Save Invite'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Members</Text>
          {members.map((member) => (
            <View key={member.id} style={styles.memberRow}>
              <View style={styles.requestInfo}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberMeta}>{member.role}</Text>
              </View>
              {isAdmin && member.id !== crew?.ownerId ? (
                <View style={styles.rowActions}>
                  <Pressable style={styles.iconButton} onPress={() => toggleOfficer(member)}>
                    <Star size={16} color={colors.text} />
                  </Pressable>
                  <Pressable style={styles.iconButton} onPress={() => handleRemove(member)}>
                    <UserMinus size={16} color={colors.error} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 840,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 60,
  },
  backText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  banner: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  bannerText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: 14,
  },
  helperText: {
    color: colors.textTertiary,
    fontSize: 13,
    lineHeight: 18,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  requestInfo: {
    flex: 1,
    gap: 2,
  },
  requestNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(245,158,11,0.14)',
    borderWidth: 1,
    borderColor: colors.pending,
  },
  pendingPillText: {
    color: colors.pending,
    fontSize: 11,
    fontWeight: '800',
  },
  rowActions: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  approveButton: {
    borderWidth: 1,
    borderColor: colors.created,
  },
  denyButton: {
    borderWidth: 1,
    borderColor: colors.deleted,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  memberName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  memberMeta: {
    color: colors.textTertiary,
    fontSize: 13,
    textTransform: 'capitalize',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  logoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  inviteCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inviteInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
  },
  inviteExpiryText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  expirationOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  expirationChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  expirationChipSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(229,229,229,0.12)',
  },
  expirationChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  expirationChipTextSelected: {
    color: colors.text,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryActionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryActionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  inviteSaveButton: {
    flex: 1,
    minHeight: 48,
  },
  disabledAction: {
    opacity: 0.6,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '700',
  },
});
