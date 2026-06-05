import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Fonts, getAccents, getPalette, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

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
            <View style={[styles.dotCircle, { backgroundColor: accents.green, borderColor: palette.border }]} />
            <View style={[styles.dotLine, { backgroundColor: palette.divider }]} />
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
            <Ionicons name="location" size={20} color={accents.pink} />
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
    // Reserve room on the right so input text never runs under the swap button.
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
});
