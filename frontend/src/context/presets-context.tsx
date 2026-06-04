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
  DEFAULT_PRESETS,
  EMPTY_VALUES,
  normalizePresets,
  presetValues,
  type ActiveValues,
  type SensoryKey,
} from '@/constants/presets';
import { useAuth } from '@/context/auth-context';
import { usePresetsService } from '@/services/services-context';
import type { SensitivityLevel } from '@/types/preference';
import type { Preset, PresetId } from '@/types/preset';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface PresetsContextValue {
  /** The three preset profiles, in slot order, each with its own values. */
  presets: Preset[];
  /** Which preset is currently selected/active (used for route scoring). */
  activeId: PresetId;
  /** The active preset's sensitivities (what route scoring reads). */
  values: ActiveValues;
  /** True while the initial per-user load is in flight. */
  loading: boolean;
  /** Status of the most recent backend save. */
  saveStatus: SaveStatus;
  /** Select a preset: makes it active and persists (mirrors it for route scoring). */
  selectPreset: (id: PresetId) => void;
  /** Edit one sensory dimension of a specific preset and persist. */
  setPresetValue: (id: PresetId, key: SensoryKey, level: SensitivityLevel) => void;
}

const PresetsContext = createContext<PresetsContextValue | null>(null);

export function PresetsProvider({ children }: { children: ReactNode }) {
  const { username, isLoggedIn } = useAuth();
  const presetsService = usePresetsService();

  const [presets, setPresets] = useState<Preset[]>(DEFAULT_PRESETS);
  const [activeId, setActiveId] = useState<PresetId>('p1');
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // Guards a load against a username change / unmount that happened mid-flight.
  const loadToken = useRef(0);

  // Persist the full set + active selection. The backend mirrors the active
  // preset into user_sensitivities so route scoring stays in sync.
  const persist = useCallback(
    async (nextPresets: Preset[], nextActiveId: PresetId) => {
      if (!isLoggedIn || !username) return;
      try {
        setSaveStatus('saving');
        await presetsService.savePresets({
          username,
          active_id: nextActiveId,
          presets: nextPresets,
        });
        setSaveStatus('saved');
      } catch (e) {
        console.error('Failed to save presets', e);
        setSaveStatus('error');
      }
    },
    [isLoggedIn, username, presetsService]
  );

  // Load (or seed) this user's presets whenever the signed-in user changes.
  useEffect(() => {
    const token = ++loadToken.current;

    if (!isLoggedIn || !username) {
      setPresets(DEFAULT_PRESETS);
      setActiveId('p1');
      setSaveStatus('idle');
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const data = await presetsService.getPresets('me');
        if (token !== loadToken.current) return;

        if (data) {
          setPresets(normalizePresets(data.presets));
          setActiveId(data.active_id);
        } else {
          // First run for this user: seed defaults and persist once (this also
          // seeds user_sensitivities via the active-preset mirror).
          setPresets(DEFAULT_PRESETS);
          setActiveId('p1');
          void persist(DEFAULT_PRESETS, 'p1');
        }
      } catch (e) {
        console.warn('Failed to load presets', e);
        if (token === loadToken.current) {
          setPresets(DEFAULT_PRESETS);
          setActiveId('p1');
        }
      } finally {
        if (token === loadToken.current) {
          setLoading(false);
        }
      }
    };

    void load();
  }, [isLoggedIn, username, presetsService, persist]);

  const selectPreset = useCallback(
    (id: PresetId) => {
      setActiveId(id);
      void persist(presets, id);
    },
    [presets, persist]
  );

  const setPresetValue = useCallback(
    (id: PresetId, key: SensoryKey, level: SensitivityLevel) => {
      setPresets((prev) => {
        const next = prev.map((p) => (p.id === id ? { ...p, [key]: level } : p));
        void persist(next, activeId);
        return next;
      });
    },
    [activeId, persist]
  );

  const activePreset = useMemo(
    () => presets.find((p) => p.id === activeId) ?? presets[0],
    [presets, activeId]
  );

  // Active values feed route scoring; suppress when logged out.
  const values = useMemo<ActiveValues>(
    () => (isLoggedIn ? presetValues(activePreset) : EMPTY_VALUES),
    [isLoggedIn, activePreset]
  );

  const value = useMemo<PresetsContextValue>(
    () => ({
      presets,
      activeId,
      values,
      loading,
      saveStatus,
      selectPreset,
      setPresetValue,
    }),
    [presets, activeId, values, loading, saveStatus, selectPreset, setPresetValue]
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
      presets: DEFAULT_PRESETS,
      activeId: 'p1',
      values: EMPTY_VALUES,
      loading: false,
      saveStatus: 'idle',
      selectPreset: () => {},
      setPresetValue: () => {},
    }
  );
}
