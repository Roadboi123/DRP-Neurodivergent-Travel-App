// Sensory intensity on a route: 1 = Low (Green), 2 = Med (Orange), 3 = High (Red).
export type SensoryLevel = 1 | 2 | 3;

export type RouteType = 'best' | 'quickest' | 'suggested';

export interface RouteOption {
  id: string;
  type: RouteType;
  name: string;
  subName?: string | null;
  details?: string;
  duration: number; // in minutes
  price: number; // in GBP
  noise: SensoryLevel; // Mapped to Sound in UI
  crowds: SensoryLevel;
  heat: SensoryLevel;
  light: SensoryLevel;
  smell: SensoryLevel;
  sensory_score?: number; // Calculated by backend
  match_percentage?: number;
  sensory_description?: string;
  description: string;
}

export interface WarningItem {
  id: string;
  title: string;
  desc: string;
  severity: 'high' | 'medium' | 'info';
  icon: string;
}
