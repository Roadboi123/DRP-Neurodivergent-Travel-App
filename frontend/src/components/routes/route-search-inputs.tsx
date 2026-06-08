import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  userCoords?: string | null;
}

const RECENTS_KEY = 'calm_travel_recent_locations';

// Pre-seeded coordinate-precise list of major London transport hubs
const LOCAL_COMMON_PLACES: LocationSuggestion[] = [
  {
    name: "St. John's Wood Underground Station",
    display_name: "St. John's Wood Underground Station, London, NW8 6DR, United Kingdom",
    subtitle: "London, NW8 6DR, United Kingdom",
    lat: 51.5353523,
    lon: -0.1742097
  },
  {
    name: "St. John's Wood",
    display_name: "St. John's Wood, London, Greater London, United Kingdom",
    subtitle: "London, Greater London, United Kingdom",
    lat: 51.5317260,
    lon: -0.1741901
  },
  {
    name: "King's Cross St. Pancras Underground Station",
    display_name: "King's Cross St. Pancras Underground Station, London, N1 9AL, United Kingdom",
    subtitle: "London, N1 9AL, United Kingdom",
    lat: 51.5303,
    lon: -0.1229
  },
  {
    name: "King's Cross",
    display_name: "King's Cross, London, Greater London, United Kingdom",
    subtitle: "London, Greater London, United Kingdom",
    lat: 51.5300,
    lon: -0.1233
  },
  {
    name: "Earl's Court Underground Station",
    display_name: "Earl's Court Underground Station, London, SW5 9QA, United Kingdom",
    subtitle: "London, SW5 9QA, United Kingdom",
    lat: 51.4912,
    lon: -0.1931
  },
  {
    name: "Barons Court Underground Station",
    display_name: "Barons Court Underground Station, London, W14 9HD, United Kingdom",
    subtitle: "London, W14 9HD, United Kingdom",
    lat: 51.4902,
    lon: -0.2139
  },
  {
    name: "Queen's Park Underground Station",
    display_name: "Queen's Park Underground Station, London, NW6 6NL, United Kingdom",
    subtitle: "London, NW6 6NL, United Kingdom",
    lat: 51.5342,
    lon: -0.2046
  },
  {
    name: "Shepherd's Bush Underground Station",
    display_name: "Shepherd's Bush Underground Station, London, W12 8ND, United Kingdom",
    subtitle: "London, W12 8ND, United Kingdom",
    lat: 51.5042,
    lon: -0.2186
  },
  {
    name: "St. James's Park Underground Station",
    display_name: "St. James's Park Underground Station, London, SW1H 0BD, United Kingdom",
    subtitle: "London, SW1H 0BD, United Kingdom",
    lat: 51.4997,
    lon: -0.1331
  },
  {
    name: "South Kensington Underground Station",
    display_name: "South Kensington Underground Station, London, SW7 2LY, United Kingdom",
    subtitle: "London, SW7 2LY, United Kingdom",
    lat: 51.4941,
    lon: -0.1738
  },
  {
    name: "Gloucester Road Underground Station",
    display_name: "Gloucester Road Underground Station, London, SW7 4SF, United Kingdom",
    subtitle: "London, SW7 4SF, United Kingdom",
    lat: 51.4944,
    lon: -0.1829
  },
  {
    name: "Victoria Underground Station",
    display_name: "Victoria Underground Station, London, SW1V 1JT, United Kingdom",
    subtitle: "London, SW1V 1JT, United Kingdom",
    lat: 51.4962,
    lon: -0.1440
  },
  {
    name: "Waterloo Underground Station",
    display_name: "Waterloo Underground Station, London, SE1 8SW, United Kingdom",
    subtitle: "London, SE1 8SW, United Kingdom",
    lat: 51.5033,
    lon: -0.1147
  },
  {
    name: "London Bridge Underground Station",
    display_name: "London Bridge Underground Station, London, SE1 9SP, United Kingdom",
    subtitle: "London, SE1 9SP, United Kingdom",
    lat: 51.5050,
    lon: -0.0860
  },
  {
    name: "Liverpool Street Underground Station",
    display_name: "Liverpool Street Underground Station, London, EC2M 7PP, United Kingdom",
    subtitle: "London, EC2M 7PP, United Kingdom",
    lat: 51.5178,
    lon: -0.0820
  },
  {
    name: "Paddington Underground Station",
    display_name: "Paddington Underground Station, London, W2 1HB, United Kingdom",
    subtitle: "London, W2 1HB, United Kingdom",
    lat: 51.5173,
    lon: -0.1775
  },
  {
    name: "Euston Underground Station",
    display_name: "Euston Underground Station, London, NW1 2HS, United Kingdom",
    subtitle: "London, NW1 2HS, United Kingdom",
    lat: 51.5281,
    lon: -0.1336
  },
  {
    name: "Oxford Circus Underground Station",
    display_name: "Oxford Circus Underground Station, London, W1B 3AG, United Kingdom",
    subtitle: "London, W1B 3AG, United Kingdom",
    lat: 51.5152,
    lon: -0.1419
  },
  {
    name: "Piccadilly Circus Underground Station",
    display_name: "Piccadilly Circus Underground Station, London, W1J 9HP, United Kingdom",
    subtitle: "London, W1J 9HP, United Kingdom",
    lat: 51.5101,
    lon: -0.1340
  },
  {
    name: "Covent Garden Underground Station",
    display_name: "Covent Garden Underground Station, London, WC2E 9JT, United Kingdom",
    subtitle: "London, WC2E 9JT, United Kingdom",
    lat: 51.5130,
    lon: -0.1243
  },
  {
    name: "Westminster Underground Station",
    display_name: "Westminster Underground Station, London, SW1A 2JR, United Kingdom",
    subtitle: "London, SW1A 2JR, United Kingdom",
    lat: 51.5014,
    lon: -0.1249
  },
  {
    name: "Green Park Underground Station",
    display_name: "Green Park Underground Station, London, W1J 8AQ, United Kingdom",
    subtitle: "London, W1J 8AQ, United Kingdom",
    lat: 51.5067,
    lon: -0.1428
  },
  {
    name: "Slough Station",
    display_name: "Slough Station, Slough, SL1 1XN, United Kingdom",
    subtitle: "Slough, SL1 1XN, United Kingdom",
    lat: 51.5117,
    lon: -0.5915
  },
  {
    name: "Burnham Station",
    display_name: "Burnham Station, Burnham, SL1 6JT, United Kingdom",
    subtitle: "Burnham, SL1 6JT, United Kingdom",
    lat: 51.5240,
    lon: -0.6481
  },
  {
    name: "Reading Station",
    display_name: "Reading Station, Reading, RG1 1LZ, United Kingdom",
    subtitle: "Reading, RG1 1LZ, United Kingdom",
    lat: 51.4586,
    lon: -0.9715
  }
];

