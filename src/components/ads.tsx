import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import mobileAds, {
  AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
  BannerAd,
  BannerAdSize,
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  TestIds,
} from 'react-native-google-mobile-ads';
import { SafeAdContainer } from './layout';

export const AD_UNITS = {
  banner: __DEV__
    ? TestIds.ADAPTIVE_BANNER
    : 'ca-app-pub-7831002909037560/6793175375',
  native: __DEV__ ? TestIds.NATIVE : 'ca-app-pub-7831002909037560/7528417402',
};
let initialized = false;
let allowed = false;
let privacyOptions = false;

export async function initializeAds(): Promise<boolean> {
  try {
    const prior = await AdsConsent.getConsentInfo();
    if (prior.canRequestAds && !initialized) {
      initialized = true;
      await mobileAds().initialize();
    }
    await AdsConsent.requestInfoUpdate();
    const consent = await AdsConsent.loadAndShowConsentFormIfRequired();
    privacyOptions =
      consent.privacyOptionsRequirementStatus ===
      AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
    allowed = consent.canRequestAds;
    if (allowed && !initialized) {
      initialized = true;
      await mobileAds().initialize();
    }
  } catch {
    const consent = await AdsConsent.getConsentInfo().catch(() => null);
    allowed = Boolean(consent?.canRequestAds);
  }
  return allowed;
}
export const privacyOptionsRequired = () => privacyOptions;
export const showAdPrivacyOptions = () => AdsConsent.showPrivacyOptionsForm();

export function GuidanceBanner() {
  const [canShow, setCanShow] = useState(allowed);
  useEffect(() => {
    if (!canShow) initializeAds().then(setCanShow);
  }, [canShow]);
  if (!canShow) return null;
  return (
    <SafeAdContainer>
      <BannerAd
        unitId={AD_UNITS.banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
      />
    </SafeAdContainer>
  );
}

export function GuidanceNativeAd() {
  const [ad, setAd] = useState<NativeAd | null>(null);
  useEffect(() => {
    let mounted = true;
    let loaded: NativeAd | null = null;
    const load = async () => {
      if (!allowed) await initializeAds();
      if (!allowed || !mounted) return;
      try {
        loaded = await NativeAd.createForAdRequest(AD_UNITS.native);
        if (mounted) setAd(loaded);
        else loaded.destroy();
      } catch {}
    };
    void load();
    return () => {
      mounted = false;
      loaded?.destroy();
    };
  }, []);
  if (!ad) return null;
  return (
    <NativeAdView nativeAd={ad} style={styles.native}>
      <Text style={styles.sponsored}>Sponsored · Ad</Text>
      <View style={styles.nativeRow}>
        {ad.icon && (
          <NativeAsset assetType={NativeAssetType.ICON}>
            <Image source={{ uri: ad.icon.url }} style={styles.icon} />
          </NativeAsset>
        )}
        <View style={styles.nativeCopy}>
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text style={styles.headline}>{ad.headline}</Text>
          </NativeAsset>
          <NativeAsset assetType={NativeAssetType.BODY}>
            <Text numberOfLines={2} style={styles.body}>
              {ad.body}
            </Text>
          </NativeAsset>
        </View>
      </View>
      <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
        <Pressable style={styles.cta}>
          <Text style={styles.ctaText}>{ad.callToAction}</Text>
        </Pressable>
      </NativeAsset>
    </NativeAdView>
  );
}

const styles = StyleSheet.create({
  native: {
    marginVertical: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BCD1C8',
    backgroundColor: '#EFF7F3',
  },
  sponsored: { fontSize: 11, color: '#5C6F68', marginBottom: 8 },
  nativeRow: { flexDirection: 'row', gap: 10 },
  icon: { width: 48, height: 48, borderRadius: 10 },
  nativeCopy: { flex: 1 },
  headline: { fontSize: 16, fontWeight: '800', color: '#173F38' },
  body: { fontSize: 13, color: '#50615C', marginTop: 3 },
  cta: {
    alignSelf: 'flex-end',
    marginTop: 10,
    backgroundColor: '#276B5C',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  ctaText: { color: 'white', fontWeight: '800' },
});
