import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, Hash, LogOut, ShieldCheck, UserPlus } from 'lucide-react-native';
import { doc, getDoc } from 'firebase/firestore';
import Colors from '@/constants/colors';
import { CLUB_ID, CLUB_NAME } from '@/constants/club';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/utils/firebase';

const WAITING_ROOM_IMAGE = require('../assets/images/waiting-room.jpg');

export default function CrewSelectionScreen() {
  const { user, signOut, requestJoin, cancelJoinRequest, joinCrew, isJoiningCrew } = useAuth();
  const [clubName, setClubName] = useState(CLUB_NAME);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  const hasPendingRequest = user?.pendingCrewId === CLUB_ID;

  useEffect(() => {
    getDoc(doc(db, 'crews', CLUB_ID))
      .then((snap) => {
        if (snap.exists()) {
          setClubName((snap.data() as { name?: string }).name || CLUB_NAME);
        }
      })
      .catch(() => setClubName(CLUB_NAME));
  }, []);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const handleRequestAccess = async () => {
    setIsSubmitting(true);
    try {
      await requestJoin(CLUB_ID);
      Alert.alert('Request Sent', `Your request to join ${clubName} is waiting for admin approval.`);
    } catch {
      Alert.alert('Error', 'Could not send your access request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRequest = () => {
    Alert.alert('Cancel Request', 'Cancel your pending access request?', [
      { text: 'Keep It', style: 'cancel' },
      {
        text: 'Cancel Request',
        style: 'destructive',
        onPress: async () => {
          setIsSubmitting(true);
          try {
            await cancelJoinRequest(CLUB_ID);
          } catch {
            Alert.alert('Error', 'Could not cancel your request. Please try again.');
          } finally {
            setIsSubmitting(false);
          }
        },
      },
    ]);
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

  return (
    <View style={styles.container}>
      <ImageBackground source={WAITING_ROOM_IMAGE} style={styles.background} resizeMode="cover">
        <LinearGradient
          colors={['rgba(0,0,0,0.18)', 'rgba(0,0,0,0.62)', Colors.dark.background]}
          style={styles.backgroundOverlay}
        />
      </ImageBackground>
      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <LogOut size={20} color={Colors.dark.textTertiary} />
        </TouchableOpacity>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <ShieldCheck size={48} color={Colors.dark.primary} strokeWidth={1.6} />
            </View>
            <Text style={styles.title}>{clubName}</Text>
            <Text style={styles.subtitle}>
              This app is private. Request access and an admin will approve your account.
            </Text>
          </View>

          <View style={styles.glassPanel}>
          {hasPendingRequest ? (
            <View style={styles.pendingCard}>
              <Clock size={22} color={Colors.dark.pending} />
              <View style={styles.pendingText}>
                <Text style={styles.pendingTitle}>Request Pending</Text>
                <Text style={styles.pendingSubtitle}>
                  You will get access after an admin approves your account.
                </Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
              onPress={handleRequestAccess}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color={Colors.dark.background} />
              ) : (
                <>
                  <UserPlus size={20} color={Colors.dark.background} />
                  <Text style={styles.primaryButtonText}>Request Access</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {hasPendingRequest && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleCancelRequest}
              disabled={isSubmitting}
            >
              <Text style={styles.secondaryButtonText}>
                {isSubmitting ? 'Updating...' : 'Cancel Request'}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.inviteBlock}>
            <Text style={styles.inviteTitle}>Already have an invite code?</Text>
            <Text style={styles.inviteSubtitle}>
              Enter it here to skip the approval wait.
            </Text>
            <View style={styles.inviteInputRow}>
              <Hash size={18} color={Colors.dark.textTertiary} />
              <TextInput
                style={styles.inviteInput}
                value={inviteCode}
                onChangeText={(text) => setInviteCode(formatInviteCode(text))}
                placeholder="ABCD1234"
                placeholderTextColor={Colors.dark.textTertiary}
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
                <ActivityIndicator color={Colors.dark.background} />
              ) : (
                <Text style={styles.inviteButtonText}>Use Invite Code</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.note}>
            Members use the app free after approval. Admin tools are managed by the club owner.
          </Text>
          </View>
        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  background: {
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
    color: Colors.dark.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
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
    borderColor: Colors.dark.pending,
    marginBottom: 16,
    gap: 12,
  },
  pendingText: {
    flex: 1,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.pending,
  },
  pendingSubtitle: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 3,
    lineHeight: 18,
  },
  primaryButton: {
    height: 56,
    borderRadius: 20,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  primaryButtonText: {
    color: Colors.dark.background,
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
    borderColor: Colors.dark.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: Colors.dark.textSecondary,
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
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  inviteSubtitle: {
    color: Colors.dark.textTertiary,
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
    borderColor: Colors.dark.borderLight,
    backgroundColor: 'rgba(0,0,0,0.34)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  inviteInput: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  inviteButton: {
    height: 48,
    borderRadius: 18,
    backgroundColor: Colors.dark.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteButtonText: {
    color: Colors.dark.background,
    fontSize: 15,
    fontWeight: '800',
  },
  note: {
    color: Colors.dark.textTertiary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 18,
  },
});
