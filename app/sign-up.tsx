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
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { CLUB_NAME } from '@/constants/club';
import { useAuth } from '@/providers/AuthProvider';
import { trackAnalyticsEvent } from '@/utils/analytics';

export default function SignUpScreen() {
  const { signUp, isSigningUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSignUp = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter a password');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    void trackAnalyticsEvent({
      eventName: 'auth_sign_up_requested',
      route: '/sign-up',
      properties: {
        method: 'email_password',
      },
    });

    try {
      const result = await signUp({ email, password, name });
      if (result?.verificationEmailSent) {
        void trackAnalyticsEvent({
          eventName: 'auth_verification_email_requested',
          route: '/sign-up',
          properties: {
            method: 'email_password',
            verificationEmailSent: true,
          },
        });
        Alert.alert(
          'Check Your Inbox',
          `We sent a verification email to ${email.trim()}. You can keep testing now, but verify the address when you get a chance.`,
        );
      }
      void trackAnalyticsEvent({
        eventName: 'auth_sign_up_success',
        route: '/sign-up',
        properties: {
          method: 'email_password',
        },
      });
      router.replace('/feature-onboarding');
    } catch (error) {
      if (__DEV__) {
        console.log('[SignUp] Error:', error);
      }
      void trackAnalyticsEvent({
        eventName: 'auth_sign_up_failed',
        route: '/sign-up',
        properties: {
          method: 'email_password',
        },
      });
      Alert.alert('Error', 'Failed to create account. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Text style={styles.logo}>{CLUB_NAME}</Text>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>
                Request access and start riding with the club
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <User size={20} color={Colors.dark.textTertiary} />
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor={Colors.dark.textTertiary}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  testID="name-input"
                />
              </View>

              <View style={styles.inputContainer}>
                <Mail size={20} color={Colors.dark.textTertiary} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={Colors.dark.textTertiary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="email-input"
                />
              </View>

              <View style={styles.inputContainer}>
                <Lock size={20} color={Colors.dark.textTertiary} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={Colors.dark.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  testID="password-input"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {showPassword ? (
                    <EyeOff size={20} color={Colors.dark.textTertiary} />
                  ) : (
                    <Eye size={20} color={Colors.dark.textTertiary} />
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Lock size={20} color={Colors.dark.textTertiary} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor={Colors.dark.textTertiary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  testID="confirm-password-input"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={20} color={Colors.dark.textTertiary} />
                  ) : (
                    <Eye size={20} color={Colors.dark.textTertiary} />
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.button, isSigningUp && styles.buttonDisabled]}
                onPress={handleSignUp}
                disabled={isSigningUp}
                activeOpacity={0.8}
                testID="sign-up-button"
              >
                {isSigningUp ? (
                  <ActivityIndicator color={Colors.dark.background} />
                ) : (
                  <Text style={styles.buttonText}>Create Account</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <TouchableOpacity onPress={() => router.replace('/sign-in')}>
                <Text style={styles.footerLink}>Sign In</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
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
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.dark.primary,
    letterSpacing: 1,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.dark.text,
    paddingVertical: 14,
    marginLeft: 12,
  },
  button: {
    backgroundColor: Colors.dark.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.dark.background,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
    gap: 6,
  },
  footerText: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
  },
  footerLink: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
  },
});
