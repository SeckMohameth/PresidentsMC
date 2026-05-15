import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, KeyRound, Mail, ShieldCheck } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/providers/AuthProvider';

function mapAuthError(error: any) {
  const code = String(error?.code ?? '');
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return 'Your current password is incorrect.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'That email is already in use.';
  }
  if (code === 'auth/invalid-email') {
    return 'Enter a valid email address.';
  }
  if (code === 'auth/weak-password') {
    return 'Password must be at least 6 characters.';
  }
  if (code === 'auth/requires-recent-login') {
    return 'Please sign out, sign back in, and try again.';
  }
  return 'Unable to update your account right now.';
}

export default function AccountSecurityScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, resetPassword, updateEmailAddress, updateAccountPassword } = useAuth();

  const [newEmail, setNewEmail] = useState(user?.email ?? '');
  const [emailPassword, setEmailPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handleSendReset = async () => {
    const email = user?.email;
    if (!email) {
      Alert.alert('Email Required', 'No email address is available for this account.');
      return;
    }
    setIsSendingReset(true);
    try {
      await resetPassword(email);
      Alert.alert('Email Sent', `Password reset email sent to ${email}.`);
    } catch (error) {
      Alert.alert('Error', mapAuthError(error));
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleUpdateEmail = async () => {
    const trimmedEmail = newEmail.trim().toLowerCase();
    if (!trimmedEmail || !emailPassword) {
      Alert.alert('Missing Info', 'Enter the new email and your current password.');
      return;
    }
    if (trimmedEmail === user?.email?.toLowerCase()) {
      Alert.alert('No Change', 'This is already your account email.');
      return;
    }

    setIsUpdatingEmail(true);
    try {
      await updateEmailAddress({ currentPassword: emailPassword, newEmail: trimmedEmail });
      setEmailPassword('');
      Alert.alert('Email Updated', 'Your email was updated. Check the new inbox for verification.');
    } catch (error) {
      Alert.alert('Update Failed', mapAuthError(error));
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Missing Info', 'Enter your current password and new password.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords Do Not Match', 'Confirm your new password again.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await updateAccountPassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Password Updated', 'Your password has been changed.');
    } catch (error) {
      Alert.alert('Update Failed', mapAuthError(error));
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <ArrowLeft size={22} color={Colors.dark.text} />
            </Pressable>
            <Text style={styles.title}>Email & Password</Text>
            <View style={styles.backButton} />
          </View>

          <View style={styles.heroCard}>
            <ShieldCheck size={24} color={Colors.dark.primary} />
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Email sign-in only</Text>
              <Text style={styles.heroText}>
                Update your email or password with your current password. Password reset sends a secure email link.
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Mail size={18} color={Colors.dark.primary} />
              <Text style={styles.cardTitle}>Change Email</Text>
            </View>
            <Text style={styles.label}>New Email</Text>
            <TextInput
              style={styles.input}
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="name@email.com"
              placeholderTextColor={Colors.dark.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.label}>Current Password</Text>
            <TextInput
              style={styles.input}
              value={emailPassword}
              onChangeText={setEmailPassword}
              placeholder="Required to change email"
              placeholderTextColor={Colors.dark.textTertiary}
              secureTextEntry
              autoCapitalize="none"
            />
            <Pressable
              style={[styles.primaryButton, isUpdatingEmail && styles.disabledButton]}
              onPress={handleUpdateEmail}
              disabled={isUpdatingEmail}
            >
              {isUpdatingEmail ? (
                <ActivityIndicator color={Colors.dark.background} />
              ) : (
                <Text style={styles.primaryButtonText}>Update Email</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <KeyRound size={18} color={Colors.dark.primary} />
              <Text style={styles.cardTitle}>Change Password</Text>
            </View>
            <Text style={styles.label}>Current Password</Text>
            <TextInput
              style={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Current password"
              placeholderTextColor={Colors.dark.textTertiary}
              secureTextEntry
              autoCapitalize="none"
            />
            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="At least 6 characters"
              placeholderTextColor={Colors.dark.textTertiary}
              secureTextEntry
              autoCapitalize="none"
            />
            <Text style={styles.label}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm password"
              placeholderTextColor={Colors.dark.textTertiary}
              secureTextEntry
              autoCapitalize="none"
            />
            <Pressable
              style={[styles.primaryButton, isUpdatingPassword && styles.disabledButton]}
              onPress={handleUpdatePassword}
              disabled={isUpdatingPassword}
            >
              {isUpdatingPassword ? (
                <ActivityIndicator color={Colors.dark.background} />
              ) : (
                <Text style={styles.primaryButtonText}>Update Password</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Forgot Password</Text>
            <Text style={styles.description}>
              Send a reset link to {user?.email || 'your account email'}.
            </Text>
            <Pressable
              style={[styles.secondaryButton, isSendingReset && styles.disabledButton]}
              onPress={handleSendReset}
              disabled={isSendingReset}
            >
              <Text style={styles.secondaryButtonText}>
                {isSendingReset ? 'Sending...' : 'Send Reset Email'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  keyboard: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: '900',
  },
  heroCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: 'rgba(18,18,19,0.94)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(229,229,229,0.14)',
    padding: 16,
    marginBottom: 16,
  },
  heroCopy: {
    flex: 1,
  },
  heroTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  heroText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '800',
  },
  label: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 14,
    color: Colors.dark.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  primaryButton: {
    height: 50,
    borderRadius: 16,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  primaryButtonText: {
    color: Colors.dark.background,
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  secondaryButtonText: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.7,
  },
  description: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
});
