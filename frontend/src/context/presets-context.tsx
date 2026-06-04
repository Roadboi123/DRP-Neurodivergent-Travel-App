import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  EMPTY_VALUES,
  getPreset,
  matchPresetId,
  PRESETS,
  SENSORY_KEYS,
  type ActiveValues,
  type Preset,
  type PresetId,
  type SensoryKey,
} from '@/constants/presets';
import { useAuth } from '@/context/auth-context';
import { usePreferencesService } from '@/services/services-context';
import type { SensitivityLevel } from '@/types/preference';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface PersistedState {
  activeId: PresetId | null;
  values: ActiveValues;
}

interface PresetsContextValue {
  /** The built-in presets, in display order. */
  presets: Preset[];
  /** Which preset the current sensitivities match, or `null` for a custom mix. */
  activeId: PresetId | null;
  /** The current working sensitivities (what gets saved to the backend). */
  values: ActiveValues;
  /** True while the initial per-user load is in flight. */
  loading: boolean;
  /** Status of the most recent backend save. */
  saveStatus: SaveStatus;
  /** Switch to a preset: loads its values and persists them (local + backend). */
  applyPreset: (id: PresetId) => void;
  /** Edit a single sensory dimension; recomputes the active preset / custom state. */
  setValue: (key: SensoryKey, level: SensitivityLevel) => void;
}

const PresetsContext = createContext<PresetsContextValue | null>(null);

const storageKey = (username: string) => `@presets:${username}`;

const allSet = (values: ActiveValues): boolean =>
  SENSORY_KEYS.every((k) => values[k] !== null);

export function PresetsProvider({ children }: { children: ReactNode }) {
  const { username, isLoggedIn } = useAuth();
  const preferencesService = usePreferencesService();

  const [values, setValues] = useState<ActiveValues>(EMPTY_VALUES);
  const [activeId, setActiveId] = useState<PresetId | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // Guards a load against a username change / unmount that happened mid-flight.
  const loadToken = useRef(0);

  // Load (or migrate) this user's presets whenever the signed-in user changes.
  useEffect(() => {
    const token = ++loadToken.current;

    if (!isLoggedIn || !username) {
      setValues(EMPTY_VALUES);
      setActiveId(null);
      setSaveStatus('idle');
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const raw = await AsyncStorage.getItem(storageKey(username));
        if (token !== loadToken.current) return;

        if (raw) {
          const parsed = JSON.parse(raw) as PersistedState;
          const restored: ActiveValues = { ...EMPTY_VALUES, ...parsed.values };
          setValues(restored);
          setActiveId(matchPresetId(restored));
          return;
        }

        // First run for this user: seed from any preferences they saved before
        // presets existed, so the screen and route scoring stay consistent.
        const existing = await preferencesService.getPreferences('me');
        if (token !== loadToken.current) return;

        if (existing) {
          const migrated: ActiveValues = {
            noise: existing.noise ?? null,
            crowds: existing.crowds ?? null,
            temperature: existing.temperature ?? null,
            smell: existing.smell ?? null,
            lights: existing.lights ?? null,
          };
          setValues(migrated);
          setActiveId(matchPresetId(migrated));
        } else {
          setValues(EMPTY_VALUES);
          setActiveId(null);
        }
      } catch (e) {
        console.warn('Failed to load presets', e);
        if (token === loadToken.current) {
          setValues(EMPTY_VALUES);
          setActiveId(null);
        }
      } finally {
        if (token === loadToken.current) {
          setLoading(false);
        }
      }
    };

    void load();
  }, [isLoggedIn, username, preferencesService]);

  const persistLocal = useCallback(
    (next: PersistedState) => {
      if (!username) return;
      AsyncStorage.setItem(storageKey(username), JSON.stringify(next)).catch(() => {
        // Persistence is best-effort; the in-memory choice still applies.
      });
    },
    [username]
  );

  // Push a complete set of sensitivities to the backend so route scoring updates.
  const saveToBackend = useCallback(
    async (next: ActiveValues) => {
      if (!isLoggedIn || !username || !allSet(next)) return;
      try {
        setSaveStatus('saving');
        await preferencesService.savePreferences({
          username,
          noise: next.noise,
          crowds: next.crowds,
          temperature: next.temperature,
          smell: next.smell,
          lights: next.lights,
        });
        setSaveStatus('saved');
      } catch (e) {
        console.error('Failed to save preferences', e);
        setSaveStatus('error');
      }
    },
    [isLoggedIn, username, preferencesService]
  );

  const applyPreset = useCallback(
    (id: PresetId) => {
      const next = { ...getPreset(id).values };
      setValues(next);
      setActiveId(id);
      persistLocal({ activeId: id, values: next });
      void saveToBackend(next);
    },
    [persistLocal, saveToBackend]
  );

  const setValue = useCallback(
    (key: SensoryKey, level: SensitivityLevel) => {
      setValues((prev) => {
        const next = { ...prev, [key]: level };
        const matched = matchPresetId(next);
        setActiveId(matched);
        persistLocal({ activeId: matched, values: next });
        void saveToBackend(next);
        return next;
      });
    },
    [persistLocal, saveToBackend]
  );

  const value = useMemo<PresetsContextValue>(
    () => ({
      presets: PRESETS,
      activeId,
      values,
      loading,
      saveStatus,
      applyPreset,
      setValue,
    }),
    [activeId, values, loading, saveStatus, applyPreset, setValue]
  );

  return <PresetsContext.Provider value={value}>{children}</PresetsContext.Provider>;
}

/**
 * Read the presets state. Returns an inert default outside a provider so isolated
 * renders (tests/storybook) don't crash.
 */
export function usePresets(): PresetsContextValue {
  return (
    useContext(PresetsContext) ?? {
      presets: PRESETS,
      activeId: null,
      values: EMPTY_VALUES,
      loading: false,
      saveStatus: 'idle',
      applyPreset: () => {},
      setValue: () => {},
    }
  );
}
