import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Image, ActivityIndicator, Modal,
  FlatList, RefreshControl, Dimensions, Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../context/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';

const { width } = Dimensions.get('window');

export default function AdminProfileScreen({ navigation }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTutors: 0,
    activeSessions: 0,
    revenue: 0,
    pendingRequests: 0,
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [showAddTutorModal, setShowAddTutorModal] = useState(false);
  const [showAddResourceModal, setShowAddResourceModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [newTutor, setNewTutor] = useState({
    name: '',
    email: '',
    phone: '',
    whatsapp: '',
    subjects: [],
    hourly_rate: '',
    bio: '',
    qualifications: '',
    experience_years: '',
  });
  const [newResource, setNewResource] = useState({
    title: '',
    subject_id: '',
    type: 'notes',
    description: '',
    file_url: '',
    year: new Date().getFullYear(),
  });
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    message: '',
    priority: 'normal',
    is_active: true,
  });
  const [subjects, setSubjects] = useState([]);
  const [allTutors, setAllTutors] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [selectedTab, setSelectedTab] = useState('overview');

  useEffect(() => {
    if (user?.email !== 'meltonhlungwani970@gmail.com' || !profile?.is_admin) {
      Alert.alert('Access Denied', 'Admin access only');
      navigation.goBack();
      return;
    }
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      
      const [
        studentsRes,
        tutorsRes,
        sessionsRes,
        requestsRes,
        activitiesRes,
        subjectsRes,
        allTutorsRes,
        allStudentsRes
      ] = await Promise.all([
        supabase.from('user_profiles').select('id', { count: 'exact' }).eq('user_type', 'student'),
        supabase.from('tutors').select('id', { count: 'exact' }),
        supabase.from('tutor_sessions').select('id', { count: 'exact' }).eq('status', 'active'),
        supabase.from('tutor_requests').select('id', { count: 'exact' }).eq('status', 'pending'),
        supabase.from('admin_activities').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('subjects').select('*').order('name'),
        supabase.from('tutors').select('*, subjects(name)').order('created_at', { ascending: false }),
        supabase.from('user_profiles').select('*, users(email)').eq('user_type', 'student').order('created_at', { ascending: false }),
      ]);

      // Calculate revenue (simplified - 20% commission)
      const { data: bookings } = await supabase
        .from('tutor_bookings')
        .select('amount')
        .eq('status', 'completed');

      const revenue = bookings?.reduce((sum, booking) => sum + (booking.amount * 0.2), 0) || 0;

      setStats({
        totalStudents: studentsRes.count || 0,
        totalTutors: tutorsRes.count || 0,
        activeSessions: sessionsRes.count || 0,
        revenue: Math.round(revenue),
        pendingRequests: requestsRes.count || 0,
      });

      setRecentActivities(activitiesRes.data || []);
      setSubjects(subjectsRes.data || []);
      setAllTutors(allTutorsRes.data || []);
      setAllStudents(allStudentsRes.data || []);

    } catch (error) {
      console.error('Error fetching admin data:', error);
      Alert.alert('Error', 'Failed to load admin data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAdminData();
  };

  const handleAddTutor = async () => {
    if (!newTutor.name || !newTutor.email || !newTutor.phone || !newTutor.subjects.length) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);

      // First create auth user for tutor
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: newTutor.email,
        password: 'TempPassword123!', // Tutor should reset this
        email_confirm: true,
      });

      if (authError) throw authError;

      // Create tutor profile
      const { error: tutorError } = await supabase.from('tutors').insert([{
        user_id: authData.user.id,
        name: newTutor.name,
        email: newTutor.email,
        phone_number: newTutor.phone,
        whatsapp_number: newTutor.whatsapp,
        bio: newTutor.bio,
        qualifications: newTutor.qualifications,
        experience_years: parseInt(newTutor.experience_years) || 1,
        hourly_rate: parseFloat(newTutor.hourly_rate) || 200,
        is_verified: true,
        status: 'active',
      }]);

      if (tutorError) throw tutorError;

      // Add subjects
      const tutorSubjects = newTutor.subjects.map(subject => ({
        tutor_id: authData.user.id,
        subject_id: subject,
      }));

      const { error: subjectsError } = await supabase
        .from('tutor_subjects')
        .insert(tutorSubjects);

      if (subjectsError) throw subjectsError;

      // Log activity
      await supabase.from('admin_activities').insert([{
        admin_id: user.id,
        action: 'added_tutor',
        details: `Added tutor: ${newTutor.name}`,
        created_at: new Date().toISOString(),
      }]);

      Alert.alert('Success', 'Tutor added successfully!');
      setShowAddTutorModal(false);
      setNewTutor({
        name: '',
        email: '',
        phone: '',
        whatsapp: '',
        subjects: [],
        hourly_rate: '',
        bio: '',
        qualifications: '',
        experience_years: '',
      });
      fetchAdminData();

    } catch (error) {
      console.error('Error adding tutor:', error);
      Alert.alert('Error', error.message || 'Failed to add tutor');
    } finally {
      setLoading(false);
    }
  };

  const handleAddResource = async () => {
    if (!newResource.title || !newResource.subject_id || !newResource.file_url) {
      Alert.alert('Validation Error', 'Please fill in all required fields and upload a file');
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.from('resources').insert([{
        ...newResource,
        uploaded_by: user.id,
        download_count: 0,
        is_active: true,
      }]);

      if (error) throw error;

      // Log activity
      await supabase.from('admin_activities').insert([{
        admin_id: user.id,
        action: 'added_resource',
        details: `Added resource: ${newResource.title}`,
        created_at: new Date().toISOString(),
      }]);

      Alert.alert('Success', 'Resource added successfully!');
      setShowAddResourceModal(false);
      setNewResource({
        title: '',
        subject_id: '',
        type: 'notes',
        description: '',
        file_url: '',
        year: new Date().getFullYear(),
      });
      fetchAdminData();

    } catch (error) {
      console.error('Error adding resource:', error);
      Alert.alert('Error', error.message || 'Failed to add resource');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAnnouncement = async () => {
    if (!newAnnouncement.title || !newAnnouncement.message) {
      Alert.alert('Validation Error', 'Please fill in title and message');
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.from('announcements').insert([{
        ...newAnnouncement,
        created_by: user.id,
        created_at: new Date().toISOString(),
      }]);

      if (error) throw error;

      // Log activity
      await supabase.from('admin_activities').insert([{
        admin_id: user.id,
        action: 'added_announcement',
        details: `Added announcement: ${newAnnouncement.title}`,
        created_at: new Date().toISOString(),
      }]);

      Alert.alert('Success', 'Announcement published!');
      setShowAnnouncementModal(false);
      setNewAnnouncement({
        title: '',
        message: '',
        priority: 'normal',
        is_active: true,
      });
      fetchAdminData();

    } catch (error) {
      console.error('Error adding announcement:', error);
      Alert.alert('Error', error.message || 'Failed to add announcement');
    } finally {
      setLoading(false);
    }
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.type === 'success') {
        setNewResource(prev => ({ ...prev, file_url: result.uri }));
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const toggleTutorStatus = async (tutorId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      
      const { error } = await supabase
        .from('tutors')
        .update({ status: newStatus })
        .eq('id', tutorId);

      if (error) throw error;

      Alert.alert('Success', `Tutor ${newStatus}d successfully`);
      fetchAdminData();
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const renderTutorItem = ({ item }) => (
    <View style={styles.tutorItem}>
      <View style={styles.tutorInfo}>
        <Text style={styles.tutorName}>{item.name}</Text>
        <Text style={styles.tutorEmail}>{item.email}</Text>
        <View style={styles.tutorSubjects}>
          {item.subjects?.slice(0, 2).map((subject, index) => (
            <View key={index} style={styles.subjectTag}>
              <Text style={styles.subjectTagText}>{subject.name}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.tutorActions}>
        <TouchableOpacity 
          style={[styles.statusButton, item.status === 'active' ? styles.activeButton : styles.inactiveButton]}
          onPress={() => toggleTutorStatus(item.id, item.status)}
        >
          <Text style={styles.statusButtonText}>{item.status === 'active' ? 'Active' : 'Inactive'}</Text>
        </TouchableOpacity>
        <Text style={styles.tutorRate}>R{item.hourly_rate}/hr</Text>
      </View>
    </View>
  );

  const renderStudentItem = ({ item }) => (
    <View style={styles.studentItem}>
      <View style={styles.studentAvatar}>
        <Text style={styles.studentAvatarText}>
          {item.full_name?.charAt(0)?.toUpperCase() || 'S'}
        </Text>
      </View>
      <View style={styles.studentInfo}>
        <Text style={styles.studentName}>{item.full_name || 'Student'}</Text>
        <Text style={styles.studentEmail}>{item.users?.email}</Text>
        <Text style={styles.studentGrade}>{item.grade_level} • {item.school_name}</Text>
      </View>
      <TouchableOpacity style={styles.viewButton}>
        <Ionicons name="eye" size={20} color="#6C5CE7" />
      </TouchableOpacity>
    </View>
  );

  const AdminStats = () => (
    <View style={styles.statsGrid}>
      <View style={styles.statCard}>
        <Ionicons name="people" size={24} color="#6C5CE7" />
        <Text style={styles.statNumber}>{stats.totalStudents}</Text>
        <Text style={styles.statLabel}>Students</Text>
      </View>
      <View style={styles.statCard}>
        <Ionicons name="school" size={24} color="#00B894" />
        <Text style={styles.statNumber}>{stats.totalTutors}</Text>
        <Text style={styles.statLabel}>Tutors</Text>
      </View>
      <View style={styles.statCard}>
        <Ionicons name="calendar" size={24} color="#FD79A8" />
        <Text style={styles.statNumber}>{stats.activeSessions}</Text>
        <Text style={styles.statLabel}>Sessions</Text>
      </View>
      <View style={styles.statCard}>
        <Ionicons name="cash" size={24} color="#FDCB6E" />
        <Text style={styles.statNumber}>R{stats.revenue}</Text>
        <Text style={styles.statLabel}>Revenue</Text>
      </View>
    </View>
  );

  const QuickActions = () => (
    <View style={styles.quickActions}>
      <TouchableOpacity 
        style={styles.quickAction}
        onPress={() => setShowAddTutorModal(true)}
      >
        <View style={[styles.quickActionIcon, { backgroundColor: '#6C5CE720' }]}>
          <Ionicons name="person-add" size={24} color="#6C5CE7" />
        </View>
        <Text style={styles.quickActionText}>Add Tutor</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.quickAction}
        onPress={() => setShowAddResourceModal(true)}
      >
        <View style={[styles.quickActionIcon, { backgroundColor: '#00B89420' }]}>
          <Ionicons name="document-attach" size={24} color="#00B894" />
        </View>
        <Text style={styles.quickActionText}>Add Resource</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.quickAction}
        onPress={() => setShowAnnouncementModal(true)}
      >
        <View style={[styles.quickActionIcon, { backgroundColor: '#FDCB6E20' }]}>
          <Ionicons name="megaphone" size={24} color="#FDCB6E" />
        </View>
        <Text style={styles.quickActionText}>Announce</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.quickAction}
        onPress={() => setSelectedTab('reports')}
      >
        <View style={[styles.quickActionIcon, { backgroundColor: '#FD79A820' }]}>
          <Ionicons name="stats-chart" size={24} color="#FD79A8" />
        </View>
        <Text style={styles.quickActionText}>Reports</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C5CE7" />
        <Text style={styles.loadingText}>Loading Admin Dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6C5CE7"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>Admin Dashboard</Text>
              <Text style={styles.headerSubtitle}>Welcome back, {profile?.full_name}</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Ionicons name="settings" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Admin Stats */}
        <AdminStats />

        {/* Quick Actions */}
        <QuickActions />

        {/* Tabs */}
        <View style={styles.tabs}>
          {['overview', 'tutors', 'students', 'activities'].map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, selectedTab === tab && styles.tabActive]}
              onPress={() => setSelectedTab(tab)}
            >
              <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content based on selected tab */}
        {selectedTab === 'overview' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Recent Activities</Text>
            {recentActivities.length > 0 ? (
              recentActivities.map((activity, index) => (
                <View key={index} style={styles.activityItem}>
                  <Ionicons 
                    name={getActivityIcon(activity.action)} 
                    size={20} 
                    color={getActivityColor(activity.action)} 
                  />
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityText}>{activity.details}</Text>
                    <Text style={styles.activityDate}>
                      {new Date(activity.created_at).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No recent activities</Text>
            )}
          </View>
        )}

        {selectedTab === 'tutors' && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>All Tutors ({allTutors.length})</Text>
              <TouchableOpacity onPress={() => setShowAddTutorModal(true)}>
                <Text style={styles.addButtonText}>+ Add New</Text>
              </TouchableOpacity>
            </View>
            {allTutors.length > 0 ? (
              <FlatList
                data={allTutors}
                renderItem={renderTutorItem}
                keyExtractor={item => item.id}
                scrollEnabled={false}
              />
            ) : (
              <Text style={styles.emptyText}>No tutors registered yet</Text>
            )}
          </View>
        )}

        {selectedTab === 'students' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>All Students ({allStudents.length})</Text>
            {allStudents.length > 0 ? (
              <FlatList
                data={allStudents}
                renderItem={renderStudentItem}
                keyExtractor={item => item.id}
                scrollEnabled={false}
              />
            ) : (
              <Text style={styles.emptyText}>No students registered yet</Text>
            )}
          </View>
        )}

        {selectedTab === 'activities' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>System Logs</Text>
            <Text style={styles.emptyText}>Activity logs will appear here</Text>
          </View>
        )}

        {/* Pending Requests */}
        {stats.pendingRequests > 0 && (
          <TouchableOpacity style={styles.pendingRequestsCard}>
            <View style={styles.pendingRequestsHeader}>
              <Ionicons name="alert-circle" size={24} color="#FF7675" />
              <Text style={styles.pendingRequestsTitle}>
                {stats.pendingRequests} Pending Requests
              </Text>
            </View>
            <Text style={styles.pendingRequestsText}>
              Tutor requests need your attention
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Add Tutor Modal */}
      <Modal
        visible={showAddTutorModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddTutorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Tutor</Text>
              <TouchableOpacity onPress={() => setShowAddTutorModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.formLabel}>Full Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Tutor's full name"
                placeholderTextColor="#636E72"
                value={newTutor.name}
                onChangeText={(text) => setNewTutor(prev => ({ ...prev, name: text }))}
              />

              <Text style={styles.formLabel}>Email *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="tutor@email.com"
                placeholderTextColor="#636E72"
                value={newTutor.email}
                onChangeText={(text) => setNewTutor(prev => ({ ...prev, email: text }))}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.formLabel}>Phone *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="+27 XXX XXX XXXX"
                placeholderTextColor="#636E72"
                value={newTutor.phone}
                onChangeText={(text) => setNewTutor(prev => ({ ...prev, phone: text }))}
                keyboardType="phone-pad"
              />

              <Text style={styles.formLabel}>WhatsApp (Optional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="+27 XXX XXX XXXX"
                placeholderTextColor="#636E72"
                value={newTutor.whatsapp}
                onChangeText={(text) => setNewTutor(prev => ({ ...prev, whatsapp: text }))}
                keyboardType="phone-pad"
              />

              <Text style={styles.formLabel}>Subjects *</Text>
              <View style={styles.subjectsGrid}>
                {subjects.map(subject => (
                  <TouchableOpacity
                    key={subject.id}
                    style={[
                      styles.subjectChip,
                      newTutor.subjects.includes(subject.id) && styles.subjectChipActive
                    ]}
                    onPress={() => {
                      setNewTutor(prev => ({
                        ...prev,
                        subjects: prev.subjects.includes(subject.id)
                          ? prev.subjects.filter(id => id !== subject.id)
                          : [...prev.subjects, subject.id]
                      }));
                    }}
                  >
                    <Text style={[
                      styles.subjectChipText,
                      newTutor.subjects.includes(subject.id) && styles.subjectChipTextActive
                    ]}>
                      {subject.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Hourly Rate (R)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="200"
                placeholderTextColor="#636E72"
                value={newTutor.hourly_rate}
                onChangeText={(text) => setNewTutor(prev => ({ ...prev, hourly_rate: text }))}
                keyboardType="numeric"
              />

              <Text style={styles.formLabel}>Experience (Years)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="2"
                placeholderTextColor="#636E72"
                value={newTutor.experience_years}
                onChangeText={(text) => setNewTutor(prev => ({ ...prev, experience_years: text }))}
                keyboardType="numeric"
              />

              <Text style={styles.formLabel}>Qualifications</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Degrees, certifications, etc."
                placeholderTextColor="#636E72"
                value={newTutor.qualifications}
                onChangeText={(text) => setNewTutor(prev => ({ ...prev, qualifications: text }))}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.formLabel}>Bio</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Brief introduction about the tutor..."
                placeholderTextColor="#636E72"
                value={newTutor.bio}
                onChangeText={(text) => setNewTutor(prev => ({ ...prev, bio: text }))}
                multiline
                numberOfLines={4}
              />

              <TouchableOpacity
                style={[styles.saveButton, loading && styles.saveButtonDisabled]}
                onPress={handleAddTutor}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Add Tutor</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Resource Modal */}
      <Modal
        visible={showAddResourceModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddResourceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Resource</Text>
              <TouchableOpacity onPress={() => setShowAddResourceModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.formLabel}>Title *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Resource title"
                placeholderTextColor="#636E72"
                value={newResource.title}
                onChangeText={(text) => setNewResource(prev => ({ ...prev, title: text }))}
              />

              <Text style={styles.formLabel}>Subject *</Text>
              <View style={styles.subjectsGrid}>
                {subjects.map(subject => (
                  <TouchableOpacity
                    key={subject.id}
                    style={[
                      styles.subjectChip,
                      newResource.subject_id === subject.id && styles.subjectChipActive
                    ]}
                    onPress={() => setNewResource(prev => ({ ...prev, subject_id: subject.id }))}
                  >
                    <Text style={[
                      styles.subjectChipText,
                      newResource.subject_id === subject.id && styles.subjectChipTextActive
                    ]}>
                      {subject.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Type</Text>
              <View style={styles.typeButtons}>
                {['notes', 'past_paper', 'textbook', 'video', 'other'].map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      newResource.type === type && styles.typeButtonActive
                    ]}
                    onPress={() => setNewResource(prev => ({ ...prev, type }))}
                  >
                    <Text style={[
                      styles.typeButtonText,
                      newResource.type === type && styles.typeButtonTextActive
                    ]}>
                      {type.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Year</Text>
              <TextInput
                style={styles.formInput}
                placeholder="2024"
                placeholderTextColor="#636E72"
                value={newResource.year.toString()}
                onChangeText={(text) => setNewResource(prev => ({ ...prev, year: parseInt(text) || 2024 }))}
                keyboardType="numeric"
              />

              <Text style={styles.formLabel}>Description</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Resource description..."
                placeholderTextColor="#636E72"
                value={newResource.description}
                onChangeText={(text) => setNewResource(prev => ({ ...prev, description: text }))}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.formLabel}>Upload File *</Text>
              <TouchableOpacity style={styles.uploadButton} onPress={pickFile}>
                <Ionicons name="cloud-upload" size={24} color="#6C5CE7" />
                <Text style={styles.uploadButtonText}>
                  {newResource.file_url ? 'File Selected' : 'Choose File'}
                </Text>
              </TouchableOpacity>
              {newResource.file_url && (
                <Text style={styles.fileName}>{newResource.file_url.split('/').pop()}</Text>
              )}

              <TouchableOpacity
                style={[styles.saveButton, loading && styles.saveButtonDisabled]}
                onPress={handleAddResource}
                disabled={loading || !newResource.file_url}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Upload Resource</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Announcement Modal */}
      <Modal
        visible={showAnnouncementModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAnnouncementModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Announcement</Text>
              <TouchableOpacity onPress={() => setShowAnnouncementModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.formLabel}>Title *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Announcement title"
                placeholderTextColor="#636E72"
                value={newAnnouncement.title}
                onChangeText={(text) => setNewAnnouncement(prev => ({ ...prev, title: text }))}
              />

              <Text style={styles.formLabel}>Priority</Text>
              <View style={styles.priorityButtons}>
                {['low', 'normal', 'high', 'urgent'].map(priority => (
                  <TouchableOpacity
                    key={priority}
                    style={[
                      styles.priorityButton,
                      newAnnouncement.priority === priority && styles.priorityButtonActive
                    ]}
                    onPress={() => setNewAnnouncement(prev => ({ ...prev, priority }))}
                  >
                    <Text style={[
                      styles.priorityButtonText,
                      newAnnouncement.priority === priority && styles.priorityButtonTextActive
                    ]}>
                      {priority.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Message *</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Announcement message..."
                placeholderTextColor="#636E72"
                value={newAnnouncement.message}
                onChangeText={(text) => setNewAnnouncement(prev => ({ ...prev, message: text }))}
                multiline
                numberOfLines={6}
              />

              <View style={styles.switchContainer}>
                <Text style={styles.switchLabel}>Active</Text>
                <Switch
                  value={newAnnouncement.is_active}
                  onValueChange={(value) => setNewAnnouncement(prev => ({ ...prev, is_active: value }))}
                  trackColor={{ false: '#2D3561', true: '#6C5CE7' }}
                  thumbColor="#FFF"
                />
              </View>

              <TouchableOpacity
                style={[styles.saveButton, loading && styles.saveButtonDisabled]}
                onPress={handleAddAnnouncement}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Publish Announcement</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getActivityIcon = (action) => {
  switch(action) {
    case 'added_tutor': return 'person-add';
    case 'added_resource': return 'document-attach';
    case 'added_announcement': return 'megaphone';
    case 'updated_settings': return 'settings';
    default: return 'checkmark-circle';
  }
};

const getActivityColor = (action) => {
  switch(action) {
    case 'added_tutor': return '#6C5CE7';
    case 'added_resource': return '#00B894';
    case 'added_announcement': return '#FDCB6E';
    case 'updated_settings': return '#FD79A8';
    default: return '#74B9FF';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E27',
  },
  loadingContainer: {
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#1E2340',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#A29BFE',
  },
  settingsButton: {
    padding: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 12,
  },
  statCard: {
    width: (width - 52) / 2,
    backgroundColor: '#1E2340',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  statNumber: {
    fontSize: 24,
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
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 12,
  },
  quickAction: {
    flex: 1,
    backgroundColor: '#1E2340',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#6C5CE7',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#636E72',
  },
  tabTextActive: {
    color: '#6C5CE7',
  },
  tabContent: {
    padding: 20,
    minHeight: 300,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 16,
  },
  addButtonText: {
    fontSize: 14,
    color: '#6C5CE7',
    fontWeight: '600',
  },
  activityItem: {
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
  activityInfo: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: '#A29BFE',
    marginBottom: 4,
  },
  activityDate: {
    fontSize: 12,
    color: '#636E72',
  },
  tutorItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E2340',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  tutorInfo: {
    flex: 1,
  },
  tutorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  tutorEmail: {
    fontSize: 13,
    color: '#A29BFE',
    marginBottom: 8,
  },
  tutorSubjects: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  subjectTag: {
    backgroundColor: '#2D3561',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  subjectTagText: {
    fontSize: 11,
    color: '#A29BFE',
  },
  tutorActions: {
    alignItems: 'flex-end',
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },
  activeButton: {
    backgroundColor: '#00B89420',
  },
  inactiveButton: {
    backgroundColor: '#FF767520',
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tutorRate: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00B894',
  },
  studentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2340',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6C5CE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  studentAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 2,
  },
  studentEmail: {
    fontSize: 13,
    color: '#A29BFE',
    marginBottom: 4,
  },
  studentGrade: {
    fontSize: 12,
    color: '#636E72',
  },
  viewButton: {
    padding: 8,
  },
  pendingRequestsCard: {
    backgroundColor: '#FF767520',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FF7675',
  },
  pendingRequestsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  pendingRequestsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF7675',
  },
  pendingRequestsText: {
    fontSize: 14,
    color: '#FFF',
  },
  emptyText: {
    fontSize: 14,
    color: '#636E72',
    textAlign: 'center',
    marginTop: 20,
  },
  bottomSpacer: {
    height: 100,
  },
  // Modal Styles
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
    height: 100,
    textAlignVertical: 'top',
  },
  subjectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectChip: {
    backgroundColor: '#1E2340',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2D3561',
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
  typeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#1E2340',
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  typeButtonActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  typeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A29BFE',
    textTransform: 'capitalize',
  },
  typeButtonTextActive: {
    color: '#FFF',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1E2340',
    borderWidth: 2,
    borderColor: '#6C5CE7',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6C5CE7',
  },
  fileName: {
    fontSize: 12,
    color: '#636E72',
    marginTop: 8,
    textAlign: 'center',
  },
  priorityButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1E2340',
    borderWidth: 1,
    borderColor: '#2D3561',
    alignItems: 'center',
  },
  priorityButtonActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  priorityButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#636E72',
  },
  priorityButtonTextActive: {
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
    marginTop: 20,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});