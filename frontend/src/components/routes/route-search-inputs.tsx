import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Fonts, getAccents, getPalette, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRoutesService } from '@/services/services-context';
import type { LocationSuggestion } from '@/types/route';

interface RouteSearchInputsProps {
  startLoc: string;
  endLoc: string;
  loading: boolean;
  onStartChange: (text: string) => void;
  onEndChange: (text: string) => void;
  onSwap: () => void;
}

export function RouteSearchInputs({
  startLoc,
  endLoc,
  loading,
  onStartChange,
  onEndChange,
  onSwap,
}: RouteSearchInputsProps) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const accents = getAccents(isDark);
  const placeholderColor = palette.textMuted;

  const routesService = useRoutesService();
  const [focusedInput, setFocusedInput] = useState<'start' | 'end' | null>(null);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const startInputRef = useRef<TextInput>(null);
  const endInputRef = useRef<TextInput>(null);

  // Debounced autocomplete suggestions search
  useEffect(() => {
    if (focusedInput === null) {
      return;
    }

    const query = focusedInput === 'start' ? startLoc : endLoc;

    if (query.trim() === '' || query === 'Current Location') {
      const defaults: LocationSuggestion[] = [];
      if (focusedInput === 'start' && startLoc !== 'Current Location') {
        defaults.push({
          name: 'Current Location',
          display_name: 'Current Location (using GPS)',
          subtitle: 'Use your phone\'s real-time GPS location',
          lat: 51.4944,
          lon: -0.1829,
        });
      }
      defaults.push(
        {
          name: "St. John's Wood Underground Station",
          display_name: "St. John's Wood Underground Station, London, United Kingdom",
          subtitle: 'London, NW8 6DR, United Kingdom',
          lat: 51.5353523,
          lon: -0.1742097,
        },
        {
          name: 'South Kensington Underground Station',
          display_name: 'South Kensington Underground Station, London, United Kingdom',
          subtitle: 'London, SW7 2LY, United Kingdom',
          lat: 51.4941,
          lon: -0.1738,
        },
        {
          name: 'Gloucester Road Underground Station',
          display_name: 'Gloucester Road Underground Station, London, United Kingdom',
          subtitle: 'London, SW7 4SF, United Kingdom',
          lat: 51.4944,
          lon: -0.1829,
        },
        {
          name: "King's Cross St. Pancras Underground Station",
          display_name: "King's Cross St. Pancras Underground Station, London, United Kingdom",
          subtitle: 'London, N1 9AL, United Kingdom',
          lat: 51.5303,
          lon: -0.1229,
        }
      );
      setSuggestions(defaults);
      return;
    }

    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const data = await routesService.suggestLocations(query);
        setSuggestions(data);
      } catch (err) {
        console.warn('Failed to fetch location suggestions:', err);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [startLoc, endLoc, focusedInput, routesService]);

  const handleBlur = () => {
    // Delay closing suggestions dropdown so taps can register
    setTimeout(() => {
      setFocusedInput(null);
    }, 250);
  };

  const handleSelectSuggestion = (sug: LocationSuggestion) => {
    if (focusedInput === 'start') {
      onStartChange(sug.name);
      startInputRef.current?.blur();
    } else if (focusedInput === 'end') {
      onEndChange(sug.name);
      endInputRef.current?.blur();
    }
    setFocusedInput(null);
    setSuggestions([]);
  };

  const getSuggestionIcon = (name: string) => {
    if (name === 'Current Location') return 'location-sharp';
    const lower = name.toLowerCase();
    if (lower.includes('station') || lower.includes('underground') || lower.includes('dlr') || lower.includes('overground')) {
      return 'subway-outline';
    }
    return 'pin-outline';
  };

  return (
    <View style={[styles.headerSpacer, { zIndex: 10 }]}>
      {/* Input Fields Card */}
      <View
        style={[
          styles.inputCard,
          { backgroundColor: palette.surface, borderColor: palette.borderStrong },
        ]}>
        {/* Start Location Input */}
        <View style={styles.inputRow}>
          <View style={styles.inputIconContainer}>
            <View style={[styles.dotCircle, { backgroundColor: accents.green, borderColor: palette.border }]} />
            <View style={[styles.dotLine, { backgroundColor: palette.divider }]} />
          </View>
          <View style={styles.inputTextContainer}>
            <Text style={[styles.fieldLabel, { color: palette.textPrimary }]}>Start Location</Text>
            <TextInput
              ref={startInputRef}
              style={[styles.textInput, { color: palette.textPrimary }]}
              value={startLoc}
              onChangeText={onStartChange}
              onFocus={() => setFocusedInput('start')}
              onBlur={handleBlur}
              placeholder="Enter starting location..."
              placeholderTextColor={placeholderColor}
              clearButtonMode="while-editing"
            />
          </View>
        </View>

        {/* Divider */}
        <View style={[styles.inputDivider, { backgroundColor: palette.divider }]} />

        {/* End Location Input */}
        <View style={styles.inputRow}>
          <View style={styles.inputIconContainer}>
            <Ionicons name="location" size={20} color={accents.pink} />
          </View>
          <View style={styles.inputTextContainer}>
            <Text style={[styles.fieldLabel, { color: palette.textPrimary }]}>End Destination</Text>
            <TextInput
              ref={endInputRef}
              style={[styles.textInput, { color: palette.textPrimary }]}
              value={endLoc}
              onChangeText={onEndChange}
              onFocus={() => setFocusedInput('end')}
              onBlur={handleBlur}
              placeholder="Enter destination..."
              placeholderTextColor={placeholderColor}
              clearButtonMode="while-editing"
            />
          </View>
        </View>

        {/* Swap start/end (Google-Maps style), vertically centred over the divider */}
        <TouchableOpacity
          onPress={onSwap}
          accessibilityRole="button"
          accessibilityLabel="Swap start and destination"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[
            styles.swapButton,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}>
          <Ionicons name="swap-vertical" size={18} color={palette.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Autocomplete Dropdown Overlay */}
      {focusedInput !== null && (suggestions.length > 0 || suggestionsLoading) && (
        <View
          style={[
            styles.suggestionsDropdown,
            { backgroundColor: palette.surface, borderColor: palette.borderStrong },
          ]}>
          {suggestionsLoading && suggestions.length === 0 ? (
            <View style={styles.suggestionsLoadingContainer}>
              <ActivityIndicator size="small" color={palette.textPrimary} />
            </View>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="always"
              style={styles.suggestionsList}
              showsVerticalScrollIndicator={false}
            >
              {suggestions.map((sug, idx) => (
                <View key={idx}>
                  <TouchableOpacity
                    style={styles.suggestionItem}
                    onPress={() => handleSelectSuggestion(sug)}
                  >
                    <View style={styles.suggestionIconWrapper}>
                      <Ionicons
                        name={getSuggestionIcon(sug.name) as any}
                        size={18}
                        color={sug.name === 'Current Location' ? accents.green : palette.textSecondary}
                      />
                    </View>
                    <View style={styles.suggestionTextWrapper}>
                      <Text style={[styles.suggestionName, { color: palette.textPrimary }]} numberOfLines={1}>
                        {sug.name}
                      </Text>
                      {sug.subtitle ? (
                        <Text style={[styles.suggestionSubtitle, { color: palette.textMuted }]} numberOfLines={1}>
                          {sug.subtitle}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                  {idx < suggestions.length - 1 && (
                    <View style={[styles.suggestionDivider, { backgroundColor: palette.divider }]} />
                  )}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerSpacer: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 10,
    zIndex: 10,
  },
  inputCard: {
    borderRadius: 14,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...hardShadow(5),
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingRight: 44,
  },
  inputIconContainer: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dotCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
  },
  dotLine: {
    width: 2,
    height: 24,
    position: 'absolute',
    bottom: -22,
  },
  inputTextContainer: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  textInput: {
    fontSize: 15,
    fontFamily: Fonts?.body,
    fontWeight: '600',
    padding: 0,
  },
  inputDivider: {
    height: 1,
    marginVertical: 8,
    marginLeft: 36,
  },
  swapButton: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...hardShadow(3),
  },
  suggestionsDropdown: {
    position: 'absolute',
    top: 136,
    left: 16,
    right: 16,
    borderRadius: 14,
    borderWidth: 2,
    maxHeight: 250,
    zIndex: 2000,
    ...hardShadow(5),
  },
  suggestionsLoadingContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionsList: {
    width: '100%',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  suggestionIconWrapper: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  suggestionTextWrapper: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 14,
    fontFamily: Fonts?.body,
    fontWeight: '700',
  },
  suggestionSubtitle: {
    fontSize: 11,
    fontFamily: Fonts?.body,
    fontWeight: '500',
    marginTop: 2,
  },
  suggestionDivider: {
    height: 1,
    marginHorizontal: 12,
  },
});
