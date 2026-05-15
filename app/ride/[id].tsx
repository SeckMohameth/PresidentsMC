import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Platform, Animated, ActivityIndicator, useWindowDimensions } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  Gauge, 
  Navigation, 
  CheckCircle2,
  FileText,
  ChevronRight,
  Pencil
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCrew, useRide } from '@/providers/CrewProvider';
import { formatDateTime, formatMiles, getPaceColor, getPaceLabel, openInMaps, getInitials, MapsApp } from '@/utils/helpers';

const getRouteCoordinates = (start: { latitude: number; longitude: number }, end: { latitude: number; longitude: number }) => {
  const points: { latitude: number; longitude: number }[] = [];
  const steps = 20;
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = start.latitude + (end.latitude - start.latitude) * t;
    const lng = start.longitude + (end.longitude - start.longitude) * t;
    const curve = Math.sin(t * Math.PI) * 0.002;
    points.push({ latitude: lat + curve, longitude: lng });
  }
  
  return points;
};

const hasUsableCoordinates = (location?: { latitude: number; longitude: number } | null) =>
  !!location &&
  Number.isFinite(location.latitude) &&
  Number.isFinite(location.longitude) &&
  Math.abs(location.latitude) <= 90 &&
  Math.abs(location.longitude) <= 180 &&
  !(location.latitude === 0 && location.longitude === 0);

