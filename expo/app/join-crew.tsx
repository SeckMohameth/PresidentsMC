import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Hash } from 'lucide-react-native';
import { AppColors, useThemeColors } from '@/constants/colors';
import { useAuth } from '@/providers/AuthProvider';
import { trackAnalyticsEvent } from '@/utils/analytics';

export default function JoinCrewScreen() {
  const { joinCrew, isJoiningCrew } = useAuth();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [inviteCode, setInviteCode] = useState('');

  const handleJoinCrew = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    void trackAnalyticsEvent({
      eventName: 'crew_join_by_code_requested',
      properties: {
        inviteCodeLength: inviteCode.trim().length,
      },
      route: '/join-crew',
    });

    try {
      await joinCrew(inviteCode.toUpperCase());
      void trackAnalyticsEvent({
        eventName: 'crew_join_by_code_success',
        route: '/join-crew',
        properties: {
          inviteCodeLength: inviteCode.trim().length,
        },
      });
      router.replace('/');
    } catch (error) {
      if (__DEV__) {
        console.log('[JoinCrew] Error:', error);
      }
      void trackAnalyticsEvent({
        eventName: 'crew_join_by_code_failed',
        route: '/join-crew',
        properties: {
          inviteCodeLength: inviteCode.trim().length,
        },
      });
      Alert.alert('Error', 'Invalid invite code. Please check and try again.');
    }
  };

  const formatInviteCode = (text: string) => {
    const cleaned = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return cleaned.slice(0, 8);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            testID="back-button"
          >
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Join a Crew</Text>
          <View style={styles.placeholder} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Enter Invite Code</Text>
              <Text style={styles.sectionDescription}>
                Ask your crew admin for the invite code
              </Text>

              <View style={styles.codeInputContainer}>
                <Hash size={24} color={colors.primary} />
                <TextInput
                  style={styles.codeInput}
                  placeholder="ABCD1234"
                  placeholderTextColor={colors.textTertiary}
                  value={inviteCode}
                  onChangeText={(text) => setInviteCode(formatInviteCode(text))}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={8}
                  testID="invite-code-input"
                />
              </View>

              <TouchableOpacity
                style={[styles.joinButton, isJoiningCrew && styles.buttonDisabled]}
                onPress={handleJoinCrew}
                disabled={isJoiningCrew || !inviteCode.trim()}
                activeOpacity={0.8}
                testID="join-button"
              >
                {isJoiningCrew ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.joinButtonText}>Join Crew</Text>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionDescription}>
              Need access? Ask an admin for the current invite code or request access from the waiting room.
            </Text>
          </ScrollView>
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
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 6,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  codeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: 16,
  },
  codeInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text,
    marginLeft: 12,
    letterSpacing: 4,
    textAlign: 'center',
  },
  joinButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  joinButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.onPrimary,
  },
});
