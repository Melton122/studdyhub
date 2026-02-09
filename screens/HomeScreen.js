import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Alert, Image, Animated, RefreshControl,
  FlatList, Modal, TextInput, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseConfig';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const { profile, user } = useAuth();
  const [studyStats, setStudyStats] = useState({
    dailyGoal: 2,
    todayStudyTime: 0,
    totalStudyTime: 0,
    streakDays: 0,
    focusScore: 0,
    completedSessions: 0,
    flashcardCount: 0,
    upcomingExams: 0,
  });
  const [dailyTip, setDailyTip] = useState(null);
  const [nextReminder, setNextReminder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [examCountdown, setExamCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    examName: 'Matric Finals',
    examDate: null,
  });
  const [newResources, setNewResources] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [activeStudents, setActiveStudents] = useState(0);
  const [featuredTutors, setFeaturedTutors] = useState([]);
  const [loadingTutors, setLoadingTutors] = useState(false);
  const [showExamModal, setShowExamModal] = useState(false);
  const [customExamDate, setCustomExamDate] = useState(new Date());
  const [customExamName, setCustomExamName] = useState('');

  const MASTER_EMAIL = 'meltonhlungwani970@gmail.com';

  useEffect(() => {
    fetchData();
    startExamCountdown();
    startPulseAnimation();
    fetchFeaturedTutors();
    loadCustomExamDate();
  }, []);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const loadCustomExamDate = async () => {
    try {
      const { data } = await supabase
        .from('user_settings')
        .select('exam_date, exam_name')
        .eq('user_id', user?.id)
        .single();

      if (data && data.exam_date) {
        const examDate = new Date(data.exam_date);
        setExamCountdown(prev => ({
          ...prev,
          examName: data.exam_name || 'My Exam',
          examDate: examDate,
        }));
        setCustomExamDate(examDate);
        setCustomExamName(data.exam_name || '');
      } else {
        // Set default to November 1st if no custom date
        const defaultDate = new Date(new Date().getFullYear(), 10, 1);
        if (new Date() > defaultDate) {
          defaultDate.setFullYear(defaultDate.getFullYear() + 1);
        }
        setExamCountdown(prev => ({
          ...prev,
          examDate: defaultDate,
        }));
        setCustomExamDate(defaultDate);
      }
    } catch (error) {
      console.error('Error loading exam date:', error);
    }
  };

  const saveCustomExamDate = async () => {
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user?.id,
          exam_date: customExamDate.toISOString(),
          exam_name: customExamName || 'My Exam',
          updated_at: new Date().toISOString(),
        });

      if (!error) {
        setExamCountdown(prev => ({
          ...prev,
          examDate: customExamDate,
          examName: customExamName || 'My Exam',
        }));
        setShowExamModal(false);
        Alert.alert('Success', 'Exam date saved successfully!');
      }
    } catch (error) {
      console.error('Error saving exam date:', error);
      Alert.alert('Error', 'Failed to save exam date');
    }
  };

  const startExamCountdown = () => {
    const interval = setInterval(() => {
      updateExamCountdown();
    }, 1000);
    
    return () => clearInterval(interval);
  };

  const updateExamCountdown = () => {
    if (!examCountdown.examDate) return;
    
    const now = new Date();
    const examDate = new Date(examCountdown.examDate);
    
    const diff = examDate.getTime() - now.getTime();
    
    if (diff <= 0) {
      setExamCountdown(prev => ({
        ...prev,
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
      }));
      return;
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    setExamCountdown(prev => ({
      ...prev,
      days,
      hours,
      minutes,
      seconds,
    }));
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchStudyStats(),
        fetchDailyTip(),
        fetchNextReminder(),
        fetchNewResources(),
        fetchAnnouncements(),
        fetchFlashcardCount(),
        fetchActiveStudents(),
      ]);
    } catch (error) {
      console.error('Error fetching home data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchFeaturedTutors = async () => {
    try {
      setLoadingTutors(true);
      const { data, error } = await supabase
        .from('tutors')
        .select('*')
        .eq('is_verified', true)
        .order('rating', { ascending: false })
        .limit(3);

      if (!error && data) {
        setFeaturedTutors(data);
      }
    } catch (error) {
      console.error('Error fetching tutors:', error);
    } finally {
      setLoadingTutors(false);
    }
  };

  const fetchActiveStudents = async () => {
    try {
      // First try to get count from active sessions in last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data: activeSessions, error: sessionsError } = await supabase
        .from('study_sessions')
        .select('user_id')
        .gte('created_at', oneDayAgo)
        .eq('is_active', true);

      if (!sessionsError) {
        const uniqueUsers = [...new Set(activeSessions.map(s => s.user_id))];
        setActiveStudents(uniqueUsers.length);
      }

      // Also try to get total user count
      const { data: usersData, error: usersError } = await supabase
        .from('user_profiles')
        .select('id', { count: 'exact' });

      if (!usersError) {
        // Use whichever is larger as a fallback
        setActiveStudents(prev => Math.max(prev, usersData.length || 0));
      }
    } catch (error) {
      console.error('Error fetching active students:', error);
      setActiveStudents(150); // Fallback number
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
    fetchFeaturedTutors();
  };

  const fetchStudyStats = async () => {
    if (!user) return;

    try {
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      // Fetch today's study sessions
      const { data: todaySessions } = await supabase
        .from('study_sessions')
        .select('duration')
        .eq('user_id', user.id)
        .gte('created_at', todayStart.toISOString())
        .lt('created_at', todayEnd.toISOString());

      // Fetch all study sessions
      const { data: allSessions } = await supabase
        .from('study_sessions')
        .select('duration, focus_level, created_at')
        .eq('user_id', user.id);

      // Calculate stats
      const todayStudyTime = todaySessions?.reduce((total, session) => total + (session.duration || 0), 0) || 0;
      const totalStudyTime = allSessions?.reduce((total, session) => total + (session.duration || 0), 0) || 0;
      
      // Streak calculation (consecutive days)
      let streakDays = 0;
      if (allSessions && allSessions.length > 0) {
        const dates = [...new Set(allSessions.map(s => new Date(s.created_at).toDateString()))];
        dates.sort((a, b) => new Date(b) - new Date(a));
        
        let currentStreak = 1;
        for (let i = 1; i < dates.length; i++) {
          const diff = Math.abs(new Date(dates[i-1]) - new Date(dates[i]));
          const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            currentStreak++;
          } else {
            break;
          }
        }
        streakDays = currentStreak;
      }

      // Focus score
      const focusScores = allSessions?.map(s => s.focus_level || 3) || [];
      const focusScore = focusScores.length > 0 
        ? Math.round(focusScores.reduce((a, b) => a + b, 0) / focusScores.length * 10) / 10
        : 0;

      // Get user's daily goal from profile or settings
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('daily_goal')
        .eq('user_id', user.id)
        .single();

      const dailyGoal = userSettings?.daily_goal || 2;

      setStudyStats(prev => ({
        ...prev,
        dailyGoal,
        todayStudyTime,
        totalStudyTime,
        streakDays,
        focusScore,
        completedSessions: allSessions?.length || 0,
      }));
    } catch (error) {
      console.error('Error fetching study stats:', error);
    }
  };

  const fetchFlashcardCount = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('flash_cards')
        .select('id')
        .eq('user_id', user.id);

      if (!error) {
        setStudyStats(prev => ({
          ...prev,
          flashcardCount: data?.length || 0,
        }));
      }
    } catch (error) {
      console.error('Error fetching flashcard count:', error);
    }
  };

  const fetchNewResources = async () => {
    try {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(4);

      if (!error) {
        setNewResources(data || []);
      }
    } catch (error) {
      console.error('Error fetching resources:', error);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(3);

      if (!error) {
        setAnnouncements(data || []);
      }
    } catch (error) {
      console.error('Error fetching announcements:', error);
    }
  };

  const handleSecretAdminAccess = () => {
    if (user?.email === MASTER_EMAIL && profile?.is_admin) {
      navigation.navigate('AdminProfile');
    } else {
      Alert.alert(
        "🎯 Matric Focus", 
        "Keep pushing! Consistent study is the bridge between goals and accomplishment.\n\nLong press (3s) on your profile picture for admin access."
      );
    }
  };

  const fetchDailyTip = async () => {
    const tips = [
      "Study in 25-minute intervals with 5-minute breaks (Pomodoro Technique).",
      "Active recall: Test yourself instead of just re-reading notes.",
      "Spaced repetition: Review material at increasing intervals.",
      "Teach someone else: The Feynman Technique improves understanding.",
      "Stay hydrated! Dehydration can reduce focus by up to 30%.",
      "Use mind maps to visualize complex topics and connections.",
      "Review your weakest subject first when your mind is freshest.",
      "Create flashcards for key formulas, dates, and definitions.",
      "Practice past papers under exam conditions for time management.",
      "Get enough sleep - it's crucial for memory consolidation.",
    ];
    const today = new Date().getDate();
    setDailyTip(tips[today % tips.length]);
  };

  const fetchNextReminder = async () => {
    if (user) {
      const { data } = await supabase
        .from('study_reminders')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .gte('time', new Date().toISOString())
        .order('time')
        .limit(1);

      if (data && data.length > 0) {
        const reminder = data[0];
        setNextReminder({
          time: new Date(reminder.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          title: reminder.title,
        });
      } else {
        setNextReminder(null);
      }
    }
  };

  const getStudyProgress = () => {
    if (studyStats.dailyGoal === 0) return 0;
    const progress = studyStats.todayStudyTime / (studyStats.dailyGoal * 3600);
    return Math.min(progress, 1);
  };

  const quickActions = [
    { icon: 'timer-outline', label: 'Study Timer', color: '#6C5CE7', screen: 'Pomodoro' },
    { icon: 'flash-outline', label: 'Flashcards', color: '#00B894', screen: 'FlashCards' },
    { icon: 'people-outline', label: 'Tutors', color: '#FD79A8', screen: 'Tutors' },
    { icon: 'notifications-outline', label: 'Reminders', color: '#FDCB6E', screen: 'StudyReminder' },
    { icon: 'book-outline', label: 'Subjects', color: '#74B9FF', screen: 'Subjects' },
    { icon: 'document-outline', label: 'Resources', color: '#AA00FF', screen: 'Resources' },
    { icon: 'calendar-outline', label: 'Study Plan', color: '#FF7675', screen: 'StudyPlan' },
    { icon: 'analytics-outline', label: 'Analytics', color: '#00CEC9', screen: 'StudyAnalytics' },
  ];

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Ionicons key={i} name="star" size={12} color="#FDCB6E" />);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<Ionicons key={i} name="star-half" size={12} color="#FDCB6E" />);
      } else {
        stars.push(<Ionicons key={i} name="star-outline" size={12} color="#FDCB6E" />);
      }
    }
    return stars;
  };

  const renderFeaturedTutor = ({ item }) => (
    <TouchableOpacity 
      style={styles.tutorCard}
      onPress={() => navigation.navigate('TutorDetails', { tutor: item })}
    >
      <LinearGradient
        colors={['#1E2340', '#2D3561']}
        style={styles.tutorGradient}
      >
        <View style={styles.tutorImageContainer}>
          {item.profile_image_url ? (
            <Image 
              source={{ uri: item.profile_image_url }} 
              style={styles.tutorImage} 
            />
          ) : (
            <View style={styles.tutorInitials}>
              <Text style={styles.tutorInitialsText}>
                {item.name?.charAt(0)?.toUpperCase() || 'T'}
              </Text>
            </View>
          )}
          {item.is_verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={12} color="#00B894" />
            </View>
          )}
        </View>
        
        <View style={styles.tutorInfo}>
          <Text style={styles.tutorName} numberOfLines={1}>
            {item.name || 'Tutor'}
          </Text>
          
          <View style={styles.tutorRating}>
            {renderStars(item.rating || 0)}
            <Text style={styles.ratingText}>
              {item.rating?.toFixed(1) || '4.5'}
            </Text>
          </View>
          
          <View style={styles.tutorSubjects}>
            <Ionicons name="book" size={10} color="#A29BFE" />
            <Text style={styles.subjectText} numberOfLines={1}>
              {item.subjects?.[0] || 'Mathematics'}
            </Text>
          </View>
          
          <View style={styles.tutorPrice}>
            <Text style={styles.priceText}>
              R{item.hourly_rate || 200}/hr
            </Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderStatCard = (icon, value, label, color) => (
    <View style={[styles.statCard, { borderColor: color + '30' }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const ExamModal = () => (
    <Modal
      visible={showExamModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowExamModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <LinearGradient
            colors={['#1E2340', '#0A0E27']}
            style={styles.modalGradient}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set Your Exam Date</Text>
              <TouchableOpacity onPress={() => setShowExamModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.formLabel}>Exam Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Matric Finals, Physics Paper 1"
                placeholderTextColor="#636E72"
                value={customExamName}
                onChangeText={setCustomExamName}
              />

              <Text style={styles.formLabel}>Exam Date</Text>
              {Platform.OS === 'ios' ? (
                <DateTimePicker
                  value={customExamDate}
                  mode="date"
                  display="spinner"
                  onChange={(event, date) => {
                    if (date) setCustomExamDate(date);
                  }}
                  style={styles.datePicker}
                  textColor="#FFF"
                />
              ) : (
                <DateTimePicker
                  value={customExamDate}
                  mode="date"
                  display="default"
                  onChange={(event, date) => {
                    if (date) setCustomExamDate(date);
                  }}
                />
              )}

              <Text style={styles.formLabel}>Exam Time (Optional)</Text>
              {Platform.OS === 'ios' ? (
                <DateTimePicker
                  value={customExamDate}
                  mode="time"
                  display="spinner"
                  onChange={(event, date) => {
                    if (date) setCustomExamDate(date);
                  }}
                  style={styles.datePicker}
                  textColor="#FFF"
                />
              ) : (
                <DateTimePicker
                  value={customExamDate}
                  mode="time"
                  display="default"
                  onChange={(event, date) => {
                    if (date) setCustomExamDate(date);
                  }}
                />
              )}

              <View style={styles.selectedDate}>
                <Ionicons name="calendar" size={16} color="#6C5CE7" />
                <Text style={styles.selectedDateText}>
                  {customExamDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveCustomExamDate}
              >
                <LinearGradient
                  colors={['#6C5CE7', '#A29BFE']}
                  style={styles.saveButtonGradient}
                >
                  <Ionicons name="save" size={20} color="#FFF" />
                  <Text style={styles.saveButtonText}>Save Exam Date</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={['#6C5CE7', '#A29BFE']}
          style={styles.loadingGradient}
        >
          <Ionicons name="book" size={60} color="#FFF" />
          <Text style={styles.loadingText}>Loading your study dashboard...</Text>
        </LinearGradient>
      </View>
    );
  }

  const progress = getStudyProgress();

  return (
    <View style={styles.container}>
      <ExamModal />
      
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6C5CE7"
            colors={['#6C5CE7']}
          />
        }
      >
        {/* Enhanced Header */}
        <TouchableOpacity 
          activeOpacity={0.9} 
          onLongPress={handleSecretAdminAccess}
          delayLongPress={3000}
        >
          <LinearGradient
            colors={['#1E2340', '#6C5CE7']}
            style={styles.header}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerTextContainer}>
                <Text style={styles.greeting}>
                  Hello, {profile?.full_name?.split(' ')[0] || 'Student'}! 👋
                </Text>
                <Text style={styles.name}>{profile?.full_name || 'Matric Student'}</Text>
                <View style={styles.schoolInfo}>
                  <Ionicons name="school" size={14} color="#A29BFE" />
                  <Text style={styles.subtitle}>
                    {profile?.school_name || 'Grade 12 Student'}
                  </Text>
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.profileButton}
                onPress={() => navigation.navigate('Profile')}
              >
                <LinearGradient
                  colors={['#FFF', '#E0E0FF']}
                  style={styles.avatar}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {profile?.profile_image_url ? (
                    <Image 
                      source={{ uri: profile.profile_image_url }} 
                      style={styles.avatarImage} 
                    />
                  ) : (
                    <Text style={styles.avatarText}>
                      {profile?.full_name?.charAt(0)?.toUpperCase() || 'S'}
                    </Text>
                  )}
                </LinearGradient>
                {profile?.is_admin && (
                  <View style={styles.adminBadge}>
                    <Ionicons name="shield-checkmark" size={12} color="#FFF" />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Community Stats */}
            <View style={styles.communityStats}>
              <View style={styles.communityItem}>
                <View style={styles.communityIcon}>
                  <Ionicons name="people" size={14} color="#A29BFE" />
                </View>
                <View>
                  <Text style={styles.communityNumber}>{activeStudents}+</Text>
                  <Text style={styles.communityLabel}>Active Students</Text>
                </View>
              </View>
              
              <View style={styles.communityDivider} />
              
              <View style={styles.communityItem}>
                <View style={styles.communityIcon}>
                  <Ionicons name="flame" size={14} color="#A29BFE" />
                </View>
                <View>
                  <Text style={styles.communityNumber}>{studyStats.streakDays}</Text>
                  <Text style={styles.communityLabel}>Day Streak</Text>
                </View>
              </View>
              
              <View style={styles.communityDivider} />
              
              <View style={styles.communityItem}>
                <View style={styles.communityIcon}>
                  <Ionicons name="time" size={14} color="#A29BFE" />
                </View>
                <View>
                  <Text style={styles.communityNumber}>
                    {Math.floor(studyStats.totalStudyTime / 3600)}
                  </Text>
                  <Text style={styles.communityLabel}>Total Hours</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Exam Countdown Timer */}
        <Animated.View style={[styles.countdownCard, { transform: [{ scale: pulseAnim }] }]}>
          <TouchableOpacity onPress={() => setShowExamModal(true)}>
            <LinearGradient
              colors={['#FF7675', '#FF5252']}
              style={styles.countdownGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.countdownHeader}>
                <View style={styles.countdownIcon}>
                  <Ionicons name="time" size={28} color="#FFF" />
                </View>
                <View style={styles.countdownTitle}>
                  <Text style={styles.countdownLabel}>COUNTDOWN TO</Text>
                  <Text style={styles.countdownExam}>{examCountdown.examName}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.editButton}
                  onPress={() => setShowExamModal(true)}
                >
                  <Ionicons name="pencil" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.countdownTimer}>
                <View style={styles.timeUnit}>
                  <View style={styles.timeBox}>
                    <Text style={styles.timeNumber}>{examCountdown.days}</Text>
                  </View>
                  <Text style={styles.timeLabel}>DAYS</Text>
                </View>
                <Text style={styles.timeSeparator}>:</Text>
                <View style={styles.timeUnit}>
                  <View style={styles.timeBox}>
                    <Text style={styles.timeNumber}>
                      {examCountdown.hours.toString().padStart(2, '0')}
                    </Text>
                  </View>
                  <Text style={styles.timeLabel}>HOURS</Text>
                </View>
                <Text style={styles.timeSeparator}>:</Text>
                <View style={styles.timeUnit}>
                  <View style={styles.timeBox}>
                    <Text style={styles.timeNumber}>
                      {examCountdown.minutes.toString().padStart(2, '0')}
                    </Text>
                  </View>
                  <Text style={styles.timeLabel}>MINS</Text>
                </View>
                <Text style={styles.timeSeparator}>:</Text>
                <View style={styles.timeUnit}>
                  <View style={styles.timeBox}>
                    <Text style={styles.timeNumber}>
                      {examCountdown.seconds.toString().padStart(2, '0')}
                    </Text>
                  </View>
                  <Text style={styles.timeLabel}>SECS</Text>
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.studyPlanButton}
                onPress={() => navigation.navigate('StudyPlan')}
              >
                <Ionicons name="calendar" size={18} color="#FFF" />
                <Text style={styles.studyPlanText}>Create Study Plan</Text>
              </TouchableOpacity>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Daily Progress Card */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <View style={styles.progressTitleContainer}>
              <Ionicons name="trending-up" size={24} color="#00B894" />
              <Text style={styles.progressTitle}>Today's Progress</Text>
            </View>
            <TouchableOpacity 
              style={styles.goalInfo}
              onPress={() => navigation.navigate('StudyAnalytics')}
            >
              <Ionicons name="analytics" size={16} color="#00B894" />
              <Text style={styles.goalText}>Analytics</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <LinearGradient
                colors={['#00B894', '#00E5B4']}
                style={[styles.progressFill, { width: `${progress * 100}%` }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
            </View>
            <View style={styles.progressInfo}>
              <Text style={styles.progressText}>
                {Math.floor(studyStats.todayStudyTime / 3600)}h {Math.floor((studyStats.todayStudyTime % 3600) / 60)}m
              </Text>
              <Text style={styles.progressGoal}>
                / {studyStats.dailyGoal}h goal ({Math.round(progress * 100)}%)
              </Text>
            </View>
          </View>
          
          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            {renderStatCard('time', Math.floor(studyStats.totalStudyTime / 3600), 'Total Hours', '#00B894')}
            {renderStatCard('flash', studyStats.flashcardCount, 'Flashcards', '#6C5CE7')}
            {renderStatCard('flame', studyStats.streakDays, 'Day Streak', '#FF7675')}
            {renderStatCard('checkmark-circle', studyStats.completedSessions, 'Sessions', '#FDCB6E')}
          </View>
        </View>

        {/* Quick Actions Grid */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <Text style={styles.sectionSubtitle}>Access tools instantly</Text>
          </View>
          <View style={styles.actionsGrid}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.actionCard}
                onPress={() => navigation.navigate(action.screen)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[action.color + '20', action.color + '10']}
                  style={styles.actionIcon}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name={action.icon} size={28} color={action.color} />
                </LinearGradient>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Featured Tutors */}
        {featuredTutors.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Featured Tutors</Text>
                <Text style={styles.sectionSubtitle}>Get help from experts</Text>
              </View>
              <TouchableOpacity 
                style={styles.seeAllButton}
                onPress={() => navigation.navigate('Tutors')}
              >
                <Text style={styles.seeAll}>See All</Text>
                <Ionicons name="arrow-forward" size={16} color="#6C5CE7" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={featuredTutors}
              renderItem={renderFeaturedTutor}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tutorsList}
            />
          </View>
        )}

        {/* Study Resources Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Study Resources</Text>
              <Text style={styles.sectionSubtitle}>Access materials by subject</Text>
            </View>
            <TouchableOpacity 
              style={styles.seeAllButton}
              onPress={() => navigation.navigate('Subjects')}
            >
              <Text style={styles.seeAll}>All Subjects</Text>
              <Ionicons name="arrow-forward" size={16} color="#6C5CE7" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.resourceCards}>
            <TouchableOpacity 
              style={styles.mainResourceCard}
              onPress={() => navigation.navigate('Subjects')}
            >
              <LinearGradient
                colors={['#6C5CE7', '#A29BFE']}
                style={styles.mainResourceGradient}
              >
                <View style={styles.resourceIconContainer}>
                  <Ionicons name="book" size={32} color="#FFF" />
                </View>
                <Text style={styles.mainResourceTitle}>My Subjects</Text>
                <Text style={styles.mainResourceCount}>
                  {profile?.selected_subjects?.length || 0} subjects
                </Text>
                <View style={styles.resourceArrow}>
                  <Ionicons name="arrow-forward" size={20} color="#FFF" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
            
            <View style={styles.resourceGrid}>
              <TouchableOpacity 
                style={styles.smallResourceCard}
                onPress={() => navigation.navigate('Resources')}
              >
                <View style={[styles.smallResourceIcon, { backgroundColor: '#00B89420' }]}>
                  <Ionicons name="document-text" size={20} color="#00B894" />
                </View>
                <Text style={styles.smallResourceLabel}>All Resources</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.smallResourceCard}
                onPress={() => navigation.navigate('Downloads')}
              >
                <View style={[styles.smallResourceIcon, { backgroundColor: '#FD79A820' }]}>
                  <Ionicons name="download" size={20} color="#FD79A8" />
                </View>
                <Text style={styles.smallResourceLabel}>Downloads</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.smallResourceCard}
                onPress={() => navigation.navigate('StudyPlan')}
              >
                <View style={[styles.smallResourceIcon, { backgroundColor: '#FDCB6E20' }]}>
                  <Ionicons name="calendar" size={20} color="#FDCB6E" />
                </View>
                <Text style={styles.smallResourceLabel}>Study Plan</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.smallResourceCard}
                onPress={() => navigation.navigate('StudyTips')}
              >
                <View style={[styles.smallResourceIcon, { backgroundColor: '#74B9FF20' }]}>
                  <Ionicons name="bulb" size={20} color="#74B9FF" />
                </View>
                <Text style={styles.smallResourceLabel}>Study Tips</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Announcements */}
        {announcements.length > 0 && (
          <View style={styles.announcementsCard}>
            <LinearGradient
              colors={['#FDCB6E20', '#FDCB6E10']}
              style={styles.announcementsGradient}
            >
              <View style={styles.announcementsHeader}>
                <View style={styles.announcementsIcon}>
                  <Ionicons name="megaphone" size={24} color="#FDCB6E" />
                </View>
                <View>
                  <Text style={styles.announcementsTitle}>Announcements</Text>
                  <Text style={styles.announcementsSubtitle}>Important updates</Text>
                </View>
              </View>
              {announcements.map((announcement, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.announcementItem}
                  onPress={() => Alert.alert(announcement.title, announcement.message)}
                >
                  <View style={styles.announcementContent}>
                    <View style={styles.announcementDot} />
                    <View style={styles.announcementTextContainer}>
                      <Text style={styles.announcementText} numberOfLines={1}>
                        {announcement.title}
                      </Text>
                      <Text style={styles.announcementDate}>
                        {new Date(announcement.created_at).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#FDCB6E" />
                </TouchableOpacity>
              ))}
            </LinearGradient>
          </View>
        )}

        {/* Daily Tip */}
        {dailyTip && (
          <TouchableOpacity 
            style={styles.tipCard}
            onPress={() => navigation.navigate('StudyTips')}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#6C5CE720', '#6C5CE710']}
              style={styles.tipGradient}
            >
              <View style={styles.tipHeader}>
                <View style={styles.tipIcon}>
                  <Ionicons name="bulb" size={28} color="#6C5CE7" />
                </View>
                <View>
                  <Text style={styles.tipTitle}>Study Tip of the Day</Text>
                  <Text style={styles.tipSubtitle}>Boost your learning</Text>
                </View>
              </View>
              <Text style={styles.tipText} numberOfLines={2}>
                {dailyTip}
              </Text>
              <View style={styles.tipAction}>
                <Text style={styles.tipActionText}>View all tips</Text>
                <Ionicons name="arrow-forward" size={16} color="#6C5CE7" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Tutor Request */}
        <TouchableOpacity 
          style={styles.quickRequestCard}
          onPress={() => navigation.navigate('RequestTutor')}
        >
          <LinearGradient
            colors={['#00B89420', '#00B89410']}
            style={styles.quickRequestGradient}
          >
            <View style={styles.quickRequestHeader}>
              <View style={styles.quickRequestIcon}>
                <Ionicons name="school" size={28} color="#00B894" />
              </View>
              <View style={styles.quickRequestInfo}>
                <Text style={styles.quickRequestTitle}>Need 1-on-1 Help?</Text>
                <Text style={styles.quickRequestText}>Connect with certified tutors</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.requestTutorButton}
              onPress={() => navigation.navigate('RequestTutor')}
            >
              <Ionicons name="chatbubble-ellipses" size={18} color="#FFF" />
              <Text style={styles.requestTutorText}>Request Tutor</Text>
            </TouchableOpacity>
          </LinearGradient>
        </TouchableOpacity>

        {/* Next Reminder */}
        {nextReminder && (
          <TouchableOpacity 
            style={styles.reminderCard}
            onPress={() => navigation.navigate('StudyReminder')}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#FD79A820', '#FD79A810']}
              style={styles.reminderGradient}
            >
              <View style={styles.reminderHeader}>
                <View style={styles.reminderIcon}>
                  <Ionicons name="notifications" size={28} color="#FD79A8" />
                </View>
                <View style={styles.reminderInfo}>
                  <Text style={styles.reminderTitle}>Next Study Reminder</Text>
                  <Text style={styles.reminderTime}>{nextReminder.time} • {nextReminder.title}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#FD79A8" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Motivation Quote */}
        <View style={styles.motivationCard}>
          <LinearGradient
            colors={['#1E2340', '#2D3561']}
            style={styles.motivationGradient}
          >
            <View style={styles.motivationIcon}>
              <Ionicons name="chatbubble-ellipses" size={28} color="#74B9FF" />
            </View>
            <Text style={styles.motivationText}>
              "Success is the sum of small efforts, repeated day in and day out."
            </Text>
            <Text style={styles.motivationAuthor}>– Robert Collier</Text>
          </LinearGradient>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <LinearGradient
            colors={['#1E2340', '#0A0E27']}
            style={styles.footerGradient}
          >
            <Ionicons name="school" size={24} color="#6C5CE7" />
            <Text style={styles.footerText}>StuddyHub • Your Matric Success Partner</Text>
            <Text style={styles.footerSubtext}>Keep learning, keep growing! 📚</Text>
          </LinearGradient>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0A0E27' 
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0E27',
  },
  loadingGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
  header: { 
    paddingTop: 60,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30, 
    borderBottomRightRadius: 30,
    marginBottom: 10,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTextContainer: {
    flex: 1,
  },
  greeting: { 
    fontSize: 14, 
    color: '#A29BFE',
    marginBottom: 4,
  },
  name: { 
    fontSize: 28, 
    fontWeight: '800', 
    color: '#FFF', 
    marginBottom: 6,
  },
  schoolInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subtitle: { 
    fontSize: 14, 
    color: '#A29BFE',
  },
  profileButton: { 
    position: 'relative',
    marginLeft: 15,
  },
  avatar: { 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#6C5CE7',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
  },
  avatarText: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: '#6C5CE7' 
  },
  adminBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#6C5CE7',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1E2340',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  communityStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginTop: 10,
  },
  communityItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  communityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  communityNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
  },
  communityLabel: {
    fontSize: 10,
    color: '#A29BFE',
    marginTop: 2,
  },
  communityDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 8,
  },
  countdownCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#FF7675',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  countdownGradient: {
    padding: 25,
    borderRadius: 25,
  },
  countdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  countdownIcon: {
    marginRight: 15,
  },
  countdownTitle: {
    flex: 1,
  },
  countdownLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 1,
    opacity: 0.9,
  },
  countdownExam: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    marginTop: 4,
  },
  editButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
  },
  countdownTimer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  timeUnit: {
    alignItems: 'center',
    flex: 1,
  },
  timeBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 10,
    borderRadius: 12,
    width: '90%',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
  },
  timeLabel: {
    fontSize: 11,
    color: '#FFF',
    fontWeight: '600',
    letterSpacing: 1,
    opacity: 0.9,
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
    opacity: 0.7,
    marginTop: -10,
  },
  studyPlanButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  studyPlanText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  progressCard: { 
    backgroundColor: '#1E2340', 
    marginHorizontal: 20, 
    marginBottom: 20,
    padding: 25, 
    borderRadius: 25, 
    borderWidth: 1, 
    borderColor: '#2D3561',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  progressHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20 
  },
  progressTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#FFF' 
  },
  goalInfo: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    backgroundColor: '#00B89420', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00B89440',
  },
  goalText: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: '#00B894' 
  },
  progressBarContainer: { 
    marginBottom: 25 
  },
  progressBar: { 
    height: 10, 
    backgroundColor: '#2D3561', 
    borderRadius: 5, 
    marginBottom: 12, 
    overflow: 'hidden' 
  },
  progressFill: { 
    height: '100%', 
    borderRadius: 5 
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: { 
    fontSize: 16, 
    fontWeight: '700',
    color: '#FFF' 
  },
  progressGoal: { 
    fontSize: 14, 
    color: '#A29BFE' 
  },
  statsGrid: { 
    flexDirection: 'row',
    gap: 15,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#0A0E27',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 1,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: '#FFF', 
    marginBottom: 4 
  },
  statLabel: { 
    fontSize: 11, 
    color: '#636E72',
    textAlign: 'center',
  },
  section: { 
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: 20 
  },
  sectionTitle: { 
    fontSize: 22, 
    fontWeight: '700', 
    color: '#FFF',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#A29BFE',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
  },
  seeAll: { 
    fontSize: 14, 
    color: '#6C5CE7', 
    fontWeight: '600' 
  },
  actionsGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 12 
  },
  actionCard: { 
    width: (width - 52) / 4, 
    backgroundColor: '#1E2340', 
    borderRadius: 20, 
    padding: 16, 
    alignItems: 'center',
    borderWidth: 1, 
    borderColor: '#2D3561',
    marginBottom: 12,
  },
  actionIcon: { 
    width: 56, 
    height: 56, 
    borderRadius: 18, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  actionLabel: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: '#FFF', 
    textAlign: 'center' 
  },
  tutorsList: {
    paddingBottom: 10,
  },
  tutorCard: {
    width: 160,
    marginRight: 15,
    borderRadius: 20,
    overflow: 'hidden',
  },
  tutorGradient: {
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  tutorImageContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  tutorImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#6C5CE7',
  },
  tutorInitials: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6C5CE7',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  tutorInitialsText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFF',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1E2340',
  },
  tutorInfo: {
    width: '100%',
    alignItems: 'center',
  },
  tutorName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  tutorRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 12,
    color: '#FDCB6E',
    fontWeight: '600',
    marginLeft: 4,
  },
  tutorSubjects: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  subjectText: {
    fontSize: 12,
    color: '#A29BFE',
    flex: 1,
  },
  tutorPrice: {
    backgroundColor: '#00B89420',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00B89440',
  },
  priceText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#00B894',
  },
  resourceCards: {
    flexDirection: 'row',
    gap: 15,
  },
  mainResourceCard: {
    flex: 2,
    borderRadius: 20,
    overflow: 'hidden',
  },
  mainResourceGradient: {
    padding: 20,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  resourceIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  mainResourceTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  mainResourceCount: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 15,
  },
  resourceArrow: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  resourceGrid: {
    flex: 3,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  smallResourceCard: {
    width: (width - 90) / 2,
    backgroundColor: '#1E2340',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  smallResourceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  smallResourceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center',
  },
  announcementsCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 25,
    overflow: 'hidden',
  },
  announcementsGradient: {
    padding: 25,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#FDCB6E30',
  },
  announcementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  announcementsIcon: {
    marginRight: 15,
  },
  announcementsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FDCB6E',
    marginBottom: 4,
  },
  announcementsSubtitle: {
    fontSize: 12,
    color: '#FDCB6E',
    opacity: 0.8,
  },
  announcementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#FDCB6E10',
  },
  announcementContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  announcementDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FDCB6E',
    marginRight: 12,
  },
  announcementTextContainer: {
    flex: 1,
  },
  announcementText: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: '600',
  },
  announcementDate: {
    fontSize: 12,
    color: '#FDCB6E',
    marginTop: 2,
  },
  tipCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 25,
    overflow: 'hidden',
  },
  tipGradient: {
    padding: 25,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#6C5CE730',
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  tipIcon: {
    marginRight: 15,
  },
  tipTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6C5CE7',
    marginBottom: 2,
  },
  tipSubtitle: {
    fontSize: 12,
    color: '#6C5CE7',
    opacity: 0.8,
  },
  tipText: { 
    fontSize: 16, 
    color: '#FFF', 
    lineHeight: 22, 
    marginBottom: 15 
  },
  tipAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#6C5CE710',
  },
  tipActionText: { 
    fontSize: 14, 
    color: '#6C5CE7', 
    fontWeight: '600' 
  },
  quickRequestCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 25,
    overflow: 'hidden',
  },
  quickRequestGradient: {
    padding: 25,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#00B89430',
  },
  quickRequestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  quickRequestIcon: {
    marginRight: 15,
  },
  quickRequestInfo: {
    flex: 1,
  },
  quickRequestTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#00B894',
    marginBottom: 4,
  },
  quickRequestText: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.9,
  },
  requestTutorButton: {
    backgroundColor: '#00B894',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 14,
  },
  requestTutorText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  reminderCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 25,
    overflow: 'hidden',
  },
  reminderGradient: {
    padding: 25,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#FD79A830',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reminderIcon: {
    marginRight: 15,
  },
  reminderInfo: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FD79A8',
    marginBottom: 4,
  },
  reminderTime: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.9,
  },
  motivationCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 25,
    overflow: 'hidden',
  },
  motivationGradient: {
    padding: 25,
    borderRadius: 25,
    alignItems: 'center',
  },
  motivationIcon: {
    marginBottom: 15,
  },
  motivationText: { 
    fontSize: 16, 
    fontStyle: 'italic', 
    color: '#FFF', 
    textAlign: 'center', 
    marginBottom: 12, 
    lineHeight: 24 
  },
  motivationAuthor: { 
    fontSize: 14, 
    color: '#74B9FF', 
    fontWeight: '600' 
  },
  footer: {
    marginHorizontal: 20,
    marginBottom: 30,
    borderRadius: 25,
    overflow: 'hidden',
  },
  footerGradient: {
    padding: 30,
    borderRadius: 25,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 15,
    marginBottom: 8,
    textAlign: 'center',
  },
  footerSubtext: {
    fontSize: 12,
    color: '#A29BFE',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '70%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  modalGradient: {
    flex: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
  },
  modalBody: {
    flex: 1,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A29BFE',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#1E2340',
    borderWidth: 1,
    borderColor: '#2D3561',
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    fontSize: 15,
    marginBottom: 20,
  },
  datePicker: {
    backgroundColor: '#1E2340',
    borderRadius: 12,
    marginBottom: 20,
  },
  selectedDate: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2340',
    padding: 16,
    borderRadius: 12,
    marginBottom: 25,
    gap: 10,
  },
  selectedDateText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
  },
  saveButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 18,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});