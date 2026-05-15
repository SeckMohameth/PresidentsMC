import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
} from 'react-native';
import * as Location from 'expo-location';
import Colors from '@/constants/colors';

type NativeGeocodeResult = {
  id: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type AddressSelection = {
  address: string;
  latitude: number;
  longitude: number;
};

interface AddressAutocompleteProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (selection: AddressSelection) => void;
  placeholder?: string;
}

const DEBOUNCE_MS = 500;
const MIN_QUERY_LENGTH = 3;

export default function AddressAutocomplete({
  value,
  onChangeText,
  onSelect,
  placeholder = 'Search address...',
}: AddressAutocompleteProps) {
  const [results, setResults] = useState<NativeGeocodeResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestQueryRef = useRef('');

  const searchAddress = useCallback(async (query: string) => {
    const trimmed = query.trim();
    latestQueryRef.current = trimmed;
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    setIsLoading(true);
    try {
      const geocoded = await Location.geocodeAsync(trimmed);
      if (latestQueryRef.current !== trimmed) return;

      const nextResults = geocoded.slice(0, 5).map((item, index) => ({
        id: `${trimmed}-${index}-${item.latitude}-${item.longitude}`,
        address: trimmed,
        latitude: item.latitude,
        longitude: item.longitude,
      }));
      setResults(nextResults);
      setShowDropdown(nextResults.length > 0);
    } catch {
      if (latestQueryRef.current === trimmed) {
        setResults([]);
        setShowDropdown(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleChangeText = (text: string) => {
    onChangeText(text);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      searchAddress(text);
    }, DEBOUNCE_MS);
  };

  const handleSelect = (result: NativeGeocodeResult) => {
    const formatted = result.address;
    onChangeText(formatted);
    onSelect({
      address: formatted,
      latitude: result.latitude,
      longitude: result.longitude,
    });
    setShowDropdown(false);
    setResults([]);
    Keyboard.dismiss();
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={Colors.dark.textTertiary}
          value={value}
          onChangeText={handleChangeText}
          onFocus={() => {
            if (results.length > 0) setShowDropdown(true);
          }}
          onBlur={() => {
            // Delay hiding so the user can tap a result
            setTimeout(() => setShowDropdown(false), 200);
          }}
        />
        {isLoading && (
          <ActivityIndicator
            size="small"
            color={Colors.dark.primary}
            style={styles.loader}
          />
        )}
      </View>
      {showDropdown && (
        <View style={styles.dropdown}>
          {results.map((item) => (
            <Pressable
              key={item.id}
              style={styles.dropdownItem}
              onPress={() => handleSelect(item)}
            >
              <Text style={styles.dropdownText} numberOfLines={2}>
                {item.address}
              </Text>
              <Text style={styles.dropdownSubtext} numberOfLines={1}>
                {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.dark.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  loader: {
    position: 'absolute',
    right: 14,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginTop: 4,
    maxHeight: 200,
    overflow: 'hidden',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  dropdownText: {
    color: Colors.dark.text,
    fontSize: 14,
    lineHeight: 20,
  },
  dropdownSubtext: {
    color: Colors.dark.textTertiary,
    fontSize: 12,
    marginTop: 2,
  },
});
