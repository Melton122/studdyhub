import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Switch, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../context/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';

const subjects = [
  'Mathematics', 'Physical Sciences', 'Life Sciences', 'Geography',
  'History', 'Accounting', 'Business Studies', 'Economics',
  'English Home Language', 'English First Additional',
  'Afrikaans', 'IsiZulu', 'Life Orientation'
];

export default function GoalSettingScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [goals, setGoals] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [newGoal, setNewGoal] = useState({
    title: '',
    subject: '',
    target_hours: 10,
    target_date: new Date(new Date().setMonth(new Date().getMonth() + 1)),
    priority: 'medium',
    description: '',
    is_public: false,
  });

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('study_goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGoals(data || []);
    } catch (error) {
      console.error('Error fetching goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddGoal = async () => {
    if (!newGoal.title.trim() || !newGoal.subject) {
      Alert.alert('Missing Information', 'Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      
      const goalData = {
        user_id: user.id,
        title: newGoal.title,
        subject: newGoal.subject,
        target_hours: newGoal.target_hours,
        target_date: newGoal.target_date.toISOString().split('T')[0],
        priority: newGoal.priority,
        description: newGoal.description,
        is_public: newGoal.is_public,
        progress: 0,
        status: 'active',
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('study_goals')
        .insert([goalData])
        .select()
        .single();

      if (error) throw error;

      setGoals([data, ...goals]);
      setShowAddModal(false);
      resetNewGoal();
      Alert.alert('Success', 'Goal added successfully! 🎯');
    } catch (error) {
      console.error('Error adding goal:', error);
      Alert.alert('Error', 'Failed to add goal');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGoal = async (goalId) => {
    Alert.alert(
      'Delete Goal',
      'Are you sure you want to delete this goal?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('study_goals')
                .delete()
                .eq('id', goalId);

              if (error) throw error;

              setGoals(goals.filter(goal => goal.id !== goalId));
              Alert.alert('Success', 'Goal deleted');
            } catch (error) {
              console.error('Error deleting goal:', error);
              Alert.alert('Error', 'Failed to delete goal');
            }
          }
        }
      ]
    );
  };

  const resetNewGoal = () => {
    setNewGoal({
      title: '',
      subject: '',
      target_hours: 10,
      target_date: new Date(new Date().setMonth(new Date().getMonth() + 1)),
      priority: 'medium',
      description: '',
      is_public: false,
    });
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#FF7675';
      case 'medium': return '#FDCB6E';
      case 'low': return '#74B9FF';
      default: return '#636E72';
    }
  };

  const getProgressPercentage = (goal) => {
    return Math.min(Math.round((goal.progress / goal.target_hours) * 100), 100);
  };

  const renderGoalItem = ({ item }) => (
    <TouchableOpacity style={styles.goalCard} activeOpacity={0.9}>
      <LinearGradient
        colors={['#1E2340', '#2D3561']}
        style={styles.goalGradient}
      >
        <View style={styles.goalHeader}>
          <View style={styles.goalTitleContainer}>
            <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(item.priority) }]} />
            <View style={styles.goalTitleWrapper}>
              <Text style={styles.goalTitle}>{item.title}</Text>
              <Text style={styles.goalSubject}>{item.subject}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => handleDeleteGoal(item.id)}>
            <Ionicons name="close" size={20} color="#636E72" />
          </TouchableOpacity>
        </View>

        <Text style={styles.goalDescription} numberOfLines={2}>
          {item.description || 'No description provided'}
        </Text>

        <View style={styles.progressContainer}>
          <View style={styles.progressLabels}>
            <Text style={styles.progressText}>
              {item.progress}h / {item.target_hours}h
            </Text>
            <Text style={styles.progressPercentage}>{getProgressPercentage(item)}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill,
                { 
                  width: `${getProgressPercentage(item)}%`,
                  backgroundColor: getPriorityColor(item.priority)
                }
              ]} 
            />
          </View>
        </View>

        <View style={styles.goalFooter}>
          <View style={styles.goalMeta}>
            <Ionicons name="calendar" size={14} color="#636E72" />
            <Text style={styles.goalDate}>
              Target: {new Date(item.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
          </View>
          {item.is_public && (
            <View style={styles.publicBadge}>
              <Ionicons name="globe" size={12} color="#6C5CE7" />
              <Text style={styles.publicText}>Public</Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6C5CE7" />
        <Text style={styles.loadingText}>Loading your goals...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#1E2340', '#6C5CE7']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Study Goals</Text>
            <Text style={styles.headerSubtitle}>Set and track your academic targets</Text>
          </View>
          <TouchableOpacity 
            style={styles.addGoalButton}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Goals Stats */}
      <View style={styles.statsOverview}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{goals.length}</Text>
          <Text style={styles.statLabel}>Total Goals</Text>
        </View>
        
        <View style={styles.statDivider} />
        
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#00B894' }]}>
            {goals.filter(g => getProgressPercentage(g) >= 100).length}
          </Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        
        <View style={styles.statDivider} />
        
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#FDCB6E' }]}>
            {goals.filter(g => getProgressPercentage(g) > 0 && getProgressPercentage(g) < 100).length}
          </Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
      </View>

      {/* Goals List */}
      {goals.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="flag-outline" size={80} color="#636E72" />
          <Text style={styles.emptyTitle}>No Goals Yet</Text>
          <Text style={styles.emptyText}>
            Set your first study goal to stay motivated and track your progress
          </Text>
          <TouchableOpacity 
            style={styles.createButton}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add-circle" size={20} color="#FFF" />
            <Text style={styles.createButtonText}>Set First Goal</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Goals ({goals.length})</Text>
            <Text style={styles.sectionSubtitle}>Tap to view details and update progress</Text>
          </View>
          {goals.map((goal, index) => (
            <View key={goal.id}>
              {renderGoalItem({ item: goal, index })}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Add Goal Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={['#1E2340', '#0A0E27']}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Set New Goal</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <Ionicons name="close" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Title */}
                <Text style={styles.formLabel}>Goal Title *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Master Algebra"
                  placeholderTextColor="#636E72"
                  value={newGoal.title}
                  onChangeText={(text) => setNewGoal({...newGoal, title: text})}
                />

                {/* Subject */}
                <Text style={styles.formLabel}>Subject *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subjectsScroll}>
                  {subjects.map((subject, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.subjectChip,
                        newGoal.subject === subject && styles.subjectChipActive
                      ]}
                      onPress={() => setNewGoal({...newGoal, subject})}
                    >
                      <Text style={[
                        styles.subjectChipText,
                        newGoal.subject === subject && styles.subjectChipTextActive
                      ]}>
                        {subject}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Target Hours */}
                <Text style={styles.formLabel}>Target Study Hours: {newGoal.target_hours}h</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={5}
                  maximumValue={100}
                  step={5}
                  value={newGoal.target_hours}
                  onValueChange={(value) => setNewGoal({...newGoal, target_hours: value})}
                  minimumTrackTintColor="#6C5CE7"
                  maximumTrackTintColor="#2D3561"
                  thumbTintColor="#6C5CE7"
                />
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderLabel}>5h</Text>
                  <Text style={styles.sliderLabel}>50h</Text>
                  <Text style={styles.sliderLabel}>100h</Text>
                </View>

                {/* Priority */}
                <Text style={styles.formLabel}>Priority</Text>
                <View style={styles.priorityButtons}>
                  {['high', 'medium', 'low'].map(priority => (
                    <TouchableOpacity
                      key={priority}
                      style={[
                        styles.priorityButton,
                        { backgroundColor: getPriorityColor(priority) + '20' },
                        newGoal.priority === priority && { borderColor: getPriorityColor(priority) }
                      ]}
                      onPress={() => setNewGoal({...newGoal, priority})}
                    >
                      <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(priority) }]} />
                      <Text style={[
                        styles.priorityButtonText,
                        { color: getPriorityColor(priority) }
                      ]}>
                        {priority.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Description */}
                <Text style={styles.formLabel}>Description (Optional)</Text>
                <TextInput
                  style={styles.descriptionInput}
                  placeholder="Describe your goal and why it's important..."
                  placeholderTextColor="#636E72"
                  value={newGoal.description}
                  onChangeText={(text) => setNewGoal({...newGoal, description: text})}
                  multiline
                  numberOfLines={3}
                />

                {/* Public Setting */}
                <View style={styles.publicSetting}>
                  <View>
                    <Text style={styles.publicSettingTitle}>Make Goal Public</Text>
                    <Text style={styles.publicSettingText}>Other students can see and be inspired</Text>
                  </View>
                  <Switch
                    value={newGoal.is_public}
                    onValueChange={(value) => setNewGoal({...newGoal, is_public: value})}
                    trackColor={{ false: '#2D3561', true: '#6C5CE7' }}
                    thumbColor="#FFF"
                  />
                </View>

                {/* Add Button */}
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={handleAddGoal}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="flag" size={20} color="#FFF" />
                      <Text style={styles.addButtonText}>Set Goal</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </View>
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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#A29BFE',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
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
  addGoalButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsOverview: {
    flexDirection: 'row',
    backgroundColor: '#1E2340',
    marginHorizontal: 20,
    marginTop: -15,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#636E72',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#2D3561',
  },
  scrollView: {
    flex: 1,
    paddingTop: 20,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#A29BFE',
  },
  goalCard: {
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 20,
    overflow: 'hidden',
  },
  goalGradient: {
    padding: 20,
    borderRadius: 20,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  goalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  goalTitleWrapper: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 2,
  },
  goalSubject: {
    fontSize: 13,
    color: '#A29BFE',
  },
  goalDescription: {
    fontSize: 14,
    color: '#A29BFE',
    lineHeight: 20,
    marginBottom: 20,
  },
  progressContainer: {
    marginBottom: 15,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
  },
  progressPercentage: {
    fontSize: 14,
    color: '#00B894',
    fontWeight: '700',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#2D3561',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  goalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  goalDate: {
    fontSize: 12,
    color: '#636E72',
  },
  publicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#6C5CE720',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  publicText: {
    fontSize: 10,
    color: '#6C5CE7',
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#A29BFE',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  createButton: {
    backgroundColor: '#6C5CE7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    maxHeight: '90%',
  },
  modalGradient: {
    paddingTop: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3561',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
  },
  modalBody: {
    padding: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A29BFE',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#0A0E27',
    borderWidth: 1,
    borderColor: '#2D3561',
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    fontSize: 15,
  },
  subjectsScroll: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  subjectChip: {
    backgroundColor: '#1E2340',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D3561',
    marginRight: 8,
  },
  subjectChipActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  subjectChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A29BFE',
  },
  subjectChipTextActive: {
    color: '#FFF',
  },
  slider: {
    height: 40,
    marginBottom: 8,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    fontSize: 12,
    color: '#636E72',
  },
  priorityButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  priorityButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  descriptionInput: {
    backgroundColor: '#0A0E27',
    borderWidth: 1,
    borderColor: '#2D3561',
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    fontSize: 15,
    height: 80,
    textAlignVertical: 'top',
  },
  publicSetting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E2340',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  publicSettingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 2,
  },
  publicSettingText: {
    fontSize: 12,
    color: '#A29BFE',
  },
  addButton: {
    backgroundColor: '#6C5CE7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 18,
    borderRadius: 14,
    marginTop: 24,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});