import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../context/AuthContext';
import { useStudy } from '../context/StudyContext';

const { width } = Dimensions.get('window');

export default function StudyAnalyticsScreen() {
  const { user } = useAuth();
  const { studyStats = {}, getStudyProgress = () => 0 } = useStudy(); // Default values
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('week'); // 'week', 'month', 'year'
  const [studyData, setStudyData] = useState({
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    dailyHours: [0, 0, 0, 0, 0, 0, 0],
    focusTrend: [0, 0, 0, 0, 0, 0, 0],
    subjectDistribution: [],
    bestStudyTimes: [],
  });
  const [sessionStats, setSessionStats] = useState({
    totalSessions: 0,
    avgFocus: 0,
    bestDay: '',
    totalHours: 0,
  });

  useEffect(() => {
    fetchAnalytics();
  }, [user, timeRange]);

  const fetchAnalytics = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let startDate;
      const today = new Date();

      switch (timeRange) {
        case 'week':
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(today);
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'year':
          startDate = new Date(today);
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 7);
      }

      // Fetch study sessions for the time range
      const { data: sessions, error: sessionsError } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (sessionsError) {
        console.error('Sessions error:', sessionsError);
        // Continue with empty data instead of throwing
      }

      // Fetch flashcard mastery data
      const { data: flashcards, error: flashcardError } = await supabase
        .from('flash_cards')
        .select('subject_id, mastery_level, difficulty_level, subjects(name)')
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString());

      if (flashcardError) {
        console.error('Flashcards error:', flashcardError);
      }

      // Process data for charts
      const processedData = await processStudyData(sessions || []);
      
      // Calculate subject distribution from flashcards
      const subjectDist = await calculateSubjectDistribution(flashcards || []);
      
      // Calculate session statistics
      const stats = calculateSessionStats(sessions || []);
      
      setStudyData({
        ...processedData,
        subjectDistribution: subjectDist,
      });
      setSessionStats(stats);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      // Set default data on error
      setStudyData({
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        dailyHours: [0, 0, 0, 0, 0, 0, 0],
        focusTrend: [0, 0, 0, 0, 0, 0, 0],
        subjectDistribution: [
          { name: 'No Data', hours: 1, color: '#636E72', legendFontColor: '#FFF' }
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  const processStudyData = async (sessions) => {
    if (!sessions || sessions.length === 0) {
      return {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        dailyHours: [0, 0, 0, 0, 0, 0, 0],
        focusTrend: [0, 0, 0, 0, 0, 0, 0],
      };
    }

    // Group by day for the last 7 days
    const dailyData = {};
    const focusData = {};
    
    // Initialize last 7 days
    const labels = [];
    const dailyHours = [];
    const focusTrend = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
      dailyData[dateKey] = 0;
      focusData[dateKey] = [];
    }

    // Fill with actual data
    sessions.forEach(session => {
      if (!session || !session.created_at) return;
      
      const sessionDate = new Date(session.created_at);
      const dateKey = sessionDate.toISOString().split('T')[0];
      const hours = (session.duration || 0) / 3600;
      
      if (dailyData[dateKey] !== undefined) {
        dailyData[dateKey] += hours;
        focusData[dateKey].push(session.focus_level || 3);
      }
    });

    // Convert to arrays for charts
    Object.keys(dailyData).forEach((dateKey, index) => {
      dailyHours.push(dailyData[dateKey]);
      
      const avgFocus = focusData[dateKey]?.length > 0 
        ? focusData[dateKey].reduce((a, b) => a + b, 0) / focusData[dateKey].length
        : 0;
      focusTrend.push(avgFocus);
    });

    return {
      labels,
      dailyHours,
      focusTrend,
    };
  };

  const calculateSubjectDistribution = async (flashcards) => {
    if (!flashcards || flashcards.length === 0) {
      return [
        { name: 'No Data', hours: 1, color: '#636E72', legendFontColor: '#FFF' }
      ];
    }

    const subjectMap = {};
    
    flashcards.forEach(card => {
      if (!card) return;
      
      const subjectName = card.subjects?.name || 'Other';
      if (!subjectMap[subjectName]) {
        subjectMap[subjectName] = { 
          name: subjectName, 
          hours: 0, 
          color: getSubjectColor(subjectName),
          legendFontColor: '#FFF'
        };
      }
      subjectMap[subjectName].hours += 1;
    });

    return Object.values(subjectMap).sort((a, b) => b.hours - a.hours);
  };

  const calculateSessionStats = (sessions) => {
    if (!sessions || sessions.length === 0) {
      return {
        totalSessions: 0,
        avgFocus: 0,
        bestDay: 'N/A',
        totalHours: 0,
      };
    }

    const validSessions = sessions.filter(s => s && s.duration);
    if (validSessions.length === 0) {
      return {
        totalSessions: 0,
        avgFocus: 0,
        bestDay: 'N/A',
        totalHours: 0,
      };
    }

    const totalHours = validSessions.reduce((sum, session) => sum + (session.duration || 0), 0) / 3600;
    const avgFocus = validSessions.reduce((sum, session) => sum + (session.focus_level || 0), 0) / validSessions.length;
    
    // Find best day (most sessions)
    const dayCounts = {};
    validSessions.forEach(session => {
      const day = new Date(session.created_at).toLocaleDateString('en-US', { weekday: 'long' });
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    
    const bestDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    return {
      totalSessions: validSessions.length,
      avgFocus: Math.round(avgFocus * 10) / 10,
      bestDay,
      totalHours: Math.round(totalHours * 10) / 10,
    };
  };

  const getSubjectColor = (subject) => {
    const colors = [
      '#6C5CE7', '#00B894', '#FD79A8', '#FDCB6E', '#74B9FF',
      '#A29BFE', '#FF7675', '#00CEC9', '#FFAA00', '#AA00FF'
    ];
    
    if (!subject) return colors[0];
    
    // Simple hash function for consistent colors
    let hash = 0;
    for (let i = 0; i < subject.length; i++) {
      hash = subject.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  const renderTimeRangeButtons = () => (
    <View style={styles.timeRangeButtons}>
      {['week', 'month', 'year'].map(range => (
        <TouchableOpacity
          key={range}
          style={[
            styles.timeRangeButton,
            timeRange === range && styles.timeRangeButtonActive
          ]}
          onPress={() => setTimeRange(range)}
        >
          <Text style={[
            styles.timeRangeText,
            timeRange === range && styles.timeRangeTextActive
          ]}>
            {range.charAt(0).toUpperCase() + range.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6C5CE7" />
        <Text style={styles.loadingText}>Loading your study analytics...</Text>
      </View>
    );
  }

  const progress = getStudyProgress();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Study Analytics</Text>
        <Text style={styles.headerSubtitle}>
          Track your progress and optimize your study habits
        </Text>
      </View>

      {/* Quick Stats */}
      <View style={styles.quickStats}>
        <View style={styles.statCard}>
          <Ionicons name="stats-chart" size={24} color="#6C5CE7" />
          <Text style={styles.statNumber}>{sessionStats.totalSessions}</Text>
          <Text style={styles.statLabel}>Sessions</Text>
        </View>
        
        <View style={styles.statCard}>
          <Ionicons name="time" size={24} color="#00B894" />
          <Text style={styles.statNumber}>{sessionStats.totalHours}h</Text>
          <Text style={styles.statLabel}>Total Hours</Text>
        </View>
        
        <View style={styles.statCard}>
          <Ionicons name="star" size={24} color="#FDCB6E" />
          <Text style={styles.statNumber}>{sessionStats.avgFocus}/5</Text>
          <Text style={styles.statLabel}>Avg Focus</Text>
        </View>
      </View>

      {/* Time Range Selector */}
      {renderTimeRangeButtons()}

      {/* Study Hours Chart */}
      <View style={styles.chartSection}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Daily Study Hours</Text>
          <Text style={styles.chartSubtitle}>Last 7 days</Text>
        </View>
        {studyData.dailyHours.some(h => h > 0) ? (
          <LineChart
            data={{
              labels: studyData.labels,
              datasets: [{
                data: studyData.dailyHours,
                color: (opacity = 1) => `rgba(108, 92, 231, ${opacity})`,
                strokeWidth: 2
              }]
            }}
            width={width - 40}
            height={200}
            chartConfig={{
              backgroundColor: '#1E2340',
              backgroundGradientFrom: '#1E2340',
              backgroundGradientTo: '#1E2340',
              decimalPlaces: 1,
              color: (opacity = 1) => `rgba(108, 92, 231, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
              style: { borderRadius: 16 },
              propsForDots: {
                r: "5",
                strokeWidth: "2",
                stroke: "#6C5CE7"
              }
            }}
            bezier
            style={styles.chart}
            formatYLabel={(value) => `${parseFloat(value).toFixed(1)}h`}
          />
        ) : (
          <View style={styles.noDataContainer}>
            <Ionicons name="bar-chart-outline" size={60} color="#636E72" />
            <Text style={styles.noDataText}>No study data available</Text>
            <Text style={styles.noDataSubtext}>Complete some study sessions to see your progress</Text>
          </View>
        )}
      </View>

      {/* Focus Trend Chart */}
      <View style={styles.chartSection}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Focus Level Trend</Text>
          <Text style={styles.chartSubtitle}>Average focus per day (1-5 scale)</Text>
        </View>
        {studyData.focusTrend.some(f => f > 0) ? (
          <BarChart
            data={{
              labels: studyData.labels,
              datasets: [{
                data: studyData.focusTrend,
              }]
            }}
            width={width - 40}
            height={200}
            chartConfig={{
              backgroundColor: '#1E2340',
              backgroundGradientFrom: '#1E2340',
              backgroundGradientTo: '#1E2340',
              decimalPlaces: 1,
              color: (opacity = 1) => `rgba(0, 184, 148, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
              style: { borderRadius: 16 }
            }}
            style={styles.chart}
            fromZero={true}
            showValuesOnTopOfBars={true}
            withInnerLines={false}
          />
        ) : (
          <View style={styles.noDataContainer}>
            <Ionicons name="trending-up-outline" size={60} color="#636E72" />
            <Text style={styles.noDataText}>No focus data available</Text>
          </View>
        )}
      </View>

      {/* Subject Distribution */}
      <View style={styles.chartSection}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Subject Distribution</Text>
          <Text style={styles.chartSubtitle}>Based on your flashcards</Text>
        </View>
        {studyData.subjectDistribution && studyData.subjectDistribution.length > 0 && studyData.subjectDistribution[0].name !== 'No Data' ? (
          <>
            <PieChart
              data={studyData.subjectDistribution}
              width={width - 40}
              height={200}
              chartConfig={{
                color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
              }}
              accessor="hours"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />
            <View style={styles.legend}>
              {studyData.subjectDistribution.map((item, index) => (
                <View key={index} style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: item.color }]} />
                  <Text style={styles.legendText}>
                    {item.name}: {item.hours} cards
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.noDataContainer}>
            <Ionicons name="pie-chart-outline" size={60} color="#636E72" />
            <Text style={styles.noDataText}>No subject data available</Text>
            <Text style={styles.noDataSubtext}>Create some flashcards to see distribution</Text>
          </View>
        )}
      </View>

      {/* Study Insights */}
      <View style={styles.insightsSection}>
        <View style={styles.sectionHeader}>
          <Ionicons name="bulb" size={24} color="#FDCB6E" />
          <Text style={styles.sectionTitle}>Study Insights</Text>
        </View>
        
        {sessionStats.totalSessions > 0 ? (
          <>
            <View style={styles.insightCard}>
              <Ionicons name="calendar" size={20} color="#6C5CE7" />
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>Your Best Study Day</Text>
                <Text style={styles.insightText}>
                  You're most productive on {sessionStats.bestDay}. Try scheduling important study sessions on this day.
                </Text>
              </View>
            </View>
            
            <View style={styles.insightCard}>
              <Ionicons name="trending-up" size={20} color="#00B894" />
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>Consistency Streak</Text>
                <Text style={styles.insightText}>
                  You've maintained a {studyStats?.streakDays || 0}-day streak! Keep going for better knowledge retention.
                </Text>
              </View>
            </View>
            
            <View style={styles.insightCard}>
              <Ionicons name="star" size={20} color="#FD79A8" />
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>Focus Level</Text>
                <Text style={styles.insightText}>
                  Your average focus score is {sessionStats.avgFocus}/5. Try the Pomodoro technique to improve focus.
                </Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.noDataInsight}>
            <Text style={styles.noDataInsightText}>
              Complete your first study session to unlock personalized insights!
            </Text>
            <TouchableOpacity 
              style={styles.startSessionButton}
              onPress={() => {
                // Navigate to Pomodoro or Study Timer
                // navigation.navigate('Pomodoro');
              }}
            >
              <Text style={styles.startSessionText}>Start a Study Session</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E27',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0E27',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#A29BFE',
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
  quickStats: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
    gap: 12,
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
    textAlign: 'center',
  },
  timeRangeButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
    marginBottom: 20,
  },
  timeRangeButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E2340',
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  timeRangeButtonActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  timeRangeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636E72',
  },
  timeRangeTextActive: {
    color: '#FFF',
  },
  chartSection: {
    backgroundColor: '#1E2340',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  chartHeader: {
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 12,
    color: '#636E72',
  },
  chart: {
    borderRadius: 16,
    marginLeft: -20,
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noDataText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginTop: 12,
    marginBottom: 8,
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#636E72',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#A29BFE',
  },
  insightsSection: {
    padding: 20,
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#1E2340',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  insightText: {
    fontSize: 13,
    color: '#A29BFE',
    lineHeight: 18,
  },
  noDataInsight: {
    backgroundColor: '#1E2340',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  noDataInsightText: {
    fontSize: 14,
    color: '#A29BFE',
    textAlign: 'center',
    marginBottom: 16,
  },
  startSessionButton: {
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  startSessionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
});