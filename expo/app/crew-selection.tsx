import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, Hash, LogOut, ShieldCheck, Trash2, UserPlus } from 'lucide-react-native';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { AppColors, useThemeColors } from '@/constants/colors';
import { CLUB_ID, CLUB_NAME } from '@/constants/club';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/utils/firebase';
import { getFriendlyErrorMessage } from '@/utils/errorMessages';

const WAITING_ROOM_IMAGE = require('../assets/images/custom-images/optimized/waiting-room.jpg');
const ADMIN_SUPPORT_EMAIL = 'mohameth@mostudios.io';
const ADMIN_SUPPORT_URL = 'https://www.mostudios.io/support';

export default function CrewSelectionScreen() {
  const { user, signOut, requestJoin, joinCrew, deleteAccount, isJoiningCrew } = useAuth();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [clubName, setClubName] = useState(CLUB_NAME);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joinRequestStatus, setJoinRequestStatus] =
    useState<'pending' | 'approved' | 'denied' | null>(null);

  const hasPendingRequest = joinRequestStatus === 'pending';
  const wasDenied = joinRequestStatus === 'denied';

  useEffect(() => {
    getDoc(doc(db, 'crews', CLUB_ID))
      .then((snap) => {
        if (snap.exists()) {
          setClubName((snap.data() as { name?: string }).name || CLUB_NAME);
        }
      })
      .catch(() => setClubName(CLUB_NAME));
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setJoinRequestStatus(null);
      return;
    }

    const requestRef = doc(db, 'crews', CLUB_ID, 'joinRequests', user.id);
    return onSnapshot(
      requestRef,
      (snap) => {
        const status = snap.data()?.status;
        setJoinRequestStatus(
          status === 'pending' || status === 'approved' || status === 'denied' ? status : null
        );
      },
      () => setJoinRequestStatus(null)
    );
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || user.pendingCrewId !== CLUB_ID || joinRequestStatus !== null) return;

    let isActive = true;
    const repairMissingRequest = async () => {
      try {
        await requestJoin(CLUB_ID);
        if (isActive) setJoinRequestStatus('pending');
      } catch (error) {
        if (__DEV__) {
          console.log('[CrewSelection] Pending request repair failed:', error);
        }
      }
    };

    void repairMissingRequest();
    return () => {
      isActive = false;
    };
  }, [joinRequestStatus, requestJoin, user?.id, user?.pendingCrewId]);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account and pending access request. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              await deleteAccount();
            } catch {
              Alert.alert('Delete Failed', 'Please sign in again and retry deleting your account.');
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleRequestAccess = async () => {
    setIsSubmitting(true);
    try {
      const result = await requestJoin(CLUB_ID);
      if (result?.status === 'approved') {
        Alert.alert('Access Granted', `You are now in ${result.crewName || clubName}.`);
        return;
      }
      Alert.alert('Request Sent', `Your request to join ${clubName} is waiting for admin approval.`);
    } catch (error) {
      Alert.alert(
        'Request Failed',
        getFriendlyErrorMessage(error, 'Could not send your access request. Please try again.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatInviteCode = (text: string) => text.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 16);

  const handleUseInviteCode = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Invite Code', 'Enter the invite code from an admin.');
      return;
    }

    try {
      await joinCrew(inviteCode.trim().toUpperCase());
      Alert.alert('Access Granted', `You are now in ${clubName}.`);
    } catch {
      Alert.alert('Invalid Code', 'That invite code did not work. Check it and try again.');
    }
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
      <View style={styles.background}>
        <Image source={WAITING_ROOM_IMAGE} style={styles.backgroundImage} contentFit="cover" />
        <LinearGradient
          colors={['rgba(0,0,0,0.34)', 'rgba(0,0,0,0.72)', 'rgba(0,0,0,0.92)']}
          style={styles.backgroundOverlay}
        />
      </View>
      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <LogOut size={20} color={colors.textTertiary} />
        </TouchableOpacity>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <ShieldCheck size={48} color={colors.primary} strokeWidth={1.6} />
            </View>
            <Text style={styles.title}>{clubName}</Text>
            <Text style={styles.subtitle}>
              This app is private. Request access and an admin will approve your account.
            </Text>
          </View>

          <View style={styles.glassPanel}>
          {hasPendingRequest ? (
            <View style={styles.pendingCard}>
              <Clock size={22} color={colors.pending} />
              <View style={styles.pendingText}>
                <Text style={styles.pendingTitle}>Request Pending</Text>
                <Text style={styles.pendingSubtitle}>
                  You will be notified when an admin approves or rejects your request.
                </Text>
              </View>
            </View>
          ) : wasDenied ? (
            <>
              <View style={styles.pendingCard}>
                <ShieldCheck size={22} color={colors.deleted} />
                <View style={styles.pendingText}>
                  <Text style={styles.pendingTitle}>Request Rejected</Text>
                  <Text style={styles.pendingSubtitle}>
                    You can request access again if an admin asked you to retry.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
                onPress={handleRequestAccess}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <>
                    <UserPlus size={20} color={colors.onPrimary} />
                    <Text style={styles.primaryButtonText}>Request Again</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
              onPress={handleRequestAccess}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <>
                  <UserPlus size={20} color={colors.onPrimary} />
                  <Text style={styles.primaryButtonText}>Request Access</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.inviteBlock}>
            <Text style={styles.inviteTitle}>Already have an invite code?</Text>
            <Text style={styles.inviteSubtitle}>
              Enter it here to skip the approval wait.
            </Text>
            <View style={styles.inviteInputRow}>
              <Hash size={18} color={colors.textTertiary} />
              <TextInput
                style={styles.inviteInput}
                value={inviteCode}
                onChangeText={(text) => setInviteCode(formatInviteCode(text))}
                placeholder="ABCD1234"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={16}
              />
            </View>
            <TouchableOpacity
              style={[
                styles.inviteButton,
                (!inviteCode.trim() || isJoiningCrew) && styles.buttonDisabled,
              ]}
              onPress={handleUseInviteCode}
              disabled={!inviteCode.trim() || isJoiningCrew}
              activeOpacity={0.85}
            >
              {isJoiningCrew ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.inviteButtonText}>Use Invite Code</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.note}>
            Members use the app free after approval. Admin tools are managed by the club owner.
          </Text>
          <View style={styles.adminSupport}>
            <Text style={styles.adminSupportText}>Club admin?</Text>
            <TouchableOpacity onPress={() => void openSupportLink(`mailto:${ADMIN_SUPPORT_EMAIL}`)}>
              <Text style={styles.adminSupportLink}>{ADMIN_SUPPORT_EMAIL}</Text>
            </TouchableOpacity>
            <Text style={styles.adminSupportText}>or</Text>
            <TouchableOpacity onPress={() => void openSupportLink(ADMIN_SUPPORT_URL)}>
              <Text style={styles.adminSupportLink}>mostudios.io/support</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.deleteAccountButton}
            onPress={handleDeleteAccount}
            disabled={isSubmitting}
          >
            <Trash2 size={16} color={colors.error} />
            <Text style={styles.deleteAccountText}>Delete Account</Text>
          </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  signOutButton: {
    alignSelf: 'flex-end',
    padding: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'flex-end',
    paddingBottom: 34,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'rgba(10,10,10,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(229,229,229,0.28)',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    lineHeight: 23,
    paddingHorizontal: 16,
  },
  glassPanel: {
    backgroundColor: 'rgba(8,8,9,0.78)',
    borderRadius: 26,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(229,229,229,0.14)',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.pending,
    marginBottom: 16,
    gap: 12,
  },
  pendingText: {
    flex: 1,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.pending,
  },
  pendingSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 3,
    lineHeight: 18,
  },
  primaryButton: {
    height: 56,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  primaryButtonText: {
    color: colors.onPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  secondaryButton: {
    height: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 15,
    fontWeight: '700',
  },
  inviteBlock: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(229,229,229,0.12)',
  },
  inviteTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  inviteSubtitle: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  inviteInputRow: {
    height: 50,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: 'rgba(0,0,0,0.34)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  inviteInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  inviteButton: {
    height: 48,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteButtonText: {
    color: '#050505',
    fontSize: 15,
    fontWeight: '800',
  },
  note: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 18,
  },
  adminSupport: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 10,
  },
  adminSupportText: {
    color: 'rgba(255,255,255,0.46)',
    fontSize: 11,
    lineHeight: 16,
  },
  adminSupportLink: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  deleteAccountButton: {
    marginTop: 14,
    minHeight: 42,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.36)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  deleteAccountText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '800',
  },
});
