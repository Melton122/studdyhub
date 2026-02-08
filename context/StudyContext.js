import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../context/AuthContext';

const StudyContext = createContext();

export const useStudy = () => {
  const context = useContext(StudyContext);
  if (!context) {
    // Return default values if context is not available
    return {
      studyStats: {},
      getStudyProgress: () => 0,
      refreshStats: () => {},
    };
  }
  return context;
};

export const StudyProvider = ({ children }) => {
  const { user } = useAuth();
  const [studyStats, setStudyStats] = useState({
    dailyGoal: 2, // 2 hours default goal
    todayStudyTime: 0,
    totalStudyTime: 0,
    streakDays: 0,
    focusScore: 0,
    completedSessions: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStudyStats = useCallback(async () => {
    if (!user) {
      setStudyStats({
        dailyGoal: 2,
        todayStudyTime: 0,
        totalStudyTime: 0,
        streakDays: 0,
        focusScore: 0,
        completedSessions: 0,
      });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      // Fetch today's study sessions
      const { data: todaySessions, error: todayError } = await supabase
        .from('study_sessions')
        .select('duration, focus_level')
        .eq('user_id', user.id)
        .gte('created_at', todayStart.toISOString())
        .lt('created_at', todayEnd.toISOString());

      if (todayError) {
        console.error('Error fetching today sessions:', todayError);
      }

      // Fetch all study sessions for total time
      const { data: allSessions, error: allError } = await supabase
        .from('study_sessions')
        .select('duration, focus_level, created_at')
        .eq('user_id', user.id);

      if (allError) {
        console.error('Error fetching all sessions:', allError);
      }

      // Calculate today's study time
      const todayStudyTime = todaySessions?.reduce((total, session) => total + (session.duration || 0), 0) || 0;

      // Calculate total study time
      const totalStudyTime = allSessions?.reduce((total, session) => total + (session.duration || 0), 0) || 0;

      // Calculate streak (simplified - count consecutive days with study sessions)
      let streakDays = 0;
      if (allSessions && allSessions.length > 0) {
        const sessionDates = allSessions
          .map(s => new Date(s.created_at).toDateString())
          .filter((date, index, self) => self.indexOf(date) === index);
        
        // Sort dates and check for consecutive days
        sessionDates.sort((a, b) => new Date(b) - new Date(a));
        let currentStreak = 0;
        let currentDate = new Date();
        
        for (let i = 0; i < sessionDates.length; i++) {
          const sessionDate = new Date(sessionDates[i]);
          const diffDays = Math.floor((currentDate - sessionDate) / (1000 * 60 * 60 * 24));
          
          if (diffDays === i) {
            currentStreak++;
          } else {
            break;
          }
        }
        
        streakDays = currentStreak;
      }

      // Calculate average focus score
      const allFocusScores = allSessions?.map(s => s.focus_level || 3) || [];
      const avgFocusScore = allFocusScores.length > 0 
        ? Math.round(allFocusScores.reduce((a, b) => a + b, 0) / allFocusScores.length * 10) / 10
        : 0;

      // Get user's study goal
      const { data: userGoal, error: goalError } = await supabase
        .from('user_study_goals')
        .select('daily_hours')
        .eq('user_id', user.id)
        .single();

      const dailyGoal = userGoal?.daily_hours || 2;

      setStudyStats({
        dailyGoal,
        todayStudyTime,
        totalStudyTime,
        streakDays,
        focusScore: avgFocusScore,
        completedSessions: allSessions?.length || 0,
      });

    } catch (error) {
      console.error('Error in fetchStudyStats:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStudyStats();
    
    // Refresh stats every 5 minutes when user is active
    const interval = setInterval(() => {
      if (user) {
        fetchStudyStats();
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, fetchStudyStats]);

  const getStudyProgress = () => {
    if (studyStats.dailyGoal === 0) return 0;
    const progress = studyStats.todayStudyTime / (studyStats.dailyGoal * 3600);
    return Math.min(progress, 1);
  };

  const refreshStats = () => {
    fetchStudyStats();
  };

  const value = {
    studyStats,
    loading,
    getStudyProgress,
    refreshStats,
  };

  return (
    <StudyContext.Provider value={value}>
      {children}
    </StudyContext.Provider>
  );
};