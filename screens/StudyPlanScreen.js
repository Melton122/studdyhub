import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, TextInput, Alert, Modal, ActivityIndicator,
  RefreshControl, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../context/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const subjects = [
  'Mathematics', 'Physical Sciences', 'Life Sciences', 'Geography',
  'History', 'Accounting', 'Business Studies', 'Economics',
  'English Home Language', 'English First Additional',
  'Afrikaans', 'IsiZulu', 'Life Orientation'
];

export default function StudyPlanScreen({ navigation }) {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [newPlan, setNewPlan] = useState({
    title: '',
    subject: '',
    topic: '',
    duration: 60,
    study_date: new Date(),
    start_time: new Date(),
    priority: 'medium',
    status: 'pending',
    notes: '',
  });

  useEffect(() => {
    fetchStudyPlans();
  }, []);

  const fetchStudyPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('study_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('study_date', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching study plans:', error);
      Alert.alert('Error', 'Failed to load study plans');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStudyPlans();
  };

  const handleAddPlan = async () => {
    if (!newPlan.title.trim() || !newPlan.subject) {
      Alert.alert('Missing Information', 'Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const planData = {
        user_id: user.id,
        title: newPlan.title,
        subject: newPlan.subject,
        topic: newPlan.topic,
        duration: newPlan.duration,
        study_date: newPlan.study_date.toISOString().split('T')[0],
        start_time: newPlan.start_time.toTimeString().split(' ')[0].substring(0, 5),
        priority: newPlan.priority,
        status: newPlan.status,
        notes: newPlan.notes,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('study_plans')
        .insert([planData])
        .select()
        .single();

      if (error) throw error;

      setPlans([...plans, data]);
      setShowAddModal(false);
      resetNewPlan();
      Alert.alert('Success', 'Study plan added successfully!');
    } catch (error) {
      console.error('Error adding plan:', error);
      Alert.alert('Error', 'Failed to add study plan');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (planId, newStatus) => {
    try {
      const { error } = await supabase
        .from('study_plans')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', planId);

      if (error) throw error;

      setPlans(plans.map(plan => 
        plan.id === planId ? { ...plan, status: newStatus } : plan
      ));
    } catch (error) {
      console.error('Error updating plan:', error);
      Alert.alert('Error', 'Failed to update plan status');
    }
  };

  const handleDeletePlan = async (planId) => {
    Alert.alert(
      'Delete Plan',
      'Are you sure you want to delete this study plan?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('study_plans')
                .delete()
                .eq('id', planId);

              if (error) throw error;

              setPlans(plans.filter(plan => plan.id !== planId));
              Alert.alert('Success', 'Study plan deleted');
            } catch (error) {
              console.error('Error deleting plan:', error);
              Alert.alert('Error', 'Failed to delete study plan');
            }
          }
        }
      ]
    );
  };

  const resetNewPlan = () => {
    setNewPlan({
      title: '',
      subject: '',
      topic: '',
      duration: 60,
      study_date: new Date(),
      start_time: new Date(),
      priority: 'medium',
      status: 'pending',
      notes: '',
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#00B894';
      case 'in_progress': return '#FDCB6E';
      case 'pending': return '#636E72';
      default: return '#636E72';
    }
  };

  const renderPlanItem = ({ item }) => (
    <TouchableOpacity
      style={styles.planCard}
      onPress={() => setSelectedPlan(item)}
      activeOpacity={0.9}
    >
      <LinearGradient
        colors={['#1E2340', '#2D3561']}
        style={styles.planGradient}
      >
        <View style={styles.planHeader}>
          <View style={styles.planTitleContainer}>
            <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(item.priority) }]} />
            <Text style={styles.planTitle}>{item.title}</Text>
          </View>
          <TouchableOpacity onPress={() => handleDeletePlan(item.id)}>
            <Ionicons name="close" size={20} color="#636E72" />
          </TouchableOpacity>
        </View>

        <View style={styles.planDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="book" size={16} color="#6C5CE7" />
            <Text style={styles.detailText}>{item.subject}</Text>
          </View>
          {item.topic && (
            <View style={styles.detailRow}>
              <Ionicons name="document-text" size={16} color="#74B9FF" />
              <Text style={styles.detailText}>{item.topic}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Ionicons name="time" size={16} color="#FDCB6E" />
            <Text style={styles.detailText}>
              {item.study_date} • {item.start_time} ({item.duration} min)
            </Text>
          </View>
        </View>

        <View style={styles.planFooter}>
          <TouchableOpacity
            style={[styles.statusButton, { backgroundColor: getStatusColor(item.status) + '20' }]}
            onPress={() => {
              const nextStatus = item.status === 'pending' ? 'in_progress' : 
                               item.status === 'in_progress' ? 'completed' : 'pending';
              handleUpdateStatus(item.id, nextStatus);
            }}
          >
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status.replace('_', ' ').toUpperCase()}
            </Text>
          </TouchableOpacity>
          
          {item.notes && (
            <TouchableOpacity>
              <Ionicons name="information-circle" size={20} color="#A29BFE" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const AddPlanModal = () => (
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
              <Text style={styles.modalTitle}>Add New Study Plan</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Title */}
              <Text style={styles.formLabel}>Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Algebra Revision"
                placeholderTextColor="#636E72"
                value={newPlan.title}
                onChangeText={(text) => setNewPlan({...newPlan, title: text})}
              />

              {/* Subject */}
              <Text style={styles.formLabel}>Subject *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subjectsScroll}>
                {subjects.map((subject, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.subjectChip,
                      newPlan.subject === subject && styles.subjectChipActive
                    ]}
                    onPress={() => setNewPlan({...newPlan, subject})}
                  >
                    <Text style={[
                      styles.subjectChipText,
                      newPlan.subject === subject && styles.subjectChipTextActive
                    ]}>
                      {subject}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Topic */}
              <Text style={styles.formLabel}>Topic (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Quadratic Equations"
                placeholderTextColor="#636E72"
                value={newPlan.topic}
                onChangeText={(text) => setNewPlan({...newPlan, topic: text})}
              />

              {/* Date and Time */}
              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.formLabel}>Date</Text>
                  <TouchableOpacity
                    style={styles.dateInput}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={styles.dateText}>
                      {newPlan.study_date.toDateString()}
                    </Text>
                    <Ionicons name="calendar" size={20} color="#6C5CE7" />
                  </TouchableOpacity>
                </View>

                <View style={styles.halfInput}>
                  <Text style={styles.formLabel}>Time</Text>
                  <TouchableOpacity
                    style={styles.dateInput}
                    onPress={() => setShowTimePicker(true)}
                  >
                    <Text style={styles.dateText}>
                      {newPlan.start_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <Ionicons name="time" size={20} color="#6C5CE7" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Duration */}
              <Text style={styles.formLabel}>Duration (minutes)</Text>
              <View style={styles.durationButtons}>
                {[30, 45, 60, 90, 120].map(duration => (
                  <TouchableOpacity
                    key={duration}
                    style={[
                      styles.durationButton,
                      newPlan.duration === duration && styles.durationButtonActive
                    ]}
                    onPress={() => setNewPlan({...newPlan, duration})}
                  >
                    <Text style={[
                      styles.durationButtonText,
                      newPlan.duration === duration && styles.durationButtonTextActive
                    ]}>
                      {duration}
                    </Text>
                  </TouchableOpacity>
                ))}
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
                      newPlan.priority === priority && { borderColor: getPriorityColor(priority) }
                    ]}
                    onPress={() => setNewPlan({...newPlan, priority})}
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

              {/* Notes */}
              <Text style={styles.formLabel}>Notes (Optional)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Additional notes or specific focus areas..."
                placeholderTextColor="#636E72"
                value={newPlan.notes}
                onChangeText={(text) => setNewPlan({...newPlan, notes: text})}
                multiline
                numberOfLines={3}
              />

              {/* Add Button */}
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddPlan}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="add-circle" size={20} color="#FFF" />
                    <Text style={styles.addButtonText}>Add Study Plan</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6C5CE7" />
        <Text style={styles.loadingText}>Loading your study plans...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AddPlanModal />
      
      {showDatePicker && (
        <DateTimePicker
          value={newPlan.study_date}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (date) setNewPlan({...newPlan, study_date: date});
          }}
        />
      )}
      
      {showTimePicker && (
        <DateTimePicker
          value={newPlan.start_time}
          mode="time"
          display="default"
          onChange={(event, date) => {
            setShowTimePicker(false);
            if (date) setNewPlan({...newPlan, start_time: date});
          }}
        />
      )}

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
            <Text style={styles.headerTitle}>Study Plan</Text>
            <Text style={styles.headerSubtitle}>Organize your study schedule</Text>
          </View>
          <TouchableOpacity 
            style={styles.addPlanButton}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.statsOverview}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{plans.length}</Text>
            <Text style={styles.statLabel}>Total Plans</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {plans.filter(p => p.status === 'completed').length}
            </Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {plans.filter(p => p.status === 'in_progress').length}
            </Text>
            <Text style={styles.statLabel}>In Progress</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Plans List */}
      {plans.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={80} color="#636E72" />
          <Text style={styles.emptyTitle}>No Study Plans Yet</Text>
          <Text style={styles.emptyText}>
            Create your first study plan to organize your study schedule
          </Text>
          <TouchableOpacity 
            style={styles.createButton}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add-circle" size={20} color="#FFF" />
            <Text style={styles.createButtonText}>Create First Plan</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={plans}
          renderItem={renderPlanItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#6C5CE7"
            />
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>Your Study Plans ({plans.length})</Text>
              <Text style={styles.listSubtitle}>Tap on any plan to view details</Text>
            </View>
          }
        />
      )}

      {/* Quick Tip */}
      <View style={styles.quickTip}>
        <Ionicons name="bulb" size={20} color="#FDCB6E" />
        <Text style={styles.quickTipText}>
          Tip: Break large topics into smaller 45-60 minute sessions for better focus
        </Text>
      </View>
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
    backgroundColor: '#0A0E27',
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
  addPlanButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsOverview: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
  },
  statItem: {
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
    color: '#A29BFE',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  listContent: {
    padding: 20,
    paddingTop: 20,
  },
  listHeader: {
    marginBottom: 20,
  },
  listTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  listSubtitle: {
    fontSize: 13,
    color: '#A29BFE',
  },
  planCard: {
    marginBottom: 15,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  planGradient: {
    padding: 20,
    borderRadius: 20,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  planTitleContainer: {
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
  planTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    flex: 1,
  },
  planDetails: {
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#A29BFE',
    marginLeft: 10,
    flex: 1,
  },
  planFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
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
  quickTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1E2340',
    margin: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDCB6E30',
  },
  quickTipText: {
    fontSize: 14,
    color: '#FDCB6E',
    flex: 1,
    lineHeight: 20,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  dateInput: {
    backgroundColor: '#0A0E27',
    borderWidth: 1,
    borderColor: '#2D3561',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 15,
    color: '#FFF',
  },
  durationButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  durationButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1E2340',
    borderWidth: 1,
    borderColor: '#2D3561',
    alignItems: 'center',
  },
  durationButtonActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  durationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A29BFE',
  },
  durationButtonTextActive: {
    color: '#FFF',
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
  notesInput: {
    backgroundColor: '#0A0E27',
    borderWidth: 1,
    borderColor: '#2D3561',
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    fontSize: 15,
    height: 100,
    textAlignVertical: 'top',
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