import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, { 
  PurchasesPackage,
  LOG_LEVEL,
} from 'react-native-purchases';
import type { CustomerInfo, CustomerInfoUpdateListener } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import {
  REVENUECAT_ENTITLEMENT_ID,
  REVENUECAT_FALLBACK_API_KEY,
  REVENUECAT_MONTHLY_PRODUCT_ID,
  REVENUECAT_YEARLY_PRODUCT_ID,
} from '@/constants/revenueCat';

export type CrewAdminStatus = 'active' | 'inactive' | 'trialing';
type RevenueCatBootstrap = {
  apiKey: string | null;
  isConfigured: boolean;
};

const isExpoGo = Constants.executionEnvironment === 'storeClient';
const isRevenueCatExplicitlyDisabled = process.env.EXPO_PUBLIC_ENABLE_REVENUECAT === 'false';

function getRCToken() {
  if (Platform.OS === 'web' || isExpoGo) {
    return process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY || REVENUECAT_FALLBACK_API_KEY;
  }

  const nativeKey = Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
  });

  return nativeKey ?? process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY ?? REVENUECAT_FALLBACK_API_KEY;
}

export function getCrewAdminStatus(customerInfo: CustomerInfo | null | undefined): CrewAdminStatus {
  const presidentsMCProEntitlement = customerInfo?.entitlements.active[REVENUECAT_ENTITLEMENT_ID];
  if (!presidentsMCProEntitlement?.isActive) return 'inactive';
  return presidentsMCProEntitlement.periodType === 'trial' ? 'trialing' : 'active';
}

function isProCustomer(customerInfo: CustomerInfo | null | undefined) {
  return typeof customerInfo?.entitlements.active[REVENUECAT_ENTITLEMENT_ID] !== 'undefined';
}

const apiKey = getRCToken();
const revenueCatBootstrap: RevenueCatBootstrap = (() => {
  if (isRevenueCatExplicitlyDisabled) {
    if (__DEV__) {
      console.log('[RevenueCat] Disabled by EXPO_PUBLIC_ENABLE_REVENUECAT=false.');
    }
    return { apiKey: null, isConfigured: false };
  }

  if (!apiKey) {
    if (__DEV__) {
      console.log('[RevenueCat] Missing API key. RevenueCat disabled.');
    }
    return { apiKey: null, isConfigured: false };
  }

  try {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    if (__DEV__ && isExpoGo) {
      console.log('[RevenueCat] Expo Go detected. Using RevenueCat Test Store API key.');
    }
    Purchases.configure({ apiKey });
    return { apiKey, isConfigured: true };
  } catch (error) {
    console.log('[RevenueCat] Error configuring Purchases:', error);
    return { apiKey: null, isConfigured: false };
  }
})();

