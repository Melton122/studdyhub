import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, Platform, Modal, TextInput,
  FlatList, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../context/AuthContext';

const REMINDER_TYPES = [
  { id: 'study', label: 'Study Session', icon: 'book', color: '#6C5CE7' },
  { id: 'break', label: 'Take a Break', icon: 'cafe', color: '#00B894' },
  { id: 'review', label: 'Review Notes', icon: 'document-text', color: '#FD79A8' },
  { id: 'exam', label: 'Exam Prep', icon: 'school', color: '#FDCB6E' },
  { id: 'goal', label: 'Goal Check-in', icon: 'flag', color: '#74B9FF' },
];

const REPEAT_OPTIONS = [
  { id: 'once', label: 'Once' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekdays', label: 'Weekdays' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

export default function StudyReminderScreen() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingReminder, setEditingReminder] = useState(null);
  
  const [newReminder, setNewReminder] = useState({
    title: '',
    description: '',
    type: 'study',
    time: new Date(),
    repeat: 'daily',
    is_active: true,
  });

  useEffect(() => {
    fetchReminders();
    requestNotificationPermissions();
  }, [user]);

  const requestNotificationPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please enable notifications for reminder functionality.');
    }
  };

  const fetchReminders = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('study_reminders')
        .select('*')
        .eq('user_id', user.id)
        .order('time');
      setReminders(data || []);
    } catch (error) {
      console.error('Error fetching reminders:', error);
    } finally {
      setLoading(false);
    }
  };

  const scheduleNotification = async (reminder) => {
    const trigger = new Date(reminder.time);
    const now = new Date();

    // If the reminder time is in the past, schedule for tomorrow
    if (trigger < now) {
      trigger.setDate(trigger.getDate() + 1);
    }

    // Configure repeating trigger
    let repeatingTrigger = null;
    if (reminder.repeat === 'daily') {
      repeatingTrigger = {
        hour: trigger.getHours(),
        minute: trigger.getMinutes(),
        repeats: true,
      };
    } else if (reminder.repeat === 'weekdays') {
      repeatingTrigger = {
        hour: trigger.getHours(),
        minute: trigger.getMinutes(),
        weekday: [2, 3, 4, 5, 6], // Tuesday to Saturday
        repeats: true,
      };
    } else if (reminder.repeat === 'weekly') {
      repeatingTrigger = {
        hour: trigger.getHours(),
        minute: trigger.getMinutes(),
        weekday: trigger.getDay(),
        repeats: true,
      };
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📚 ' + reminder.title,
        body: reminder.description || 'Time to study!',
        sound: true,
        data: { reminderId: reminder.id },
      },
      trigger: repeatingTrigger || trigger,
    });
  };

  const saveReminder = async () => {
    if (!newReminder.title.trim()) {
      Alert.alert('Error', 'Please enter a reminder title');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'Please login to save reminders');
      return;
    }

    try {
      const reminderData = {
        ...newReminder,
        user_id: user.id,
        notification_id: `reminder_${Date.now()}`,
      };

      let result;
      if (editingReminder) {
        result = await supabase
          .from('study_reminders')
          .update(reminderData)
          .eq('id', editingReminder.id);
      } else {
        result = await supabase
          .from('study_reminders')
          .insert([reminderData]);
      }

      if (result.error) throw result.error;

      // Schedule notification
      if (newReminder.is_active) {
        await scheduleNotification(reminderData);
      }

      Alert.alert(
        'Success',
        editingReminder ? 'Reminder updated!' : 'Reminder set!'
      );

      setShowAddModal(false);
      setEditingReminder(null);
      setNewReminder({
        title: '',
        description: '',
        type: 'study',
        time: new Date(),
        repeat: 'daily',
        is_active: true,
      });
      fetchReminders();
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const toggleReminderStatus = async (reminder) => {
    try {
      const updatedReminder = {
        ...reminder,
        is_active: !reminder.is_active,
      };

      await supabase
        .from('study_reminders')
        .update({ is_active: updatedReminder.is_active })
        .eq('id', reminder.id);

      if (updatedReminder.is_active) {
        await scheduleNotification(updatedReminder);
      } else {
        await Notifications.cancelScheduledNotificationAsync(reminder.notification_id);
      }

      fetchReminders();
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const deleteReminder = async (reminder) => {
    Alert.alert(
      'Delete Reminder',
      'Are you sure you want to delete this reminder?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase
                .from('study_reminders')
                .delete()
                .eq('id', reminder.id);
              
              if (reminder.notification_id) {
                await Notifications.cancelScheduledNotificationAsync(reminder.notification_id);
              }
              
              fetchReminders();
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const editReminder = (reminder) => {
    setEditingReminder(reminder);
    setNewReminder({
      title: reminder.title,
      description: reminder.description || '',
      type: reminder.type,
      time: new Date(reminder.time),
      repeat: reminder.repeat,
      is_active: reminder.is_active,
    });
    setShowAddModal(true);
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatRepeat = (repeat) => {
    const option = REPEAT_OPTIONS.find(r => r.id === repeat);
    return option ? option.label : repeat;
  };

  const renderReminderItem = ({ item }) => {
    const type = REMINDER_TYPES.find(t => t.id === item.type);
    
    return (
      <View style={styles.reminderCard}>
        <View style={styles.reminderHeader}>
          <View style={[styles.typeIcon, { backgroundColor: type?.color + '20' }]}>
            <Ionicons name={type?.icon || 'notifications'} size={20} color={type?.color} />
          </View>
          <View style={styles.reminderInfo}>
            <Text style={styles.reminderTitle}>{item.title}</Text>
            {item.description ? (
              <Text style={styles.reminderDescription} numberOfLines={1}>
                {item.description}
              </Text>
            ) : null}
            <View style={styles.reminderMeta}>
              <View style={styles.timeBadge}>
                <Ionicons name="time" size={12} color="#636E72" />
                <Text style={styles.timeText}>{formatTime(item.time)}</Text>
              </View>
              <View style={styles.repeatBadge}>
                <Ionicons name="repeat" size={12} color="#636E72" />
                <Text style={styles.repeatText}>{formatRepeat(item.repeat)}</Text>
              </View>
            </View>
          </View>
        </View>
        
        <View style={styles.reminderActions}>
          <Switch
            value={item.is_active}
            onValueChange={() => toggleReminderStatus(item)}
            trackColor={{ false: '#2D3561', true: type?.color || '#6C5CE7' }}
            thumbColor="#FFF"
          />
          
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => editReminder(item)}
          >
            <Ionicons name="create-outline" size={18} color="#6C5CE7" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={() => deleteReminder(item)}
          >
            <Ionicons name="trash-outline" size={18} color="#FF7675" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6C5CE7" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Study Reminders</Text>
        <Text style={styles.headerSubtitle}>
          Stay on track with your study schedule
        </Text>
      </View>

      {/* Add Reminder Button */}
      <TouchableOpacity 
        style={styles.addButton}
        onPress={() => {
          setEditingReminder(null);
          setNewReminder({
            title: '',
            description: '',
            type: 'study',
            time: new Date(),
            repeat: 'daily',
            is_active: true,
          });
          setShowAddModal(true);
        }}
      >
        <Ionicons name="add" size={24} color="#FFF" />
        <Text style={styles.addButtonText}>Add New Reminder</Text>
      </TouchableOpacity>

      {/* Reminders List */}
      <FlatList
        data={reminders}
        renderItem={renderReminderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={60} color="#636E72" />
            <Text style={styles.emptyTitle}>No reminders set</Text>
            <Text style={styles.emptyText}>
              Add reminders to stay on track with your studies
            </Text>
          </View>
        }
      />

      {/* Add/Edit Reminder Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingReminder ? 'Edit Reminder' : 'New Reminder'}
              </Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Reminder Type */}
              <Text style={styles.formLabel}>Reminder Type</Text>
              <View style={styles.typeGrid}>
                {REMINDER_TYPES.map(type => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.typeButton,
                      newReminder.type === type.id && styles.typeButtonActive,
                      { borderColor: type.color + '40' }
                    ]}
                    onPress={() => setNewReminder(prev => ({ ...prev, type: type.id }))}
                  >
                    <Ionicons 
                      name={type.icon} 
                      size={20} 
                      color={newReminder.type === type.id ? '#FFF' : type.color} 
                    />
                    <Text style={[
                      styles.typeButtonText,
                      newReminder.type === type.id && styles.typeButtonTextActive,
                      { color: newReminder.type === type.id ? '#FFF' : type.color }
                    ]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Title */}
              <Text style={styles.formLabel}>Title *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g., Review Mathematics chapter 3"
                placeholderTextColor="#636E72"
                value={newReminder.title}
                onChangeText={(text) => setNewReminder(prev => ({ ...prev, title: text }))}
              />

              {/* Description */}
              <Text style={styles.formLabel}>Description (Optional)</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Add details about what to study..."
                placeholderTextColor="#636E72"
                value={newReminder.description}
                onChangeText={(text) => setNewReminder(prev => ({ ...prev, description: text }))}
                multiline
                numberOfLines={3}
              />

              {/* Time */}
              <Text style={styles.formLabel}>Time *</Text>
              <TouchableOpacity 
                style={styles.timeButton}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="time" size={20} color="#6C5CE7" />
                <Text style={styles.timeButtonText}>
                  {newReminder.time.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </Text>
              </TouchableOpacity>

              {/* Repeat */}
              <Text style={styles.formLabel}>Repeat</Text>
              <View style={styles.repeatGrid}>
                {REPEAT_OPTIONS.map(option => (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.repeatButton,
                      newReminder.repeat === option.id && styles.repeatButtonActive
                    ]}
                    onPress={() => setNewReminder(prev => ({ ...prev, repeat: option.id }))}
                  >
                    <Text style={[
                      styles.repeatButtonText,
                      newReminder.repeat === option.id && styles.repeatButtonTextActive
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Active Switch */}
              <View style={styles.switchContainer}>
                <Text style={styles.switchLabel}>Active</Text>
                <Switch
                  value={newReminder.is_active}
                  onValueChange={(value) => setNewReminder(prev => ({ ...prev, is_active: value }))}
                  trackColor={{ false: '#2D3561', true: '#6C5CE7' }}
                  thumbColor="#FFF"
                />
              </View>

              {/* Save Button */}
              <TouchableOpacity 
                style={[
                  styles.saveButton,
                  !newReminder.title.trim() && styles.saveButtonDisabled
                ]}
                onPress={saveReminder}
                disabled={!newReminder.title.trim()}
              >
                <Text style={styles.saveButtonText}>
                  {editingReminder ? 'Update Reminder' : 'Save Reminder'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Time Picker */}
      {showTimePicker && (
        <DateTimePicker
          value={newReminder.time}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedTime) => {
            setShowTimePicker(false);
            if (selectedTime) {
              setNewReminder(prev => ({ ...prev, time: selectedTime }));
            }
          }}
        />
      )}
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
  addButton: {
    backgroundColor: '#6C5CE7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    borderRadius: 14,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  listContent: {
    padding: 20,
    paddingBottom: 30,
  },
  reminderCard: {
    backgroundColor: '#1E2340',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  reminderHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reminderInfo: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  reminderDescription: {
    fontSize: 13,
    color: '#A29BFE',
    marginBottom: 8,
  },
  reminderMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2D3561',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  timeText: {
    fontSize: 11,
    color: '#636E72',
  },
  repeatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2D3561',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  repeatText: {
    fontSize: 11,
    color: '#636E72',
  },
  reminderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2D3561',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF767520',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#636E72',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0A0E27',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3561',
  },
  modalTitle: {
    fontSize: 20,
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
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 100,
  },
  typeButtonActive: {
    backgroundColor: '#6C5CE7',
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  typeButtonTextActive: {
    color: '#FFF',
  },
  formInput: {
    backgroundColor: '#1E2340',
    borderWidth: 1,
    borderColor: '#2D3561',
    borderRadius: 12,
    padding: 14,
    color: '#FFF',
    fontSize: 15,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1E2340',
    borderWidth: 1,
    borderColor: '#2D3561',
    borderRadius: 12,
    padding: 14,
  },
  timeButtonText: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: '600',
  },
  repeatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  repeatButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1E2340',
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  repeatButtonActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  repeatButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636E72',
  },
  repeatButtonTextActive: {
    color: '#FFF',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 20,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  saveButton: {
    backgroundColor: '#6C5CE7',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});