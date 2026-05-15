import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { 
  ArrowLeft, 
  Crown, 
  Shield, 
  Users, 
  Map, 
  Camera,
  Zap,
  Check,
  Sparkles,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/providers/AuthProvider';
import { getCrewAdminStatus, useRevenueCat } from '@/providers/RevenueCatProvider';
import type { CrewAdminStatus } from '@/providers/RevenueCatProvider';
import { trackAnalyticsEvent } from '@/utils/analytics';



const features = [
  { icon: Users, text: 'Unlimited crew members' },
  { icon: Map, text: 'Unlimited rides & routes' },
  { icon: Camera, text: 'Shared photo albums' },
  { icon: Shield, text: 'Private & secure' },
  { icon: Zap, text: 'Real-time check-ins' },
];

const TERMS_URL = 'https://www.mostudios.io/terms';
const PRIVACY_URL = 'https://www.mostudios.io/privacy';

export default function CreateCrewPaywallScreen() {
  const { createCrew, isCreatingCrew } = useAuth();
  const { 
    monthlyPackage, 
    yearlyPackage, 
    isLoading, 
    isPurchasing,
    isRestoring,
    purchasePackage, 
    restorePurchases,
    crewAdminStatus,
  } = useRevenueCat();
  
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [crewName, setCrewName] = useState('');
  const [crewDescription, setCrewDescription] = useState('');
  const [crewLogo, setCrewLogo] = useState('');
  const [step, setStep] = useState<'paywall' | 'details'>('paywall');
  const [subscriptionStatus, setSubscriptionStatus] = useState<CrewAdminStatus>('inactive');
  const [isUsingBetaAccess, setIsUsingBetaAccess] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const crownRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(crownRotate, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(crownRotate, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [fadeAnim, slideAnim, scaleAnim, crownRotate]);

  useEffect(() => {
    void trackAnalyticsEvent({
      eventName: 'paywall_view',
      route: '/create-crew-paywall',
      properties: {
        selectedPlan,
      },
    });
  }, [selectedPlan]);

  useEffect(() => {
    setSubscriptionStatus(crewAdminStatus);
    if (crewAdminStatus !== 'inactive') {
      setIsUsingBetaAccess(false);
    }
    if (crewAdminStatus !== 'inactive' && step === 'paywall') {
      setStep('details');
    }
  }, [crewAdminStatus, step]);

  const crownRotateInterpolate = crownRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-5deg', '5deg'],
  });

  const getMonthlyPrice = () => {
    if (monthlyPackage?.product?.priceString) {
      return monthlyPackage.product.priceString;
    }
    return '$2.49';
  };

  const getYearlyPrice = () => {
    if (yearlyPackage?.product?.priceString) {
      return yearlyPackage.product.priceString;
    }
    return '$24.99';
  };

  const getYearlyMonthlyPrice = () => {
    if (yearlyPackage?.product?.price) {
      const monthly = (yearlyPackage.product.price / 12).toFixed(2);
      return `$${monthly}`;
    }
    return '$2.08';
  };

  const openExternalLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unable to open link', 'Please try again.');
    }
  };

  const handleSubscribe = async () => {
    const selectedPackage = selectedPlan === 'monthly' ? monthlyPackage : yearlyPackage;
    
    if (!selectedPackage) {
      Alert.alert('Error', 'Selected plan is not available. Please try again.');
      return;
    }

    void trackAnalyticsEvent({
      eventName: 'purchase_intent',
      route: '/create-crew-paywall',
      properties: {
        selectedPlan,
        packageId: selectedPackage.identifier,
      },
    });

    try {
      const customerInfo = await purchasePackage(selectedPackage);
      const nextSubscriptionStatus = getCrewAdminStatus(customerInfo);

      if (nextSubscriptionStatus === 'inactive') {
        void trackAnalyticsEvent({
          eventName: 'purchase_failed',
          route: '/create-crew-paywall',
          properties: {
            selectedPlan,
            packageId: selectedPackage.identifier,
            reason: 'missing_entitlement',
          },
        });
        Alert.alert(
          'Subscription Not Ready',
          'Your purchase completed, but Crew Admin access is not active yet. Tap Restore Purchases or try again in a moment.'
        );
        return;
      }

      setSubscriptionStatus(nextSubscriptionStatus);
      void trackAnalyticsEvent({
        eventName: 'purchase_success',
        route: '/create-crew-paywall',
        properties: {
          selectedPlan,
          packageId: selectedPackage.identifier,
        },
      });
      setStep('details');
    } catch (error: any) {
      if (error?.userCancelled) {
        return;
      }
      void trackAnalyticsEvent({
        eventName: 'purchase_failed',
        route: '/create-crew-paywall',
        properties: {
          selectedPlan,
          packageId: selectedPackage.identifier,
        },
      });
      Alert.alert('Purchase Failed', 'Unable to complete purchase. Please try again.');
    }
  };

  const handleRestore = async () => {
    void trackAnalyticsEvent({
      eventName: 'restore_intent',
      route: '/create-crew-paywall',
    });

    try {
      const customerInfo = await restorePurchases();
      const nextSubscriptionStatus = getCrewAdminStatus(customerInfo);

      if (nextSubscriptionStatus !== 'inactive') {
        setSubscriptionStatus(nextSubscriptionStatus);
        void trackAnalyticsEvent({
          eventName: 'restore_success',
          route: '/create-crew-paywall',
        });
        Alert.alert('Restored!', 'Your subscription has been restored.', [
          { text: 'Continue', onPress: () => setStep('details') }
        ]);
      } else {
        Alert.alert('No Subscription Found', 'We could not find an active subscription to restore.');
      }
    } catch {
      void trackAnalyticsEvent({
        eventName: 'restore_failed',
        route: '/create-crew-paywall',
      });
      Alert.alert('Restore Failed', 'Unable to restore purchases. Please try again.');
    }
  };

  const handleSkipPaywall = () => {
    setIsUsingBetaAccess(true);
    setSubscriptionStatus('trialing');
    void trackAnalyticsEvent({
      eventName: 'purchase_success',
      route: '/create-crew-paywall',
      properties: {
        selectedPlan,
        mode: 'skip_paywall',
      },
    });
    setStep('details');
  };

  const handleCreateCrew = async () => {
    if (!crewName.trim()) {
      Alert.alert('Error', 'Please enter a crew name');
      return;
    }

    void trackAnalyticsEvent({
      eventName: 'crew_create_started',
      route: '/create-crew-paywall',
      properties: {
        hasLogo: Boolean(crewLogo),
      },
    });

    try {
      await createCrew({
        name: crewName,
        description: crewDescription,
        logoUri: crewLogo,
        subscriptionStatus,
      });
      void trackAnalyticsEvent({
        eventName: 'crew_create_success',
        route: '/create-crew-paywall',
        properties: {
          crewNameLength: crewName.trim().length,
          hasLogo: Boolean(crewLogo),
        },
      });
      Alert.alert(
        'Crew Created!',
        `${crewName} is ready. Share your invite code with members.`,
        [{ text: 'Let\'s Go', onPress: () => router.replace('/') }]
      );
    } catch (error) {
      if (__DEV__) {
        console.log('[CreateCrew] Error:', error);
      }
      void trackAnalyticsEvent({
        eventName: 'crew_create_failed',
        route: '/create-crew-paywall',
        properties: {
          crewNameLength: crewName.trim().length,
          hasLogo: Boolean(crewLogo),
        },
      });
      Alert.alert('Error', 'Failed to create crew. Please try again.');
    }
  };

  const handlePickLogo = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant photo permissions to select a crew logo.');
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
      setCrewLogo(result.assets[0].uri);
    }
  };

  if (step === 'details') {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setStep('paywall')}
              testID="back-button"
            >
              <ArrowLeft size={24} color={Colors.dark.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create Your Crew</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView
            contentContainerStyle={styles.detailsContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.successBadge}>
              <Check size={20} color={Colors.dark.success} />
              <Text style={styles.successText}>
                {isUsingBetaAccess
                  ? 'Beta Access Enabled'
                  : subscriptionStatus === 'trialing'
                    ? 'Free Trial Active'
                    : 'Subscription Active'}
              </Text>
            </View>

            <View style={styles.detailsSection}>
              <Text style={styles.inputLabel}>Crew Logo (Optional)</Text>
              <TouchableOpacity style={styles.logoPicker} onPress={handlePickLogo} activeOpacity={0.8}>
                {crewLogo ? (
                  <Image source={{ uri: crewLogo }} style={styles.logoPreview} contentFit="cover" />
                ) : (
                  <View style={styles.logoPlaceholder}>
                    <Camera size={24} color={Colors.dark.textTertiary} />
                    <Text style={styles.logoPlaceholderText}>Add Logo</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.detailsSection}>
              <Text style={styles.inputLabel}>Crew Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Iron Riders MC"
                placeholderTextColor={Colors.dark.textTertiary}
                value={crewName}
                onChangeText={setCrewName}
                autoCapitalize="words"
                testID="crew-name-input"
              />
            </View>

            <View style={styles.detailsSection}>
              <Text style={styles.inputLabel}>Description (Optional)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Tell members what your crew is about..."
                placeholderTextColor={Colors.dark.textTertiary}
                value={crewDescription}
                onChangeText={setCrewDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                testID="crew-description-input"
              />
            </View>

            <TouchableOpacity
              style={[styles.createButton, isCreatingCrew && styles.buttonDisabled]}
              onPress={handleCreateCrew}
              disabled={isCreatingCrew}
              activeOpacity={0.8}
              testID="create-crew-button"
            >
              {isCreatingCrew ? (
                <ActivityIndicator color={Colors.dark.background} />
              ) : (
                <Text style={styles.createButtonText}>Create Crew</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(212, 175, 55, 0.15)', 'transparent']}
        style={styles.gradientOverlay}
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            testID="back-button"
          >
            <ArrowLeft size={24} color={Colors.dark.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Start a Crew</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View 
            style={[
              styles.heroSection,
              {
                opacity: fadeAnim,
                transform: [
                  { translateY: slideAnim },
                  { scale: scaleAnim },
                ],
              },
            ]}
          >
            <Animated.View 
              style={[
                styles.crownContainer,
                { transform: [{ rotate: crownRotateInterpolate }] },
              ]}
            >
              <LinearGradient
                colors={[Colors.dark.primary, '#B8860B']}
                style={styles.crownGradient}
              >
                <Crown size={48} color="#fff" strokeWidth={1.5} />
              </LinearGradient>
            </Animated.View>
            <View style={styles.heroTextContainer}>
              <View style={styles.heroTitleRow}>
                <Sparkles size={18} color={Colors.dark.primary} />
                <Text style={styles.heroTitle}>Become a Crew Admin</Text>
                <Sparkles size={18} color={Colors.dark.primary} />
              </View>
              <Text style={styles.heroSubtitle}>
                Create and manage your own private crew. Members always join free.
              </Text>
            </View>
          </Animated.View>

          <Animated.View 
            style={[
              styles.trialBanner,
              { opacity: fadeAnim },
            ]}
          >
            <Text style={styles.trialText}>First month free on monthly · First year free on yearly</Text>
          </Animated.View>

          <Animated.View 
            style={[
              styles.featuresSection,
              { opacity: fadeAnim },
            ]}
          >
            {features.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <View style={styles.featureIconContainer}>
                  <feature.icon size={20} color={Colors.dark.primary} strokeWidth={2} />
                </View>
                <Text style={styles.featureText}>{feature.text}</Text>
                <Check size={18} color={Colors.dark.success} />
              </View>
            ))}
          </Animated.View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.dark.primary} />
              <Text style={styles.loadingText}>Loading plans...</Text>
            </View>
          ) : (
            <View style={styles.plansSection}>
              <TouchableOpacity
                style={[
                  styles.planCard,
                  selectedPlan === 'yearly' && styles.planCardSelected,
                ]}
                onPress={() => setSelectedPlan('yearly')}
                activeOpacity={0.8}
                testID="yearly-plan"
              >
                <View style={styles.bestValueBadge}>
                  <Text style={styles.bestValueText}>BEST VALUE</Text>
                </View>
                <View style={styles.planHeader}>
                  <View>
                    <Text style={styles.planName}>Yearly</Text>
                    <Text style={styles.planSavings}>First year free · Lower monthly cost</Text>
                  </View>
                  <View style={[
                    styles.radioOuter,
                    selectedPlan === 'yearly' && styles.radioOuterSelected,
                  ]}>
                    {selectedPlan === 'yearly' && (
                      <View style={styles.radioInner} />
                    )}
                  </View>
                </View>
                <View style={styles.planPricing}>
                  <Text style={styles.planPrice}>{getYearlyPrice()}</Text>
                  <Text style={styles.planPeriod}>/year</Text>
                </View>
                <Text style={styles.planBilling}>Free for 1 year, then {getYearlyMonthlyPrice()}/month billed annually</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.planCard,
                  selectedPlan === 'monthly' && styles.planCardSelected,
                ]}
                onPress={() => setSelectedPlan('monthly')}
                activeOpacity={0.8}
                testID="monthly-plan"
              >
                <View style={styles.planHeader}>
                  <Text style={styles.planName}>Monthly</Text>
                  <View style={[
                    styles.radioOuter,
                    selectedPlan === 'monthly' && styles.radioOuterSelected,
                  ]}>
                    {selectedPlan === 'monthly' && (
                      <View style={styles.radioInner} />
                    )}
                  </View>
                </View>
                <View style={styles.planPricing}>
                  <Text style={styles.planPrice}>{getMonthlyPrice()}</Text>
                  <Text style={styles.planPeriod}>/month</Text>
                </View>
                <Text style={styles.planBilling}>Free for 1 month, then {getMonthlyPrice()}/month</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.subscribeButton, 
              (isPurchasing || isLoading) && styles.buttonDisabled
            ]}
            onPress={handleSubscribe}
            activeOpacity={0.8}
            disabled={isPurchasing || isLoading}
            testID="subscribe-button"
          >
            {isPurchasing ? (
              <ActivityIndicator color={Colors.dark.background} />
            ) : (
              <Text style={styles.subscribeButtonText}>
                {selectedPlan === 'monthly' ? 'Get First Month Free' : 'Get First Year Free'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestore}
            disabled={isRestoring}
            activeOpacity={0.7}
          >
            {isRestoring ? (
              <ActivityIndicator size="small" color={Colors.dark.textSecondary} />
            ) : (
              <Text style={styles.restoreText}>Restore Purchases</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.betaAccessButton}
            onPress={handleSkipPaywall}
            activeOpacity={0.8}
            testID="skip-paywall-button"
          >
            <Text style={styles.betaAccessButtonText}>Skip For Testing</Text>
          </TouchableOpacity>
          <Text style={styles.betaAccessText}>
            This bypasses billing and unlocks crew admin access so you can create a crew and explore the app.
          </Text>

          <Text style={styles.termsText}>
            Subscriptions renew automatically unless canceled at least 24 hours before the end of the current period. After the free introductory period, you will be charged {selectedPlan === 'yearly' ? `${getYearlyPrice()}/year` : `${getMonthlyPrice()}/month`} to your Apple or Google account. Manage or cancel anytime in account settings. By continuing, you agree to our{' '}
            <Text style={styles.termsLink} onPress={() => void openExternalLink(TERMS_URL)}>
              Terms of Use
            </Text>{' '}
            and{' '}
            <Text style={styles.termsLink} onPress={() => void openExternalLink(PRIVACY_URL)}>
              Privacy Policy
            </Text>
            .
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
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
    color: Colors.dark.text,
  },
  placeholder: {
    width: 40,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 8,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  crownContainer: {
    marginBottom: 20,
  },
  crownGradient: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  heroTextContainer: {
    alignItems: 'center',
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  heroSubtitle: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  trialBanner: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
  },
  trialText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  featuresSection: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  featureIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  featureText: {
    flex: 1,
    fontSize: 15,
    color: Colors.dark.text,
    fontWeight: '500' as const,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  plansSection: {
    gap: 12,
    marginBottom: 20,
  },
  planCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: Colors.dark.border,
    position: 'relative',
  },
  planCardSelected: {
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.surfaceElevated,
  },
  bestValueBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bestValueText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.dark.background,
    letterSpacing: 0.5,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  planName: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  planSavings: {
    fontSize: 13,
    color: Colors.dark.success,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: Colors.dark.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.dark.primary,
  },
  planPricing: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  planPeriod: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    marginLeft: 4,
  },
  planBilling: {
    fontSize: 13,
    color: Colors.dark.textTertiary,
  },
  subscribeButton: {
    backgroundColor: Colors.dark.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  subscribeButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.dark.background,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  restoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  restoreText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    fontWeight: '500' as const,
  },
  betaAccessButton: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  betaAccessButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.dark.primary,
  },
  betaAccessText: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 18,
  },
  termsText: {
    fontSize: 12,
    color: Colors.dark.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: Colors.dark.primary,
    textDecorationLine: 'underline',
  },
  detailsContent: {
    padding: 24,
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.dark.success,
  },
  successText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.success,
  },
  detailsSection: {
    marginBottom: 24,
  },
  logoPicker: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoPreview: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    alignItems: 'center',
    gap: 6,
  },
  logoPlaceholderText: {
    color: Colors.dark.textTertiary,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  createButton: {
    backgroundColor: Colors.dark.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.dark.background,
  },
});
