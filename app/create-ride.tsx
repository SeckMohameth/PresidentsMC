import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import MapView, { MapPressEvent, Marker, Polyline } from 'react-native-maps';
import { X, MapPin, Calendar, Clock, Gauge, FileText, ImagePlus, Image as ImageIcon, Trash2, MapPinned, LocateFixed } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useCrew, useRide } from '@/providers/CrewProvider';
import AddressAutocomplete, { AddressSelection } from '@/components/AddressAutocomplete';
import { ImageAttribution } from '@/types';
import { calculateDistanceMiles } from '@/utils/helpers';

type PaceType = 'casual' | 'moderate' | 'spirited';
type MapTarget = 'start' | 'end';
const DEFAULT_COVER_IMAGE = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=400&fit=crop';
const DEFAULT_REGION = {
  latitude: 41.7658,
  longitude: -72.6734,
  latitudeDelta: 0.2,
  longitudeDelta: 0.2,
};

function formatReverseAddress(item?: Location.LocationGeocodedAddress) {
  if (!item) return 'Dropped pin';
  const lineOne = [item.name, item.street].filter(Boolean).join(' ');
  const lineTwo = [item.city, item.region, item.postalCode].filter(Boolean).join(', ');
  return [lineOne, lineTwo].filter(Boolean).join(', ') || 'Dropped pin';
}

