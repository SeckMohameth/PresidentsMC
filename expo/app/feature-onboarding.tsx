import React, { useRef, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View, ViewToken } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Bell, Bike, Camera, Map, Shield, Users } from 'lucide-react-native';
import { AppColors, useThemeColors } from '@/constants/colors';
import { CLUB_NAME } from '@/constants/club';
import { useAuth } from '@/providers/AuthProvider';
import { getAvatarSource } from '@/utils/avatar';
import { getPhotoPickerErrorMessage, pickSingleImage, requestPhotoLibraryAccess } from '@/utils/imagePicker';
import { uploadImageUri } from '@/utils/storageUpload';

const heroImage = require('../assets/images/crew-image-mc.avif');

type FeatureSlide = {
  id: string;
  label: string;
  title: string;
  body: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  bullets: string[];
  isProfileSetup?: boolean;
};

const slides: FeatureSlide[] = [
  {
    id: 'rides',
    label: 'Rides',
    title: 'Plan the route before anyone rolls out.',
    body: 'Admins can create rides with start and end points. Members can join, check details, and open directions.',
    icon: Map,
    bullets: ['Start and end locations', 'Apple or Google Maps directions', 'RSVPs and check-ins'],
  },
  {
    id: 'announcements',
    label: 'Updates',
    title: 'Keep club business out of noisy feeds.',
    body: 'Announcements are private to approved members, with pinned posts for the things everyone needs to see.',
    icon: Bell,
    bullets: ['Pinned club updates', 'Optional images and links', 'Admin and officer controls'],
  },
  {
    id: 'albums',
    label: 'Albums',
    title: 'Every completed ride gets a memory lane.',
    body: 'Members can add ride photos after a ride, and the club can look back through shared albums and stats.',
    icon: Camera,
    bullets: ['Shared ride albums', 'Member profile photos', 'Club mileage and photo stats'],
  },
  {
    id: 'profile',
    label: 'Profile',
    title: 'Set up how members see you.',
    body: 'Add a nickname, optional profile photo, and your primary bike. You can edit this later.',
    icon: Users,
    bullets: [],
    isProfileSetup: true,
  },
  {
    id: 'private',
    label: 'Private',
    title: 'Built for one club, not the whole internet.',
    body: 'Members request access first. Admins approve who gets in and can manage roles as the club grows.',
    icon: Shield,
    bullets: ['Invite and approval flow', 'Admin, officer, member roles', 'Private club access controls'],
  },
];

