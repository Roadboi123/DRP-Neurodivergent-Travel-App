import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Fonts } from '@/constants/theme';

// Types for Route Suggestions
type SensoryLevel = 1 | 2 | 3; // 1 = Low (Green), 2 = Med (Orange), 3 = High (Red)

interface RouteOption {
  id: string;
  type: 'best' | 'quickest' | 'suggested';
  name: string;
  subName?: string | null;
  details?: string;
  duration: number; // in minutes
  price: number; // in GBP
  noise: SensoryLevel;     // Mapped to Sound in UI
  crowds: SensoryLevel;
  heat: SensoryLevel;
  light: SensoryLevel;
  smell: SensoryLevel;
  sensory_score?: number;   // Calculated by Backend
  description: string;
}

interface WarningItem {
  id: string;
  title: string;
  desc: string;
  severity: 'high' | 'medium' | 'info';
  icon: string;
}

// Default Mock Warnings
const warnings: WarningItem[] = [
  {
    id: 'w1',
    title: 'District Line Delays',
    desc: 'Moderate delays are causing platform crowding at South Kensington.',
    severity: 'medium',
    icon: 'alert-circle',
  },
  {
    id: 'w2',
    title: 'High Vehicle Heat Reports',
    desc: 'Bus 170 and Central Line are running 4°C above normal temperatures.',
    severity: 'high',
    icon: 'thermometer',
  },
  {
    id: 'w3',
    title: 'Entrance Drilling Noise',
    desc: 'Heavy street construction near Gloucester Road station (90dB+).',
    severity: 'info',
    icon: 'volume-high',
  },
];


