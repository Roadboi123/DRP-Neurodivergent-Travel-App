import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Fonts } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { API_BASE_URL } from '@/constants/api';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const [backendState, setBackendState] = useState<'Online' | 'Offline' | 'Checking'>('Checking');

  // Hydration mismatch fix
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function checkBackend() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/health`
        );
        const data = await response.json();
        if (data.status === 'ok') {
          setBackendState('Online');
        } else {
          setBackendState('Offline');
        }
      } catch (error) {
        console.warn('Backend checking failed, falling back to offline state:', error);
        setBackendState('Offline');
      }
    }
    checkBackend();
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? '#121517' : '#FAF9F6' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.greetingText, { color: isDark ? '#AAA' : '#666' }]}>
              Hello, Traveler 🥀
            </Text>
            <Text style={[styles.title, { color: isDark ? '#FFF' : '#1A1A1A', fontFamily: Fonts?.rounded }]}>
              My Planner
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: backendState === 'Online' ? '#E8F5E9' : '#FFEBEE' }]}>
            <View style={[styles.statusDot, { backgroundColor: backendState === 'Online' ? '#4CAF50' : '#F44336' }]} />
            <Text style={[styles.statusText, { color: backendState === 'Online' ? '#2E7D32' : '#C62828' }]}>
              API: {backendState}
            </Text>
          </View>
        </View>

        {/* Welcome Banner Card */}
        <View style={[styles.bannerCard, { backgroundColor: isDark ? '#1E2229' : '#FFFFFF', borderColor: isDark ? '#2E3543' : '#EAEAEA' }]}>
          <Text style={[styles.bannerTitle, { color: isDark ? '#FFF' : '#1A1A1A' }]}>
            Your Sensory Safe Space
          </Text>
          <Text style={[styles.bannerDesc, { color: isDark ? '#AAA' : '#666' }]}>
            {"Let's find quieter, cooler, and less crowded routes tailored precisely to your sensory profile."}
          </Text>
        </View>

        {/* Quick Actions Grid */}
        <Text style={[styles.sectionTitle, { color: isDark ? '#FFF' : '#1A1A1A', fontFamily: Fonts?.rounded }]}>
          Quick Actions
        </Text>
        <View style={styles.gridRow}>
          <TouchableOpacity
            onPress={() => router.push('/routes')}
            style={[styles.gridCard, { backgroundColor: isDark ? '#1E2229' : '#FFFFFF', borderColor: isDark ? '#2E3543' : '#EAEAEA' }]}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="navigate" size={24} color="#1E88E5" />
            </View>
            <Text style={[styles.cardTitleText, { color: isDark ? '#FFF' : '#1A1A1A' }]}>Plan Calm Route</Text>
            <Text style={[styles.cardDescText, { color: isDark ? '#AAA' : '#888' }]}>Find sensory friendly paths</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/preferences')}
            style={[styles.gridCard, { backgroundColor: isDark ? '#1E2229' : '#FFFFFF', borderColor: isDark ? '#2E3543' : '#EAEAEA' }]}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="settings-sharp" size={24} color="#4CAF50" />
            </View>
            <Text style={[styles.cardTitleText, { color: isDark ? '#FFF' : '#1A1A1A' }]}>Sensory Sensitivities</Text>
            <Text style={[styles.cardDescText, { color: isDark ? '#AAA' : '#888' }]}>Update comfort thresholds</Text>
          </TouchableOpacity>
        </View>

        {/* Daily Travel Tips */}
        <Text style={[styles.sectionTitle, { color: isDark ? '#FFF' : '#1A1A1A', fontFamily: Fonts?.rounded }]}>
          Daily Travel Tips
        </Text>
        <View style={[styles.tipsContainer, { backgroundColor: isDark ? '#1E2229' : '#FFFFFF', borderColor: isDark ? '#2E3543' : '#EAEAEA' }]}>
          <View style={styles.tipRow}>
            <Ionicons name="sunny" size={20} color="#FF9800" />
            <Text style={[styles.tipText, { color: isDark ? '#FFF' : '#333' }]}>
              Central Line temperature is deep and elevated at 32°C. Taking the District Line is recommended.
            </Text>
          </View>
          <View style={[styles.tipDivider, { backgroundColor: isDark ? '#2E3543' : '#F0F0EE' }]} />
          <View style={styles.tipRow}>
            <Ionicons name="volume-high" size={20} color="#4A90E2" />
            <Text style={[styles.tipText, { color: isDark ? '#FFF' : '#333' }]}>
              Active drilling near Gloucester Road entrance. Scent/sound isolation headphones advised.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greetingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  bannerCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  bannerDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
  gridCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  cardTitleText: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardDescText: {
    fontSize: 11,
    lineHeight: 14,
  },
  tipsContainer: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
  },
  tipRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  tipText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
  },
  tipDivider: {
    height: 1,
  },
});