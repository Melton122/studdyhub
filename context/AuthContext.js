import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseConfig.js';


const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Helper to fetch profile data from your 'user_profiles' table
  const fetchUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('Profile fetch error:', error.message);
        return null;
      }
      
      if (data) {
        setProfile(data);
        setIsAdmin(data.is_admin || false);
        return data;
      }
    } catch (error) {
      console.error('Unexpected error fetching profile:', error);
    }
    return null;
  };

  useEffect(() => {
    // 1. Initialize Auth State
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          await fetchUserProfile(initialSession.user.id);
        }
      } catch (err) {
        console.error("Error initializing auth:", err.message);
      } finally {
        // ALWAYS set loading to false to unblock the UI
        setLoading(false);
      }
    };

    initializeAuth();

    // 2. Listen for Auth State Changes (Login, Logout, Token Refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('Auth event triggered:', event);
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          await fetchUserProfile(currentSession.user.id);
        } else {
          // Reset state on sign out
          setProfile(null);
          setIsAdmin(false);
        }
        
        // Ensure loading is false after any state change event
        setLoading(false);
      }
    );

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Sign out error", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile, 
      loading, 
      isAdmin, 
      signOut 
    }}>
      {children}
    </AuthContext.Provider>
  );
};