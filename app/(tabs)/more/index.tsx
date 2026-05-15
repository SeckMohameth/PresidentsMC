import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Share, Platform, TextInput, Modal, Linking, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '@/utils/firebase';
import {
  Users,
  Settings,
  Share2,
  Copy,
  Shield,
  Bell,
  CreditCard,
  HelpCircle,
  LogOut,
  ChevronRight,
  Crown,
  Pencil,
  Camera,
  Mail,
  Globe,
  AtSign,
  KeyRound,
  Bike
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { CLUB_NAME } from '@/constants/club';
import { useCrew } from '@/providers/CrewProvider';
import { useAuth } from '@/providers/AuthProvider';
import { getInitials } from '@/utils/helpers';
import { trackAnalyticsEvent } from '@/utils/analytics';
import * as Clipboard from 'expo-clipboard';
import { CrewMember } from '@/types';

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  showBadge?: boolean;
  badgeText?: string;
  destructive?: boolean;
}

function MenuItem({ icon, label, onPress, showBadge, badgeText, destructive }: MenuItemProps) {
  return (
    <Pressable 
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
      onPress={onPress}
    >
      <View style={styles.menuItemLeft}>
        {icon}
        <Text style={[styles.menuItemLabel, destructive && styles.destructiveText]}>{label}</Text>
      </View>
      <View style={styles.menuItemRight}>
        {showBadge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeText}</Text>
          </View>
        )}
        <ChevronRight size={20} color={Colors.dark.textTertiary} />
      </View>
    </Pressable>
  );
}

type ExitPreview = {
  title: string;
  message: string;
};

const WEBSITE_URL = 'https://www.mostudios.io/';
const PRIVACY_URL = 'https://www.mostudios.io/privacy';
const TERMS_URL = 'https://www.mostudios.io/terms';
const IOS_SUBSCRIPTIONS_URL = 'itms-apps://apps.apple.com/account/subscriptions';
const ANDROID_SUBSCRIPTIONS_URL =
  'https://play.google.com/store/account/subscriptions?package=app.mostudios.presidentsmc';

