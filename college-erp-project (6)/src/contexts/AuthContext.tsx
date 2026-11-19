import React, { createContext, useContext, useEffect, useState } from 'react';
import { isConfiguredAdminEmail, verifyEncryptedAdmin } from '../lib/adminAuth';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { Profile, UserRole } from '../types/erp';

interface AuthContextValue {
  profile: Profile | null;
  loading: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchDemoRole: (role: UserRole) => void;
}

const DEMO_PROFILES: Record<UserRole, Profile> = {
  admin: { id: 'demo-admin', full_name: 'College Admin', email: 'phaniinapakolla227@proton.me', mobile: '9849000001', role: 'admin', status: 'approved', department_id: null },
  hod: { id: 'demo-hod', full_name: 'Prof. Rajesh Verma (HOD - CS)', email: 'hod.cs@college.edu', mobile: '9849000002', role: 'hod', status: 'approved', department_id: 'dept-cs' },
  faculty: { id: 'demo-faculty', full_name: 'Dr. Ananya Rao (Faculty)', email: 'ananya.rao@college.edu', mobile: '9849000003', role: 'faculty', status: 'approved', department_id: 'dept-cs' },
  student: { id: 'demo-student', full_name: 'Aarav Sharma (Roll 101)', email: 'aarav.101@college.edu', mobile: '9849000004', role: 'student', status: 'approved', department_id: 'dept-cs' },
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    (localStorage.getItem('erp-theme') as 'light' | 'dark') || 'light'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('erp-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        setProfile(data as Profile | null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        setProfile(data as Profile | null);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      if (await isConfiguredAdminEmail(email)) {
        const valid = await verifyEncryptedAdmin(email, password);
        if (!valid) throw new Error('Invalid Admin password.');
        setProfile(DEMO_PROFILES.admin);
        return;
      }
      const matched = Object.values(DEMO_PROFILES).find((p) => p.email === email) || DEMO_PROFILES.faculty;
      setProfile(matched);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    if (!isSupabaseConfigured) {
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

  const switchDemoRole = (role: UserRole) => setProfile(DEMO_PROFILES[role]);
  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  return (
    <AuthContext.Provider value={{ profile, loading, theme, toggleTheme, signIn, signUp, signOut, switchDemoRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
