export type SensitivityLevel = 'little' | 'manageable' | 'dontcare';

export interface Preference {
  id: string;
  label: string;
  emoji: string;
  value: SensitivityLevel | null;
}

export interface PreferenceResponse {
  username: string;
  noise: SensitivityLevel | null;
  crowds: SensitivityLevel | null;
  temperature: SensitivityLevel | null;
  smell: SensitivityLevel | null;
  lights: SensitivityLevel | null;
}
