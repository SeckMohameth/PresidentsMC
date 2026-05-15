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
import { Eye, EyeOff, Mail, Lock } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { CLUB_NAME } from '@/constants/club';
import { useAuth } from '@/providers/AuthProvider';
import { trackAnalyticsEvent } from '@/utils/analytics';

export default function SignInScreen() {
  const { signIn, isSigningIn, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    void trackAnalyticsEvent({
      eventName: 'auth_sign_in_requested',
      route: '/sign-in',
      properties: {
        method: 'email_password',
      },
    });

    try {
      await signIn({ email, password });
      void trackAnalyticsEvent({
        eventName: 'auth_sign_in_success',
        route: '/sign-in',
        properties: {
          method: 'email_password',
        },
      });
    } catch (error) {
      if (__DEV__) {
        console.log('[SignIn] Error:', error);
      }
      void trackAnalyticsEvent({
        eventName: 'auth_sign_in_failed',
        route: '/sign-in',
        properties: {
          method: 'email_password',
        },
      });
      Alert.alert('Error', 'Invalid email or password. Please try again.');
    }
  };

  const handleForgotPassword = () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert('Email Required', 'Please enter your email address first, then tap "Forgot Password?".');
      return;
    }

    Alert.alert(
      'Reset Password',
      `Send a password reset email to ${trimmedEmail}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            void trackAnalyticsEvent({
              eventName: 'auth_password_reset_requested',
              route: '/sign-in',
              properties: {
                method: 'email_password',
              },
            });
            try {
              await resetPassword(trimmedEmail);
              Alert.alert(
                'Email Sent',
                'Check your inbox for a password reset link. It may take a few minutes to arrive.',
              );
            } catch (error: any) {
              if (__DEV__) {
                console.log('[SignIn] Reset password error:', error);
              }
              const message =
                error?.code === 'auth/user-not-found'
                  ? 'No account found with that email address.'
                  : error?.code === 'auth/invalid-email'
                    ? 'Please enter a valid email address.'
                    : error?.code === 'auth/too-many-requests'
                      ? 'Too many attempts. Please try again later.'
                      : 'Failed to send reset email. Please try again.';
              Alert.alert('Error', message);
            }
          },
        },
      ],
    );
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
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>
                Sign in to continue to {CLUB_NAME}
              </Text>
            </View>

            <View style={styles.form}>
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

              <TouchableOpacity style={styles.forgotPassword} onPress={handleForgotPassword}>
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, isSigningIn && styles.buttonDisabled]}
                onPress={handleSignIn}
                disabled={isSigningIn}
                activeOpacity={0.8}
                testID="sign-in-button"
              >
                {isSigningIn ? (
                  <ActivityIndicator color={Colors.dark.background} />
                ) : (
                  <Text style={styles.buttonText}>Sign In</Text>
                )}
              </TouchableOpacity>

            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don{"'"}t have an account?</Text>
              <TouchableOpacity onPress={() => router.replace('/sign-up')}>
                <Text style={styles.footerLink}>Sign Up</Text>
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
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
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
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    fontSize: 14,
    color: Colors.dark.primary,
    fontWeight: '500' as const,
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
