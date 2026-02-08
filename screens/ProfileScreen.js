import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, ActivityIndicator, RefreshControl, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../context/AuthContext';
import { useStudy } from '../context/StudyContext';

const { width } = Dimensions.get('window');

export default function ProfileScreen({ navigation }) {
  const { profile, user, signOut } = useAuth();
  const { studyStats } = useStudy();
  
  const [stats, setStats] = useState({
    bookedSessions: 0,
    downloadedResources: 0,
    tutorRequests: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserStats();
    }
  }, [user]);

  const fetchUserStats = async () => {
    try {
      setLoadingStats(true);
      
      // Fetching counts from different tables simultaneously
      const [sessions, resources, requests] = await Promise.all([
        supabase.from('tutor_sessions').select('*', { count: 'exact', head: true }).eq('student_id', user.id),
        supabase.from('resources').select('*', { count: 'exact', head: true }), // Replace with a 'user_downloads' table if you have one
        supabase.from('tutor_requests').select('*', { count: 'exact', head: true }).eq('student_email', user.email)
      ]);

      setStats({
        bookedSessions: sessions.count || 0,
        downloadedResources: resources.count || 0,
        tutorRequests: requests.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoadingStats(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserStats();
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", onPress: signOut, style: "destructive" }
    ]);
  };

  return (
    <ScrollView 
      style={styles.container} 
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C5CE7" />}
    >
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          {profile?.is_admin && (
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={12} color="#FFF" />
              <Text style={styles.adminBadgeText}>ADMIN</Text>
            </View>
          )}
        </View>
        <Text style={styles.userName}>{profile?.full_name || 'Student'}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        
        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => navigation.navigate('EditProfile')}
        >
          <Ionicons name="create-outline" size={20} color="#FFF" />
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{loadingStats ? '...' : stats.bookedSessions}</Text>
          <Text style={styles.statLabel}>Sessions</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{Math.floor((studyStats?.totalStudyTime || 0) / 3600)}h</Text>
          <Text style={styles.statLabel}>Study Time</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{loadingStats ? '...' : stats.tutorRequests}</Text>
          <Text style={styles.statLabel}>Requests</Text>
        </View>
      </View>

      {/* Details Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Academic Information</Text>
        <View style={styles.infoCard}>
          <InfoRow icon="school-outline" label="School" value={profile?.school_name || 'Not set'} />
          <InfoRow icon="location-outline" label="Province" value={profile?.province || 'Not set'} />
          <InfoRow icon="book-outline" label="Grade" value={profile?.grade_level || 'Grade 12'} />
          <InfoRow 
            icon="list-outline" 
            label="Subjects" 
            value={profile?.selected_subjects?.join(', ') || 'No subjects selected'} 
          />
        </View>
      </View>

      {/* Account Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('MySessions')}>
          <Ionicons name="calendar-outline" size={22} color="#A29BFE" />
          <Text style={styles.menuText}>My Booked Sessions</Text>
          <Ionicons name="chevron-forward" size={20} color="#636E72" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Downloads')}>
          <Ionicons name="download-outline" size={22} color="#A29BFE" />
          <Text style={styles.menuText}>My Downloads</Text>
          <Ionicons name="chevron-forward" size={20} color="#636E72" />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuItem, { marginTop: 20 }]} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#FF7675" />
          <Text style={[styles.menuText, { color: '#FF7675' }]}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// Helper Component for Info Rows
const InfoRow = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIcon}>
      <Ionicons name={icon} size={20} color="#6C5CE7" />
    </View>
    <View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E27' },
  header: { alignItems: 'center', paddingVertical: 40, backgroundColor: '#1E2340', borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  avatarContainer: { position: 'relative', marginBottom: 16 },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#6C5CE7', justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#2D3561' },
  avatarText: { fontSize: 40, fontWeight: '800', color: '#FFF' },
  adminBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#00B894', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 2, borderColor: '#1E2340' },
  adminBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '900', marginLeft: 4 },
  userName: { fontSize: 24, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  userEmail: { fontSize: 14, color: '#A29BFE', marginBottom: 20 },
  editButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#6C5CE7', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  editButtonText: { color: '#FFF', fontWeight: '700', marginLeft: 8 },
  statsGrid: { flexDirection: 'row', paddingHorizontal: 20, marginTop: -25, gap: 12 },
  statCard: { flex: 1, backgroundColor: '#1E2340', padding: 15, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#2D3561', elevation: 5 },
  statValue: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  statLabel: { fontSize: 12, color: '#636E72', marginTop: 4 },
  section: { padding: 20, marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 15 },
  infoCard: { backgroundColor: '#1E2340', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#2D3561' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  infoIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#6C5CE720', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  infoLabel: { fontSize: 12, color: '#A29BFE' },
  infoValue: { fontSize: 15, color: '#FFF', fontWeight: '600', marginTop: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E2340', padding: 16, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#2D3561' },
  menuText: { flex: 1, fontSize: 16, fontWeight: '600', color: '#FFF', marginLeft: 15 },
});