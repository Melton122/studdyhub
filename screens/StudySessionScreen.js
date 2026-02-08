import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Animated, Easing, Vibration, Modal, TextInput,
  Dimensions, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../context/AuthContext';
import Slider from '@react-native-community/slider';

const { width } = Dimensions.get('window');

const FOCUS_LEVELS = [
  { level: 1, label: 'Low', emoji: '😴', color: '#FF7675' },
  { level: 2, label: 'Medium', emoji: '😊', color: '#FDCB6E' },
  { level: 3, label: 'High', emoji: '🚀', color: '#00B894' },
];

const SESSION_TYPES = [
  { id: 'pomodoro', name: 'Pomodoro', duration: 25, color: '#6C5CE7' },
  { id: 'deep_work', name: 'Deep Work', duration: 50, color: '#00B894' },
  { id: 'quick_review', name: 'Quick Review', duration: 15, color: '#FD79A8' },
  { id: 'custom', name: 'Custom', duration: 30, color: '#FDCB6E' },
];

export default function StudySessionScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [selectedType, setSelectedType] = useState('pomodoro');
  const [customDuration, setCustomDuration] = useState(30);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedFocus, setSelectedFocus] = useState(3);
  const [sessionNotes, setSessionNotes] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [showSubjectsModal, setShowSubjectsModal] = useState(false);
  const [sessionHistory, setSessionHistory] = useState([]);
  
  const timerRef = useRef(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fetchUserSubjects();
    fetchRecentSessions();
    startPulseAnimation();
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const fetchUserSubjects = async () => {
    try {
      const { data, error } = await supabase
        .from('user_subjects')
        .select('subject')
        .eq('user_id', user.id);

      if (!error && data?.length > 0) {
        const subjectList = data.map(item => item.subject);
        setSubjects(subjectList);
        setSelectedSubject(subjectList[0]);
      } else {
        const defaults = ['Mathematics', 'Physical Sciences', 'Life Sciences'];
        setSubjects(defaults);
        setSelectedSubject(defaults[0]);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchRecentSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!error) setSessionHistory(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  };

  const getSessionDuration = () => {
    if (selectedType === 'custom') return customDuration * 60;
    const session = SESSION_TYPES.find(s => s.id === selectedType);
    return session ? session.duration * 60 : 25 * 60;
  };

  const startTimer = () => {
    if (!selectedSubject) return Alert.alert('Select Subject', 'Please select a subject first.');
    setSessionActive(true);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          completeSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    Vibration.vibrate(100);
  };

  const pauseTimer = () => {
    setSessionActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const resetTimer = () => {
    pauseTimer();
    setTimeLeft(getSessionDuration());
  };

  const completeSession = async () => {
    pauseTimer();
    Vibration.vibrate([0, 500, 200, 500]);
    const durationMins = Math.floor(getSessionDuration() / 60);

    try {
      setLoading(true);
      const { error } = await supabase.from('study_sessions').insert([{
        user_id: user.id,
        subject: selectedSubject,
        duration: durationMins,
        focus_level: selectedFocus,
        session_type: selectedType,
        notes: sessionNotes,
      }]);

      if (error) throw error;
      fetchRecentSessions();
      Alert.alert('Session Saved! 🎉', `You focused for ${durationMins} minutes.`);
      resetTimer();
    } catch (error) {
      Alert.alert('Error', 'Failed to save session');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1E2340', '#6C5CE7']} style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Study Session</Text>
          <Text style={styles.headerSubtitle}>Ready to focus?</Text>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Timer UI */}
        <View style={styles.timerWrapper}>
          <Animated.View style={[styles.timerCircle, { transform: [{ scale: sessionActive ? pulseAnim : 1 }] }]}>
            <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
            <Text style={styles.timerSubtext}>{selectedSubject}</Text>
          </Animated.View>
        </View>

        {/* Controls */}
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={resetTimer}>
            <Ionicons name="refresh" size={28} color="#A29BFE" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.playBtn, { backgroundColor: sessionActive ? '#FF7675' : '#00B894' }]} 
            onPress={sessionActive ? pauseTimer : startTimer}
          >
            <Ionicons name={sessionActive ? "pause" : "play"} size={32} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={completeSession}>
            <Ionicons name="checkmark-done" size={28} color="#00B894" />
          </TouchableOpacity>
        </View>

        {/* Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Session Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typesList}>
            {SESSION_TYPES.map(type => (
              <TouchableOpacity 
                key={type.id} 
                onPress={() => { setSelectedType(type.id); setTimeLeft(type.duration * 60); }}
                style={[styles.typeCard, selectedType === type.id && { borderColor: type.color, backgroundColor: type.color + '20' }]}
              >
                <Ionicons name="timer-outline" size={20} color={type.color} />
                <Text style={[styles.typeText, { color: type.color }]}>{type.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Subject Picker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subject</Text>
          <TouchableOpacity style={styles.subjectPicker} onPress={() => setShowSubjectsModal(true)}>
            <Text style={styles.subjectPickerText}>{selectedSubject}</Text>
            <Ionicons name="chevron-down" size={20} color="#6C5CE7" />
          </TouchableOpacity>
        </View>

        {/* Focus Level */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How's your Focus?</Text>
          <View style={styles.focusRow}>
            {FOCUS_LEVELS.map(f => (
              <TouchableOpacity 
                key={f.level} 
                onPress={() => setSelectedFocus(f.level)}
                style={[styles.focusCard, selectedFocus === f.level && { backgroundColor: f.color + '30', borderColor: f.color }]}
              >
                <Text style={styles.focusEmoji}>{f.emoji}</Text>
                <Text style={styles.focusLabel}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Subject Modal */}
      <Modal visible={showSubjectsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose Subject</Text>
            {subjects.map(s => (
              <TouchableOpacity key={s} style={styles.modalItem} onPress={() => { setSelectedSubject(s); setShowSubjectsModal(false); }}>
                <Text style={styles.modalItemText}>{s}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowSubjectsModal(false)}>
              <Text style={styles.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E27' },
  header: { padding: 40, paddingTop: 60, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#FFF' },
  headerSubtitle: { color: '#A29BFE', fontSize: 16 },
  scrollContent: { paddingBottom: 40 },
  timerWrapper: { alignItems: 'center', marginTop: 30 },
  timerCircle: { width: 220, height: 220, borderRadius: 110, borderWeight: 8, borderColor: '#6C5CE7', justifyContent: 'center', alignItems: 'center', backgroundColor: '#1E2340', elevation: 10 },
  timerText: { fontSize: 54, fontWeight: 'bold', color: '#FFF' },
  timerSubtext: { color: '#6C5CE7', fontWeight: '600' },
  controlsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 30, marginTop: 40 },
  playBtn: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  iconBtn: { padding: 10 },
  section: { paddingHorizontal: 20, marginTop: 30 },
  sectionTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 15 },
  typesList: { flexDirection: 'row' },
  typeCard: { padding: 15, borderRadius: 15, backgroundColor: '#1E2340', marginRight: 10, alignItems: 'center', borderWidth: 1, borderColor: 'transparent', minWidth: 100 },
  typeText: { marginTop: 5, fontWeight: '600' },
  subjectPicker: { backgroundColor: '#1E2340', padding: 18, borderRadius: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subjectPickerText: { color: '#FFF', fontSize: 16 },
  focusRow: { flexDirection: 'row', justifyContent: 'space-between' },
  focusCard: { flex: 1, margin: 5, padding: 15, borderRadius: 15, backgroundColor: '#1E2340', alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  focusEmoji: { fontSize: 24, marginBottom: 5 },
  focusLabel: { color: '#FFF', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1E2340', borderRadius: 20, padding: 20 },
  modalTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  modalItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#2D3561' },
  modalItemText: { color: '#FFF', fontSize: 16 },
  closeBtn: { marginTop: 20, padding: 15, alignItems: 'center' },
  closeBtnText: { color: '#FF7675', fontWeight: 'bold' }
});