export default function RoutesScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Input states
  const [startLoc, setStartLoc] = useState('Current Location');
  const [endLoc, setEndLoc] = useState('Imperial College London');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  // Sorting and filtering states
  const [sortBy, setSortBy] = useState<'speed' | 'sensory'>('speed');
  const [selectedTransport, setSelectedTransport] = useState<string | null>(null);
  const [warningsExpanded, setWarningsExpanded] = useState(false);

  // Routes state
  const [routes, setRoutes] = useState<RouteOption[]>([]);

  // Fetch routes from FastAPI backend with preference scoring
  useEffect(() => {
    let active = true;

    async function fetchRoutes() {
      if (!startLoc.trim() || !endLoc.trim()) {
        setRoutes([]);
        return;
      }

      setLoading(true);

      try {
        const startParam = encodeURIComponent(startLoc.trim());
        const endParam = encodeURIComponent(endLoc.trim());
        const userParam = username.trim() ? `&username=${encodeURIComponent(username.trim())}` : '';

        // Fetch from Railway production backend
        const url = `https://drp-neurodivergent-travel-app-production.up.railway.app/routes?start=${startParam}&end=${endParam}${userParam}`;
        
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error('Railway backend response error');
        }

        const data = await res.json();
        if (active) {
          setRoutes(data);
        }
      } catch (error) {
        console.warn('Production backend unavailable, trying local backend...', error);
        
        try {
          const startParam = encodeURIComponent(startLoc.trim());
          const endParam = encodeURIComponent(endLoc.trim());
          const userParam = username.trim() ? `&username=${encodeURIComponent(username.trim())}` : '';
          
          const localUrl = `http://localhost:8000/routes?start=${startParam}&end=${endParam}${userParam}`;
          const localRes = await fetch(localUrl);
          
          if (!localRes.ok) {
            throw new Error('Local backend response error');
          }

          const localData = await localRes.json();
          if (active) {
            setRoutes(localData);
          }
        } catch (localError) {
          console.warn('Local backend unavailable...', localError);
          if (active) {
            setRoutes([]);
          }
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    const timer = setTimeout(() => {
      fetchRoutes();
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [startLoc, endLoc, username]);

  // Apply sorting and filtering
  const getSortedRoutes = () => {
    let list = [...routes];

    // Filter by transport mode if clicked
    if (selectedTransport) {
      if (selectedTransport === 'walk') {
        list = list.filter(
          (r) =>
            r.name.toLowerCase().includes('walk') ||
            (r.subName && r.subName.toLowerCase().includes('walk'))
        );
      } else if (selectedTransport === 'bus') {
        list = list.filter((r) => r.name.toLowerCase().includes('bus'));
      }
    }

    if (sortBy === 'speed') {
      return list.sort((a, b) => a.duration - b.duration);
    } else {
      // Sort by backend calculated sensory discomfort score (lowest score first)
      // Fallback to simple sum if sensory_score is missing
      return list.sort((a, b) => {
        const scoreA = a.sensory_score ?? (a.noise + a.crowds + a.heat + a.light + a.smell);
        const scoreB = b.sensory_score ?? (b.noise + b.crowds + b.heat + b.light + b.smell);
        return scoreA - scoreB;
      });
    }
  };

  // Helper to render the sensory indicator blocks
  const renderSensoryMeter = (level: SensoryLevel, label: string) => {
    let barColor = '#4CAF50'; // Low (Green)
    if (level === 2) barColor = '#FF9800'; // Med (Orange)
    if (level === 3) barColor = '#F44336'; // High (Red)

    return (
      <View style={styles.meterContainer}>
        <Text style={[styles.meterLabel, { color: isDark ? '#AAA' : '#666' }]}>
          {label}
        </Text>
        <View style={styles.meterBlocks}>
          <View
            style={[
              styles.meterBlock,
              {
                backgroundColor:
                  level >= 1 ? barColor : isDark ? '#333' : '#E5E7EB',
              },
            ]}
          />
          <View
            style={[
              styles.meterBlock,
              {
                backgroundColor:
                  level >= 2 ? barColor : isDark ? '#333' : '#E5E7EB',
              },
            ]}
          />
          <View
            style={[
              styles.meterBlock,
              {
                backgroundColor:
                  level >= 3 ? barColor : isDark ? '#333' : '#E5E7EB',
              },
            ]}
          />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? '#121517' : '#FAF9F6' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Inputs Header Spacer */}
      <View style={styles.headerSpacer}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity style={styles.backButton} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#FFF' : '#1A1A1A'} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: isDark ? '#FFF' : '#1A1A1A', fontFamily: Fonts?.rounded }]}>
            CalmRoute Planner
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Input Fields Card */}
        <View
          style={[
            styles.inputCard,
            {
              backgroundColor: isDark ? '#1E2229' : '#FFFFFF',
              borderColor: isDark ? '#2A303C' : '#E5E7EB',
            },
          ]}
        >
          {/* Start Location Input */}
          <View style={styles.inputRow}>
            <View style={styles.inputIconContainer}>
              <View style={[styles.dotCircle, { backgroundColor: '#4A90E2' }]} />
              <View style={styles.dotLine} />
            </View>
            <View style={styles.inputTextContainer}>
              <Text style={styles.fieldLabel}>Start Location</Text>
              <TextInput
                style={[styles.textInput, { color: isDark ? '#FFF' : '#1A1A1A' }]}
                value={startLoc}
                onChangeText={setStartLoc}
                placeholder="Enter starting location..."
                placeholderTextColor={isDark ? '#555' : '#999'}
                clearButtonMode="while-editing"
              />
            </View>
          </View>

          {/* Divider */}
          <View style={[styles.inputDivider, { backgroundColor: isDark ? '#2E3543' : '#F0F0EE' }]} />

          {/* End Location Input */}
          <View style={styles.inputRow}>
            <View style={styles.inputIconContainer}>
              <Ionicons name="location" size={20} color="#E04F5F" />
            </View>
            <View style={styles.inputTextContainer}>
              <Text style={styles.fieldLabel}>End Destination</Text>
              <TextInput
                style={[styles.textInput, { color: isDark ? '#FFF' : '#1A1A1A' }]}
                value={endLoc}
                onChangeText={setEndLoc}
                placeholder="Enter destination..."
                placeholderTextColor={isDark ? '#555' : '#999'}
                clearButtonMode="while-editing"
              />
            </View>
          </View>
        </View>

        {/* Username Sensitivities Card */}
        <View
          style={[
            styles.usernameCard,
            {
              backgroundColor: isDark ? '#1E2229' : '#FFFFFF',
              borderColor: isDark ? '#2A303C' : '#E5E7EB',
              marginTop: 10,
            },
          ]}
        >
          <View style={styles.inputRow}>
            <View style={styles.inputIconContainer}>
              <Ionicons name="person-circle-outline" size={22} color="#1D9E75" />
            </View>
            <View style={styles.inputTextContainer}>
              <Text style={styles.fieldLabel}>Apply Username Sensitivities</Text>
              <TextInput
                style={[styles.textInput, { color: isDark ? '#FFF' : '#1A1A1A' }]}
                value={username}
                onChangeText={setUsername}
                placeholder="Enter username (e.g. calm_traveler)..."
                placeholderTextColor={isDark ? '#555' : '#999'}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {username.trim().length > 0 && !loading && (
              <Ionicons name="checkmark-circle" size={20} color="#1D9E75" style={{ marginLeft: 6 }} />
            )}
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Quick transport options */}
        <View style={styles.modeSummaryRow}>
          <TouchableOpacity
            onPress={() => setSelectedTransport(selectedTransport === 'walk' ? null : 'walk')}
            style={[
              styles.modeCard,
              {
                backgroundColor: isDark ? '#1E2229' : '#FFFFFF',
                borderColor:
                  selectedTransport === 'walk'
                    ? '#4A90E2'
                    : isDark
                    ? '#2E3543'
                    : '#EAEAEA',
              },
            ]}
          >
            <View style={styles.modeIconRow}>
              <Ionicons name="walk" size={20} color="#4CAF50" />
              <Text style={[styles.modeLabel, { color: isDark ? '#FFF' : '#333' }]}>Walk</Text>
            </View>
            <Text style={[styles.modeValue, { color: isDark ? '#AAA' : '#666' }]}>41 min</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeCard,
              {
                backgroundColor: isDark ? '#1E2229' : '#FFFFFF',
                borderColor: isDark ? '#2E3543' : '#EAEAEA',
              },
            ]}
          >
            <View style={styles.modeIconRow}>
              <Ionicons name="bicycle" size={20} color="#2196F3" />
              <Text style={[styles.modeLabel, { color: isDark ? '#FFF' : '#333' }]}>Cycle</Text>
            </View>
            <Text style={[styles.modeValue, { color: isDark ? '#AAA' : '#666' }]}>16 min</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeCard,
              {
                backgroundColor: isDark ? '#1E2229' : '#FFFFFF',
                borderColor: isDark ? '#2E3543' : '#EAEAEA',
              },
            ]}
          >
            <View style={styles.modeIconRow}>
              <Ionicons name="flash" size={18} color="#FFEB3B" />
              <Text style={[styles.modeLabel, { color: isDark ? '#FFF' : '#333' }]}>Scooter</Text>
            </View>
            <Text style={[styles.modeValue, { color: isDark ? '#AAA' : '#666' }]}>31 min</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeCard,
              {
                backgroundColor: isDark ? '#1E2229' : '#FFFFFF',
                borderColor: isDark ? '#2E3543' : '#EAEAEA',
              },
            ]}
          >
            <View style={styles.modeIconRow}>
              <Ionicons name="car-sport" size={18} color="#E04F5F" />
              <Text style={[styles.modeLabel, { color: isDark ? '#FFF' : '#333' }]}>Taxi</Text>
            </View>
            <Text style={[styles.modeValue, { color: isDark ? '#AAA' : '#666' }]}>23 min</Text>
            <Text style={styles.taxiPrice}>~£14</Text>
          </TouchableOpacity>
        </View>

        {/* Warnings Collapsible Card */}
        <View style={styles.warningContainer}>
          <TouchableOpacity
            onPress={() => setWarningsExpanded(!warningsExpanded)}
            activeOpacity={0.85}
            style={[
              styles.warningHeader,
              {
                backgroundColor: isDark ? '#2D221C' : '#FFF5F0',
                borderColor: '#FF7F50',
              },
            ]}
          >
            <View style={styles.warningTitleGroup}>
              <Ionicons name="warning" size={22} color="#FF7F50" />
              <Text
                style={[
                  styles.warningHeaderText,
                  { color: isDark ? '#FF9E79' : '#D04E1F' },
                ]}
              >
                Sensory Warnings [3]
              </Text>
            </View>
            <Ionicons
              name={warningsExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={isDark ? '#FF9E79' : '#D04E1F'}
            />
          </TouchableOpacity>

          {warningsExpanded && (
            <View
              style={[
                styles.warningDropdown,
                {
                  backgroundColor: isDark ? '#1E2229' : '#FFFFFF',
                  borderColor: isDark ? '#2E3543' : '#F0EEED',
                },
              ]}
            >
              {warnings.map((w, index) => (
                <View key={w.id}>
                  <View style={styles.warningItemRow}>
                    <View
                      style={[
                        styles.warningBullet,
                        {
                          backgroundColor:
                            w.severity === 'high'
                              ? '#FF4D4D'
                              : w.severity === 'medium'
                              ? '#FF944D'
                              : '#4DA6FF',
                        },
                      ]}
                    >
                      <Ionicons name={w.icon as any} size={14} color="#FFF" />
                    </View>
                    <View style={styles.warningItemText}>
                      <Text style={[styles.warningItemTitle, { color: isDark ? '#FFF' : '#1A1A1A' }]}>
                        {w.title}
                      </Text>
                      <Text style={[styles.warningItemDesc, { color: isDark ? '#AAA' : '#666' }]}>
                        {w.desc}
                      </Text>
                    </View>
                  </View>
                  {index < warnings.length - 1 && (
                    <View style={[styles.warningSeparator, { backgroundColor: isDark ? '#2E3543' : '#F0EEED' }]} />
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Routing Options List */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: isDark ? '#FFF' : '#1A1A1A', fontFamily: Fonts?.rounded }]}>
            Available Routes
          </Text>
          <View style={[styles.sortContainer, { backgroundColor: isDark ? '#1E2229' : '#EAEAEA' }]}>
            <TouchableOpacity
              onPress={() => setSortBy('speed')}
              style={[
                styles.sortButton,
                sortBy === 'speed' && { backgroundColor: isDark ? '#2E3543' : '#FFFFFF' },
              ]}
            >
              <Text
                style={[
                  styles.sortText,
                  {
                    color: isDark ? '#FFF' : '#1A1A1A',
                    fontWeight: sortBy === 'speed' ? '700' : '400',
                  },
                ]}
              >
                Speed
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSortBy('sensory')}
              style={[
                styles.sortButton,
                sortBy === 'sensory' && { backgroundColor: isDark ? '#2E3543' : '#FFFFFF' },
              ]}
            >
              <Text
                style={[
                  styles.sortText,
                  {
                    color: isDark ? '#FFF' : '#1A1A1A',
                    fontWeight: sortBy === 'sensory' ? '700' : '400',
                  },
                ]}
              >
                Sensory
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingSpinner}>
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text style={[styles.loadingText, { color: isDark ? '#AAA' : '#666' }]}>
              Calculating calmest routes...
            </Text>
          </View>
        ) : getSortedRoutes().length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="map" size={48} color={isDark ? '#333' : '#CCC'} />
            <Text style={[styles.emptyText, { color: isDark ? '#888' : '#888' }]}>
              No routes found. Please check location inputs.
            </Text>
          </View>
        ) : (
          <View style={styles.routesList}>
            {getSortedRoutes().map((route) => {
              // Get route group titles and badges
              let groupTitle = 'Suggested';
              let badgeColor = isDark ? '#2E3543' : '#F0F0EE';
              let badgeTextColor = isDark ? '#CCC' : '#666';

              if (route.type === 'best') {
                groupTitle = 'Best by preference';
                badgeColor = isDark ? '#1C3224' : '#E8F5E9';
                badgeTextColor = isDark ? '#66BB6A' : '#2E7D32';
              } else if (route.type === 'quickest') {
                groupTitle = 'Quickest';
                badgeColor = isDark ? '#351C1C' : '#FFEBEE';
                badgeTextColor = isDark ? '#EF5350' : '#C62828';
              }

              return (
                <View key={route.id} style={styles.routeGroupWrapper}>
                  <Text
                    style={[
                      styles.groupHeaderLabel,
                      { color: isDark ? '#AAA' : '#555', fontFamily: Fonts?.rounded },
                    ]}
                  >
                    {groupTitle}
                    {route.sensory_score !== undefined && (
                      <Text style={{ fontSize: 11, fontWeight: '400', color: '#999' }}>
                        {' '}
                        (Sensory Score: {route.sensory_score})
                      </Text>
                    )}
                  </Text>

                  <View
                    style={[
                      styles.routeCard,
                      {
                        backgroundColor: isDark ? '#1E2229' : '#FFFFFF',
                        borderColor: isDark ? '#2E3543' : '#EAEAEA',
                      },
                    ]}
                  >
                    {/* Header: Mode Icon + Name */}
                    <View style={styles.cardHeader}>
                      <View style={styles.transitBadgeRow}>
                        <View style={[styles.transitBadge, { backgroundColor: badgeColor }]}>
                          <Ionicons name="bus" size={16} color={badgeTextColor} />
                          <Text style={[styles.badgeText, { color: badgeTextColor }]}>
                            {route.name}
                          </Text>
                        </View>

                        {route.subName && (
                          <>
                            <Ionicons
                              name="arrow-forward"
                              size={14}
                              color={isDark ? '#666' : '#999'}
                              style={styles.arrowSpacing}
                            />
                            {route.subName.toLowerCase().includes('district') ? (
                              <View style={[styles.transitBadge, { backgroundColor: '#1B5E20' }]}>
                                <Ionicons name="subway" size={14} color="#FFF" />
                                <Text style={[styles.badgeText, { color: '#FFF' }]}>District Line</Text>
                              </View>
                            ) : route.subName.toLowerCase().includes('central') ? (
                              <View style={[styles.transitBadge, { backgroundColor: '#B71C1C' }]}>
                                <Ionicons name="subway" size={14} color="#FFF" />
                                <Text style={[styles.badgeText, { color: '#FFF' }]}>Central Line</Text>
                              </View>
                            ) : null}

                            {route.subName.toLowerCase().includes('walk') && (
                              <View
                                style={[
                                  styles.transitBadge,
                                  { backgroundColor: isDark ? '#2E3543' : '#ECEFF1' },
                                ]}
                              >
                                <Ionicons name="walk" size={14} color={isDark ? '#CCC' : '#455A64'} />
                              </View>
                            )}
                          </>
                        )}
                      </View>

                      {/* Travel Stats: Time + Cost */}
                      <View style={styles.cardStats}>
                        <Text style={[styles.cardTime, { color: isDark ? '#FFF' : '#1A1A1A' }]}>
                          {route.duration} min
                        </Text>
                        <Text style={[styles.cardCost, { color: isDark ? '#AAA' : '#666' }]}>
                          £{route.price.toFixed(2)}
                        </Text>
                      </View>
                    </View>

                    {/* Sensory Dashboard - Wrapping Grid layout for 5 distinct meters */}
                    <View style={[styles.sensoryRow, { borderTopColor: isDark ? '#2E3543' : '#F0F0EE' }]}>
                      {renderSensoryMeter(route.noise, 'Sound')}
                      {renderSensoryMeter(route.crowds, 'Crowds')}
                      {renderSensoryMeter(route.heat, 'Heat')}
                      {renderSensoryMeter(route.light, 'Light')}
                      {renderSensoryMeter(route.smell, 'Smell')}
                    </View>

                    {/* Explanation */}
                    <Text style={[styles.routeDescription, { color: isDark ? '#9BA1A6' : '#555' }]}>
                      💡 {route.description}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  headerSpacer: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 10,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    padding: 6,
    borderRadius: 50,
  },
  navTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  inputCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  usernameCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
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
  },
  dotLine: {
    width: 2,
    height: 24,
    backgroundColor: '#CCC',
    position: 'absolute',
    bottom: -22,
  },
  inputTextContainer: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  textInput: {
    fontSize: 15,
    fontWeight: '600',
    padding: 0,
  },
  inputDivider: {
    height: 1,
    marginVertical: 8,
    marginLeft: 36,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  modeSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 12,
    gap: 8,
  },
  modeCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 10,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  modeIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  modeLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  modeValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  taxiPrice: {
    fontSize: 10,
    color: '#E04F5F',
    fontWeight: '800',
    marginTop: 2,
  },
  warningContainer: {
    marginVertical: 10,
  },
  warningHeader: {
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  warningTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningHeaderText: {
    fontSize: 14,
    fontWeight: '700',
  },
  warningDropdown: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
  },
  warningItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  warningBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningItemText: {
    flex: 1,
  },
  warningItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  warningItemDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  warningSeparator: {
    height: 1,
    marginVertical: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sortContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
  },
  sortButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  sortText: {
    fontSize: 12,
  },
  routesList: {
    gap: 16,
  },
  routeGroupWrapper: {
    marginBottom: 4,
  },
  groupHeaderLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'capitalize',
    letterSpacing: -0.1,
  },
  routeCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  transitBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
    gap: 4,
  },
  transitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 5,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  arrowSpacing: {
    marginHorizontal: 2,
  },
  cardStats: {
    alignItems: 'flex-end',
  },
  cardTime: {
    fontSize: 15,
    fontWeight: '800',
  },
  cardCost: {
    fontSize: 11,
    marginTop: 2,
  },
  sensoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    paddingTop: 10,
    rowGap: 10,
    columnGap: 4,
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  meterContainer: {
    width: '30%',
    minWidth: 80,
    alignItems: 'flex-start',
  },
  meterLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  meterBlocks: {
    flexDirection: 'row',
    gap: 3,
  },
  meterBlock: {
    width: 14,
    height: 7,
    borderRadius: 2,
  },
  routeDescription: {
    fontSize: 11.5,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  loadingSpinner: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
});