export const [RevenueCatProvider, useRevenueCat] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [isConfigured] = useState(revenueCatBootstrap.isConfigured);
  const customerInfoQueryKey = useMemo(
    () => ['revenuecat', 'customerInfo', isConfigured] as const,
    [isConfigured]
  );

  const customerInfoQuery = useQuery({
    queryKey: customerInfoQueryKey,
    queryFn: async () => {
      if (!isConfigured) return null;
      return Purchases.getCustomerInfo();
    },
    enabled: isConfigured,
    staleTime: 1000 * 60 * 5,
  });

  const offeringsQuery = useQuery({
    queryKey: ['revenuecat', 'offerings', isConfigured],
    queryFn: async () => {
      if (!isConfigured) return null;
      return Purchases.getOfferings();
    },
    enabled: isConfigured,
    staleTime: 1000 * 60 * 10,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (pkg: PurchasesPackage) => {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return customerInfo;
    },
    onSuccess: (customerInfo) => {
      queryClient.setQueryData(customerInfoQueryKey, customerInfo);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      const customerInfo = await Purchases.restorePurchases();
      return customerInfo;
    },
    onSuccess: (customerInfo) => {
      queryClient.setQueryData(customerInfoQueryKey, customerInfo);
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { customerInfo } = await Purchases.logIn(userId);
      return customerInfo;
    },
    onSuccess: (customerInfo) => {
      queryClient.setQueryData(customerInfoQueryKey, customerInfo);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const customerInfo = await Purchases.logOut();
      return customerInfo;
    },
    onSuccess: (customerInfo) => {
      queryClient.setQueryData(customerInfoQueryKey, customerInfo);
    },
  });

  const customerInfo = customerInfoQuery.data;
  const offerings = offeringsQuery.data;
  const currentOffering = offerings?.current;

  const crewAdminStatus = getCrewAdminStatus(customerInfo);
  const isCrewAdmin = isProCustomer(customerInfo);

  const monthlyPackage = currentOffering?.availablePackages.find(
    (pkg) =>
      pkg.identifier === '$rc_monthly' ||
      pkg.identifier === REVENUECAT_MONTHLY_PRODUCT_ID ||
      pkg.product.identifier === REVENUECAT_MONTHLY_PRODUCT_ID
  );
  const yearlyPackage = currentOffering?.availablePackages.find(
    (pkg) =>
      pkg.identifier === '$rc_annual' ||
      pkg.identifier === REVENUECAT_YEARLY_PRODUCT_ID ||
      pkg.product.identifier === REVENUECAT_YEARLY_PRODUCT_ID
  );

  useEffect(() => {
    if (!isConfigured) return;

    const listener: CustomerInfoUpdateListener = (nextCustomerInfo) => {
      queryClient.setQueryData(customerInfoQueryKey, nextCustomerInfo);
    };

    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [customerInfoQueryKey, isConfigured, queryClient]);

  const purchasePackage = useCallback(async (pkg: PurchasesPackage) => {
    return purchaseMutation.mutateAsync(pkg);
  }, [purchaseMutation]);

  const restorePurchases = useCallback(async () => {
    return restoreMutation.mutateAsync();
  }, [restoreMutation]);

  const refreshCustomerInfo = useCallback(async () => {
    if (!isConfigured) return null;
    const nextCustomerInfo = await Purchases.getCustomerInfo();
    queryClient.setQueryData(customerInfoQueryKey, nextCustomerInfo);
    return nextCustomerInfo;
  }, [customerInfoQueryKey, isConfigured, queryClient]);

  const presentPaywall = useCallback(async () => {
    if (!isConfigured) return false;

    const result = await RevenueCatUI.presentPaywall({
      offering: currentOffering ?? undefined,
      displayCloseButton: true,
    });
    if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
      await refreshCustomerInfo();
      return true;
    }
    return false;
  }, [currentOffering, isConfigured, refreshCustomerInfo]);

  const presentPaywallIfNeeded = useCallback(async () => {
    if (!isConfigured) return false;

    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: REVENUECAT_ENTITLEMENT_ID,
      offering: currentOffering ?? undefined,
      displayCloseButton: true,
    });
    if (
      result === PAYWALL_RESULT.NOT_PRESENTED ||
      result === PAYWALL_RESULT.PURCHASED ||
      result === PAYWALL_RESULT.RESTORED
    ) {
      const nextCustomerInfo = await refreshCustomerInfo();
      return isProCustomer(nextCustomerInfo) || result === PAYWALL_RESULT.NOT_PRESENTED;
    }
    return false;
  }, [currentOffering, isConfigured, refreshCustomerInfo]);

  const presentCustomerCenter = useCallback(async () => {
    if (!isConfigured) return;

    await RevenueCatUI.presentCustomerCenter({
      callbacks: {
        onRestoreCompleted: ({ customerInfo: restoredCustomerInfo }) => {
          queryClient.setQueryData(customerInfoQueryKey, restoredCustomerInfo);
        },
        onPromotionalOfferSucceeded: ({ customerInfo: nextCustomerInfo }) => {
          queryClient.setQueryData(customerInfoQueryKey, nextCustomerInfo);
        },
      },
    });
    await refreshCustomerInfo();
  }, [customerInfoQueryKey, isConfigured, queryClient, refreshCustomerInfo]);

  const loginUser = useCallback(async (userId: string) => {
    return loginMutation.mutateAsync(userId);
  }, [loginMutation]);

  const logoutUser = useCallback(async () => {
    return logoutMutation.mutateAsync();
  }, [logoutMutation]);

  return {
    isEnabled: !isRevenueCatExplicitlyDisabled && Boolean(apiKey),
    isConfigured,
    customerInfo,
    offerings,
    currentOffering,
    monthlyPackage,
    yearlyPackage,
    crewAdminStatus,
    isCrewAdmin,
    entitlementId: REVENUECAT_ENTITLEMENT_ID,
    isLoading: customerInfoQuery.isLoading || offeringsQuery.isLoading,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
    purchasePackage,
    restorePurchases,
    refreshCustomerInfo,
    presentPaywall,
    presentPaywallIfNeeded,
    presentCustomerCenter,
    loginUser,
    logoutUser,
    purchaseError: purchaseMutation.error,
    restoreError: restoreMutation.error,
  };
});
