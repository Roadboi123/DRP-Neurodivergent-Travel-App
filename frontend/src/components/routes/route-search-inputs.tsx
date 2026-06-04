import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { Fonts, getPalette, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface RouteSearchInputsProps {
  startLoc: string;
  endLoc: string;
  loading: boolean;
  onStartChange: (text: string) => void;
  onEndChange: (text: string) => void;
}

export function RouteSearchInputs({
  startLoc,
  endLoc,
  loading,
  onStartChange,
  onEndChange,
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
            <Text style={[styles.fieldLabel, { color: palette.textPrimary }]}>Start Location</Text>
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
            <Text style={[styles.fieldLabel, { color: palette.textPrimary }]}>End Destination</Text>
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
    borderRadius: 14,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...hardShadow(5),
  },
  usernameCard: {
    borderRadius: 14,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...hardShadow(5),
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
});