const FRONTEND_SUGGESTIONS_CACHE: Record<string, LocationSuggestion[]> = {};

export function RouteSearchInputs({
  startLoc,
  endLoc,
  loading,
  onStartChange,
  onEndChange,
  onSwap,
  userCoords,
}: RouteSearchInputsProps) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const accents = getAccents(isDark);
  const placeholderColor = palette.textMuted;

  const routesService = useRoutesService();
  const [focusedInput, setFocusedInput] = useState<'start' | 'end' | null>(null);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [recents, setRecents] = useState<LocationSuggestion[]>([]);

  const startInputRef = useRef<TextInput>(null);
  const endInputRef = useRef<TextInput>(null);

  // Parse user coords for proximity sorting
  let userLat: number | null = null;
  let userLon: number | null = null;
  if (userCoords) {
    const parts = userCoords.split(',');
    if (parts.length === 2) {
      userLat = parseFloat(parts[0]);
      userLon = parseFloat(parts[1]);
    }
  }

  // Load recents on mount
  useEffect(() => {
    async function loadRecents() {
      try {
        const data = await AsyncStorage.getItem(RECENTS_KEY);
        if (data) {
          setRecents(JSON.parse(data));
        }
      } catch (e) {
        console.warn('Failed to load recent locations:', e);
      }
    }
    loadRecents();
  }, []);

  // Debounced autocomplete suggestions search with instant local prefix filtering
  useEffect(() => {
    if (focusedInput === null) {
      return;
    }

    const query = focusedInput === 'start' ? startLoc : endLoc;
    const cleanQuery = query.trim().toLowerCase();

    // Helper to normalize strings for comparison (strip dots, spaces, apostrophes)
    const normalize = (s: string) => s.toLowerCase().replace(/['’.\s]+/g, '');
    const normQuery = normalize(cleanQuery);

    // 1. Get recent choices if query is empty or is "Current Location"
    if (cleanQuery === '' || query === 'Current Location') {
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
      
      // If we have recent locations, display them!
      if (recents.length > 0) {
        defaults.push(...recents.map(r => ({ ...r, isRecent: true } as LocationSuggestion & { isRecent?: boolean })));
      } else {
        // Fallback to local common list sorted by proximity
        const copyDefaults = [...LOCAL_COMMON_PLACES];
        if (userLat !== null && userLon !== null) {
          const lat = userLat;
          const lon = userLon;
          copyDefaults.sort((a, b) => {
            const distA = (a.lat - lat) ** 2 + (a.lon - lon) ** 2;
            const distB = (b.lat - lat) ** 2 + (b.lon - lon) ** 2;
            return distA - distB;
          });
        }
        defaults.push(...copyDefaults.slice(0, 5));
      }
      setSuggestions(defaults);
      return;
    }

    // 2. Perform Instant Local/Recent Filter (0ms delay!)
    const matchingRecents = recents
      .filter(place => normalize(place.name).includes(normQuery))
      .map(r => ({ ...r, isRecent: true }));

    const matchingLocal = LOCAL_COMMON_PLACES.filter(place => {
      const normName = normalize(place.name);
      return normName.includes(normQuery);
    });

    // Merge and de-duplicate (prefer recents)
    const mergedList: (LocationSuggestion & { isRecent?: boolean })[] = [...matchingRecents];
    const seenCoords = new Set(mergedList.map(s => `${s.lat.toFixed(4)},${s.lon.toFixed(4)}`));

    for (const item of matchingLocal) {
      const coordKey = `${item.lat.toFixed(4)},${item.lon.toFixed(4)}`;
      if (!seenCoords.has(coordKey)) {
        mergedList.push(item);
        seenCoords.add(coordKey);
      }
    }

    // Sort: Recents first, then sort remaining by proximity
    mergedList.sort((a, b) => {
      if (a.isRecent && !b.isRecent) return -1;
      if (!a.isRecent && b.isRecent) return 1;

      if (userLat !== null && userLon !== null) {
        const distA = (a.lat - userLat) ** 2 + (a.lon - userLon) ** 2;
        const distB = (b.lat - userLat) ** 2 + (b.lon - userLon) ** 2;
        return distA - distB;
      }
      return 0;
    });

    setSuggestions(mergedList);

    // If query is too short, don't query backend
    if (cleanQuery.length < 3) {
      return;
    }

    // Check frontend cache
    const cacheKey = `${normQuery}:${userLat}:${userLon}`;
    if (FRONTEND_SUGGESTIONS_CACHE[cacheKey]) {
      setSuggestions(FRONTEND_SUGGESTIONS_CACHE[cacheKey]);
      return;
    }

    // 3. Fire debounced backend request (150ms) to supplement suggestions list
    const delayDebounce = setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const data = await routesService.suggestLocations(query, userCoords);
        
        setSuggestions(prev => {
          const merged = [...prev];
          const currentSeen = new Set(merged.map(s => `${s.lat.toFixed(4)},${s.lon.toFixed(4)}`));
          
          for (const item of data) {
            const coordKey = `${item.lat.toFixed(4)},${item.lon.toFixed(4)}`;
            if (!currentSeen.has(coordKey)) {
              merged.push(item);
              currentSeen.add(coordKey);
            }
          }

          // Re-sort: Recents first, then others by proximity
          merged.sort((a: any, b: any) => {
            if (a.isRecent && !b.isRecent) return -1;
            if (!a.isRecent && b.isRecent) return 1;

            if (userLat !== null && userLon !== null) {
              const distA = (a.lat - userLat) ** 2 + (a.lon - userLon) ** 2;
              const distB = (b.lat - userLat) ** 2 + (b.lon - userLon) ** 2;
              return distA - distB;
            }
            return 0;
          });

          // Save to frontend cache
          FRONTEND_SUGGESTIONS_CACHE[cacheKey] = merged;
          return merged;
        });
      } catch (err) {
        console.warn('Failed to fetch location suggestions:', err);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 150);

    return () => clearTimeout(delayDebounce);
  }, [startLoc, endLoc, focusedInput, routesService, userCoords, userLat, userLon, recents]);

  const handleBlur = () => {
    // Delay closing suggestions dropdown so taps can register
    setTimeout(() => {
      setFocusedInput(null);
    }, 250);
  };

  const handleSelectSuggestion = async (sug: LocationSuggestion) => {
    if (focusedInput === 'start') {
      onStartChange(sug.name);
      startInputRef.current?.blur();
    } else if (focusedInput === 'end') {
      onEndChange(sug.name);
      endInputRef.current?.blur();
    }
    setFocusedInput(null);
    setSuggestions([]);

    // Save to recents if not Current Location
    if (sug.name !== 'Current Location') {
      try {
        const filtered = recents.filter(item => item.name.toLowerCase() !== sug.name.toLowerCase());
        const updated = [sug, ...filtered].slice(0, 10);
        setRecents(updated);
        await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save recent location:', e);
      }
    }
  };

  const getSuggestionIcon = (name: string, isRecent?: boolean) => {
    if (name === 'Current Location') return 'location-sharp';
    if (isRecent) return 'time-outline';
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
              {suggestions.map((sug: any, idx) => (
                <View key={idx}>
                  <TouchableOpacity
                    style={styles.suggestionItem}
                    onPress={() => handleSelectSuggestion(sug)}
                  >
                    <View style={styles.suggestionIconWrapper}>
                      <Ionicons
                        name={getSuggestionIcon(sug.name, sug.isRecent) as any}
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
