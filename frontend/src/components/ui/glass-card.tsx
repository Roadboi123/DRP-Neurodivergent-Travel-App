import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Glass, type GlassProps } from '@/components/ui/glass';

export interface GlassCardProps extends Omit<GlassProps, 'children'> {
  children?: ReactNode;
  /** Inner padding (default 18). */
  padding?: number;
  /** Style applied to the inner content View (not the glass surface). */
  contentStyle?: StyleProp<ViewStyle>;
}

/** A frosted-glass card: the Clearway surface for grouped content. */
export function GlassCard({ children, padding = 18, contentStyle, ...glass }: GlassCardProps) {
  return (
    <Glass {...glass}>
      <View style={[{ padding }, contentStyle]}>{children}</View>
    </Glass>
  );
}
