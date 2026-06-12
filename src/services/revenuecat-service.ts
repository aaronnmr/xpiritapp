import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";

export type RevenueCatProductId = "xpirit_premium_monthly_299" | "xpirit_elite_monthly_799";

export type XpiritEntitlement = "premium_reports" | "elite_analytics";

export type XpiritPlan = {
  entitlementId: XpiritEntitlement;
  id: RevenueCatProductId;
  label: string;
  price: string;
  summary: string;
};

export type PurchaseResult = {
  entitlementId: XpiritEntitlement;
  isActive: boolean;
  productId: RevenueCatProductId;
  status: "configured" | "missing_api_key" | "purchased" | "cancelled" | "unavailable";
};

export const xpiritPlans: XpiritPlan[] = [
  {
    entitlementId: "premium_reports",
    id: "xpirit_premium_monthly_299",
    label: "Xpirit Premium",
    price: "2,99€",
    summary: "Visual reports and sharing"
  },
  {
    entitlementId: "elite_analytics",
    id: "xpirit_elite_monthly_799",
    label: "Xpirit Elite",
    price: "7,99€",
    summary: "Everything in Premium, plus wearable sync with Oura and advanced ecosystem insights"
  }
];

let isConfigured = false;

export const RevenueCatService = {
  async configure(userId?: string): Promise<PurchaseResult> {
    const apiKey = getRevenueCatApiKey();
    const plan = xpiritPlans[0];

    if (!apiKey) {
      return {
        entitlementId: plan.entitlementId,
        isActive: false,
        productId: plan.id,
        status: "missing_api_key"
      };
    }

    if (!isConfigured) {
      await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
      Purchases.configure({
        apiKey,
        appUserID: userId
      });
      isConfigured = true;
    }

    return {
      entitlementId: plan.entitlementId,
      isActive: false,
      productId: plan.id,
      status: "configured"
    };
  },

  async getCustomerEntitlements() {
    await this.configure();
    const customerInfo = await Purchases.getCustomerInfo();

    return {
      eliteAnalytics: Boolean(customerInfo.entitlements.active.elite_analytics),
      premiumReports: Boolean(customerInfo.entitlements.active.premium_reports)
    };
  },

  async purchaseProduct(productId: RevenueCatProductId): Promise<PurchaseResult> {
    const configureResult = await this.configure();
    const plan = xpiritPlans.find((item) => item.id === productId) ?? xpiritPlans[0];

    if (configureResult.status === "missing_api_key") {
      return {
        entitlementId: plan.entitlementId,
        isActive: false,
        productId: plan.id,
        status: "missing_api_key"
      };
    }

    try {
      const offerings = await Purchases.getOfferings();
      const packages = offerings.current?.availablePackages ?? [];
      const selectedPackage = packages.find((item) => item.product.identifier === productId);

      if (!selectedPackage) {
        return {
          entitlementId: plan.entitlementId,
          isActive: false,
          productId: plan.id,
          status: "unavailable"
        };
      }

      const { customerInfo } = await Purchases.purchasePackage(selectedPackage);

      return {
        entitlementId: plan.entitlementId,
        isActive: Boolean(customerInfo.entitlements.active[plan.entitlementId]),
        productId: plan.id,
        status: "purchased"
      };
    } catch (error) {
      if (isUserCancelledPurchase(error)) {
        return {
          entitlementId: plan.entitlementId,
          isActive: false,
          productId: plan.id,
          status: "cancelled"
        };
      }

      throw error;
    }
  },

  async restorePurchases() {
    await this.configure();
    const customerInfo = await Purchases.restorePurchases();

    return {
      eliteAnalytics: Boolean(customerInfo.entitlements.active.elite_analytics),
      premiumReports: Boolean(customerInfo.entitlements.active.premium_reports)
    };
  }
};

function getRevenueCatApiKey() {
  if (Platform.OS === "ios") {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  }

  if (Platform.OS === "android") {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  }

  return process.env.EXPO_PUBLIC_REVENUECAT_WEB_API_KEY;
}

function isUserCancelledPurchase(error: unknown) {
  return typeof error === "object" && error !== null && "userCancelled" in error && Boolean(error.userCancelled);
}
