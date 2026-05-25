import { useCallback } from 'react';
import createContextHook from '@nkzw/create-context-hook';

export type CrewAdminStatus = 'active' | 'inactive' | 'trialing';

type RevenueCatPackage = {
  identifier: string;
  product: {
    identifier: string;
    price?: number;
    priceString?: string;
  };
};

export function getCrewAdminStatus(_customerInfo?: unknown): CrewAdminStatus {
  return 'inactive';
}

export const [RevenueCatProvider, useRevenueCat] = createContextHook(() => {
  const unavailable = useCallback(async (..._args: unknown[]) => {
    throw new Error('REVENUECAT_DISABLED');
  }, []);

  const noop = useCallback(async (..._args: unknown[]) => null, []);
  const falseResult = useCallback(async (..._args: unknown[]) => false, []);

  return {
    isEnabled: false,
    isConfigured: false,
    configurationError: 'disabled',
    customerInfo: null,
    offerings: null,
    currentOffering: null,
    monthlyPackage: undefined as RevenueCatPackage | undefined,
    yearlyPackage: undefined as RevenueCatPackage | undefined,
    crewAdminStatus: 'inactive' as CrewAdminStatus,
    isCrewAdmin: false,
    entitlementId: 'PresidentsMC Pro',
    isLoading: false,
    isPurchasing: false,
    isRestoring: false,
    purchasePackage: unavailable,
    restorePurchases: unavailable,
    refreshCustomerInfo: noop,
    presentPaywall: falseResult,
    presentPaywallIfNeeded: falseResult,
    presentCustomerCenter: noop,
    loginUser: noop,
    logoutUser: noop,
    purchaseError: null,
    restoreError: null,
  };
});
