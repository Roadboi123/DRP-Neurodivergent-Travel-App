import React, { useState } from 'react';
import {
  Modal,
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

import { useAuth } from '@/context/auth-context';
import { Fonts, getPalette } from '@/constants/theme';
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
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.sheet, { backgroundColor: palette.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.textPrimary, fontFamily: Fonts?.rounded }]}>
              {mode === 'profile' ? 'Your Profile' : mode === 'login' ? 'Sign In' : 'Register Account'}
            </Text>

            <TouchableOpacity onPress={handleClose} hitSlop={10} accessibilityLabel="Close window">
              <Ionicons name="close" size={24} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {mode === 'profile' && isLoggedIn ? (
              <View style={styles.loggedInContainer}>
                {/* Avatar */}
                <View style={styles.avatarContainer}>
                  <View style={[styles.avatarCircle, { backgroundColor: '#E91E63' }]}>
                    <Text style={styles.avatarInitials}>{getInitials(username)}</Text>
                  </View>
                  <View style={styles.activeDot} />
                </View>

                {/* Info */}
                <Text style={[styles.usernameText, { color: palette.textPrimary, fontFamily: Fonts?.rounded }]}>
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
                  <View style={[styles.alertCard, styles.alertError, { backgroundColor: isDark ? '#3D1F1C' : '#FDF2F2' }]}>
                    <Ionicons name="alert-circle" size={18} color="#FF4D4D" />
                    <Text style={[styles.alertText, { color: '#FF4D4D' }]}>{errorMsg}</Text>
                  </View>
                ) : null}

                {successMsg ? (
                  <View style={[styles.alertCard, styles.alertSuccess, { backgroundColor: isDark ? '#1C3224' : '#E8F5E9' }]}>
                    <Ionicons name="checkmark-circle" size={18} color="#2E7D32" />
                    <Text style={[styles.alertText, { color: isDark ? '#81C784' : '#2E7D32' }]}>{successMsg}</Text>
                  </View>
                ) : null}

                {/* Inputs */}
                <View style={styles.inputBlock}>
                  <Text style={[styles.inputLabel, { color: palette.textPrimary }]}>Username</Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: isDark ? '#2E3543' : '#F0F0EE',
                        borderColor: palette.border,
                        color: palette.textPrimary,
                      },
                    ]}
                    value={inputName}
                    onChangeText={setInputName}
                    placeholder="Enter your username"
                    placeholderTextColor={isDark ? '#777' : '#999'}
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
                        backgroundColor: isDark ? '#2E3543' : '#F0F0EE',
                        borderColor: palette.border,
                        color: palette.textPrimary,
                      },
                    ]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    placeholderTextColor={isDark ? '#777' : '#999'}
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
                      placeholderTextColor={isDark ? '#777' : '#999'}
                      secureTextEntry={true}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                )}

                <View style={styles.submitRow}>
                  {loading ? (
                    <ActivityIndicator size="small" color="#E91E63" style={styles.spinner} />
                  ) : (
                    <TouchableOpacity
                      style={[styles.submitBtn, { backgroundColor: '#E91E63' }]}
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
                        <Text style={[styles.toggleLink, { color: '#E91E63' }]}>Sign Up</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.toggleTextContainer}>
                      <Text style={[styles.toggleLabel, { color: palette.textSecondary }]}>
                        Already have an account?{' '}
                      </Text>
                      <TouchableOpacity onPress={() => { setMode('login'); setErrorMsg(''); }}>
                        <Text style={[styles.toggleLink, { color: '#E91E63' }]}>Sign In</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </TouchableOpacity>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  } as ViewStyle,
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 32,
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
    fontSize: 20,
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
    backgroundColor: '#2E7D32',
    borderWidth: 2,
    borderColor: '#FFF',
  } as ViewStyle,
  usernameText: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  } as TextStyle,
  infoText: {
    fontSize: 13,
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
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1.5,
  } as ViewStyle,
  switchBtn: {
    backgroundColor: 'transparent',
  } as ViewStyle,
  logoutBtn: {
    backgroundColor: 'rgba(255, 77, 77, 0.08)',
    borderColor: 'transparent',
  } as ViewStyle,
  actionBtnText: {
    fontSize: 12,
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
    fontWeight: '600',
    lineHeight: 16,
  } as TextStyle,
  inputBlock: {
    gap: 6,
    marginBottom: 12,
  } as ViewStyle,
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
  } as TextStyle,
  textInput: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '600',
  } as TextStyle,
  submitRow: {
    marginTop: 10,
    alignItems: 'center',
  } as ViewStyle,
  submitBtn: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  } as ViewStyle,
  submitBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
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
