import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { isDevMode, isSupabaseConfigured, supabase } from '../lib/supabase';
import { applyAccessibilityToDom, applyGlassVisibilityToDom, applyWallpaperToDom, getCookie, loadAccessibilityPrefs, loadGlassVisibility, loadLocalWallpaper, setCookie, ThemeMode } from '../lib/localPrefs';
import { Profile, UserRole } from '../types/erp';

interface AuthContextValue {
  profile: Profile | null;
  loading: boolean;
  theme: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  signIn: (email: string, password: string, expectedRole?: UserRole) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  recovering: boolean;
  requestPasswordReset: (email: string) => Promise<void>;
  verifyRecoveryOtpAndReset: (identifier: string, otpCode: string, newPassword: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  switchDemoRole: (role: UserRole) => void;
}

const DEMO_PROFILES: Record<UserRole, Profile> = {
  admin: { id: 'demo-admin', full_name: 'College Admin', email: 'admin@college.edu', mobile: null, role: 'admin', status: 'approved', department_id: null },
  hod: { id: 'demo-hod', full_name: 'Prof. Rajesh Verma (HOD - CS)', email: 'hod.cs@college.edu', mobile: null, role: 'hod', status: 'approved', department_id: 'dept-cs' },
  faculty: { id: 'demo-faculty', full_name: 'Dr. Ananya Rao (Faculty)', email: 'ananya.rao@college.edu', mobile: null, role: 'faculty', status: 'approved', department_id: 'dept-cs' },
  student: { id: 'demo-student', full_name: 'Aarav Sharma (Roll 101)', email: 'aarav.101@college.edu', mobile: null, role: 'student', status: 'approved', department_id: 'dept-cs' },
  exam_controller: { id: 'demo-exam', full_name: 'Dr. Vikram Nair (Controller of Examinations)', email: 'coe@college.edu', mobile: null, role: 'exam_controller', status: 'approved', department_id: null },
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = (localStorage.getItem('erp-theme') || getCookie('erp_theme')) as ThemeMode;
    return ['light', 'dark', 'glass-dark'].includes(saved) ? saved : (saved === ('glass-light' as any) ? 'glass-dark' : 'light');
  });
  const checkingRoleRef = useRef(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('erp-theme', theme);
    setCookie('erp_theme', theme, 60);
  }, [theme]);

  useEffect(() => {
    applyWallpaperToDom(loadLocalWallpaper());
    applyGlassVisibilityToDom(loadGlassVisibility());
    applyAccessibilityToDom(loadAccessibilityPrefs());
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Keep the same object identity when nothing changed, so pages that depend on `profile`
    // do not refetch (or reset forms) on every auth event such as a tab refocus.
    const applyProfile = (next: Profile | null) =>
      setProfile((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));

    const loadProfile = async (userId: string) => {
      if (checkingRoleRef.current) return;
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (error) {
        console.error('Failed to load profile', error);
        return; // keep the current profile on transient errors instead of logging the user out
      }
      if (!checkingRoleRef.current) {
        applyProfile((data as Profile | null) || null);
      }
    };

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error || !session?.user) {
        applyProfile(null);
      } else {
        await loadProfile(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
      if (!session?.user) {
        applyProfile(null);
        return;
      }
      if (checkingRoleRef.current) return;
      // Do not await Supabase calls inside this callback (can deadlock the auth client).
      const uid = session.user.id;
      setTimeout(() => { void loadProfile(uid); }, 0);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string, expectedRole?: UserRole) => {
    if (!isSupabaseConfigured) {
      if (!isDevMode) throw new Error('Supabase is not configured. Contact your system administrator.');
      const matched = Object.values(DEMO_PROFILES).find((p) => p.email === email) || DEMO_PROFILES[expectedRole || 'faculty'];
      if (expectedRole && matched.role !== expectedRole) {
        throw new Error(`Access denied: This account is registered as ${matched.role.toUpperCase()}, not ${expectedRole.toUpperCase()}. Please use the ${matched.role.toUpperCase()} login portal.`);
      }
      setProfile(matched);
      return;
    }

    checkingRoleRef.current = true;
    try {
      let resolvedEmail = email.trim();
      if (!resolvedEmail.includes('@')) {
        const { data: lookedUp, error: luErr } = await supabase.rpc('resolve_login_email', { p_identifier: resolvedEmail });
        if (luErr || !lookedUp) {
          throw new Error('No student account found for that Roll Number. Please check your roll number or use your registered email.');
        }
        resolvedEmail = String(lookedUp);
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email: resolvedEmail, password });
      if (error) throw error;
      if (data.user) {
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();
        if (profErr) {
          await supabase.auth.signOut();
          throw new Error(`Profile load failed: ${profErr.message}`);
        }
        if (!prof) {
          await supabase.auth.signOut();
          throw new Error('Account exists in Auth, but no profile row was found in public.profiles.');
        }
        const loaded = prof as Profile;
        if (expectedRole && loaded.role !== expectedRole) {
          await supabase.auth.signOut();
          setProfile(null);
          throw new Error(
            `Access denied: This account is registered as ${loaded.role.toUpperCase()}, not ${expectedRole.toUpperCase()}. Please sign in through the ${loaded.role.toUpperCase()} login portal.`
          );
        }
        setProfile(loaded);
      }
    } finally {
      checkingRoleRef.current = false;
    }
  };

  const [recovering, setRecovering] = useState(false);

  const requestPasswordReset = async (email: string) => {
    if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
    let targetEmail = email.trim();
    if (!targetEmail.includes('@')) {
      const { data: lookedUp } = await supabase.rpc('resolve_login_email', { p_identifier: targetEmail });
      if (lookedUp) targetEmail = String(lookedUp);
    }
    const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, { redirectTo: window.location.origin });
    if (error) throw error;
  };

  const verifyRecoveryOtpAndReset = async (identifier: string, otpCode: string, newPassword: string) => {
    if (!isSupabaseConfigured) throw new Error('System is not configured.');
    let targetEmail = identifier.trim();
    if (!targetEmail.includes('@')) {
      const { data: lookedUp } = await supabase.rpc('resolve_login_email', { p_identifier: targetEmail });
      if (!lookedUp) throw new Error('No account found for that Roll Number.');
      targetEmail = String(lookedUp);
    }
    checkingRoleRef.current = true;
    try {
      const { error: otpErr } = await supabase.auth.verifyOtp({
        email: targetEmail.toLowerCase(),
        token: otpCode.trim(),
        type: 'recovery',
      });
      if (otpErr) throw otpErr;

      const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updErr) throw updErr;

      await supabase.auth.signOut();
      setProfile(null);
      setRecovering(false);
    } finally {
      checkingRoleRef.current = false;
    }
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    setRecovering(false);
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    if (!isSupabaseConfigured) {
      if (!isDevMode) throw new Error('Supabase is not configured. Contact your system administrator.');
      setProfile({ id: 'demo-pending', full_name: fullName, email, mobile: null, role: 'student', status: 'pending', department_id: null });
      return;
    }
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    if (error) throw error;
  };

  const signOut = async () => {
    if (isSupabaseConfigured) await supabase.auth.signOut();
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (!isSupabaseConfigured || !profile || profile.id.startsWith('demo-')) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', profile.id).maybeSingle();
    if (data) setProfile(data as Profile);
  };

  const switchDemoRole = (role: UserRole) => {
    if (!isDevMode) return;
    setProfile(DEMO_PROFILES[role]);
  };

  const setThemeMode = (mode: ThemeMode) => setTheme(mode);
  const toggleTheme = () => setTheme((prev) => {
    const order: ThemeMode[] = ['light', 'dark', 'glass-dark'];
    return order[(order.indexOf(prev) + 1) % order.length];
  });

  return (
    <AuthContext.Provider value={{ profile, loading, theme, setThemeMode, toggleTheme, signIn, signUp, signOut, refreshProfile, switchDemoRole, recovering, requestPasswordReset, verifyRecoveryOtpAndReset, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};