export default function CreateRideScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const { rideId } = useLocalSearchParams<{ rideId?: string }>();
  const { crew, currentUser, createRide, updateRide, deleteRide, isCreatingRide } = useCrew();
  const { ride } = useRide(rideId || '');
  const isEditMode = Boolean(rideId);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startName, setStartName] = useState('');
  const [startAddress, setStartAddress] = useState('');
  const [startCoords, setStartCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [endName, setEndName] = useState('');
  const [endAddress, setEndAddress] = useState('');
  const [endCoords, setEndCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [rideDate, setRideDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [dateSelected, setDateSelected] = useState(false);
  const [timeSelected, setTimeSelected] = useState(false);
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [pace, setPace] = useState<PaceType>('moderate');
  const [notes, setNotes] = useState('');
  const [coverImage, setCoverImage] = useState<string>('');
  const [coverAttribution, setCoverAttribution] = useState<ImageAttribution | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [mapTarget, setMapTarget] = useState<MapTarget>('start');
  const [isResolvingPin, setIsResolvingPin] = useState(false);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  useEffect(() => {
    if (!ride || !isEditMode || isInitialized) return;
    setTitle(ride.title || '');
    setDescription(ride.description || '');
    setStartName(ride.startLocation?.name || '');
    setStartAddress(ride.startLocation?.address || '');
    setStartCoords({
      latitude: ride.startLocation?.latitude ?? 0,
      longitude: ride.startLocation?.longitude ?? 0,
    });
    setEndName(ride.endLocation?.name || '');
    setEndAddress(ride.endLocation?.address || '');
    setEndCoords({
      latitude: ride.endLocation?.latitude ?? 0,
      longitude: ride.endLocation?.longitude ?? 0,
    });
    const rideDateValue = ride.dateTime ? new Date(ride.dateTime) : new Date();
    setRideDate(rideDateValue);
    setDateSelected(true);
    setTimeSelected(true);
    setDuration(ride.estimatedDuration || '');
    setDistance(String(ride.estimatedDistance || ''));
    setPace(ride.pace || 'moderate');
    setNotes(ride.notes || '');
    setCoverImage(ride.coverImage || '');
    setCoverAttribution(ride.coverAttribution);
    setIsInitialized(true);
  }, [ride, isEditMode, isInitialized]);

  useEffect(() => {
    if (!startCoords || !endCoords) return;
    const computed = calculateDistanceMiles(startCoords, endCoords);
    if (Number.isFinite(computed)) {
      setDistance(String(Math.round(computed * 10) / 10));
    }
  }, [startCoords, endCoords]);

  const mapRegion = useMemo(() => {
    if (startCoords && endCoords) {
      const latitudeDelta = Math.max(Math.abs(startCoords.latitude - endCoords.latitude) * 1.8, 0.04);
      const longitudeDelta = Math.max(Math.abs(startCoords.longitude - endCoords.longitude) * 1.8, 0.04);
      return {
        latitude: (startCoords.latitude + endCoords.latitude) / 2,
        longitude: (startCoords.longitude + endCoords.longitude) / 2,
        latitudeDelta,
        longitudeDelta,
      };
    }

    const point = startCoords || endCoords;
    if (point) {
      return {
        latitude: point.latitude,
        longitude: point.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
    }

    return DEFAULT_REGION;
  }, [endCoords, startCoords]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (startCoords && endCoords) {
      mapRef.current.fitToCoordinates([startCoords, endCoords], {
        edgePadding: { top: 70, right: 70, bottom: 70, left: 70 },
        animated: true,
      });
      return;
    }

    const point = startCoords || endCoords;
    if (point) {
      mapRef.current.animateToRegion({
        latitude: point.latitude,
        longitude: point.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      }, 350);
    }
  }, [endCoords, startCoords]);

  if (isEditMode && !ride) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: Colors.dark.textSecondary }}>Loading ride...</Text>
      </View>
    );
  }

  const pickCoverImage = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant photo permissions to select a cover image.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setCoverImage(result.assets[0].uri);
      setCoverAttribution(undefined);
    }
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === 'set' && selectedDate) {
      const updated = new Date(rideDate);
      updated.setFullYear(selectedDate.getFullYear());
      updated.setMonth(selectedDate.getMonth());
      updated.setDate(selectedDate.getDate());
      setRideDate(updated);
      setDateSelected(true);
    }
  };

  const handleTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (event.type === 'set' && selectedDate) {
      const updated = new Date(rideDate);
      updated.setHours(selectedDate.getHours());
      updated.setMinutes(selectedDate.getMinutes());
      setRideDate(updated);
      setTimeSelected(true);
    }
  };

  const handleStartAddressSelect = (selection: AddressSelection) => {
    setStartAddress(selection.address);
    setStartCoords({ latitude: selection.latitude, longitude: selection.longitude });
  };

  const handleEndAddressSelect = (selection: AddressSelection) => {
    setEndAddress(selection.address);
    setEndCoords({ latitude: selection.latitude, longitude: selection.longitude });
  };

  const setDroppedPin = async (target: MapTarget, coordinate: { latitude: number; longitude: number }) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }

    if (target === 'start') {
      setStartCoords(coordinate);
      if (!startName.trim()) setStartName('Start pin');
    } else {
      setEndCoords(coordinate);
      if (!endName.trim()) setEndName('End pin');
    }

    setIsResolvingPin(true);
    try {
      const addresses = await Location.reverseGeocodeAsync(coordinate);
      const formatted = formatReverseAddress(addresses[0]);
      if (target === 'start') {
        setStartAddress(formatted);
      } else {
        setEndAddress(formatted);
      }
    } catch {
      const fallback = `${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`;
      if (target === 'start') {
        setStartAddress(fallback);
      } else {
        setEndAddress(fallback);
      }
    } finally {
      setIsResolvingPin(false);
    }
  };

  const handleMapPress = (event: MapPressEvent) => {
    void setDroppedPin(mapTarget, event.nativeEvent.coordinate);
  };

  const formattedDate = dateSelected
    ? rideDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  const formattedTime = timeSelected
    ? rideDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : '';

  const submitRide = async () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    const coverValue = coverImage || DEFAULT_COVER_IMAGE;
    if (isEditMode && rideId) {
      setIsSaving(true);
      try {
        await updateRide(rideId, {
          title: title.trim(),
          description: description.trim(),
          startLocation: {
            name: startName.trim(),
            address: startAddress.trim(),
            latitude: startCoords?.latitude ?? 0,
            longitude: startCoords?.longitude ?? 0,
          },
          endLocation: {
            name: endName.trim(),
            address: endAddress.trim(),
            latitude: endCoords?.latitude ?? 0,
            longitude: endCoords?.longitude ?? 0,
          },
          dateTime: rideDate.toISOString(),
          estimatedDuration: duration || '2 hours',
          estimatedDistance: parseFloat(distance) || 0,
          pace,
          notes: notes.trim(),
          coverImage: coverValue,
          coverAttribution: coverAttribution,
        });
        router.back();
      } finally {
        setIsSaving(false);
      }
      return;
    }

    await createRide({
      crewId: crew?.id || '',
      title: title.trim(),
      description: description.trim(),
      startLocation: {
        name: startName.trim(),
        address: startAddress.trim(),
        latitude: startCoords?.latitude ?? 0,
        longitude: startCoords?.longitude ?? 0,
      },
      endLocation: {
        name: endName.trim(),
        address: endAddress.trim(),
        latitude: endCoords?.latitude ?? 0,
        longitude: endCoords?.longitude ?? 0,
      },
      dateTime: rideDate.toISOString(),
      estimatedDuration: duration || '2 hours',
      estimatedDistance: parseFloat(distance) || 0,
      pace,
      notes: notes.trim(),
      coverImage: coverValue,
      coverAttribution: coverAttribution,
      createdBy: currentUser?.id || '',
      createdByName: currentUser?.name || '',
    });

    router.back();
  };

  const handleCreate = () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a ride title');
      return;
    }
    if (!startName.trim() || !endName.trim()) {
      Alert.alert('Error', 'Please enter start and end locations');
      return;
    }
    if (!dateSelected || !timeSelected) {
      Alert.alert('Error', 'Please select date and time');
      return;
    }

    if (!startCoords || !endCoords) {
      Alert.alert(
        'Missing Coordinates',
        'Select an address from the suggestions to get accurate map coordinates. Continue without?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: submitRide },
        ]
      );
      return;
    }

    submitRide();
  };

  const handleDelete = () => {
    if (!rideId) return;
    Alert.alert('Delete Ride', 'Remove this ride, its RSVP list, and album references from the club?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setIsSaving(true);
          try {
            await deleteRide(rideId);
            router.back();
          } catch {
            Alert.alert('Error', 'Unable to delete this ride right now.');
          } finally {
            setIsSaving(false);
          }
        },
      },
    ]);
  };

  const paceOptions: { value: PaceType; label: string; color: string }[] = [
    { value: 'casual', label: 'Casual', color: Colors.dark.success },
    { value: 'moderate', label: 'Moderate', color: Colors.dark.warning },
    { value: 'spirited', label: 'Spirited', color: Colors.dark.error },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.closeButton} onPress={() => router.back()}>
          <X size={24} color={Colors.dark.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEditMode ? 'Edit Ride' : 'New Ride'}</Text>
        <View style={styles.headerActions}>
          {isEditMode && (
            <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={isSaving}>
              <Trash2 size={17} color={Colors.dark.error} />
            </Pressable>
          )}
          <Pressable
            style={[styles.createButton, (!title.trim() || isCreatingRide || isSaving) && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={!title.trim() || isCreatingRide || isSaving}
          >
            <Text style={[styles.createButtonText, (!title.trim() || isCreatingRide || isSaving) && styles.createButtonTextDisabled]}>
              {isSaving ? 'Saving...' : isCreatingRide ? 'Creating...' : isEditMode ? 'Save' : 'Create'}
            </Text>
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 20 },
            isTablet && styles.scrollContentTablet,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Sunday Morning Cruise"
              placeholderTextColor={Colors.dark.textTertiary}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="What's this ride about?"
              placeholderTextColor={Colors.dark.textTertiary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.labelRow}>
              <ImageIcon size={16} color={Colors.dark.primary} />
              <Text style={styles.label}>Cover Image</Text>
            </View>
            {coverImage ? (
              <View style={styles.coverPreview}>
                <Image source={{ uri: coverImage }} style={styles.coverImage} contentFit="cover" />
                <Pressable style={styles.coverRemove} onPress={() => setCoverImage('')}>
                  <X size={16} color={Colors.dark.text} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.coverPlaceholder}>
                <Text style={styles.coverPlaceholderText}>No cover selected</Text>
              </View>
            )}
            <View style={styles.coverActions}>
              <Pressable style={styles.coverButton} onPress={pickCoverImage}>
                <ImagePlus size={18} color={Colors.dark.text} />
                <Text style={styles.coverButtonText}>Photos</Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.section, { zIndex: 3 }]}>
            <View style={styles.labelRow}>
              <MapPin size={16} color={Colors.dark.success} />
              <Text style={styles.label}>Start Location *</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Location name (e.g., Joe's Garage)"
              placeholderTextColor={Colors.dark.textTertiary}
              value={startName}
              onChangeText={setStartName}
            />
            <View style={{ marginTop: 8 }}>
              <AddressAutocomplete
                value={startAddress}
                onChangeText={setStartAddress}
                onSelect={handleStartAddressSelect}
                placeholder="Search address..."
              />
            </View>
            {startCoords && (
              <Text style={styles.coordsHint}>
                Coordinates set ({startCoords.latitude.toFixed(4)}, {startCoords.longitude.toFixed(4)})
              </Text>
            )}
          </View>

          <View style={[styles.section, { zIndex: 2 }]}>
            <View style={styles.labelRow}>
              <MapPin size={16} color={Colors.dark.error} />
              <Text style={styles.label}>End Location *</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Location name (e.g., Hill Country BBQ)"
              placeholderTextColor={Colors.dark.textTertiary}
              value={endName}
              onChangeText={setEndName}
            />
            <View style={{ marginTop: 8 }}>
              <AddressAutocomplete
                value={endAddress}
                onChangeText={setEndAddress}
                onSelect={handleEndAddressSelect}
                placeholder="Search address..."
              />
            </View>
            {endCoords && (
              <Text style={styles.coordsHint}>
                Coordinates set ({endCoords.latitude.toFixed(4)}, {endCoords.longitude.toFixed(4)})
              </Text>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.labelRow}>
              <MapPinned size={16} color={Colors.dark.primary} />
              <Text style={styles.label}>Map Pins</Text>
            </View>
            <View style={styles.mapPanel}>
              <View style={styles.mapToolbar}>
                <View style={styles.segmentedControl}>
                  <Pressable
                    style={[styles.segmentButton, mapTarget === 'start' && styles.segmentButtonActive]}
                    onPress={() => setMapTarget('start')}
                  >
                    <Text style={[styles.segmentText, mapTarget === 'start' && styles.segmentTextActive]}>
                      Start
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.segmentButton, mapTarget === 'end' && styles.segmentButtonActive]}
                    onPress={() => setMapTarget('end')}
                  >
                    <Text style={[styles.segmentText, mapTarget === 'end' && styles.segmentTextActive]}>
                      End
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.pinStatus}>
                  <LocateFixed size={14} color={isResolvingPin ? Colors.dark.warning : Colors.dark.textTertiary} />
                  <Text style={styles.pinStatusText}>
                    {isResolvingPin ? 'Resolving pin...' : `Tap map to set ${mapTarget}`}
                  </Text>
                </View>
              </View>
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={mapRegion}
                mapType="standard"
                showsUserLocation
                showsMyLocationButton
                onPress={handleMapPress}
              >
                {startCoords && (
                  <Marker
                    coordinate={startCoords}
                    title="Start"
                    description={startAddress || startName || 'Ride start'}
                    pinColor={Colors.dark.success}
                    draggable
                    onDragEnd={(event) => void setDroppedPin('start', event.nativeEvent.coordinate)}
                  />
                )}
                {endCoords && (
                  <Marker
                    coordinate={endCoords}
                    title="End"
                    description={endAddress || endName || 'Ride end'}
                    pinColor={Colors.dark.error}
                    draggable
                    onDragEnd={(event) => void setDroppedPin('end', event.nativeEvent.coordinate)}
                  />
                )}
                {startCoords && endCoords && (
                  <Polyline
                    coordinates={[startCoords, endCoords]}
                    strokeColor={Colors.dark.primary}
                    strokeWidth={4}
                    lineDashPattern={[10, 6]}
                  />
                )}
              </MapView>
              <View style={styles.mapLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: Colors.dark.success }]} />
                  <Text style={styles.legendText}>Start</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: Colors.dark.error }]} />
                  <Text style={styles.legendText}>End</Text>
                </View>
                <Text style={styles.mapHint}>Drag either pin to adjust the route estimate.</Text>
              </View>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.section, { flex: 1 }]}>
              <View style={styles.labelRow}>
                <Calendar size={16} color={Colors.dark.primary} />
                <Text style={styles.label}>Date *</Text>
              </View>
              <Pressable style={styles.pickerButton} onPress={() => setShowDatePicker(true)}>
                <Text style={[styles.pickerButtonText, !dateSelected && styles.pickerPlaceholder]}>
                  {dateSelected ? formattedDate : 'Select date'}
                </Text>
              </Pressable>
            </View>
            <View style={{ width: 12 }} />
            <View style={[styles.section, { flex: 1 }]}>
              <View style={styles.labelRow}>
                <Clock size={16} color={Colors.dark.primary} />
                <Text style={styles.label}>Time *</Text>
              </View>
              <Pressable style={styles.pickerButton} onPress={() => setShowTimePicker(true)}>
                <Text style={[styles.pickerButtonText, !timeSelected && styles.pickerPlaceholder]}>
                  {timeSelected ? formattedTime : 'Select time'}
                </Text>
              </Pressable>
            </View>
          </View>

          {Platform.OS === 'ios' && showDatePicker && (
            <View style={styles.iosPickerContainer}>
              <Pressable style={styles.iosPickerDone} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.iosPickerDoneText}>Done</Text>
              </Pressable>
              <DateTimePicker
                value={rideDate}
                mode="date"
                display="inline"
                onChange={handleDateChange}
                minimumDate={new Date()}
                themeVariant="dark"
                accentColor={Colors.dark.primary}
              />
            </View>
          )}

          {Platform.OS === 'ios' && showTimePicker && (
            <View style={styles.iosPickerContainer}>
              <Pressable style={styles.iosPickerDone} onPress={() => setShowTimePicker(false)}>
                <Text style={styles.iosPickerDoneText}>Done</Text>
              </Pressable>
              <DateTimePicker
                value={rideDate}
                mode="time"
                display="spinner"
                onChange={handleTimeChange}
                themeVariant="dark"
                accentColor={Colors.dark.primary}
              />
            </View>
          )}

          {Platform.OS === 'android' && showDatePicker && (
            <DateTimePicker
              value={rideDate}
              mode="date"
              onChange={handleDateChange}
              minimumDate={new Date()}
            />
          )}

          {Platform.OS === 'android' && showTimePicker && (
            <DateTimePicker
              value={rideDate}
              mode="time"
              onChange={handleTimeChange}
            />
          )}

          <View style={styles.row}>
            <View style={[styles.section, { flex: 1 }]}>
              <Text style={styles.label}>Duration</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 3 hours"
                placeholderTextColor={Colors.dark.textTertiary}
                value={duration}
                onChangeText={setDuration}
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={[styles.section, { flex: 1 }]}>
              <Text style={styles.label}>Distance (mi)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 85"
                placeholderTextColor={Colors.dark.textTertiary}
                value={distance}
                onChangeText={setDistance}
                keyboardType="numeric"
                editable={false}
              />
              <Text style={styles.autoDistanceHint}>Auto-calculated from start and end points</Text>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Gauge size={16} color={Colors.dark.textSecondary} />
              <Text style={styles.label}>Pace</Text>
            </View>
            <View style={styles.paceOptions}>
              {paceOptions.map(option => (
                <Pressable 
                  key={option.value}
                  style={[
                    styles.paceOption, 
                    pace === option.value && { borderColor: option.color, backgroundColor: `${option.color}15` }
                  ]}
                  onPress={() => setPace(option.value)}
                >
                  <View style={[styles.paceDot, { backgroundColor: option.color }]} />
                  <Text style={[styles.paceLabel, pace === option.value && { color: option.color }]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.labelRow}>
              <FileText size={16} color={Colors.dark.textSecondary} />
              <Text style={styles.label}>Notes</Text>
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Any rules, stops, or things riders should know..."
              placeholderTextColor={Colors.dark.textTertiary}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
  },
  createButton: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  createButtonDisabled: {
    backgroundColor: Colors.dark.surfaceElevated,
  },
  createButtonText: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
  },
  createButtonTextDisabled: {
    color: Colors.dark.textTertiary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  scrollContentTablet: {
    maxWidth: 840,
    alignSelf: 'center',
    width: '100%',
  },
  section: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  coverPreview: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.dark.surface,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholderText: {
    color: Colors.dark.textTertiary,
    fontSize: 13,
  },
  coverActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  coverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  coverButtonText: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
  },
  label: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.dark.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  mapPanel: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: 'hidden',
  },
  mapToolbar: {
    padding: 12,
    gap: 10,
    backgroundColor: Colors.dark.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  segmentButton: {
    flex: 1,
    minHeight: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: Colors.dark.primary,
  },
  segmentText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: Colors.dark.text,
  },
  pinStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pinStatusText: {
    color: Colors.dark.textTertiary,
    fontSize: 12,
    fontWeight: '600',
  },
  map: {
    width: '100%',
    height: 280,
  },
  mapLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  mapHint: {
    color: Colors.dark.textTertiary,
    fontSize: 12,
    flexShrink: 1,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  paceOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  paceOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.dark.surface,
    borderWidth: 2,
    borderColor: Colors.dark.border,
  },
  paceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  paceLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  pickerButton: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    justifyContent: 'center',
  },
  pickerButtonText: {
    color: Colors.dark.text,
    fontSize: 16,
  },
  pickerPlaceholder: {
    color: Colors.dark.textTertiary,
  },
  iosPickerContainer: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  iosPickerDone: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  iosPickerDoneText: {
    color: Colors.dark.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  coordsHint: {
    color: Colors.dark.textTertiary,
    fontSize: 12,
    marginTop: 6,
    fontStyle: 'italic',
  },
  autoDistanceHint: {
    color: Colors.dark.textTertiary,
    fontSize: 11,
    marginTop: 6,
  },
});
