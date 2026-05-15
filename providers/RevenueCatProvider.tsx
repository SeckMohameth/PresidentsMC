import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, { 
  PurchasesPackage,
  LOG_LEVEL,
} from 'react-native-purchases';
import type { CustomerInfo } from 'react-native-purchases';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';

export type CrewAdminStatus = 'active' | 'inactive' | 'trialing';
type RevenueCatBootstrap = {
  apiKey: string | null;
  isConfigured: boolean;
};

const isExpoGo = Constants.executionEnvironment === 'storeClient';

function getRCToken() {
  if (Platform.OS === 'web' || isExpoGo) {
    return process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
  }

  const nativeKey = Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
  });

  return nativeKey ?? process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
}

export function getCrewAdminStatus(customerInfo: CustomerInfo | null | undefined): CrewAdminStatus {
  const crewAdminEntitlement = customerInfo?.entitlements.active['crew_admin'];
  if (!crewAdminEntitlement?.isActive) return 'inactive';
  return crewAdminEntitlement.periodType === 'trial' ? 'trialing' : 'active';
}

const apiKey = getRCToken();
const revenueCatBootstrap: RevenueCatBootstrap = (() => {
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
  const customerInfoQueryKey = ['revenuecat', 'customerInfo', isConfigured] as const;

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
  const isCrewAdmin = crewAdminStatus !== 'inactive';

  const monthlyPackage = currentOffering?.availablePackages.find(
    (pkg) => pkg.identifier === '$rc_monthly'
  );
  const yearlyPackage = currentOffering?.availablePackages.find(
    (pkg) => pkg.identifier === '$rc_annual'
  );

  const purchasePackage = useCallback(async (pkg: PurchasesPackage) => {
    return purchaseMutation.mutateAsync(pkg);
  }, [purchaseMutation]);

  const restorePurchases = useCallback(async () => {
    return restoreMutation.mutateAsync();
  }, [restoreMutation]);

  const loginUser = useCallback(async (userId: string) => {
    return loginMutation.mutateAsync(userId);
  }, [loginMutation]);

  const logoutUser = useCallback(async () => {
    return logoutMutation.mutateAsync();
  }, [logoutMutation]);

  return {
    isConfigured,
    customerInfo,
    offerings,
    currentOffering,
    monthlyPackage,
    yearlyPackage,
    crewAdminStatus,
    isCrewAdmin,
    isLoading: customerInfoQuery.isLoading || offeringsQuery.isLoading,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
    purchasePackage,
    restorePurchases,
    loginUser,
    logoutUser,
    purchaseError: purchaseMutation.error,
    restoreError: restoreMutation.error,
  };
});
