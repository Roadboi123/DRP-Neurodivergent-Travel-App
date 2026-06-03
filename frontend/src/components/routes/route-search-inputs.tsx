import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Fonts, getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface RouteSearchInputsProps {
  startLoc: string;
  endLoc: string;
  username: string;
  loading: boolean;
  onStartChange: (text: string) => void;
  onEndChange: (text: string) => void;
  onUsernameChange: (text: string) => void;
}

export function RouteSearchInputs({
  startLoc,
  endLoc,
  username,
  loading,
  onStartChange,
  onEndChange,
  onUsernameChange,
}: RouteSearchInputsProps) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const placeholderColor = isDark ? '#555' : '#999';

  return (
    <View style={styles.headerSpacer}>
      {/* Input Fields Card */}
      <View
        style={[
          styles.inputCard,
          { backgroundColor: palette.surface, borderColor: palette.borderStrong },
        ]}>
        {/* Start Location Input */}
        <View style={styles.inputRow}>
          <View style={styles.inputIconContainer}>
            <View style={[styles.dotCircle, { backgroundColor: '#4A90E2' }]} />
            <View style={styles.dotLine} />
          </View>
          <View style={styles.inputTextContainer}>
            <Text style={styles.fieldLabel}>Start Location</Text>
            <TextInput
              style={[styles.textInput, { color: palette.textPrimary }]}
              value={startLoc}
              onChangeText={onStartChange}
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
            <Ionicons name="location" size={20} color="#E04F5F" />
          </View>
          <View style={styles.inputTextContainer}>
            <Text style={styles.fieldLabel}>End Destination</Text>
            <TextInput
              style={[styles.textInput, { color: palette.textPrimary }]}
              value={endLoc}
              onChangeText={onEndChange}
              placeholder="Enter destination..."
              placeholderTextColor={placeholderColor}
              clearButtonMode="while-editing"
            />
          </View>
        </View>
      </View>

      {/* Username Sensitivities Card */}
      <View
        style={[
          styles.usernameCard,
          { backgroundColor: palette.surface, borderColor: palette.borderStrong, marginTop: 10 },
        ]}>
        <View style={styles.inputRow}>
          <View style={styles.inputIconContainer}>
            <Ionicons name="person-circle-outline" size={22} color="#1D9E75" />
          </View>
          <View style={styles.inputTextContainer}>
            <Text style={styles.fieldLabel}>Apply Username Sensitivities</Text>
            <TextInput
              style={[styles.textInput, { color: palette.textPrimary }]}
              value={username}
              onChangeText={onUsernameChange}
              placeholder="Enter username (e.g. calm_traveler)..."
              placeholderTextColor={placeholderColor}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {username.trim().length > 0 && !loading && (
            <Ionicons
              name="checkmark-circle"
              size={20}
              color="#1D9E75"
              style={{ marginLeft: 6 }}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
