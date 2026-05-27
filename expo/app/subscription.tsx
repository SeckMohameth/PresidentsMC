import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, updateDoc } from 'firebase/firestore';
import { ArrowLeft, Camera, Check, Map, Shield, Users, Zap } from 'lucide-react-native';
import { AppColors, useThemeColors } from '@/constants/colors';
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from '@/constants/legal';
import { useCrew } from '@/providers/CrewProvider';
import { getCrewAdminStatus, useRevenueCat } from '@/providers/RevenueCatProvider';
import { trackAnalyticsEvent } from '@/utils/analytics';
import { db } from '@/utils/firebase';

const features = [
  { icon: Users, text: 'Unlimited club members' },
  { icon: Map, text: 'Unlimited rides & routes' },
  { icon: Camera, text: 'Shared photo albums' },
  { icon: Shield, text: 'Private club access' },
  { icon: Zap, text: 'Real-time check-ins' },
];

const FALLBACK_MONTHLY_PRICE = '$3.99';
const FALLBACK_YEARLY_PRICE = '$34.99';
const FALLBACK_YEARLY_MONTHLY_PRICE = '$2.92';
const FALLBACK_YEARLY_SAVINGS = '$12.89';
const paywallHeroImage = require('../assets/images/custom-images/optimized/harley.jpg');