function pickOwnershipCandidate(members: CrewMember[], currentUserId?: string) {
  if (!currentUserId) return null;

  const priority = (role: CrewMember['role']) => {
    if (role === 'admin' || role === 'officer') return 0;
    return 1;
  };

  return [...members]
    .filter((member) => member.id !== currentUserId)
    .sort((a, b) => {
      const roleDiff = priority(a.role) - priority(b.role);
      if (roleDiff !== 0) return roleDiff;
      return new Date(a.joinedCrewAt).getTime() - new Date(b.joinedCrewAt).getTime();
    })[0] || null;
}

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentUser, crew, isAdmin, members, leaveCrew, getInviteCode } = useCrew();
  const { signOut, deleteAccount, updateProfile, resendVerificationEmail, user } = useAuth();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isOwner = !!currentUser?.id && crew?.ownerId === currentUser.id;
  const isSubscriptionOwner =
    !!currentUser?.id &&
    (crew?.subscriptionOwnerId === currentUser.id || crew?.ownerId === currentUser.id);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editBike, setEditBike] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [crewInviteCode, setCrewInviteCode] = useState('');
  const [isInviteCodeLoading, setIsInviteCodeLoading] = useState(false);

  const nextOwner = pickOwnershipCandidate(members, currentUser?.id);

  const leavePreview: ExitPreview = (() => {
    if (!crew || !currentUser) {
      return {
        title: 'Leave Club',
        message: `Are you sure you want to leave ${CLUB_NAME}?`,
      };
    }

    if (!isOwner) {
      return {
        title: 'Leave Club',
        message: `You will be removed from ${crew.name}. Your account will stay active, and your existing content will keep its current attribution.`,
      };
    }

    if (members.length <= 1) {
      return {
        title: 'Archive Club',
        message: `You are the last member of ${crew.name}. Leaving will archive the crew immediately and permanently purge it after 30 days. Your store subscription is not auto-cancelled and must be cancelled manually from Apple or Google subscriptions.`,
      };
    }

    return {
      title: 'Transfer Ownership and Leave',
      message: `Ownership will transfer to ${nextOwner?.name || 'the longest-serving member'}. Admin tools will lock until the new owner starts a subscription. Your store subscription is not auto-cancelled and must be cancelled manually from Apple or Google subscriptions.`,
    };
  })();

  const deletePreview: ExitPreview = (() => {
    if (!crew || !currentUser) {
      return {
        title: 'Delete Account',
        message: 'This permanently deletes your account. Authored content will remain and be anonymized to "Former Member".',
      };
    }

    const base =
      'This permanently deletes your account. Authored content will remain in the club app and be anonymized to "Former Member".';

    if (!isOwner) {
      return {
        title: 'Delete Account',
        message: `${base} You will also be removed from ${crew.name}.`,
      };
    }

    if (members.length <= 1) {
      return {
        title: 'Delete Account and Archive Crew',
        message: `${base} Because you are the last member, ${crew.name} will be archived immediately and permanently purged after 30 days. Your store subscription is not auto-cancelled and must be cancelled manually from Apple or Google subscriptions.`,
      };
    }

    return {
      title: 'Delete Account and Transfer Ownership',
      message: `${base} Ownership will transfer to ${nextOwner?.name || 'the longest-serving member'}, and admin tools will lock until the new owner subscribes. Your store subscription is not auto-cancelled and must be cancelled manually from Apple or Google subscriptions.`,
    };
  })();

  useEffect(() => {
    let isActive = true;
    if (!crew?.id || !isAdmin) {
      setCrewInviteCode('');
      setIsInviteCodeLoading(false);
      return;
    }

    setIsInviteCodeLoading(true);
    getInviteCode()
      .then((code) => {
        if (!isActive) return;
        setCrewInviteCode(code);
      })
      .catch((error) => {
        if (__DEV__) {
          console.log('[MoreScreen] Invite code load error:', error);
        }
        if (!isActive) return;
        setCrewInviteCode('');
      })
      .finally(() => {
        if (!isActive) return;
        setIsInviteCodeLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [crew?.id, getInviteCode, isAdmin]);

  const openEditProfile = () => {
    setEditName(currentUser?.name || '');
    setEditAvatar(currentUser?.avatar || '');
    setEditBike(currentUser?.bike || '');
    setEditModalVisible(true);
  };

  const pickAvatar = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant photo permissions to change your avatar.');
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
      setEditAvatar(result.assets[0].uri);
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }
    setIsSaving(true);
    try {
      let avatarUrl = editAvatar;
      if (avatarUrl && !avatarUrl.startsWith('http') && user?.id) {
        const response = await fetch(avatarUrl);
        const blob = await response.blob();
        const storageRef = ref(storage, `users/${user.id}/avatar.jpg`);
        await uploadBytes(storageRef, blob);
        avatarUrl = await getDownloadURL(storageRef);
      }
      await updateProfile({
        name: editName.trim(),
        avatar: avatarUrl,
        bike: editBike.trim(),
      });
      setEditModalVisible(false);
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyInviteCode = async () => {
    if (crewInviteCode) {
      if (Platform.OS !== 'web') {
        await Clipboard.setStringAsync(crewInviteCode);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert('Copied!', `Invite code "${crewInviteCode}" copied to clipboard`);
      return;
    }
    Alert.alert('Invite Code Unavailable', 'The invite code is still loading. Please try again.');
  };

  const handleShareInvite = async () => {
    if (!crewInviteCode) {
      Alert.alert('Invite Code Unavailable', 'The invite code is still loading. Please try again.');
      return;
    }
    try {
      await Share.share({
        message: `Join ${crew?.name || CLUB_NAME} on the ${CLUB_NAME} app. Use invite code: ${crewInviteCode}`,
      });
    } catch (error) {
      if (__DEV__) {
        console.log('[MoreScreen] Error sharing:', error);
      }
    }
  };

  const handleLeaveCrew = () => {
    Alert.alert(
      leavePreview.title,
      leavePreview.message,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: async () => {
          void trackAnalyticsEvent({
            eventName: 'crew_leave_requested',
            crewId: crew?.id ?? null,
            route: '/(tabs)/more',
          });
          try {
            const result = await leaveCrew();
            const successMessage = result.crewArchived
              ? `The crew was archived and will be purged after 30 days.`
              : result.ownershipTransferred
                ? `Ownership transferred to ${result.nextOwnerName || 'the next owner'}. Admin tools are now locked until a subscription is active.`
                : `You left ${result.crewName || 'the crew'}.`;
            Alert.alert(
              'Club Updated',
              result.shouldManageSubscription
                ? `${successMessage} Your store subscription stays active until you cancel it manually.`
                : successMessage,
              result.shouldManageSubscription
                ? [
                    { text: 'Not Now', style: 'cancel' },
                    { text: 'Manage Subscription', onPress: () => void handleManageSubscription() },
                  ]
                : [{ text: 'OK' }]
            );
          } catch {
            void trackAnalyticsEvent({
              eventName: 'crew_leave_failed',
              crewId: crew?.id ?? null,
              route: '/(tabs)/more',
            });
            Alert.alert('Error', 'Unable to leave crew right now.');
          }
        } },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: async () => {
          void trackAnalyticsEvent({
            eventName: 'auth_sign_out_requested',
            route: '/(tabs)/more',
          });
          await signOut().catch((error) => {
            if (__DEV__) {
              console.log('[MoreScreen] Sign out error:', error);
            }
          });
        } },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      deletePreview.title,
      deletePreview.message,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            void trackAnalyticsEvent({
              eventName: 'crew_delete_requested',
              crewId: crew?.id ?? null,
              route: '/(tabs)/more',
            });
            try {
              const result = await deleteAccount();
              void trackAnalyticsEvent({
                eventName: 'crew_delete_success',
                crewId: crew?.id ?? null,
                route: '/(tabs)/more',
                properties: {
                  shouldManageSubscription: result.shouldManageSubscription,
                },
              });
              Alert.alert(
                'Account Deleted',
                result.shouldManageSubscription
                  ? 'Your account was deleted. Any authored content was anonymized, and your store subscription remains active until you cancel it manually.'
                  : 'Your account was deleted and any authored content was anonymized.',
                result.shouldManageSubscription
                  ? [
                      { text: 'Not Now', style: 'cancel' },
                      { text: 'Manage Subscription', onPress: () => void handleManageSubscription() },
                    ]
                  : [{ text: 'OK' }]
              );
            } catch {
              void trackAnalyticsEvent({
                eventName: 'crew_delete_failed',
                crewId: crew?.id ?? null,
                route: '/(tabs)/more',
              });
              Alert.alert('Delete Failed', 'Please sign in again and retry deleting your account.');
            }
          },
        },
      ]
    );
  };

  const handleManageSubscription = async () => {
    const url =
      Platform.OS === 'ios'
        ? IOS_SUBSCRIPTIONS_URL
        : ANDROID_SUBSCRIPTIONS_URL;
    await openSupportLink(url);
  };

  const openSupportLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unable to open link', 'Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 8 },
          isTablet && styles.scrollContentTablet,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>More</Text>

        <Pressable style={styles.profileCard} onPress={openEditProfile}>
          <View style={styles.profileAvatarContainer}>
            {currentUser?.avatar ? (
              <Image
                source={{ uri: currentUser.avatar }}
                style={styles.profileAvatar}
                contentFit="cover"
              />
            ) : (
              <View style={styles.profileAvatarPlaceholder}>
                <Text style={styles.profileInitials}>
                  {getInitials(currentUser?.name || 'U')}
                </Text>
              </View>
            )}
            {isAdmin && (
              <View style={styles.adminBadge}>
                <Crown size={12} color={Colors.dark.text} />
              </View>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{currentUser?.name}</Text>
            <Text style={styles.profileEmail}>{currentUser?.email}</Text>
            {currentUser?.bike ? (
              <View style={styles.bikeLine}>
                <Bike size={13} color={Colors.dark.textTertiary} />
                <Text style={styles.profileBike}>{currentUser.bike}</Text>
              </View>
            ) : null}
            <View style={styles.roleTag}>
              <Text style={styles.roleTagText}>
                {currentUser?.role === 'admin' ? 'Admin' : currentUser?.role === 'officer' ? 'Officer' : 'Member'}
              </Text>
            </View>
          </View>
          <Pencil size={18} color={Colors.dark.textTertiary} />
        </Pressable>

        {user && !user.emailVerified && (
          <View style={styles.verificationCard}>
            <View style={styles.verificationCopy}>
              <Text style={styles.verificationTitle}>Verify your email</Text>
              <Text style={styles.verificationText}>
                Verification stays optional for beta, but password resets and launch support are safer when your inbox is confirmed.
              </Text>
            </View>
            <Pressable
              style={[styles.verificationButton, isSendingVerification && styles.verificationButtonDisabled]}
              disabled={isSendingVerification}
              onPress={async () => {
                setIsSendingVerification(true);
                try {
                  await resendVerificationEmail();
                  Alert.alert('Email Sent', `Verification email sent to ${user.email}.`);
                } catch {
                  Alert.alert('Error', 'Unable to send verification email right now.');
                } finally {
                  setIsSendingVerification(false);
                }
              }}
            >
              <Text style={styles.verificationButtonText}>
                {isSendingVerification ? 'Sending...' : 'Send Email'}
              </Text>
            </Pressable>
          </View>
        )}

        {isAdmin && (
          <View style={styles.inviteCard}>
            <View style={styles.inviteHeader}>
              <Text style={styles.inviteTitle}>Invite Code</Text>
              <Pressable style={styles.shareButton} onPress={handleShareInvite}>
                <Share2 size={16} color={Colors.dark.primary} />
                <Text style={styles.shareButtonText}>Share</Text>
              </Pressable>
            </View>
            <View style={styles.inviteCodeRow}>
              <Text style={styles.inviteCode}>
                {crewInviteCode || (isInviteCodeLoading ? 'Loading...' : 'Unavailable')}
              </Text>
              <Pressable style={styles.copyButton} onPress={handleCopyInviteCode}>
                <Copy size={18} color={Colors.dark.text} />
              </Pressable>
            </View>
            <Text style={styles.inviteHint}>Share this code to invite new members</Text>
          </View>
        )}

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Club</Text>
          <View style={styles.menuCard}>
            <MenuItem 
              icon={<Users size={20} color={Colors.dark.primary} />}
              label="Members"
              onPress={() => router.push('/members')}
              showBadge
              badgeText={`${members.length}`}
            />
            {isAdmin && (
              <MenuItem 
                icon={<Shield size={20} color={Colors.dark.warning} />}
                label="Admin Settings"
                onPress={() => router.push('/admin-settings')}
              />
            )}
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Settings</Text>
          <View style={styles.menuCard}>
            <MenuItem 
              icon={<Bell size={20} color={Colors.dark.textSecondary} />}
              label="Notifications"
              onPress={() => router.push('/notifications')}
            />
            <MenuItem 
              icon={<Settings size={20} color={Colors.dark.textSecondary} />}
              label="Preferences"
              onPress={() => router.push('/preferences')}
            />
          </View>
        </View>

        {isSubscriptionOwner && (
          <View style={styles.menuSection}>
            <Text style={styles.menuSectionTitle}>Subscription</Text>
            <View style={styles.menuCard}>
            <MenuItem 
              icon={<CreditCard size={20} color={Colors.dark.success} />}
              label="Manage Subscription"
              onPress={handleManageSubscription}
            />
          </View>
        </View>
        )}

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Support</Text>
          <View style={styles.menuCard}>
            <MenuItem 
              icon={<HelpCircle size={20} color={Colors.dark.textSecondary} />}
              label="Help & Support"
              onPress={() => setSupportModalVisible(true)}
            />
          </View>
        </View>

        <View style={styles.menuSection}>
          <View style={styles.menuCard}>
            <MenuItem 
              icon={<LogOut size={20} color={Colors.dark.error} />}
              label="Leave Club"
              onPress={handleLeaveCrew}
              destructive
            />
            <MenuItem 
              icon={<LogOut size={20} color={Colors.dark.error} />}
              label="Delete Account"
              onPress={handleDeleteAccount}
              destructive
            />
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Account</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon={<KeyRound size={20} color={Colors.dark.textSecondary} />}
              label="Email & Password"
              onPress={() => router.push('/account-security' as any)}
            />
            <MenuItem
              icon={<LogOut size={20} color={Colors.dark.textSecondary} />}
              label="Sign Out"
              onPress={handleSignOut}
            />
          </View>
        </View>

        <Text style={styles.version}>{CLUB_NAME} v1.0.0</Text>
      </ScrollView>

      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <Pressable onPress={handleSaveProfile} disabled={isSaving}>
                <Text style={[styles.modalSave, isSaving && { opacity: 0.5 }]}>
                  {isSaving ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>
            </View>

            <Pressable style={styles.editAvatarContainer} onPress={pickAvatar}>
              {editAvatar ? (
                <Image source={{ uri: editAvatar }} style={styles.editAvatar} contentFit="cover" />
              ) : (
                <View style={styles.editAvatarPlaceholder}>
                  <Text style={styles.editAvatarInitials}>{getInitials(editName || 'U')}</Text>
                </View>
              )}
              <View style={styles.editAvatarBadge}>
                <Camera size={14} color={Colors.dark.text} />
              </View>
            </Pressable>

            <Text style={styles.editLabel}>Display Name</Text>
            <TextInput
              style={styles.editInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={Colors.dark.textTertiary}
            />

            <Text style={[styles.editLabel, styles.editLabelSpaced]}>Bike</Text>
            <TextInput
              style={styles.editInput}
              value={editBike}
              onChangeText={setEditBike}
              placeholder="Harley-Davidson Street Glide"
              placeholderTextColor={Colors.dark.textTertiary}
              maxLength={80}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={supportModalVisible} animationType="slide" transparent onRequestClose={() => setSupportModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setSupportModalVisible(false)}>
                <Text style={styles.modalCancel}>Close</Text>
              </Pressable>
              <Text style={styles.modalTitle}>Help & Support</Text>
              <View style={{ width: 48 }} />
            </View>

            <Pressable style={styles.supportRow} onPress={() => openSupportLink('mailto:support@mostudios.io')}>
              <View style={styles.supportIcon}>
                <Mail size={18} color={Colors.dark.primary} />
              </View>
              <View style={styles.supportText}>
                <Text style={styles.supportTitle}>support@mostudios.io</Text>
                <Text style={styles.supportSubtitle}>Email support</Text>
              </View>
            </Pressable>

            <Pressable style={styles.supportRow} onPress={() => openSupportLink('mailto:info@mostudios.io')}>
              <View style={styles.supportIcon}>
                <Mail size={18} color={Colors.dark.primary} />
              </View>
              <View style={styles.supportText}>
                <Text style={styles.supportTitle}>info@mostudios.io</Text>
                <Text style={styles.supportSubtitle}>General inquiries</Text>
              </View>
            </Pressable>

            <Pressable style={styles.supportRow} onPress={() => openSupportLink('https://instagram.com/mostudios.io')}>
              <View style={styles.supportIcon}>
                <AtSign size={18} color={Colors.dark.primary} />
              </View>
              <View style={styles.supportText}>
                <Text style={styles.supportTitle}>@mostudios.io</Text>
                <Text style={styles.supportSubtitle}>Instagram</Text>
              </View>
            </Pressable>

            <Pressable style={styles.supportRow} onPress={() => openSupportLink(WEBSITE_URL)}>
              <View style={styles.supportIcon}>
                <Globe size={18} color={Colors.dark.primary} />
              </View>
              <View style={styles.supportText}>
                <Text style={styles.supportTitle}>www.mostudios.io</Text>
                <Text style={styles.supportSubtitle}>Website</Text>
              </View>
            </Pressable>

            <Pressable style={styles.supportRow} onPress={() => openSupportLink(TERMS_URL)}>
              <View style={styles.supportIcon}>
                <Shield size={18} color={Colors.dark.primary} />
              </View>
              <View style={styles.supportText}>
                <Text style={styles.supportTitle}>Terms of Use</Text>
                <Text style={styles.supportSubtitle}>Auto-renewable subscription terms</Text>
              </View>
            </Pressable>

            <Pressable style={styles.supportRow} onPress={() => openSupportLink(PRIVACY_URL)}>
              <View style={styles.supportIcon}>
                <Shield size={18} color={Colors.dark.primary} />
              </View>
              <View style={styles.supportText}>
                <Text style={styles.supportTitle}>Privacy Policy</Text>
                <Text style={styles.supportSubtitle}>How {CLUB_NAME} handles your data</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  scrollContentTablet: {
    maxWidth: 840,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.dark.text,
    letterSpacing: -0.5,
    marginBottom: 24,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  verificationCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 12,
  },
  verificationCopy: {
    gap: 4,
  },
  verificationTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '700',
  },
  verificationText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  verificationButton: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  verificationButtonDisabled: {
    opacity: 0.6,
  },
  verificationButtonText: {
    color: Colors.dark.background,
    fontSize: 13,
    fontWeight: '700',
  },
  profileAvatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  profileAvatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitials: {
    color: Colors.dark.text,
    fontSize: 24,
    fontWeight: '700',
  },
  adminBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.dark.primary,
    borderRadius: 10,
    padding: 4,
    borderWidth: 2,
    borderColor: Colors.dark.surface,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  profileEmail: {
    color: Colors.dark.textTertiary,
    fontSize: 14,
    marginBottom: 8,
  },
  bikeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  profileBike: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  roleTag: {
    backgroundColor: 'rgba(212, 166, 52, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  roleTagText: {
    color: Colors.dark.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  inviteCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  inviteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  inviteTitle: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shareButtonText: {
    color: Colors.dark.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 12,
    paddingLeft: 16,
    marginBottom: 8,
  },
  inviteCode: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 2,
  },
  copyButton: {
    padding: 16,
  },
  inviteHint: {
    color: Colors.dark.textTertiary,
    fontSize: 12,
  },
  menuSection: {
    marginBottom: 24,
  },
  menuSectionTitle: {
    color: Colors.dark.textTertiary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  menuItemPressed: {
    backgroundColor: Colors.dark.surfaceElevated,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemLabel: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '500',
  },
  destructiveText: {
    color: Colors.dark.error,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontWeight: '700',
  },
  version: {
    color: Colors.dark.textTertiary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.dark.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    color: Colors.dark.text,
    fontSize: 17,
    fontWeight: '600',
  },
  modalCancel: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
  },
  modalSave: {
    color: Colors.dark.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    gap: 12,
  },
  supportIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportText: {
    flex: 1,
  },
  supportTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '600',
  },
  supportSubtitle: {
    color: Colors.dark.textTertiary,
    fontSize: 13,
    marginTop: 2,
  },
  editAvatarContainer: {
    alignSelf: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  editAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  editAvatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAvatarInitials: {
    color: Colors.dark.text,
    fontSize: 36,
    fontWeight: '700',
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 16,
    padding: 8,
    borderWidth: 2,
    borderColor: Colors.dark.background,
  },
  editLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  editLabelSpaced: {
    marginTop: 16,
  },
  editInput: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.dark.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
});
