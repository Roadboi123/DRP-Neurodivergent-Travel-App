import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { getPalette, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { WarningItem } from '@/types/route';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface DailyTipsProps {
  warnings?: WarningItem[];
}

export function DailyTips({ warnings = [] }: DailyTipsProps) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const tipColor = palette.textPrimary;

  // Filter out any info-only warning cards if they are just generic promos (like anonymous login suggestions)
  const activeAlerts = warnings.filter(w => w.id !== 'w_anon_info');

  const renderTips = () => {
    if (activeAlerts.length > 0) {
      return activeAlerts.map((w, index) => {
        // Map warning icon name to valid IoniconName
        let iconName: IoniconName = 'alert-circle';
        let iconColor = '#FF9800'; // Default orange
        
        if (w.icon === 'thermometer') {
          iconName = 'thermometer';
          iconColor = w.severity === 'high' ? '#F44336' : '#FF9800';
        } else if (w.icon === 'alert-circle') {
          iconName = 'alert-circle';
          iconColor = w.severity === 'high' ? '#F44336' : '#FF9800';
        } else if (w.icon === 'sunny') {
          iconName = 'sunny';
          iconColor = '#FF9800';
        } else if (w.icon === 'leaf') {
          iconName = 'leaf';
          iconColor = '#4CAF50';
        } else if (w.icon === 'volume-high') {
          iconName = 'volume-high';
          iconColor = '#4A90E2';
        }

        return (
          <View key={w.id}>
            <View style={styles.tipRow}>
              <Ionicons name={iconName} size={20} color={iconColor} />
              <Text style={[styles.tipText, { color: tipColor }]}>
                <Text style={{ fontWeight: 'bold' }}>{w.title}: </Text>
                {w.desc}
              </Text>
            </View>
            {index < activeAlerts.length - 1 && (
              <View style={[styles.tipDivider, { backgroundColor: palette.divider }]} />
            )}
          </View>
        );
      });
    }

    // Default pleasant tips when no warnings exist
    return (
      <View style={{ gap: 12 }}>
        <View style={styles.tipRow}>
          <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
          <Text style={[styles.tipText, { color: tipColor }]}>
            Good service reported across all tube and rail lines today. Have a peaceful travel!
          </Text>
        </View>
        <View style={[styles.tipDivider, { backgroundColor: palette.divider }]} />
        <View style={styles.tipRow}>
          <Ionicons name="leaf" size={20} color="#4CAF50" />
          <Text style={[styles.tipText, { color: tipColor }]}>
            Weather is pleasant in London. Quiet walking routes are highly recommended.
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.tipsContainer, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      {renderTips()}
    </View>
  );
}

const styles = StyleSheet.create({
  tipsContainer: {
    borderRadius: 14,
    borderWidth: 2,
    padding: 16,
    gap: 12,
    ...hardShadow(5),
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
    marginVertical: 4,
  },
});
