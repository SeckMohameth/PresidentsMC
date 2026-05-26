import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Share, Platform, TextInput, Modal, Linking, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Users,
  Settings,
  Share2,
  Copy,
  Shield,
  Bell,
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
  Bike,
  ImagePlus,
  UserPlus,
  UserMinus,
  Trash2,
  X,
  MessageSquarePlus
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AppColors, useThemeColors } from '@/constants/colors';
import { CLUB_NAME } from '@/constants/club';
import { useCrew } from '@/providers/CrewProvider';
import { useAuth } from '@/providers/AuthProvider';
import { getAvatarSource, isDefaultAvatar } from '@/utils/avatar';
import { getInitials } from '@/utils/helpers';
import { trackAnalyticsEvent } from '@/utils/analytics';
import * as Clipboard from 'expo-clipboard';
import { BikeProfile, CrewMember } from '@/types';
import { getPhotoPickerErrorMessage, pickSingleImage, requestPhotoLibraryAccess } from '@/utils/imagePicker';
import { uploadImageUri } from '@/utils/storageUpload';

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  showBadge?: boolean;
  badgeText?: string;
  destructive?: boolean;
  warning?: boolean;
}

function MenuItem({ icon, label, onPress, showBadge, badgeText, destructive, warning }: MenuItemProps) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable 
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
      onPress={onPress}
    >
      <View style={styles.menuItemLeft}>
        {icon}
        <Text style={[
          styles.menuItemLabel,
          destructive && styles.destructiveText,
          warning && styles.warningText,
        ]}>
          {label}
        </Text>
      </View>
      <View style={styles.menuItemRight}>
        {showBadge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeText}</Text>
          </View>
        )}
        <ChevronRight size={20} color={colors.textTertiary} />
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
const FEEDBACK_URL = 'https://www.momadeit.online/apps/pjs8MBE7YCvnzUzLCIFd';

