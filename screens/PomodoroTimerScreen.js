import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, Vibration, Platform
} from 'react-native';  // Added TextInput here
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../context/AuthContext';
import * as Notifications from 'expo-notifications';

// ... rest of the code remains the same ...

const WORK_TIME = 25 * 60; // 25 minutes in seconds
const SHORT_BREAK = 5 * 60; // 5 minutes
const LONG_BREAK = 15 * 60; // 15 minutes

export default function PomodoroTimerScreen() {
  const { user } = useAuth();
  const [time, setTime] = useState(WORK_TIME);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState('work'); // 'work', 'shortBreak', 'longBreak'
  const [cycles, setCycles] = useState(0);
  const [totalStudyTime, setTotalStudyTime] = useState(0);
  const [sessions, setSessions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [currentGoal, setCurrentGoal] = useState('');

  useEffect(() => {
    let interval = null;

    if (isActive && time > 0) {
      interval = setInterval(() => {
        setTime(time => time - 1);
      }, 1000);
    } else if (time === 0 && isActive) {
      handleTimerComplete();
      clearInterval(interval);
    }

    return () => clearInterval(interval);
  }, [isActive, time]);

  useEffect(() => {
    fetchSessions();
    fetchGoals();
  }, [user]);

  const fetchSessions = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  const fetchGoals = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('study_goals')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_completed', false)
        .order('priority');
      setGoals(data || []);
      if (data && data.length > 0) {
        setCurrentGoal(data[0].title);
      }
    } catch (error) {
      console.error('Error fetching goals:', error);
    }
  };

  const handleTimerComplete = async () => {
    // Vibrate phone
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Vibration.vibrate([500, 500, 500]);
    }

    // Send notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: mode === 'work' ? 'Time for a break! 🎉' : 'Back to work! ⏰',
        body: mode === 'work' ? 'Take a well-deserved break' : 'Time to focus again',
        sound: true,
      },
      trigger: null,
    });

    // Save session to database
    if (mode === 'work' && user) {
      try {
        await supabase.from('study_sessions').insert({
          user_id: user.id,
          duration: WORK_TIME,
          focus_level: 4, // Default
          distractions: 0,
          goal_achieved: false,
        });
        setTotalStudyTime(prev => prev + WORK_TIME);
        fetchSessions();
      } catch (error) {
        console.error('Error saving session:', error);
      }
    }

    // Switch mode
    if (mode === 'work') {
      setCycles(prev => prev + 1);
      if (cycles % 4 === 3) {
        setMode('longBreak');
        setTime(LONG_BREAK);
        Alert.alert('Great work!', 'Time for a long break (15 minutes)');
      } else {
        setMode('shortBreak');
        setTime(SHORT_BREAK);
        Alert.alert('Pomodoro completed!', 'Take a 5-minute break');
      }
    } else {
      setMode('work');
      setTime(WORK_TIME);
      Alert.alert('Break over!', 'Time to focus for 25 minutes');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startTimer = () => {
    setIsActive(true);
  };

  const pauseTimer = () => {
    setIsActive(false);
  };

  const resetTimer = () => {
    setIsActive(false);
    setTime(mode === 'work' ? WORK_TIME : mode === 'shortBreak' ? SHORT_BREAK : LONG_BREAK);
  };

  const skipToNext = () => {
    handleTimerComplete();
  };

  const addGoal = async () => {
    if (!currentGoal.trim() || !user) return;
    
    try {
      const { error } = await supabase.from('study_goals').insert({
        user_id: user.id,
        title: currentGoal,
        priority: goals.length + 1,
        is_completed: false,
      });
      
      if (error) throw error;
      
      setCurrentGoal('');
      fetchGoals();
      Alert.alert('Goal added!', 'Keep track of your study goals');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const completeGoal = async (goalId) => {
    try {
      await supabase
        .from('study_goals')
        .update({ is_completed: true, completed_at: new Date().toISOString() })
        .eq('id', goalId);
      
      fetchGoals();
    } catch (error) {
      console.error('Error completing goal:', error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pomodoro Timer</Text>
        <Text style={styles.headerSubtitle}>Focus for 25 minutes, break for 5</Text>
      </View>

      {/* Timer Display */}
      <View style={styles.timerContainer}>
        <Text style={styles.timerText}>{formatTime(time)}</Text>
        <View style={styles.modeIndicator}>
          <Text style={[styles.modeText, 
            mode === 'work' ? styles.workMode :
            mode === 'shortBreak' ? styles.shortBreakMode :
            styles.longBreakMode
          ]}>
            {mode === 'work' ? 'FOCUS TIME' : 
             mode === 'shortBreak' ? 'SHORT BREAK' : 'LONG BREAK'}
          </Text>
          <Text style={styles.cyclesText}>Cycle {cycles + 1}</Text>
        </View>
      </View>

      {/* Timer Controls */}
      <View style={styles.controls}>
        {!isActive ? (
          <TouchableOpacity style={styles.startButton} onPress={startTimer}>
            <Ionicons name="play" size={24} color="#FFF" />
            <Text style={styles.startButtonText}>Start Focus</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.pauseButton} onPress={pauseTimer}>
            <Ionicons name="pause" size={24} color="#FFF" />
            <Text style={styles.pauseButtonText}>Pause</Text>
          </TouchableOpacity>
        )}
        
        <View style={styles.secondaryControls}>
          <TouchableOpacity style={styles.resetButton} onPress={resetTimer}>
            <Ionicons name="refresh" size={20} color="#6C5CE7" />
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.skipButton} onPress={skipToNext}>
            <Ionicons name="fast-forward" size={20} color="#00B894" />
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Current Goal */}
      <View style={styles.goalSection}>
        <Text style={styles.sectionTitle}>Today's Focus Goal</Text>
        <View style={styles.goalInputContainer}>
          <Ionicons name="flag" size={20} color="#6C5CE7" />
          <TextInput
            style={styles.goalInput}
            placeholder="What do you want to achieve?"
            placeholderTextColor="#636E72"
            value={currentGoal}
            onChangeText={setCurrentGoal}
            onSubmitEditing={addGoal}
          />
          <TouchableOpacity style={styles.addGoalButton} onPress={addGoal}>
            <Ionicons name="add" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
        
        {/* Active Goals */}
        {goals.map(goal => (
          <TouchableOpacity 
            key={goal.id} 
            style={styles.goalItem}
            onPress={() => completeGoal(goal.id)}
          >
            <Ionicons 
              name={goal.is_completed ? "checkmark-circle" : "ellipse-outline"} 
              size={20} 
              color={goal.is_completed ? "#00B894" : "#636E72"} 
            />
            <Text style={[
              styles.goalText,
              goal.is_completed && styles.goalCompleted
            ]}>
              {goal.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats */}
      <View style={styles.statsSection}>
        <View style={styles.statCard}>
          <Ionicons name="time" size={24} color="#6C5CE7" />
          <Text style={styles.statNumber}>
            {Math.floor(totalStudyTime / 3600)}h {Math.floor((totalStudyTime % 3600) / 60)}m
          </Text>
          <Text style={styles.statLabel}>Total Study Time</Text>
        </View>
        
        <View style={styles.statCard}>
          <Ionicons name="repeat" size={24} color="#FD79A8" />
          <Text style={styles.statNumber}>{cycles}</Text>
          <Text style={styles.statLabel}>Pomodoros</Text>
        </View>
        
        <View style={styles.statCard}>
          <Ionicons name="trophy" size={24} color="#FDCB6E" />
          <Text style={styles.statNumber}>
            {goals.filter(g => g.is_completed).length}/{goals.length}
          </Text>
          <Text style={styles.statLabel}>Goals</Text>
        </View>
      </View>

      {/* Recent Sessions */}
      <View style={styles.sessionsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Sessions</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>
        
        {sessions.slice(0, 3).map((session, index) => (
          <View key={index} style={styles.sessionItem}>
            <View style={styles.sessionTime}>
              <Text style={styles.sessionDuration}>
                {Math.floor(session.duration / 60)} min
              </Text>
              <Text style={styles.sessionDate}>
                {new Date(session.created_at).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.sessionFocus}>
              <Text style={styles.focusLabel}>Focus Level</Text>
              <View style={styles.focusBars}>
                {[1, 2, 3, 4, 5].map(level => (
                  <View 
                    key={level}
                    style={[
                      styles.focusBar,
                      level <= session.focus_level && styles.focusBarActive
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E27',
  },
  header: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#1E2340',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#A29BFE',
  },
  timerContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  timerText: {
    fontSize: 80,
    fontWeight: '200',
    color: '#FFF',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  modeIndicator: {
    alignItems: 'center',
    marginTop: 10,
  },
  modeText: {
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  workMode: {
    backgroundColor: '#6C5CE720',
    color: '#6C5CE7',
  },
  shortBreakMode: {
    backgroundColor: '#00B89420',
    color: '#00B894',
  },
  longBreakMode: {
    backgroundColor: '#FD79A820',
    color: '#FD79A8',
  },
  cyclesText: {
    fontSize: 12,
    color: '#636E72',
    marginTop: 4,
  },
  controls: {
    alignItems: 'center',
    marginVertical: 20,
  },
  startButton: {
    backgroundColor: '#6C5CE7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 20,
    marginBottom: 16,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  pauseButton: {
    backgroundColor: '#FF7675',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 20,
    marginBottom: 16,
  },
  pauseButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  secondaryControls: {
    flexDirection: 'row',
    gap: 20,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#2D3561',
    borderRadius: 12,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C5CE7',
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#00B89420',
    borderRadius: 12,
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00B894',
  },
  goalSection: {
    padding: 20,
    backgroundColor: '#1E2340',
    marginHorizontal: 16,
    borderRadius: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 16,
  },
  goalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0E27',
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  goalInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    paddingVertical: 14,
    marginLeft: 10,
  },
  addGoalButton: {
    backgroundColor: '#6C5CE7',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3561',
  },
  goalText: {
    flex: 1,
    fontSize: 15,
    color: '#FFF',
  },
  goalCompleted: {
    textDecorationLine: 'line-through',
    color: '#636E72',
  },
  statsSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E2340',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#636E72',
  },
  sessionsSection: {
    paddingHorizontal: 16,
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAll: {
    fontSize: 14,
    color: '#6C5CE7',
    fontWeight: '600',
  },
  sessionItem: {
    backgroundColor: '#1E2340',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  sessionTime: {
    alignItems: 'flex-start',
  },
  sessionDuration: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  sessionDate: {
    fontSize: 12,
    color: '#636E72',
    marginTop: 2,
  },
  sessionFocus: {
    alignItems: 'flex-end',
  },
  focusLabel: {
    fontSize: 12,
    color: '#636E72',
    marginBottom: 6,
  },
  focusBars: {
    flexDirection: 'row',
    gap: 3,
  },
  focusBar: {
    width: 8,
    height: 20,
    backgroundColor: '#2D3561',
    borderRadius: 2,
  },
  focusBarActive: {
    backgroundColor: '#00B894',
  },
});