export default function FeatureOnboardingScreen() {
  const { completeFeatureOnboarding, updateProfile, user } = useAuth();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<FeatureSlide>>(null);
  const [index, setIndex] = useState(0);
  const [nickname, setNickname] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [bikeName, setBikeName] = useState(user?.bike || user?.bikes?.[0]?.name || '');
  const [bikeDetails, setBikeDetails] = useState(user?.bikes?.[0]?.details || '');
  const [isSaving, setIsSaving] = useState(false);
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const pickAvatar = async () => {
    const hasAccess = await requestPhotoLibraryAccess(
      'Please grant photo permissions to add your profile picture.'
    );
    if (!hasAccess) return;

    try {
      const result = await pickSingleImage({ quality: 0.8 });
      if (!result.canceled && result.assets[0]) {
        setAvatar(result.assets[0].uri);
      }
    } catch (error) {
      if (__DEV__) {
        console.log('[FeatureOnboarding] Avatar picker error:', error);
      }
      Alert.alert('Photo Error', getPhotoPickerErrorMessage(error));
    }
  };

  const uploadAvatarIfNeeded = async () => {
    if (!avatar || avatar.startsWith('http') || avatar.startsWith('presidentsmc://') || !user?.id) {
      return avatar;
    }

    return uploadImageUri(avatar, `users/${user.id}/avatars/avatar-${Date.now()}.jpg`);
  };

  const complete = async () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setIsSaving(true);
    try {
      const displayName = nickname.trim() || user?.name || 'Member';
      const uploadedAvatar = await uploadAvatarIfNeeded();
      const bike = bikeName.trim();
      await updateProfile({
        name: displayName,
        avatar: uploadedAvatar,
        bike,
        bikes: bike
          ? [{
              id: user?.bikes?.[0]?.id || `bike-${Date.now()}`,
              name: bike,
              details: bikeDetails.trim(),
              createdAt: user?.bikes?.[0]?.createdAt || new Date().toISOString(),
              isPrimary: true,
            }]
          : [],
      });
    } catch (error) {
      if (__DEV__) {
        console.log('[FeatureOnboarding] Profile setup save error:', error);
      }
      Alert.alert('Profile Error', 'Unable to save your profile setup right now.');
      setIsSaving(false);
      return;
    }
    await completeFeatureOnboarding();
    router.replace('/crew-selection');
    setIsSaving(false);
  };

  const next = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (index < slides.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1 });
      return;
    }
    void complete();
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
  }).current;

  const renderSlide = ({ item, index: slideIndex }: { item: FeatureSlide; index: number }) => {
    const Icon = item.icon;
    if (item.isProfileSetup) {
      return (
        <View style={[styles.slide, { width }]}>
          <View style={styles.featurePanel}>
            <View style={styles.panelTopRow}>
              <View style={styles.iconBox}>
                <Users size={25} color={colors.text} strokeWidth={1.8} />
              </View>
              <Text style={styles.slideCount}>{slideIndex + 1}/{slides.length}</Text>
            </View>
            <Text style={styles.slideLabel}>{item.label}</Text>
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideBody}>{item.body}</Text>

            <Pressable style={styles.avatarSetupRow} onPress={pickAvatar}>
              <Image source={getAvatarSource(avatar)} style={styles.avatarPreview} contentFit="cover" />
              <View style={styles.avatarSetupCopy}>
                <Text style={styles.avatarSetupTitle}>Profile Picture</Text>
                <Text style={styles.avatarSetupText}>Tap to choose one, or keep the helmet default.</Text>
              </View>
              <Camera size={18} color={colors.textSecondary} />
            </Pressable>

            <Text style={styles.inputLabel}>Nickname</Text>
            <TextInput
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder="What should members call you?"
              placeholderTextColor={colors.textTertiary}
              maxLength={48}
            />

            <View style={styles.bikeLabelRow}>
              <Bike size={16} color={colors.primary} />
              <Text style={styles.inputLabel}>Primary Bike</Text>
            </View>
            <TextInput
              style={styles.input}
              value={bikeName}
              onChangeText={setBikeName}
              placeholder="Harley-Davidson Street Glide"
              placeholderTextColor={colors.textTertiary}
              maxLength={80}
            />
            <TextInput
              style={[styles.input, styles.detailsInput]}
              value={bikeDetails}
              onChangeText={setBikeDetails}
              placeholder="Color, year, custom notes"
              placeholderTextColor={colors.textTertiary}
              maxLength={120}
              multiline
            />
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.slide, { width }]}>
        <View style={styles.featurePanel}>
          <View style={styles.panelTopRow}>
            <View style={styles.iconBox}>
              <Icon size={25} color={colors.text} strokeWidth={1.8} />
            </View>
            <Text style={styles.slideCount}>{slideIndex + 1}/{slides.length}</Text>
          </View>
          <Text style={styles.slideLabel}>{item.label}</Text>
          <Text style={styles.slideTitle}>{item.title}</Text>
          <Text style={styles.slideBody}>{item.body}</Text>
          <View style={styles.bulletList}>
            {item.bullets.map((bullet) => (
              <View key={bullet} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>{bullet}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.imageHeader}>
        <Image source={heroImage} style={styles.heroImage} contentFit="cover" />
        <LinearGradient
          colors={['rgba(0,0,0,0.08)', 'rgba(5,5,5,0.34)', colors.background]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.clubMark}>
            <Users size={18} color={colors.background} strokeWidth={2.2} />
          </View>
          <View>
            <Text style={styles.kicker}>Welcome to</Text>
            <Text style={styles.clubName}>{CLUB_NAME}</Text>
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={slides}
          keyExtractor={(item) => item.id}
          renderItem={renderSlide}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ viewAreaCoveragePercentThreshold: 60 }}
        />

        <View style={styles.footer}>
          <View style={styles.dots}>
            {slides.map((slide, dotIndex) => (
              <View
                key={slide.id}
                style={[styles.dot, dotIndex === index && styles.dotActive]}
              />
            ))}
          </View>
          <Pressable style={[styles.button, isSaving && styles.buttonDisabled]} onPress={next} disabled={isSaving}>
            <Text style={styles.buttonText}>
              {index === slides.length - 1 ? (isSaving ? 'Saving...' : 'Finish Setup') : 'Continue'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  imageHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '42%',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 22,
    paddingTop: 6,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  clubMark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  kicker: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  clubName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
  },
  slide: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 22,
    paddingBottom: 18,
    alignItems: 'center',
  },
  featurePanel: {
    width: '100%',
    maxWidth: 560,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: 'rgba(17,17,17,0.94)',
    padding: 18,
  },
  panelTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.heat,
  },
  slideCount: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: '700',
  },
  slideLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
    marginBottom: 8,
  },
  slideTitle: {
    color: colors.text,
    fontSize: 29,
    lineHeight: 35,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 12,
  },
  slideBody: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  bulletList: {
    gap: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 24,
  },
  bulletDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.heat,
  },
  bulletText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  avatarSetupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 12,
    marginBottom: 14,
  },
  avatarPreview: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  avatarSetupCopy: {
    flex: 1,
    gap: 3,
  },
  avatarSetupTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  avatarSetupText: {
    color: colors.textTertiary,
    fontSize: 12,
    lineHeight: 17,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 7,
  },
  bikeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 12,
  },
  detailsInput: {
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 0,
  },
  footer: {
    paddingHorizontal: 22,
    paddingBottom: 16,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  dots: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 7,
    marginBottom: 18,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.borderLight,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  button: {
    minHeight: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.text,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '900',
  },
});