function pickOwnershipCandidate(members: CrewMember[], currentUserId?: string) {
  if (!currentUserId) return null;

  const priority = (role: CrewMember['role']) => {
    if (role === 'admin' || role === 'officer') return 0;
    return 1;
  };

  return [...members]
    .filter((member) => member.id !== currentUserId && member.role === 'admin')
    .sort((a, b) => {
      const roleDiff = priority(a.role) - priority(b.role);
      if (roleDiff !== 0) return roleDiff;
      return new Date(a.joinedCrewAt).getTime() - new Date(b.joinedCrewAt).getTime();
    })[0] || null;
}

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === 'ios' ? 74 : 66;
  const router = useRouter();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { currentUser, crew, isAdmin, canManageJoinRequests, members, joinRequests, leaveCrew, getInviteCode } = useCrew();
  const { signOut, deleteAccount, updateProfile, user } = useAuth();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isOwner = !!currentUser?.id && crew?.ownerId === currentUser.id;
  const pendingJoinRequests = joinRequests.filter((request) => request.status === 'pending');
  const visibleMemberCount = members.filter((member) => !member.isDeveloperSupport).length;
  const otherAdmins = members.filter(
    (member) => member.id !== currentUser?.id && member.role === 'admin' && !member.isDeveloperSupport
  );
  const needsAdminBeforeExit =
    !!currentUser &&
    (isOwner || currentUser.role === 'admin') &&
    visibleMemberCount > 1 &&
    otherAdmins.length === 0;

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editBike, setEditBike] = useState('');
  const [editBikes, setEditBikes] = useState<BikeProfile[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [supportModalVisible, setSupportModalVisible] = useState(false);
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

    if (needsAdminBeforeExit) {
      return {
        title: 'Promote an Admin First',
        message: `Promote another member to admin before leaving ${crew.name}. Members can leave anytime, but the club must keep at least one admin.`,
      };
    }

    if (!isOwner) {
      return {
        title: 'Leave Club',
        message: `You will be removed from ${crew.name}. Your account will stay active, and your existing content will keep its current attribution.`,
      };
    }

    if (visibleMemberCount <= 1) {
      return {
        title: 'Archive Club',
        message: `You are the last member of ${crew.name}. Leaving will archive the crew immediately and permanently purge it after 30 days.`,
      };
    }

    return {
      title: 'Transfer Ownership and Leave',
      message: `Ownership will transfer to ${nextOwner?.name || 'the longest-serving member'}.`,
    };
  })();

  const deletePreview: ExitPreview = (() => {
    if (!crew || !currentUser) {
      return {
        title: 'Delete Account',
        message: 'This permanently deletes your account and personal data. This cannot be undone. Photos you added will stay in club albums, but they will be anonymized to "Former Member".',
      };
    }

    const base =
      'This permanently deletes your account and personal data. This cannot be undone. Photos you added will stay in club albums, but they will be anonymized to "Former Member".';

    if (needsAdminBeforeExit) {
      return {
        title: 'Promote an Admin First',
        message: `${base} Promote another member to admin before deleting your account so the club still has an admin.`,
      };
    }

    if (!isOwner) {
      return {
        title: 'Delete Account',
        message: `${base} You will also be removed from ${crew.name}.`,
      };
    }

    if (visibleMemberCount <= 1) {
      return {
        title: 'Delete Account and Archive Crew',
      message: `${base} Because you are the last member, ${crew.name} will be archived immediately and permanently purged after 30 days.`,
      };
    }

    return {
      title: 'Delete Account and Transfer Ownership',
      message: `${base} Ownership will transfer to ${nextOwner?.name || 'the longest-serving member'}.`,
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
    setEditBikes(
      currentUser?.bikes?.length
        ? currentUser.bikes
        : currentUser?.bike
          ? [{
              id: `bike-${Date.now()}`,
              name: currentUser.bike,
              createdAt: new Date().toISOString(),
              isPrimary: true,
            }]
          : []
    );
    setEditModalVisible(true);
  };

  const addBikeDraft = () => {
    setEditBikes((current) => [
      ...current,
      {
        id: `bike-${Date.now()}`,
        name: '',
        details: '',
        createdAt: new Date().toISOString(),
        isPrimary: current.length === 0,
      },
    ]);
  };

  const updateBikeDraft = (bikeId: string, updates: Partial<BikeProfile>) => {
    setEditBikes((current) =>
      current.map((bike) => bike.id === bikeId ? { ...bike, ...updates } : bike)
    );
  };

  const removeBikeDraft = (bikeId: string) => {
    setEditBikes((current) => {
      const next = current.filter((bike) => bike.id !== bikeId);
      if (next.length > 0 && !next.some((bike) => bike.isPrimary)) {
        return next.map((bike, index) => ({ ...bike, isPrimary: index === 0 }));
      }
      return next;
    });
  };

  const setPrimaryBikeDraft = (bikeId: string) => {
    setEditBikes((current) =>
      current.map((bike) => ({ ...bike, isPrimary: bike.id === bikeId }))
    );
  };

  const pickAvatar = async () => {
    const hasAccess = await requestPhotoLibraryAccess(
      'Please grant photo permissions to change your avatar.'
    );
    if (!hasAccess) return;

    try {
      const result = await pickSingleImage({ quality: 0.8 });
      if (!result.canceled && result.assets[0]) {
        setEditAvatar(result.assets[0].uri);
      }
    } catch (error) {
      if (__DEV__) {
        console.log('[More] Photo picker error:', error);
      }
      Alert.alert('Photo Error', getPhotoPickerErrorMessage(error));
    }
  };

  const pickBikePhoto = async (bikeId: string) => {
    const hasAccess = await requestPhotoLibraryAccess(
      'Please grant photo permissions to add a bike photo.'
    );
    if (!hasAccess) return;

    try {
      const result = await pickSingleImage({ quality: 0.85 });
      if (!result.canceled && result.assets[0]) {
        updateBikeDraft(bikeId, { photoUrl: result.assets[0].uri });
      }
    } catch (error) {
      if (__DEV__) {
        console.log('[More] Bike photo picker error:', error);
      }
      Alert.alert('Photo Error', getPhotoPickerErrorMessage(error));
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
      if (avatarUrl && !avatarUrl.startsWith('http') && !isDefaultAvatar(avatarUrl) && user?.id) {
        avatarUrl = await uploadImageUri(avatarUrl, `users/${user.id}/avatar.jpg`);
      }
      const normalizedBikes = editBikes
        .map((bike, index) => ({
          ...bike,
          name: bike.name.trim(),
          details: bike.details?.trim() || '',
          isPrimary: bike.isPrimary === true || (index === 0 && !editBikes.some((item) => item.isPrimary)),
        }))
        .filter((bike) => bike.name);
      const uploadedBikes = await Promise.all(normalizedBikes.map(async (bike) => {
        let photoUrl = bike.photoUrl || '';
        if (photoUrl && !photoUrl.startsWith('http') && user?.id) {
          photoUrl = await uploadImageUri(photoUrl, `users/${user.id}/bikes/${bike.id}.jpg`);
        }
        return { ...bike, photoUrl };
      }));
      const primaryBike = uploadedBikes.find((bike) => bike.isPrimary) || uploadedBikes[0];
      await updateProfile({
        name: editName.trim(),
        avatar: avatarUrl,
        bike: primaryBike?.name || editBike.trim(),
        bikes: uploadedBikes,
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
    if (needsAdminBeforeExit) {
      Alert.alert(leavePreview.title, leavePreview.message);
      return;
    }

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
                ? `Ownership transferred to ${result.nextOwnerName || 'the next owner'}.`
                : `You left ${result.crewName || 'the crew'}.`;
            Alert.alert('Club Updated', successMessage);
          } catch (error: any) {
            void trackAnalyticsEvent({
              eventName: 'crew_leave_failed',
              crewId: crew?.id ?? null,
              route: '/(tabs)/more',
            });
            const message = String(error?.message ?? '');
            Alert.alert(
              'Error',
              message.includes('ANOTHER_ADMIN_REQUIRED')
                ? 'Promote another member to admin before leaving the club.'
                : 'Unable to leave crew right now.'
            );
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
    if (needsAdminBeforeExit) {
      Alert.alert(deletePreview.title, deletePreview.message);
      return;
    }

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
                'Your account was deleted. Photos and authored club content were kept and anonymized.'
              );
            } catch (error: any) {
              void trackAnalyticsEvent({
                eventName: 'crew_delete_failed',
                crewId: crew?.id ?? null,
                route: '/(tabs)/more',
              });
              const message = String(error?.message ?? '');
              Alert.alert(
                'Delete Failed',
                message.includes('ANOTHER_ADMIN_REQUIRED')
                  ? 'Promote another member to admin before deleting your account.'
                  : 'Please sign in again and retry deleting your account.'
              );
            }
          },
        },
      ]
    );
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
          { paddingTop: insets.top + 8, paddingBottom: tabBarHeight + insets.bottom + 32 },
          isTablet && styles.scrollContentTablet,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>More</Text>

        <Pressable
          style={styles.profileCard}
          onPress={() => currentUser?.id && router.push(`/member/${currentUser.id}`)}
        >
          <View style={styles.profileAvatarContainer}>
            {currentUser?.avatar ? (
              <Image
                source={getAvatarSource(currentUser.avatar)}
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
            {(isAdmin || canManageJoinRequests) && (
              <View style={styles.adminBadge}>
                <Crown size={12} color={colors.text} />
              </View>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{currentUser?.name}</Text>
            <Text style={styles.profileEmail}>{currentUser?.email}</Text>
            {currentUser?.bike ? (
              <View style={styles.bikeLine}>
                <Bike size={13} color={colors.textTertiary} />
                <Text style={styles.profileBike}>{currentUser.bike}</Text>
              </View>
            ) : null}
            <View style={styles.roleTag}>
              <Text style={styles.roleTagText}>
                {currentUser?.role === 'admin' ? 'Admin' : currentUser?.role === 'officer' ? 'Officer' : 'Member'}
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.editProfileButton}
            onPress={(event) => {
              event.stopPropagation();
              openEditProfile();
            }}
          >
            <Pencil size={18} color={colors.textTertiary} />
          </Pressable>
        </Pressable>

        {(isAdmin || canManageJoinRequests) && pendingJoinRequests.length > 0 && (
          <Pressable style={styles.joinRequestsCard} onPress={() => router.push('/admin-settings')}>
            <View style={styles.joinRequestsIcon}>
              <UserPlus size={22} color={colors.pending} />
            </View>
            <View style={styles.joinRequestsCopy}>
              <Text style={styles.joinRequestsTitle}>
                {pendingJoinRequests.length} pending join {pendingJoinRequests.length === 1 ? 'request' : 'requests'}
              </Text>
              <Text style={styles.joinRequestsText}>Review, approve, or deny access to the club.</Text>
            </View>
            <ChevronRight size={20} color={colors.textTertiary} />
          </Pressable>
        )}

        {isAdmin && (
          <View style={styles.inviteCard}>
            <View style={styles.inviteHeader}>
              <Text style={styles.inviteTitle}>Invite Code</Text>
              <Pressable style={styles.shareButton} onPress={handleShareInvite}>
                <Share2 size={16} color={colors.primary} />
                <Text style={styles.shareButtonText}>Share</Text>
              </Pressable>
            </View>
            <View style={styles.inviteCodeRow}>
              <Text style={styles.inviteCode}>
                {crewInviteCode || (isInviteCodeLoading ? 'Loading...' : 'Unavailable')}
              </Text>
              <Pressable style={styles.copyButton} onPress={handleCopyInviteCode}>
                <Copy size={18} color={colors.text} />
              </Pressable>
            </View>
            <Text style={styles.inviteHint}>Share this code to invite new members</Text>
          </View>
        )}

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Club</Text>
          <View style={styles.menuCard}>
            <MenuItem 
              icon={<Users size={20} color={colors.primary} />}
              label="Members"
              onPress={() => router.push('/members')}
              showBadge
              badgeText={`${members.length}`}
            />
            {isAdmin && (
              <MenuItem 
                icon={<Shield size={20} color={colors.warning} />}
                label="Admin Settings"
                onPress={() => router.push('/admin-settings')}
                showBadge={pendingJoinRequests.length > 0}
                badgeText={`${pendingJoinRequests.length}`}
              />
            )}
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Settings</Text>
          <View style={styles.menuCard}>
            <MenuItem 
              icon={<Bell size={20} color={colors.textSecondary} />}
              label="Notifications"
              onPress={() => router.push('/notifications')}
            />
            <MenuItem 
              icon={<Settings size={20} color={colors.textSecondary} />}
              label="Preferences"
              onPress={() => router.push('/preferences')}
            />
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Support</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon={<MessageSquarePlus size={20} color={colors.info} />}
              label="Submit Feedback"
              onPress={() => openSupportLink(FEEDBACK_URL)}
            />
            <MenuItem 
              icon={<HelpCircle size={20} color={colors.textSecondary} />}
              label="Help & Support"
              onPress={() => setSupportModalVisible(true)}
            />
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Account</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon={<KeyRound size={20} color={colors.textSecondary} />}
              label="Email & Password"
              onPress={() => router.push('/account-security' as any)}
            />
          </View>
        </View>

        <View style={[styles.menuSection, styles.dangerZoneSection]}>
          <Text style={[styles.menuSectionTitle, styles.dangerZoneTitle]}>Danger Zone</Text>
          <Text style={styles.dangerZoneHint}>
            These actions remove access or permanently delete your account data.
          </Text>
          <View style={styles.dangerMenuCard}>
            <MenuItem
              icon={<UserMinus size={20} color={colors.error} />}
              label="Leave Club"
              onPress={handleLeaveCrew}
              destructive
            />
            <MenuItem
              icon={<Trash2 size={20} color={colors.error} />}
              label="Delete Account"
              onPress={handleDeleteAccount}
              destructive
            />
          </View>
        </View>

        <View style={styles.bottomAccountActions}>
          <MenuItem
            icon={<LogOut size={20} color={colors.warning} />}
            label="Sign Out"
            onPress={handleSignOut}
            warning
          />
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

            <ScrollView showsVerticalScrollIndicator={false}>
              <Pressable style={styles.editAvatarContainer} onPress={pickAvatar}>
                {editAvatar ? (
                  <Image source={getAvatarSource(editAvatar)} style={styles.editAvatar} contentFit="cover" />
                ) : (
                  <View style={styles.editAvatarPlaceholder}>
                    <Text style={styles.editAvatarInitials}>{getInitials(editName || 'U')}</Text>
                  </View>
                )}
                <View style={styles.editAvatarBadge}>
                  <Camera size={14} color={colors.text} />
                </View>
              </Pressable>

              <Text style={styles.editLabel}>Display Name</Text>
              <TextInput
                style={styles.editInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Your name"
                placeholderTextColor={colors.textTertiary}
              />

              <View style={styles.editSectionHeader}>
                <Text style={[styles.editLabel, styles.editLabelSpaced]}>Bikes</Text>
                <Pressable style={styles.addBikeButton} onPress={addBikeDraft}>
                  <ImagePlus size={15} color={colors.text} />
                  <Text style={styles.addBikeText}>Add Bike</Text>
                </Pressable>
              </View>

              {editBikes.length === 0 ? (
                <View style={styles.emptyBikeCard}>
                  <Bike size={18} color={colors.textTertiary} />
                  <Text style={styles.emptyBikeText}>Add your bike so members can see what you ride.</Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.bikeEditorList}
                >
                  {editBikes.map((bike, index) => (
                    <View key={bike.id} style={styles.bikeEditorCard}>
                      <Pressable style={styles.bikePhotoButton} onPress={() => pickBikePhoto(bike.id)}>
                        {bike.photoUrl ? (
                          <Image source={{ uri: bike.photoUrl }} style={styles.bikePhoto} contentFit="cover" />
                        ) : (
                          <View style={styles.bikePhotoPlaceholder}>
                            <Camera size={18} color={colors.textTertiary} />
                            <Text style={styles.bikePhotoPlaceholderText}>Add Photo</Text>
                          </View>
                        )}
                        <LinearGradient
                          colors={['transparent', 'rgba(0,0,0,0.72)', 'rgba(0,0,0,0.95)']}
                          locations={[0.22, 0.68, 1]}
                          style={StyleSheet.absoluteFillObject}
                        />
                        <View style={styles.bikePhotoCopy}>
                          <Text style={styles.bikeCardTitle} numberOfLines={1}>
                            {bike.name.trim() || `Bike ${index + 1}`}
                          </Text>
                          <Text style={styles.bikeCardSubtitle} numberOfLines={2}>
                            {bike.details?.trim() || 'Bike photo'}
                          </Text>
                        </View>
                      </Pressable>
                      <View style={styles.bikeEditorBody}>
                        <TextInput
                          style={styles.bikeInput}
                          value={bike.name}
                          onChangeText={(value) => {
                            updateBikeDraft(bike.id, { name: value });
                            if (index === 0) setEditBike(value);
                          }}
                          placeholder="Harley-Davidson Street Glide"
                          placeholderTextColor={colors.textTertiary}
                          maxLength={80}
                        />
                        <TextInput
                          style={[styles.bikeInput, styles.bikeDetailsInput]}
                          value={bike.details || ''}
                          onChangeText={(value) => updateBikeDraft(bike.id, { details: value })}
                          placeholder="Color, year, custom notes"
                          placeholderTextColor={colors.textTertiary}
                          maxLength={120}
                        />
                        <View style={styles.bikeEditorActions}>
                          <Pressable
                            style={[styles.primaryBikeChip, bike.isPrimary && styles.primaryBikeChipActive]}
                            onPress={() => setPrimaryBikeDraft(bike.id)}
                          >
                            <Text style={[styles.primaryBikeText, bike.isPrimary && styles.primaryBikeTextActive]}>
                              {bike.isPrimary ? 'Primary' : 'Set Primary'}
                            </Text>
                          </Pressable>
                          <Pressable style={styles.removeBikeButton} onPress={() => removeBikeDraft(bike.id)}>
                            <X size={15} color={colors.error} />
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </ScrollView>
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

            <Pressable style={styles.feedbackCard} onPress={() => openSupportLink(FEEDBACK_URL)}>
              <View style={styles.feedbackIcon}>
                <MessageSquarePlus size={22} color={colors.info} />
              </View>
              <View style={styles.supportText}>
                <Text style={styles.feedbackTitle}>Submit Feedback</Text>
                <Text style={styles.feedbackSubtitle}>Report a bug or request a feature</Text>
              </View>
              <ChevronRight size={20} color={colors.info} />
            </Pressable>

            <Pressable style={styles.supportRow} onPress={() => openSupportLink('mailto:support@mostudios.io')}>
              <View style={styles.supportIcon}>
                <Mail size={18} color={colors.primary} />
              </View>
              <View style={styles.supportText}>
                <Text style={styles.supportTitle}>support@mostudios.io</Text>
                <Text style={styles.supportSubtitle}>Email support</Text>
              </View>
            </Pressable>

            <Pressable style={styles.supportRow} onPress={() => openSupportLink('mailto:info@mostudios.io')}>
              <View style={styles.supportIcon}>
                <Mail size={18} color={colors.primary} />
              </View>
              <View style={styles.supportText}>
                <Text style={styles.supportTitle}>info@mostudios.io</Text>
                <Text style={styles.supportSubtitle}>General inquiries</Text>
              </View>
            </Pressable>

            <Pressable style={styles.supportRow} onPress={() => openSupportLink('https://instagram.com/mostudios.io')}>
              <View style={styles.supportIcon}>
                <AtSign size={18} color={colors.primary} />
              </View>
              <View style={styles.supportText}>
                <Text style={styles.supportTitle}>@mostudios.io</Text>
                <Text style={styles.supportSubtitle}>Instagram</Text>
              </View>
            </Pressable>

            <Pressable style={styles.supportRow} onPress={() => openSupportLink(WEBSITE_URL)}>
              <View style={styles.supportIcon}>
                <Globe size={18} color={colors.primary} />
              </View>
              <View style={styles.supportText}>
                <Text style={styles.supportTitle}>www.mostudios.io</Text>
                <Text style={styles.supportSubtitle}>Website</Text>
              </View>
            </Pressable>

            <Pressable style={styles.supportRow} onPress={() => openSupportLink(TERMS_URL)}>
              <View style={styles.supportIcon}>
                <Shield size={18} color={colors.primary} />
              </View>
              <View style={styles.supportText}>
                <Text style={styles.supportTitle}>Terms of Use</Text>
                <Text style={styles.supportSubtitle}>App terms and acceptable use</Text>
              </View>
            </Pressable>

            <Pressable style={styles.supportRow} onPress={() => openSupportLink(PRIVACY_URL)}>
              <View style={styles.supportIcon}>
                <Shield size={18} color={colors.primary} />
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

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  scrollContentTablet: {
    maxWidth: 840,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 24,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitials: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  adminBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 4,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  profileInfo: {
    flex: 1,
  },
  editProfileButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  profileName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  profileEmail: {
    color: colors.textTertiary,
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
    color: colors.textSecondary,
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
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  inviteCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  joinRequestsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.pending,
  },
  joinRequestsIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,158,11,0.14)',
  },
  joinRequestsCopy: {
    flex: 1,
  },
  joinRequestsTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  joinRequestsText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  inviteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  inviteTitle: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shareButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    paddingLeft: 16,
    marginBottom: 8,
  },
  inviteCode: {
    flex: 1,
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 2,
  },
  copyButton: {
    padding: 16,
  },
  inviteHint: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  menuSection: {
    marginBottom: 24,
  },
  menuSectionTitle: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dangerZoneSection: {
    marginTop: 12,
  },
  dangerZoneTitle: {
    color: colors.error,
  },
  dangerZoneHint: {
    color: colors.textTertiary,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
    marginLeft: 4,
  },
  dangerMenuCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.error,
  },
  bottomAccountActions: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.warning,
    marginBottom: 18,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  destructiveText: {
    color: colors.error,
  },
  warningText: {
    color: colors.warning,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  version: {
    color: colors.textTertiary,
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
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  modalCancel: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  modalSave: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  supportIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportText: {
    flex: 1,
  },
  feedbackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.infoMuted,
    borderWidth: 1,
    borderColor: colors.info,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  feedbackIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  feedbackSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  supportTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  supportSubtitle: {
    color: colors.textTertiary,
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
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAvatarInitials: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '700',
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 8,
    borderWidth: 2,
    borderColor: colors.background,
  },
  editLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  editLabelSpaced: {
    marginTop: 16,
  },
  editInput: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addBikeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addBikeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyBikeCard: {
    minHeight: 86,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
  },
  emptyBikeText: {
    color: colors.textTertiary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  bikeEditorList: {
    gap: 12,
    paddingRight: 20,
  },
  bikeEditorCard: {
    width: 278,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  bikePhotoButton: {
    height: 330,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  bikePhoto: {
    width: '100%',
    height: '100%',
  },
  bikePhotoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bikePhotoPlaceholderText: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: '800',
  },
  bikePhotoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderBottomWidth: 180,
    borderBottomColor: 'rgba(0,0,0,0.72)',
  },
  bikePhotoCopy: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
  },
  bikeCardTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  bikeCardSubtitle: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 5,
  },
  bikeEditorBody: {
    gap: 8,
    padding: 12,
  },
  bikeInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bikeDetailsInput: {
    fontSize: 13,
  },
  bikeEditorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryBikeChip: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryBikeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  primaryBikeText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  primaryBikeTextActive: {
    color: colors.text,
  },
  removeBikeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
});