export default function RideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentUser, joinRide, leaveRide, checkIn, isAdmin } = useCrew();
  const { ride, attendeeMembers } = useRide(id || '');
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  
  const mapRef = useRef<MapView>(null);
  const mapOpacity = useRef(new Animated.Value(0)).current;
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [hasPromptedCheckIn, setHasPromptedCheckIn] = useState(false);
  
  useEffect(() => {
    if (ride) {
      Animated.timing(mapOpacity, {
        toValue: 1,
        duration: 600,
        delay: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [ride, mapOpacity]);

  useEffect(() => {
    const maybePromptCheckIn = async () => {
      if (!ride || hasPromptedCheckIn) return;
      const isUpcomingLocal = ride.status === 'upcoming';
      const isAttendingLocal = currentUser ? ride.attendees.includes(currentUser.id) : false;
      const isCheckedInLocal = currentUser ? ride.checkedIn.includes(currentUser.id) : false;
      if (!isUpcomingLocal || !isAttendingLocal || isCheckedInLocal) return;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = location.coords;
      const CHECK_IN_RADIUS_MILES = 0.5;
      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const R = 3958.8;
      const dLat = toRad(ride.startLocation.latitude - latitude);
      const dLon = toRad(ride.startLocation.longitude - longitude);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(latitude)) * Math.cos(toRad(ride.startLocation.latitude)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      if (distance <= CHECK_IN_RADIUS_MILES) {
        setHasPromptedCheckIn(true);
        Alert.alert('Check In', 'You are near the start location. Check in now?', [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Check In', onPress: () => checkIn(ride.id) },
        ]);
      }
    };

    maybePromptCheckIn().catch((error) => {
      console.log('[RideDetail] Auto check-in prompt error:', error);
    });
  }, [ride, currentUser, hasPromptedCheckIn, checkIn]);

  if (!ride) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Ride not found</Text>
      </View>
    );
  }

  const isAttending = currentUser ? ride.attendees.includes(currentUser.id) : false;
  const isCheckedIn = currentUser ? ride.checkedIn.includes(currentUser.id) : false;
  const isUpcoming = ride.status === 'upcoming';
  const isCompleted = ride.status === 'completed';
  const statusLabel =
    ride.status === 'completed'
      ? 'Completed'
      : ride.status === 'cancelled'
        ? 'Cancelled'
        : ride.status === 'active'
          ? 'Active'
          : 'Upcoming';
  const statusStyle =
    ride.status === 'completed'
      ? styles.completedBadge
      : ride.status === 'cancelled'
        ? styles.cancelledBadge
        : ride.status === 'active'
          ? styles.activeBadge
          : styles.upcomingBadge;
  const statusTone =
    ride.status === 'completed'
      ? Colors.dark.completed
      : ride.status === 'cancelled'
        ? Colors.dark.cancelled
        : ride.status === 'active'
          ? Colors.dark.info
          : Colors.dark.upcoming;
  
  const hasStartCoordinates = hasUsableCoordinates(ride.startLocation);
  const hasEndCoordinates = hasUsableCoordinates(ride.endLocation);
  const hasRouteCoordinates = hasStartCoordinates && hasEndCoordinates;
  const routeCoordinates = hasRouteCoordinates
    ? getRouteCoordinates(
        { latitude: ride.startLocation.latitude, longitude: ride.startLocation.longitude },
        { latitude: ride.endLocation.latitude, longitude: ride.endLocation.longitude }
      )
    : [];

  const midLat = hasRouteCoordinates
    ? (ride.startLocation.latitude + ride.endLocation.latitude) / 2
    : ride.startLocation.latitude || 41.7658;
  const midLng = hasRouteCoordinates
    ? (ride.startLocation.longitude + ride.endLocation.longitude) / 2
    : ride.startLocation.longitude || -72.6734;
  const latDelta = hasRouteCoordinates
    ? Math.abs(ride.startLocation.latitude - ride.endLocation.latitude) * 1.5 + 0.02
    : 0.05;
  const lngDelta = hasRouteCoordinates
    ? Math.abs(ride.startLocation.longitude - ride.endLocation.longitude) * 1.5 + 0.02
    : 0.05;

  const handleToggleAttendance = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (isAttending) {
      Alert.alert('Leave Ride', 'Are you sure you want to leave this ride?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => leaveRide(ride.id) },
      ]);
    } else {
      joinRide(ride.id);
    }
  };

  const handleCheckIn = async () => {
    setIsCheckingIn(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Location permission is required to check in. Please enable it in Settings.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = location.coords;

      const CHECK_IN_RADIUS_MILES = 0.5;
      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const R = 3958.8; // Earth radius in miles
      const dLat = toRad(ride.startLocation.latitude - latitude);
      const dLon = toRad(ride.startLocation.longitude - longitude);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(latitude)) * Math.cos(toRad(ride.startLocation.latitude)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      if (distance > CHECK_IN_RADIUS_MILES) {
        Alert.alert(
          'Too Far Away',
          `You need to be within ${CHECK_IN_RADIUS_MILES} miles of the start location to check in. You are ${distance.toFixed(1)} miles away.`
        );
        return;
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await checkIn(ride.id);
      Alert.alert('Checked In!', 'You\'ve been checked in for this ride.');
    } catch {
      Alert.alert('Error', 'Could not verify your location. Please try again.');
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleOpenMaps = async (app: MapsApp, mode: 'start' | 'route') => {
    try {
      if (mode === 'route') {
        if (!hasRouteCoordinates) throw new Error('INVALID_ROUTE');
        await openInMaps(ride.endLocation, app, ride.startLocation);
        return;
      }
      if (!hasStartCoordinates) throw new Error('INVALID_DESTINATION');
      await openInMaps(ride.startLocation, app);
    } catch {
      Alert.alert('Directions Unavailable', 'This ride needs a valid start and end address before directions can open.');
    }
  };

  const handleNavigate = (mode: 'start' | 'route') => {
    const title = mode === 'route' ? 'Open Route' : 'Navigate to Start';
    if (Platform.OS === 'web') {
      void handleOpenMaps('google', mode);
      return;
    }
    Alert.alert(title, 'Choose a maps app:', [
      ...(Platform.OS === 'ios'
        ? [{ text: 'Apple Maps', onPress: () => void handleOpenMaps('apple', mode) }]
        : []),
      { text: 'Google Maps', onPress: () => void handleOpenMaps('google', mode) },
      { text: 'Waze', onPress: () => void handleOpenMaps('waze', mode) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.heroContainer}>
          <Image 
            source={{ uri: ride.coverImage }}
            style={styles.heroImage}
            contentFit="cover"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'transparent', 'rgba(0,0,0,0.8)']}
            locations={[0, 0.3, 1]}
            style={styles.heroGradient}
          />
          <Pressable 
            style={[styles.backButton, { top: insets.top + 8 }]}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={Colors.dark.text} />
          </Pressable>
          {isAdmin && (
            <Pressable 
              style={[styles.editButton, { top: insets.top + 8 }]}
              onPress={() => router.push({ pathname: '/create-ride', params: { rideId: ride.id } })}
            >
              <Pencil size={20} color={Colors.dark.text} />
            </Pressable>
          )}
          <View style={[styles.heroContent, { paddingBottom: 20 }]}>
            <View style={[styles.statusBadge, statusStyle]}>
              <Text style={[styles.statusText, { color: statusTone }]}>
                {statusLabel}
              </Text>
            </View>
            <Text style={styles.heroTitle}>{ride.title}</Text>
            <Text style={styles.heroDate}>{formatDateTime(ride.dateTime)}</Text>
          </View>
        </View>

        <View style={[styles.content, isTablet && styles.contentTablet]}>
          <View style={styles.quickStats}>
            <View style={styles.quickStat}>
              <Clock size={18} color={Colors.dark.primary} />
              <Text style={styles.quickStatValue}>{ride.estimatedDuration}</Text>
              <Text style={styles.quickStatLabel}>Duration</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStat}>
              <MapPin size={18} color={Colors.dark.success} />
              <Text style={styles.quickStatValue}>{formatMiles(ride.estimatedDistance)} mi</Text>
              <Text style={styles.quickStatLabel}>Distance</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStat}>
              <Gauge size={18} color={getPaceColor(ride.pace)} />
              <Text style={[styles.quickStatValue, { color: getPaceColor(ride.pace) }]}>
                {getPaceLabel(ride.pace)}
              </Text>
              <Text style={styles.quickStatLabel}>Pace</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Route</Text>
            
            {Platform.OS !== 'web' && hasRouteCoordinates && (
              <Animated.View style={[styles.mapContainer, { opacity: mapOpacity }]}>
                <MapView
                  ref={mapRef}
                  style={styles.map}
                  provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
                  initialRegion={{
                    latitude: midLat,
                    longitude: midLng,
                    latitudeDelta: latDelta,
                    longitudeDelta: lngDelta,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                >
                  <Marker
                    coordinate={{
                      latitude: ride.startLocation.latitude,
                      longitude: ride.startLocation.longitude,
                    }}
                    title="Start"
                    description={ride.startLocation.name}
                    pinColor={Colors.dark.success}
                  />
                  <Marker
                    coordinate={{
                      latitude: ride.endLocation.latitude,
                      longitude: ride.endLocation.longitude,
                    }}
                    title="End"
                    description={ride.endLocation.name}
                    pinColor={Colors.dark.error}
                  />
                  <Polyline
                    coordinates={routeCoordinates}
                    strokeColor={Colors.dark.primary}
                    strokeWidth={4}
                    lineDashPattern={[0]}
                  />
                </MapView>
              </Animated.View>
            )}
            
            {(Platform.OS === 'web' || !hasRouteCoordinates) && (
              <View style={styles.mapPlaceholder}>
                <MapPin size={32} color={Colors.dark.primary} />
                <Text style={styles.mapPlaceholderText}>
                  {hasRouteCoordinates ? 'Map preview available on mobile' : 'Add valid start and end addresses to preview the route'}
                </Text>
              </View>
            )}
            
            <View style={styles.routeCard}>
              <View style={styles.routePoint}>
                <View style={[styles.routeDot, styles.startDot]} />
                <View style={styles.routeInfo}>
                  <Text style={styles.routeLabel}>Start</Text>
                  <Text style={styles.routeName}>{ride.startLocation.name}</Text>
                  <Text style={styles.routeAddress}>{ride.startLocation.address}</Text>
                </View>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.routePoint}>
                <View style={[styles.routeDot, styles.endDot]} />
                <View style={styles.routeInfo}>
                  <Text style={styles.routeLabel}>End</Text>
                  <Text style={styles.routeName}>{ride.endLocation.name}</Text>
                  <Text style={styles.routeAddress}>{ride.endLocation.address}</Text>
                </View>
              </View>
            </View>
            <View style={styles.directionsRow}>
              <Pressable
                style={[styles.navigateButton, !hasStartCoordinates && styles.navigateButtonDisabled]}
                onPress={() => handleNavigate('start')}
                disabled={!hasStartCoordinates}
              >
                <Navigation size={18} color={Colors.dark.text} />
                <Text style={styles.navigateButtonText}>To Start</Text>
              </Pressable>
              <Pressable
                style={[styles.navigateButton, !hasRouteCoordinates && styles.navigateButtonDisabled]}
                onPress={() => handleNavigate('route')}
                disabled={!hasRouteCoordinates}
              >
                <Navigation size={18} color={Colors.dark.text} />
                <Text style={styles.navigateButtonText}>Full Route</Text>
              </Pressable>
            </View>
          </View>

          {ride.notes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <View style={styles.notesCard}>
                <FileText size={18} color={Colors.dark.textTertiary} />
                <Text style={styles.notesText}>{ride.notes}</Text>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {isCompleted ? 'Attendees' : 'Going'} ({attendeeMembers.length})
              </Text>
            </View>
            <View style={styles.attendeesCard}>
              {attendeeMembers.slice(0, 5).map((member, index) => (
                <View key={member.id} style={[styles.attendeeAvatar, { marginLeft: index > 0 ? -12 : 0 }]}>
                  {member.avatar ? (
                    <Image 
                      source={{ uri: member.avatar }}
                      style={styles.attendeeImage}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.attendeePlaceholder}>
                      <Text style={styles.attendeeInitials}>{getInitials(member.name)}</Text>
                    </View>
                  )}
                  {ride.checkedIn.includes(member.id) && (
                    <View style={styles.checkedInBadge}>
                      <CheckCircle2 size={10} color={Colors.dark.text} />
                    </View>
                  )}
                </View>
              ))}
              {attendeeMembers.length > 5 && (
                <View style={[styles.attendeeAvatar, styles.moreAttendees, { marginLeft: -12 }]}>
                  <Text style={styles.moreAttendeesText}>+{attendeeMembers.length - 5}</Text>
                </View>
              )}
              <View style={styles.attendeeNames}>
                <Text style={styles.attendeeNamesText} numberOfLines={2}>
                  {attendeeMembers.slice(0, 3).map(m => m.name.split(' ')[0]).join(', ')}
                  {attendeeMembers.length > 3 && ` and ${attendeeMembers.length - 3} more`}
                </Text>
              </View>
            </View>
          </View>

          {isCompleted && ride.photos.length > 0 && (
            <View style={styles.section}>
              <Pressable 
                style={styles.sectionHeader}
                onPress={() => router.push(`/album/${ride.id}`)}
              >
                <Text style={styles.sectionTitle}>Photos ({ride.photos.length})</Text>
                <ChevronRight size={20} color={Colors.dark.textTertiary} />
              </Pressable>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photosScroll}
              >
                {ride.photos.slice(0, 4).map((photo, index) => (
                  <Pressable 
                    key={photo.id}
                    style={styles.photoThumb}
                    onPress={() => router.push(`/album/${ride.id}`)}
                  >
                    <Image 
                      source={{ uri: photo.imageUrl }}
                      style={styles.photoImage}
                      contentFit="cover"
                    />
                    {index === 3 && ride.photos.length > 4 && (
                      <View style={styles.photoOverlay}>
                        <Text style={styles.photoOverlayText}>+{ride.photos.length - 4}</Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {isUpcoming && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          {isAttending && !isCheckedIn && (
            <Pressable style={styles.checkInButton} onPress={handleCheckIn} disabled={isCheckingIn}>
              {isCheckingIn ? (
                <ActivityIndicator color={Colors.dark.text} />
              ) : (
                <>
                  <CheckCircle2 size={20} color={Colors.dark.text} />
                  <Text style={styles.checkInButtonText}>Check In</Text>
                </>
              )}
            </Pressable>
          )}
          <Pressable 
            style={[
              styles.attendButton, 
              isAttending && styles.leaveButton,
              isAttending && !isCheckedIn && { flex: 1 }
            ]}
            onPress={handleToggleAttendance}
          >
            <Text style={[styles.attendButtonText, isAttending && styles.leaveButtonText]}>
              {isAttending ? (isCheckedIn ? 'Checked In ✓' : 'Leave Ride') : 'Join Ride'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: Colors.dark.textTertiary,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  heroContainer: {
    height: 280,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  statusBadge: {
    backgroundColor: 'rgba(10,10,10,0.72)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 12,
    borderWidth: 1,
  },
  upcomingBadge: {
    borderColor: Colors.dark.upcoming,
  },
  activeBadge: {
    borderColor: Colors.dark.info,
  },
  completedBadge: {
    borderColor: Colors.dark.completed,
  },
  cancelledBadge: {
    borderColor: Colors.dark.cancelled,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  heroTitle: {
    color: Colors.dark.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  heroDate: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    padding: 20,
  },
  contentTablet: {
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  quickStats: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  quickStat: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: Colors.dark.border,
    marginHorizontal: 12,
  },
  quickStatValue: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 2,
  },
  quickStatLabel: {
    color: Colors.dark.textTertiary,
    fontSize: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  routeCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
  },
  startDot: {
    backgroundColor: Colors.dark.success,
  },
  endDot: {
    backgroundColor: Colors.dark.error,
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: Colors.dark.border,
    marginLeft: 5,
    marginVertical: 4,
  },
  routeInfo: {
    flex: 1,
  },
  routeLabel: {
    color: Colors.dark.textTertiary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  routeName: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  routeAddress: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
  },
  directionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  navigateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  navigateButtonDisabled: {
    opacity: 0.45,
  },
  navigateButtonText: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '600',
  },
  mapContainer: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    height: 160,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 8,
  },
  mapPlaceholderText: {
    color: Colors.dark.textTertiary,
    fontSize: 14,
  },
  notesCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
  },
  notesText: {
    flex: 1,
    color: Colors.dark.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  attendeesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
  },
  attendeeAvatar: {
    position: 'relative',
  },
  attendeeImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.dark.surface,
  },
  attendeePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.surface,
  },
  attendeeInitials: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '700',
  },
  checkedInBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.dark.success,
    borderRadius: 8,
    padding: 2,
    borderWidth: 2,
    borderColor: Colors.dark.surface,
  },
  moreAttendees: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.surface,
  },
  moreAttendeesText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  attendeeNames: {
    flex: 1,
    marginLeft: 12,
  },
  attendeeNamesText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  photosScroll: {
    gap: 8,
  },
  photoThumb: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.dark.surface,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoOverlayText: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '700',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: Colors.dark.background,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dark.success,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  checkInButtonText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '600',
  },
  attendButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.primary,
    borderRadius: 28,
    paddingVertical: 16,
  },
  leaveButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.dark.border,
  },
  attendButtonText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '700',
  },
  leaveButtonText: {
    color: Colors.dark.textSecondary,
  },
});
