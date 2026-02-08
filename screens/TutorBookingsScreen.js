import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, Alert, ActivityIndicator, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../context/AuthContext';

export default function TutorBookingsScreen({ navigation }) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('tutor_bookings')
        .select(`
          *,
          tutors (
            id,
            name,
            profile_image_url,
            subjects
          )
        `)
        .eq('student_id', user.id)
        .order('session_date', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      Alert.alert('Error', 'Failed to load bookings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  const filteredBookings = bookings.filter(booking => {
    if (selectedFilter === 'all') return true;
    return booking.status === selectedFilter;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return '#00B894';
      case 'pending': return '#FDCB6E';
      case 'cancelled': return '#FF7675';
      case 'completed': return '#6C5CE7';
      default: return '#636E72';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'confirmed': return 'checkmark-circle';
      case 'pending': return 'time';
      case 'cancelled': return 'close-circle';
      case 'completed': return 'checkmark-done';
      default: return 'help-circle';
    }
  };

  const handleCancelBooking = async (bookingId) => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('tutor_bookings')
                .update({ status: 'cancelled' })
                .eq('id', bookingId);

              if (error) throw error;

              setBookings(bookings.map(booking => 
                booking.id === bookingId ? { ...booking, status: 'cancelled' } : booking
              ));
              
              Alert.alert('Success', 'Booking cancelled successfully');
            } catch (error) {
              console.error('Error cancelling booking:', error);
              Alert.alert('Error', 'Failed to cancel booking');
            }
          }
        }
      ]
    );
  };

  const handleReschedule = (booking) => {
    Alert.alert(
      'Reschedule Session',
      'Contact your tutor to reschedule this session.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Message Tutor',
          onPress: () => {
            navigation.navigate('TutorDetails', { 
              tutor: booking.tutors,
              prefillMessage: `Hi ${booking.tutors.name}, I'd like to reschedule our ${booking.subject} session scheduled for ${booking.session_date}.`
            });
          }
        }
      ]
    );
  };

  const renderBookingItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.bookingCard}
      onPress={() => navigation.navigate('TutorDetails', { tutor: item.tutors })}
      activeOpacity={0.9}
    >
      <LinearGradient
        colors={['#1E2340', '#2D3561']}
        style={styles.bookingGradient}
      >
        {/* Header */}
        <View style={styles.bookingHeader}>
          <View style={styles.tutorInfo}>
            <Text style={styles.tutorName}>{item.tutors?.name || 'Tutor'}</Text>
            <Text style={styles.subject}>{item.subject}</Text>
          </View>
          
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Ionicons 
              name={getStatusIcon(item.status)} 
              size={14} 
              color={getStatusColor(item.status)} 
            />
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Details */}
        <View style={styles.bookingDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={16} color="#A29BFE" />
            <Text style={styles.detailText}>
              {new Date(item.session_date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Ionicons name="time" size={16} color="#A29BFE" />
            <Text style={styles.detailText}>
              {item.start_time} • {item.duration} minutes
            </Text>
          </View>
          
          {item.notes && (
            <View style={styles.detailRow}>
              <Ionicons name="document-text" size={16} color="#A29BFE" />
              <Text style={styles.detailText} numberOfLines={1}>
                {item.notes}
              </Text>
            </View>
          )}
        </View>

        {/* Price and Actions */}
        <View style={styles.bookingFooter}>
          <Text style={styles.price}>R{item.amount?.toFixed(2) || '0.00'}</Text>
          
          <View style={styles.actionButtons}>
            {item.status === 'pending' && (
              <TouchableOpacity 
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => handleCancelBooking(item.id)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
            
            {item.status === 'confirmed' && (
              <>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.rescheduleButton]}
                  onPress={() => handleReschedule(item)}
                >
                  <Text style={styles.rescheduleButtonText}>Reschedule</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.actionButton, styles.joinButton]}
                  onPress={() => Alert.alert('Join Session', 'Session link will be sent before the session starts')}
                >
                  <Text style={styles.joinButtonText}>Join</Text>
                </TouchableOpacity>
              </>
            )}
            
            {item.status === 'completed' && (
              <TouchableOpacity 
                style={[styles.actionButton, styles.reviewButton]}
                onPress={() => navigation.navigate('TutorDetails', { 
                  tutor: item.tutors,
                  showReviewModal: true 
                })}
              >
                <Text style={styles.reviewButtonText}>Leave Review</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const FilterButton = ({ label, value }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        selectedFilter === value && styles.filterButtonActive
      ]}
      onPress={() => setSelectedFilter(value)}
    >
      <Text style={[
        styles.filterButtonText,
        selectedFilter === value && styles.filterButtonTextActive
      ]}>
        {label}
      </Text>
      {selectedFilter === value && (
        <View style={styles.filterDot} />
      )}
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6C5CE7" />
        <Text style={styles.loadingText}>Loading your bookings...</Text>
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
            <Text style={styles.headerTitle}>My Bookings</Text>
            <Text style={styles.headerSubtitle}>Manage your tutoring sessions</Text>
          </View>
          <TouchableOpacity 
            style={styles.newBookingButton}
            onPress={() => navigation.navigate('Tutors')}
          >
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Stats Overview */}
      <View style={styles.statsOverview}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{bookings.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        
        <View style={styles.statDivider} />
        
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#00B894' }]}>
            {bookings.filter(b => b.status === 'confirmed').length}
          </Text>
          <Text style={styles.statLabel}>Confirmed</Text>
        </View>
        
        <View style={styles.statDivider} />
        
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#FDCB6E' }]}>
            {bookings.filter(b => b.status === 'pending').length}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      {/* Filter Buttons */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
      >
        <FilterButton label="All" value="all" />
        <FilterButton label="Pending" value="pending" />
        <FilterButton label="Confirmed" value="confirmed" />
        <FilterButton label="Completed" value="completed" />
        <FilterButton label="Cancelled" value="cancelled" />
      </ScrollView>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={80} color="#636E72" />
          <Text style={styles.emptyTitle}>No Bookings Yet</Text>
          <Text style={styles.emptyText}>
            {selectedFilter === 'all' 
              ? "You haven't booked any tutoring sessions yet"
              : `No ${selectedFilter} bookings found`
            }
          </Text>
          
          {selectedFilter === 'all' && (
            <TouchableOpacity 
              style={styles.bookNowButton}
              onPress={() => navigation.navigate('Tutors')}
            >
              <Ionicons name="search" size={20} color="#FFF" />
              <Text style={styles.bookNowText}>Find Tutors</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredBookings}
          renderItem={renderBookingItem}
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
            <Text style={styles.listTitle}>
              {selectedFilter === 'all' ? 'All Bookings' : selectedFilter.charAt(0).toUpperCase() + selectedFilter.slice(1) + ' Bookings'}
              {' '}({filteredBookings.length})
            </Text>
          }
        />
      )}

      {/* Quick Tip */}
      <View style={styles.quickTip}>
        <Ionicons name="information-circle" size={20} color="#74B9FF" />
        <Text style={styles.quickTipText}>
          Confirmed sessions can be joined 5 minutes before the scheduled time
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
  newBookingButton: {
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
  filtersContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1E2340',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#2D3561',
    alignItems: 'center',
    position: 'relative',
  },
  filterButtonActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A29BFE',
  },
  filterButtonTextActive: {
    color: '#FFF',
  },
  filterDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
  },
  listContent: {
    padding: 20,
    paddingTop: 10,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 20,
  },
  bookingCard: {
    marginBottom: 15,
    borderRadius: 20,
    overflow: 'hidden',
  },
  bookingGradient: {
    padding: 20,
    borderRadius: 20,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  tutorInfo: {
    flex: 1,
  },
  tutorName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  subject: {
    fontSize: 14,
    color: '#A29BFE',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  bookingDetails: {
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
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: {
    fontSize: 20,
    fontWeight: '800',
    color: '#00B894',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  cancelButton: {
    backgroundColor: '#FF767520',
    borderWidth: 1,
    borderColor: '#FF7675',
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF7675',
  },
  rescheduleButton: {
    backgroundColor: '#FDCB6E20',
    borderWidth: 1,
    borderColor: '#FDCB6E',
  },
  rescheduleButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FDCB6E',
  },
  joinButton: {
    backgroundColor: '#00B894',
  },
  joinButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  reviewButton: {
    backgroundColor: '#6C5CE720',
    borderWidth: 1,
    borderColor: '#6C5CE7',
  },
  reviewButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6C5CE7',
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
  bookNowButton: {
    backgroundColor: '#6C5CE7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  bookNowText: {
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
    borderColor: '#74B9FF30',
  },
  quickTipText: {
    fontSize: 14,
    color: '#74B9FF',
    flex: 1,
    lineHeight: 20,
  },
});