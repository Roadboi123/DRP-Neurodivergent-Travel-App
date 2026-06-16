import React, { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ViewStyle,
  type TextStyle,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

import { useAuth } from '@/context/auth-context';
import { CLEARWAY, Fonts, GLASS, getPalette, Radii, softShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_BASE_URL, LOCAL_API_BASE_URL } from '@/constants/config';

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

type AuthMode = 'login' | 'register' | 'profile';

async function authFetch(path: string, options: RequestInit): Promise<Response> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, options);
    // If the server returns a 5xx error or client fetch fails, try the local fallback
    if (res.status >= 500) {
      throw new Error('Server error');
    }
    return res;
  } catch (e) {
    console.warn('Primary auth endpoint unreachable. Attempting fallback...', e);
    return fetch(`${LOCAL_API_BASE_URL}${path}`, options);
  }
}

export function ProfileModal({ visible, onClose }: ProfileModalProps) {
  const { username, isLoggedIn, login, logout } = useAuth();
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);

  const [mode, setMode] = useState<AuthMode>(isLoggedIn ? 'profile' : 'login');
  const [inputName, setInputName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Reset forms when modal closes or mode shifts
  const resetForm = () => {
    setInputName('');
    setPassword('');
    setConfirmPassword('');
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleLogin = async () => {
    const user = inputName.trim();
    const pass = password.trim();

    if (!user || !pass) {
      setErrorMsg('Please enter both username and password');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    
    try {
      const res = await authFetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.detail || 'Incorrect username or password');
        return;
      }

      login(data.username, data.access_token);
      setMode('profile');
      handleClose();
    } catch (e) {
      setErrorMsg('Connection failed. Please check if the server is running.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    const user = inputName.trim();
    const pass = password.trim();
    const confirm = confirmPassword.trim();

    if (!user || !pass || !confirm) {
      setErrorMsg('All fields are required');
      return;
    }

    if (user.length < 3) {
      setErrorMsg('Username must be at least 3 characters');
      return;
    }

    if (pass.length < 6) {
      setErrorMsg('Password must be at least 6 characters');
      return;
    }

    if (pass !== confirm) {
      setErrorMsg('Passwords do not match');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await authFetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.detail || 'Registration failed');
        return;
      }

      setSuccessMsg('Account registered successfully! Logging you in...');
      
      // Auto login
      const loginRes = await authFetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass }),
      });
      const loginData = await loginRes.json();
      
      if (loginRes.ok) {
        login(loginData.username, loginData.access_token);
        setMode('profile');
        setTimeout(handleClose, 1000);
      } else {
        setMode('login');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (e) {
      setErrorMsg('Connection failed. Please check if the server is running.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    const clean = name.trim().replace(/[^a-zA-Z0-9]/g, '');
    if (!clean) return 'U';
    return clean.slice(0, 2).toUpperCase();
  };

  // Sync mode with global state changes
  React.useEffect(() => {
    if (visible) {
      setMode(isLoggedIn ? 'profile' : 'login');
      resetForm();
    }
  }, [visible, isLoggedIn]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.sheet, { backgroundColor: GLASS.light.fill, borderColor: GLASS.light.border }]}
            // Tapping the sheet (outside an input) dismisses the keyboard on
            // native; stopPropagation keeps the backdrop from closing the modal.
            // On web the press bubbles up from the inputs, so calling
            // Keyboard.dismiss() here would blur the field the user just clicked —
            // and there's no soft keyboard to dismiss anyway, so skip it.
            onPress={(e) => {
              e.stopPropagation();
              if (Platform.OS !== 'web') {
                Keyboard.dismiss();
              }
            }}
          >
            <BlurView intensity={GLASS.light.blur} tint="light" style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.textPrimary }]}>
              {mode === 'profile' ? 'Your Profile' : mode === 'login' ? 'Sign In' : 'Register Account'}
            </Text>

            <TouchableOpacity onPress={handleClose} hitSlop={10} accessibilityLabel="Close window">
              <Ionicons name="close" size={24} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {mode === 'profile' && isLoggedIn ? (
              <View style={styles.loggedInContainer}>
                {/* Avatar */}
                <View style={styles.avatarContainer}>
                  <View style={[styles.avatarCircle, { backgroundColor: CLEARWAY.blue }]}>
                    <Text style={styles.avatarInitials}>{getInitials(username)}</Text>
                  </View>
                  <View style={styles.activeDot} />
                </View>

                {/* Info */}
                <Text style={[styles.usernameText, { color: palette.textPrimary }]}>
                  @{username}
                </Text>
                <Text style={[styles.infoText, { color: palette.textSecondary }]}>
                  Your personalized sensory preferences are active. Route suggestions and sensitivities will automatically load for your profile.
                </Text>

                <View style={styles.actionsDivider} />

                {/* Actions */}
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.switchBtn, { borderColor: palette.border }]}
                    onPress={() => {
                      setMode('login');
                      resetForm();
                    }}
                  >
                    <Ionicons name="swap-horizontal" size={16} color={palette.textPrimary} />
                    <Text style={[styles.actionBtnText, { color: palette.textPrimary }]}>Switch User</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.logoutBtn]}
                    onPress={() => {
                      logout();
                      handleClose();
                    }}
                  >
                    <Ionicons name="log-out-outline" size={16} color="#FF4D4D" />
                    <Text style={[styles.actionBtnText, { color: '#FF4D4D' }]}>Sign Out</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.loginFormContainer}>
                {errorMsg ? (
                  <View style={[styles.alertCard, styles.alertError, { backgroundColor: 'rgba(207,107,91,0.12)' }]}>
                    <Ionicons name="alert-circle" size={18} color={CLEARWAY.bad} />
                    <Text style={[styles.alertText, { color: '#a8392c' }]}>{errorMsg}</Text>
                  </View>
                ) : null}

                {successMsg ? (
                  <View style={[styles.alertCard, styles.alertSuccess, { backgroundColor: 'rgba(91,157,107,0.14)' }]}>
                    <Ionicons name="checkmark-circle" size={18} color={CLEARWAY.good} />
                    <Text style={[styles.alertText, { color: '#3c7a4e' }]}>{successMsg}</Text>
                  </View>
                ) : null}

                {/* Inputs */}
                <View style={styles.inputBlock}>
                  <Text style={[styles.inputLabel, { color: palette.textPrimary }]}>Username</Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: 'rgba(255,255,255,0.5)',
                        borderColor: palette.border,
                        color: palette.textPrimary,
                      },
                    ]}
                    value={inputName}
                    onChangeText={setInputName}
                    placeholder="Enter your username"
                    placeholderTextColor={palette.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputBlock}>
                  <Text style={[styles.inputLabel, { color: palette.textPrimary }]}>Password</Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: 'rgba(255,255,255,0.5)',
                        borderColor: palette.border,
                        color: palette.textPrimary,
                      },
                    ]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    placeholderTextColor={palette.textMuted}
                    secureTextEntry={true}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                {mode === 'register' && (
                  <View style={styles.inputBlock}>
                    <Text style={[styles.inputLabel, { color: palette.textPrimary }]}>Confirm Password</Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: isDark ? '#2E3543' : '#F0F0EE',
                          borderColor: palette.border,
                          color: palette.textPrimary,
                        },
                      ]}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm your password"
                      placeholderTextColor={palette.textMuted}
                      secureTextEntry={true}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                )}

                <View style={styles.submitRow}>
                  {loading ? (
                    <ActivityIndicator size="small" color={CLEARWAY.blue} style={styles.spinner} />
                  ) : (
                    <TouchableOpacity
                      style={[styles.submitBtn, { backgroundColor: CLEARWAY.blue }]}
                      onPress={mode === 'login' ? handleLogin : handleRegister}
                    >
                      <Text style={styles.submitBtnText}>
                        {mode === 'login' ? 'Sign In' : 'Register Account'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Toggle Links */}
                <View style={styles.toggleRow}>
                  {mode === 'login' ? (
                    <View style={styles.toggleTextContainer}>
                      <Text style={[styles.toggleLabel, { color: palette.textSecondary }]}>
                        {"Don't have an account? "}
                      </Text>
                      <TouchableOpacity onPress={() => { setMode('register'); setErrorMsg(''); }}>
                        <Text style={[styles.toggleLink, { color: CLEARWAY.blueStrong }]}>Sign Up</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.toggleTextContainer}>
                      <Text style={[styles.toggleLabel, { color: palette.textSecondary }]}>
                        Already have an account?{' '}
                      </Text>
                      <TouchableOpacity onPress={() => { setMode('login'); setErrorMsg(''); }}>
                        <Text style={[styles.toggleLink, { color: CLEARWAY.blueStrong }]}>Sign In</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
          </TouchableOpacity>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  } as ViewStyle,
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  } as ViewStyle,
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: Radii.cardLg,
    borderTopRightRadius: Radii.cardLg,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 32,
    borderWidth: 1,
    overflow: 'hidden',
    ...softShadow(3),
  } as ViewStyle,
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#9993',
    marginBottom: 12,
  } as ViewStyle,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  } as ViewStyle,
  title: {
    fontSize: 22,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    letterSpacing: -0.5,
  } as TextStyle,
  scrollContent: {
    paddingVertical: 12,
  } as ViewStyle,
  loggedInContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  } as ViewStyle,
  avatarContainer: {
    position: 'relative',
    marginBottom: 14,
  } as ViewStyle,
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  } as ViewStyle,
  avatarInitials: {
    color: '#FFF',
    fontSize: 26,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    letterSpacing: -0.5,
  } as TextStyle,
  activeDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: CLEARWAY.good,
    borderWidth: 2,
    borderColor: '#FFF',
  } as ViewStyle,
  usernameText: {
    fontSize: 22,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 8,
  } as TextStyle,
  infoText: {
    fontSize: 13,
    fontFamily: Fonts?.body,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
    marginBottom: 20,
  } as TextStyle,
  actionsDivider: {
    height: 1,
    backgroundColor: '#9992',
    width: '100%',
    marginVertical: 16,
  } as ViewStyle,
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  } as ViewStyle,
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: Radii.pill,
    gap: 6,
    borderWidth: 1,
  } as ViewStyle,
  switchBtn: {
    backgroundColor: 'transparent',
  } as ViewStyle,
  logoutBtn: {
    backgroundColor: 'rgba(255, 77, 77, 0.08)',
    borderColor: 'transparent',
  } as ViewStyle,
  actionBtnText: {
    fontSize: 13,
    fontFamily: Fonts?.semibold,
    fontWeight: '700',
  } as TextStyle,
  loginFormContainer: {
    gap: 16,
  } as ViewStyle,
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
  } as ViewStyle,
  alertError: {
    borderColor: 'rgba(255, 77, 77, 0.2)',
  } as ViewStyle,
  alertSuccess: {
    borderColor: 'rgba(46, 125, 50, 0.2)',
  } as ViewStyle,
  alertText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: Fonts?.body,
    fontWeight: '600',
    lineHeight: 16,
  } as TextStyle,
  inputBlock: {
    gap: 6,
    marginBottom: 12,
  } as ViewStyle,
  inputLabel: {
    fontSize: 13,
    fontFamily: Fonts?.semibold,
    fontWeight: '700',
  } as TextStyle,
  textInput: {
    height: 50,
    borderRadius: Radii.input,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: Fonts?.body,
    fontWeight: '600',
  } as TextStyle,
  submitRow: {
    marginTop: 10,
    alignItems: 'center',
  } as ViewStyle,
  submitBtn: {
    width: '100%',
    height: 52,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...softShadow(1),
  } as ViewStyle,
  submitBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: Fonts?.semibold,
    fontWeight: '700',
    letterSpacing: 0.2,
  } as TextStyle,
  spinner: {
    paddingVertical: 14,
  } as ViewStyle,
  toggleRow: {
    marginTop: 8,
    alignItems: 'center',
  } as ViewStyle,
  toggleTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  toggleLabel: {
    fontSize: 13,
    fontWeight: '600',
  } as TextStyle,
  toggleLink: {
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  } as TextStyle,
});