export default function SubscriptionScreen() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { crew, currentUser, isAdmin, isOfficer, isSubscriptionActive } = useCrew();
  const {
    crewAdminStatus,
    isEnabled,
    isLoading,
    isPurchasing,
    isRestoring,
    presentPaywallIfNeeded,
    presentCustomerCenter,
    refreshCustomerInfo,
    restorePurchases,
  } = useRevenueCat();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [isPresentingPaywall, setIsPresentingPaywall] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    void trackAnalyticsEvent({
      eventName: 'paywall_view',
      route: '/subscription',
    });
  }, [fadeAnim, scaleAnim, slideAnim]);

  const getMonthlyPrice = () => FALLBACK_MONTHLY_PRICE;
  const getYearlyPrice = () => FALLBACK_YEARLY_PRICE;
  const getYearlyMonthlyPrice = () => FALLBACK_YEARLY_MONTHLY_PRICE;
  const isDeveloperSupport = currentUser?.isDeveloperSupport === true;
  const isSubscriptionCoveredByClub = isSubscriptionActive && crew?.subscriptionOwnerId !== currentUser?.id;
  const canManageOwnSubscription = !isDeveloperSupport && isSubscriptionActive && crew?.subscriptionOwnerId === currentUser?.id;

  const openExternalLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unable to open link', 'Please try again.');
    }
  };

  const syncClubSubscription = async (status: 'active' | 'trialing') => {
    if (!crew?.id || !currentUser?.id) return;
    if (isDeveloperSupport) return;
    if (
      isSubscriptionActive &&
      crew.subscriptionOwnerId &&
      crew.subscriptionOwnerId !== currentUser.id
    ) {
      return;
    }
    await updateDoc(doc(db, 'crews', crew.id), {
      billingRequired: true,
      subscriptionStatus: status,
      subscriptionOwnerId: currentUser.id,
    });
  };

  const handleSubscribe = async () => {
    if (!(isAdmin || isOfficer)) {
      Alert.alert('Admins Only', 'Only club admins can manage the club subscription.');
      return;
    }
    if (isDeveloperSupport) {
      Alert.alert(
        'Developer Support',
        'This support account can test the app, but it cannot own the club subscription.'
      );
      return;
    }
    if (isSubscriptionCoveredByClub) {
      Alert.alert('Club Covered', 'Another admin already covers this club subscription.');
      return;
    }
    if (canManageOwnSubscription) {
      await presentCustomerCenter();
      return;
    }
    if (!isEnabled) {
      Alert.alert('Subscriptions Unavailable', 'RevenueCat is not enabled for this build.');
      return;
    }

    setIsPresentingPaywall(true);
    void trackAnalyticsEvent({
      eventName: 'purchase_intent',
      route: '/subscription',
      properties: { selectedPlan, mode: 'revenuecat_paywall' },
    });

    try {
      const didUnlock = await presentPaywallIfNeeded();
      const customerInfo = await refreshCustomerInfo();
      const nextStatus = getCrewAdminStatus(customerInfo);

      if (didUnlock || nextStatus !== 'inactive') {
        if (nextStatus === 'active' || nextStatus === 'trialing') {
          await syncClubSubscription(nextStatus);
        }
        void trackAnalyticsEvent({
          eventName: 'purchase_success',
          route: '/subscription',
          properties: { selectedPlan },
        });
        Alert.alert('Subscription Active', 'PresidentsMC Pro is active for this account.');
        return;
      }
    } catch (error: any) {
      if (error?.userCancelled) return;
      void trackAnalyticsEvent({
        eventName: 'purchase_failed',
        route: '/subscription',
        properties: { selectedPlan },
      });
      Alert.alert('Purchase Failed', 'Unable to complete purchase. Please try again.');
    } finally {
      setIsPresentingPaywall(false);
    }
  };

  const handleRestore = async () => {
    try {
      const customerInfo = await restorePurchases();
      const nextStatus = getCrewAdminStatus(customerInfo);
      if (nextStatus === 'active' || nextStatus === 'trialing') {
        await syncClubSubscription(nextStatus);
      }
      Alert.alert(
        nextStatus === 'inactive' ? 'No Subscription Found' : 'Restored',
        nextStatus === 'inactive'
          ? 'We could not find an active subscription to restore.'
          : 'Your subscription has been restored.'
      );
    } catch {
      Alert.alert('Restore Failed', 'Unable to restore purchases. Please try again.');
    }
  };

  const isBusy = isPurchasing || isPresentingPaywall || isLoading;
  const statusLabel =
    isSubscriptionCoveredByClub
      ? 'Covered by another admin'
      : isSubscriptionActive
        ? 'Club subscription active'
        : crewAdminStatus === 'trialing'
          ? 'Trial active'
          : crewAdminStatus === 'active'
            ? 'Subscription active'
            : 'Subscription inactive';

  if (!(isAdmin || isOfficer)) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <ArrowLeft size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Club Subscription</Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.accessDenied}>
            <Shield size={32} color={colors.textTertiary} />
            <Text style={styles.accessDeniedTitle}>Admins Only</Text>
            <Text style={styles.accessDeniedText}>
              Members never need to subscribe. A club admin handles PresidentsMC Pro for the club.
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(216,58,46,0.18)', 'transparent']}
        style={styles.gradientOverlay}
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Club Subscription</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View
            style={[
              styles.heroSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
              },
            ]}
          >
            <View style={styles.heroImageFrame}>
              <Image source={paywallHeroImage} style={styles.heroImage} contentFit="cover" />
              <LinearGradient
                colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.46)', 'rgba(0,0,0,0.88)']}
                locations={[0, 0.45, 1]}
                style={styles.heroImageOverlay}
              />
              <View style={styles.heroTextContainer}>
                <Text style={styles.heroEyebrow}>PresidentsMC Pro</Text>
                <Text style={styles.heroTitle}>Keep the club connected.</Text>
                <Text style={styles.heroSubtitle}>
                  One active club admin subscription supports private rides, announcements, photos, members, and stats.
                </Text>
              </View>
            </View>
          </Animated.View>

          <View style={styles.statusBadge}>
            <Check size={16} color={isSubscriptionActive || crewAdminStatus !== 'inactive' ? colors.success : colors.textTertiary} />
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
          {isSubscriptionCoveredByClub && (
            <View style={styles.coveredNotice}>
              <Text style={styles.coveredNoticeTitle}>No purchase needed</Text>
              <Text style={styles.coveredNoticeText}>
                This club already has an active subscription. Only the paying admin can manage billing.
              </Text>
            </View>
          )}

          <View style={styles.trialBanner}>
            <Text style={styles.trialText}>Monthly {getMonthlyPrice()} · Yearly {getYearlyPrice()}</Text>
            <Text style={styles.trialSubtext}>
              Save 27% with yearly, about {getYearlyMonthlyPrice()}/month.
            </Text>
          </View>

          <View style={styles.featuresSection}>
            {features.map((feature) => (
              <View key={feature.text} style={styles.featureRow}>
                <View style={styles.featureIconContainer}>
                  <feature.icon size={20} color={colors.primary} strokeWidth={2} />
                </View>
                <Text style={styles.featureText}>{feature.text}</Text>
                <Check size={18} color={colors.success} />
              </View>
            ))}
          </View>

          <View style={styles.plansSection}>
            {isLoading && (
              <View style={styles.loadingInline}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Checking store pricing...</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.planCard, selectedPlan === 'yearly' && styles.planCardSelected]}
              onPress={() => setSelectedPlan('yearly')}
              activeOpacity={0.85}
            >
              <View style={styles.bestValueBadge}>
                <Text style={styles.bestValueText}>BEST VALUE</Text>
              </View>
              <View style={styles.planHeader}>
                <View>
                  <Text style={styles.planName}>Yearly</Text>
                  <Text style={styles.planSavings}>Save 27% · Save {FALLBACK_YEARLY_SAVINGS}/year</Text>
                </View>
                <View style={[styles.radioOuter, selectedPlan === 'yearly' && styles.radioOuterSelected]}>
                  {selectedPlan === 'yearly' && <View style={styles.radioInner} />}
                </View>
              </View>
              <View style={styles.planPricing}>
                <Text style={styles.planPrice}>{getYearlyPrice()}</Text>
                <Text style={styles.planPeriod}>/year</Text>
              </View>
              <Text style={styles.planBilling}>Billed annually · about {getYearlyMonthlyPrice()}/month</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardSelected]}
              onPress={() => setSelectedPlan('monthly')}
              activeOpacity={0.85}
            >
              <View style={styles.planHeader}>
                <Text style={styles.planName}>Monthly</Text>
                <View style={[styles.radioOuter, selectedPlan === 'monthly' && styles.radioOuterSelected]}>
                  {selectedPlan === 'monthly' && <View style={styles.radioInner} />}
                </View>
              </View>
              <View style={styles.planPricing}>
                <Text style={styles.planPrice}>{getMonthlyPrice()}</Text>
                <Text style={styles.planPeriod}>/month</Text>
              </View>
              <Text style={styles.planBilling}>Billed monthly · cancel anytime</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.subscribeButton, isBusy && styles.buttonDisabled]}
            onPress={handleSubscribe}
            disabled={isBusy || isSubscriptionCoveredByClub}
            activeOpacity={0.85}
          >
            {isBusy ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.subscribeButtonText}>
                {canManageOwnSubscription
                  ? 'Manage Subscription'
                  : isSubscriptionCoveredByClub
                    ? 'Club Covered'
                    : selectedPlan === 'yearly'
                      ? 'Subscribe Yearly'
                      : 'Subscribe Monthly'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleRestore} disabled={isRestoring}>
            {isRestoring ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <Text style={styles.secondaryButtonText}>Restore Purchases</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => void presentCustomerCenter()}
            disabled={!isEnabled || !canManageOwnSubscription}
          >
            <Text style={styles.secondaryButtonText}>Manage Subscription</Text>
          </TouchableOpacity>

          <Text style={styles.termsText}>
            Subscriptions renew automatically unless canceled at least 24 hours before the end of the current period.
            You will be charged {selectedPlan === 'yearly' ? `${getYearlyPrice()}/year` : `${getMonthlyPrice()}/month`} to your Apple or Google account.
            Manage or cancel anytime in account settings. By continuing, you agree to our{' '}
            <Text style={styles.termsLink} onPress={() => void openExternalLink(TERMS_OF_USE_URL)}>
              Terms of Use
            </Text>{' '}
            and{' '}
            <Text style={styles.termsLink} onPress={() => void openExternalLink(PRIVACY_POLICY_URL)}>
              Privacy Policy
            </Text>
            .
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    fontWeight: '700',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 8,
  },
  heroSection: {
    width: '100%',
    marginBottom: 14,
  },
  heroImageFrame: {
    height: 340,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroImageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroTextContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 31,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 22,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 12,
  },
  statusText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  coveredNotice: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  coveredNoticeTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  coveredNoticeText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  accessDenied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  accessDeniedTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 8,
  },
  accessDeniedText: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  trialBanner: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  trialText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  trialSubtext: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  featuresSection: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  featureText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  loadingInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  plansSection: {
    gap: 12,
    marginBottom: 20,
  },
  planCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.border,
    position: 'relative',
  },
  planCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
  },
  bestValueBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bestValueText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.background,
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
    fontWeight: '700',
    color: colors.text,
  },
  planSavings: {
    fontSize: 13,
    color: colors.success,
    fontWeight: '600',
    marginTop: 2,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  planPricing: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
  },
  planPeriod: {
    fontSize: 16,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  planBilling: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  subscribeButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  subscribeButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.background,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  termsText: {
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
  },
  termsLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
