import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Linking, Alert,
  Image, Share, ActivityIndicator, Modal,
  TextInput, FlatList, Dimensions, KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function TutorDetailsScreen({ route, navigation }) {
  const { user, profile } = useAuth();
  const { tutor } = route.params;
  
  const [loading, setLoading] = useState(true);
  const [tutorDetails, setTutorDetails] = useState(tutor);
  const [sessions, setSessions] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [bookingDetails, setBookingDetails] = useState({
    date: new Date(),
    time: new Date(),
    duration: 60,
    subject: '',
    notes: '',
  });
  const [subjects, setSubjects] = useState([]);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [quickMessage, setQuickMessage] = useState('');

  const readyMessages = [
    `Hey ${tutor.name}, I found you on StuddyHub and I'm interested in booking a session!`,
    `Hi ${tutor.name}, I need help preparing for my exams. Can we schedule a session?`,
    `Hello, I saw your profile on StuddyHub and would like to book a tutoring session.`,
    `Hi ${tutor.name}, I'm struggling with ${tutor.subjects?.[0] || 'a subject'} and need your help.`,
  ];

  useEffect(() => {
    fetchTutorDetails();
    checkIfFavorite();
    fetchTutorSubjects();
    setQuickMessage(readyMessages[0]);
  }, [tutor.id]);

  const fetchTutorDetails = async () => {
    try {
      setLoading(true);
      
      // Fetch tutor sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('tutor_sessions')
        .select('*')
        .eq('tutor_id', tutor.id)
        .eq('status', 'available')
        .gte('session_date', new Date().toISOString().split('T')[0])
        .order('session_date', { ascending: true });

      if (!sessionsError) {
        setSessions(sessionsData || []);
      }

      // Fetch tutor reviews
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('tutor_reviews')
        .select('*, students(full_name, profile_image_url)')
        .eq('tutor_id', tutor.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!reviewsError) {
        setReviews(reviewsData || []);
      }

      // Update tutor details
      const { data: freshTutorData, error: tutorError } = await supabase
        .from('tutors')
        .select('*')
        .eq('id', tutor.id)
        .single();

      if (!tutorError && freshTutorData) {
        setTutorDetails(freshTutorData);
      }

    } catch (error) {
      console.error('Error fetching tutor details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTutorSubjects = async () => {
    try {
      const subjs = tutorDetails.subjects || tutor.subjects || [];
      setSubjects(subjs);
      if (subjs.length > 0) {
        setBookingDetails(prev => ({ ...prev, subject: subjs[0] }));
      }
    } catch (error) {
      console.error('Error fetching tutor subjects:', error);
    }
  };

  const checkIfFavorite = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('tutor_favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('tutor_id', tutor.id)
        .single();
      if (!error && data) setIsFavorite(true);
    } catch (error) {
      setIsFavorite(false);
    }
  };

  const toggleFavorite = async () => {
    if (!user) {
      Alert.alert('Please Login', 'You need to login to save tutors to favorites.');
      return;
    }

    try {
      if (isFavorite) {
        const { error } = await supabase.from('tutor_favorites').delete().eq('user_id', user.id).eq('tutor_id', tutor.id);
        if (!error) {
          setIsFavorite(false);
          Alert.alert('Removed', 'Removed from favorites.');
        }
      } else {
        const { error } = await supabase.from('tutor_favorites').insert([{ user_id: user.id, tutor_id: tutor.id }]);
        if (!error) {
          setIsFavorite(true);
          Alert.alert('Saved', 'Added to favorites.');
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const sendQuickMessage = async () => {
    if (!user) return Alert.alert('Login Required', 'Please login to send a message.');
    if (!quickMessage.trim()) return Alert.alert('Empty Message', 'Please enter a message.');

    try {
      setSendingMessage(true);
      const { error } = await supabase.from('notifications').insert([{
        user_id: tutorDetails.user_id,
        title: 'New Message from Student',
        message: quickMessage,
        type: 'student_message',
        data: { student_id: user.id, student_name: profile?.full_name || user.email },
      }]);

      if (error) throw error;
      Alert.alert('Sent!', 'Message sent successfully.', [{ text: 'OK', onPress: () => setShowContactModal(false) }]);
    } catch (error) {
      Alert.alert('Error', 'Failed to send message.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleBookSession = async () => {
    if (!user) return Alert.alert('Login Required', 'Please login to book a session.');
    if (!bookingDetails.subject) return Alert.alert('Select Subject', 'Please select a subject.');

    try {
      setLoading(true);
      const bookingData = {
        tutor_id: tutor.id,
        student_id: user.id,
        student_name: profile?.full_name || user.email,
        subject: bookingDetails.subject,
        session_date: bookingDetails.date.toISOString().split('T')[0],
        start_time: bookingDetails.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        duration: bookingDetails.duration,
        notes: bookingDetails.notes,
        status: 'pending',
        amount: (tutorDetails.hourly_rate || 200) * (bookingDetails.duration / 60),
      };

      const { error } = await supabase.from('tutor_bookings').insert([bookingData]);
      if (error) throw error;

      Alert.alert('Request Sent!', 'Your booking request has been sent.', [{ text: 'OK', onPress: () => setShowBookingModal(false) }]);
    } catch (error) {
      Alert.alert('Booking Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 0; i < 5; i++) {
      stars.push(
        <Ionicons 
          key={i} 
          name={i < Math.floor(rating) ? "star" : (i === Math.floor(rating) && rating % 1 >= 0.5) ? "star-half" : "star-outline"} 
          size={16} 
          color="#FDCB6E" 
        />
      );
    }
    return stars;
  };

  const ratingInfo = reviews.length > 0 
    ? { average: (reviews.reduce((a,b) => a + b.rating, 0) / reviews.length).toFixed(1), count: reviews.length }
    : { average: 0, count: 0 };

  // --- Modals ---

  const ContactModal = () => (
    <Modal visible={showContactModal} animationType="slide" transparent={true} onRequestClose={() => setShowContactModal(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <LinearGradient colors={['#1E2340', '#0A0E27']} style={styles.modalGradient}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Contact {tutorDetails.name}</Text>
              <TouchableOpacity onPress={() => setShowContactModal(false)}><Ionicons name="close" size={24} color="#FFF" /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.formLabel}>Quick Templates</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.messageTemplates}>
                {readyMessages.map((msg, i) => (
                  <TouchableOpacity key={i} style={styles.messageTemplate} onPress={() => setQuickMessage(msg)}>
                    <Text style={styles.messageTemplateText} numberOfLines={2}>{msg}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.formLabel}>Your Message</Text>
              <TextInput
                style={styles.messageInput}
                placeholder="Type message..."
                placeholderTextColor="#636E72"
                value={quickMessage}
                onChangeText={setQuickMessage}
                multiline
              />
              <TouchableOpacity style={styles.sendButton} onPress={sendQuickMessage} disabled={sendingMessage}>
                {sendingMessage ? <ActivityIndicator color="#FFF" /> : <Text style={styles.sendButtonText}>Send Message</Text>}
              </TouchableOpacity>
              
              <View style={styles.contactOptions}>
                {tutorDetails.whatsapp_number && (
                  <TouchableOpacity style={styles.directContactButton} onPress={() => Linking.openURL(`https://wa.me/${tutorDetails.whatsapp_number}`)}>
                    <Ionicons name="logo-whatsapp" size={20} color="#25D366" /><Text style={styles.directContactText}>WhatsApp</Text>
                  </TouchableOpacity>
                )}
                {tutorDetails.phone_number && (
                  <TouchableOpacity style={styles.directContactButton} onPress={() => Linking.openURL(`tel:${tutorDetails.phone_number}`)}>
                    <Ionicons name="call" size={20} color="#0984E3" /><Text style={styles.directContactText}>Call</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </LinearGradient>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  const BookingModal = () => (
    <Modal visible={showBookingModal} animationType="slide" transparent={true} onRequestClose={() => setShowBookingModal(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <LinearGradient colors={['#1E2340', '#0A0E27']} style={styles.modalGradient}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Book Session</Text>
              <TouchableOpacity onPress={() => setShowBookingModal(false)}><Ionicons name="close" size={24} color="#FFF" /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.formLabel}>Subject</Text>
              <View style={styles.subjectsGrid}>
                {subjects.map((sub, i) => (
                  <TouchableOpacity 
                    key={i} 
                    style={[styles.subjectChip, bookingDetails.subject === sub && styles.subjectChipActive]}
                    onPress={() => setBookingDetails(prev => ({...prev, subject: sub}))}
                  >
                    <Text style={[styles.subjectChipText, bookingDetails.subject === sub && styles.subjectChipTextActive]}>{sub}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Duration</Text>
              <View style={styles.durationButtons}>
                {[60, 90, 120].map(dur => (
                  <TouchableOpacity 
                    key={dur} 
                    style={[styles.durationButton, bookingDetails.duration === dur && styles.durationButtonActive]}
                    onPress={() => setBookingDetails(prev => ({...prev, duration: dur}))}
                  >
                    <Text style={[styles.durationButtonText, bookingDetails.duration === dur && styles.durationButtonTextActive]}>{dur} min</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.costContainer}>
                <Text style={styles.costLabel}>Total Cost:</Text>
                <Text style={styles.costValue}>R{((tutorDetails.hourly_rate || 200) * (bookingDetails.duration / 60)).toFixed(2)}</Text>
              </View>

              <Text style={styles.formLabel}>Message/Notes</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Any specific topic?"
                placeholderTextColor="#636E72"
                value={bookingDetails.notes}
                onChangeText={t => setBookingDetails(prev => ({...prev, notes: t}))}
                multiline
              />

              <TouchableOpacity style={styles.bookNowButton} onPress={handleBookSession} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.bookNowText}>Confirm Request</Text>}
              </TouchableOpacity>
            </ScrollView>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );

  // --- Main Render ---

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C5CE7" />
        <Text style={styles.loadingText}>Loading Profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ContactModal />
      <BookingModal />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#1E2340', '#6C5CE7']} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.actionButton} onPress={toggleFavorite}>
                <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={22} color={isFavorite ? "#FF7675" : "#FFF"} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => Share.share({ message: `Check out ${tutorDetails.name} on StuddyHub!` })}>
                <Ionicons name="share-outline" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              {tutorDetails.profile_image_url && !imageError ? (
                <Image source={{ uri: tutorDetails.profile_image_url }} style={styles.avatar} onError={() => setImageError(true)} />
              ) : (
                <View style={styles.avatarPlaceholder}><Text style={styles.avatarInitials}>{tutorDetails.name?.charAt(0) || 'T'}</Text></View>
              )}
              {tutorDetails.is_verified && <View style={styles.verifiedBadge}><Ionicons name="checkmark-circle" size={16} color="#00B894" /></View>}
            </View>
            <Text style={styles.tutorName}>{tutorDetails.name}</Text>
            <View style={styles.ratingContainer}>
              <View style={styles.starsContainer}>{renderStars(parseFloat(ratingInfo.average))}</View>
              <Text style={styles.ratingText}>{ratingInfo.average} • {ratingInfo.count} reviews</Text>
            </View>
            <View style={styles.priceTag}>
              <Ionicons name="cash" size={18} color="#00B894" />
              <Text style={styles.priceText}>R{tutorDetails.hourly_rate || 200}/hour</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Ionicons name="book" size={20} color="#6C5CE7" />
            <Text style={styles.statNumber}>{subjects.length}</Text>
            <Text style={styles.statLabel}>Subjects</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="school" size={20} color="#00B894" />
            <Text style={styles.statNumber}>{tutorDetails.experience_years || 1}+</Text>
            <Text style={styles.statLabel}>Years</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="people" size={20} color="#FD79A8" />
            <Text style={styles.statNumber}>{tutorDetails.students_taught || 0}</Text>
            <Text style={styles.statLabel}>Students</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.quickContactCard} onPress={() => setShowContactModal(true)}>
          <LinearGradient colors={['#6C5CE720', '#6C5CE710']} style={styles.quickContactGradient}>
            <View style={styles.quickContactHeader}>
              <View style={styles.quickContactIcon}><Ionicons name="chatbubble-ellipses" size={28} color="#6C5CE7" /></View>
              <View style={styles.quickContactInfo}>
                <Text style={styles.quickContactTitle}>Send a Quick Message</Text>
                <Text style={styles.quickContactText}>"Hey {tutorDetails.name?.split(' ')[0]}, I have a question..."</Text>
              </View>
            </View>
            <Ionicons name="arrow-forward" size={20} color="#6C5CE7" />
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bookNowLargeButton} onPress={() => setShowBookingModal(true)}>
          <LinearGradient colors={['#6C5CE7', '#A29BFE']} style={styles.bookNowGradient}>
            <Ionicons name="calendar" size={24} color="#FFF" />
            <Text style={styles.bookNowLargeText}>Book Session Now</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About Tutor</Text>
          <Text style={styles.bioText}>{tutorDetails.bio || `${tutorDetails.name} is an experienced tutor.`}</Text>
          {tutorDetails.credentials && (
            <View style={styles.qualifications}>
              {tutorDetails.credentials.map((cred, i) => (
                <View key={i} style={styles.qualificationItem}>
                  <Ionicons name="school" size={16} color="#00B894" />
                  <Text style={styles.qualificationText}>{cred}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subjects Offered</Text>
          <View style={styles.subjectsGridSection}>
            {subjects.map((sub, i) => (
              <View key={i} style={styles.subjectCard}>
                <Ionicons name="book" size={20} color="#6C5CE7" />
                <Text style={styles.subjectName}>{sub}</Text>
              </View>
            ))}
          </View>
        </View>

        {sessions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Available Slots</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sessionsScroll}>
              {sessions.slice(0, 5).map((session, i) => (
                <TouchableOpacity 
                  key={i} 
                  style={styles.sessionCard}
                  onPress={() => {
                    setBookingDetails(prev => ({ ...prev, date: new Date(session.session_date), duration: session.duration || 60 }));
                    setShowBookingModal(true);
                  }}
                >
                  <LinearGradient colors={['#1E2340', '#2D3561']} style={styles.sessionGradient}>
                    <Text style={styles.sessionDay}>{new Date(session.session_date).toLocaleDateString('en-US', { weekday: 'short' })}</Text>
                    <Text style={styles.sessionDate}>{new Date(session.session_date).getDate()}</Text>
                    <Text style={styles.sessionTime}>{session.start_time}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {reviews.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Reviews</Text>
              <TouchableOpacity onPress={() => navigation.navigate('TutorReviews', { reviews, tutorName: tutorDetails.name })}>
                <Text style={styles.viewAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            {reviews.slice(0, 2).map((review, i) => (
              <View key={i} style={styles.reviewPreview}>
                <LinearGradient colors={['#1E2340', '#2D3561']} style={styles.reviewGradient}>
                  <View style={styles.reviewPreviewHeader}>
                    <View style={styles.reviewRating}>{renderStars(review.rating)}</View>
                    <Text style={styles.reviewPreviewDate}>{new Date(review.created_at).toLocaleDateString()}</Text>
                  </View>
                  <Text style={styles.reviewPreviewComment} numberOfLines={2}>"{review.comment}"</Text>
                  <Text style={styles.reviewPreviewAuthorName}>- {review.students?.full_name || 'Student'}</Text>
                </LinearGradient>
              </View>
            ))}
          </View>
        )}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={styles.bottomContactBar}>
        <TouchableOpacity style={styles.bottomMessageButton} onPress={() => setShowContactModal(true)}>
          <Ionicons name="chatbubble" size={20} color="#6C5CE7" />
          <Text style={styles.bottomMessageText}>Message</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomBookButton} onPress={() => setShowBookingModal(true)}>
          <Ionicons name="calendar" size={20} color="#FFF" />
          <Text style={styles.bottomBookText}>Book Session</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E27' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0E27' },
  loadingText: { marginTop: 20, fontSize: 16, color: '#A29BFE' },
  scrollView: { flex: 1 },
  header: { paddingTop: 60, paddingBottom: 30, paddingHorizontal: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerActions: { flexDirection: 'row', gap: 10 },
  actionButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  
  profileSection: { alignItems: 'center' },
  avatarContainer: { position: 'relative', marginBottom: 15 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#FFF' },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#A29BFE', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFF' },
  avatarInitials: { fontSize: 40, fontWeight: 'bold', color: '#FFF' },
  verifiedBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#FFF', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  
  tutorName: { fontSize: 24, fontWeight: '800', color: '#FFF', marginBottom: 5 },
  ratingContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  starsContainer: { flexDirection: 'row' },
  ratingText: { color: '#FFF', fontWeight: '600' },
  priceTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 184, 148, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 5 },
  priceText: { color: '#00B894', fontWeight: '700' },

  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, marginTop: -25 },
  statItem: { backgroundColor: '#1E2340', flex: 1, marginHorizontal: 4, borderRadius: 15, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#2D3561' },
  statNumber: { color: '#FFF', fontWeight: 'bold', fontSize: 16, marginTop: 5 },
  statLabel: { color: '#A29BFE', fontSize: 10 },

  quickContactCard: { marginHorizontal: 20, marginBottom: 20, borderRadius: 20, overflow: 'hidden' },
  quickContactGradient: { padding: 20, borderWidth: 1, borderColor: '#6C5CE730', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quickContactHeader: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  quickContactIcon: { marginRight: 15 },
  quickContactInfo: { flex: 1 },
  quickContactTitle: { fontSize: 16, fontWeight: '700', color: '#6C5CE7', marginBottom: 4 },
  quickContactText: { fontSize: 13, color: '#FFF', opacity: 0.9, fontStyle: 'italic' },

  bookNowLargeButton: { marginHorizontal: 20, marginBottom: 25, borderRadius: 16, overflow: 'hidden', elevation: 5 },
  bookNowGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 18 },
  bookNowLargeText: { color: '#FFF', fontWeight: 'bold', fontSize: 18 },

  section: { paddingHorizontal: 20, marginBottom: 25 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 10 },
  viewAllText: { color: '#6C5CE7', fontWeight: '600' },
  bioText: { color: '#A29BFE', lineHeight: 22 },
  
  qualifications: { marginTop: 10 },
  qualificationItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  qualificationText: { color: '#FFF', fontSize: 13 },

  subjectsGridSection: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  subjectCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E2340', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, gap: 6, borderWidth: 1, borderColor: '#2D3561' },
  subjectName: { color: '#FFF', fontSize: 13 },

  sessionsScroll: { marginLeft: -20, paddingLeft: 20 },
  sessionCard: { marginRight: 15, borderRadius: 16, overflow: 'hidden', width: 90 },
  sessionGradient: { padding: 15, alignItems: 'center', height: 100, justifyContent: 'center' },
  sessionDay: { color: '#A29BFE', fontSize: 12, marginBottom: 2 },
  sessionDate: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  sessionTime: { color: '#00B894', fontSize: 11, marginTop: 4, fontWeight: '600' },

  reviewPreview: { marginBottom: 15, borderRadius: 15, overflow: 'hidden' },
  reviewGradient: { padding: 15 },
  reviewPreviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  reviewPreviewDate: { color: '#636E72', fontSize: 12 },
  reviewPreviewComment: { color: '#FFF', fontStyle: 'italic', marginBottom: 8 },
  reviewPreviewAuthorName: { color: '#A29BFE', fontSize: 12, textAlign: 'right' },

  bottomSpacer: { height: 100 },
  bottomContactBar: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#1E2340', flexDirection: 'row', padding: 15, borderTopWidth: 1, borderTopColor: '#2D3561', gap: 12 },
  bottomMessageButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#6C5CE7' },
  bottomMessageText: { color: '#6C5CE7', fontWeight: '700' },
  bottomBookButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 14, borderRadius: 12, backgroundColor: '#6C5CE7' },
  bottomBookText: { color: '#FFF', fontWeight: '700' },

  // Modal Styles
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalContent: { height: height * 0.85, borderTopLeftRadius: 25, borderTopRightRadius: 25, overflow: 'hidden' },
  modalGradient: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#2D3561' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  modalBody: { padding: 20 },
  formLabel: { color: '#A29BFE', fontSize: 14, marginBottom: 10, marginTop: 15, fontWeight: '600' },
  
  messageTemplates: { flexDirection: 'row', marginBottom: 10 },
  messageTemplate: { backgroundColor: '#1E2340', padding: 10, borderRadius: 10, marginRight: 10, width: 180, borderWidth: 1, borderColor: '#2D3561' },
  messageTemplateText: { color: '#A29BFE', fontSize: 12 },
  messageInput: { backgroundColor: '#0A0E27', borderWidth: 1, borderColor: '#2D3561', borderRadius: 12, padding: 15, color: '#FFF', height: 100, textAlignVertical: 'top' },
  
  sendButton: { backgroundColor: '#6C5CE7', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  sendButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  
  contactOptions: { marginTop: 30, borderTopWidth: 1, borderTopColor: '#2D3561', paddingTop: 20, flexDirection: 'row', gap: 10 },
  directContactButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1E2340', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#2D3561' },
  directContactText: { color: '#FFF' },

  subjectsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  subjectChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#1E2340', borderWidth: 1, borderColor: '#2D3561' },
  subjectChipActive: { backgroundColor: '#6C5CE7', borderColor: '#6C5CE7' },
  subjectChipText: { color: '#A29BFE' },
  subjectChipTextActive: { color: '#FFF', fontWeight: 'bold' },

  durationButtons: { flexDirection: 'row', gap: 10 },
  durationButton: { flex: 1, padding: 12, alignItems: 'center', backgroundColor: '#1E2340', borderRadius: 10, borderWidth: 1, borderColor: '#2D3561' },
  durationButtonActive: { backgroundColor: '#00B894', borderColor: '#00B894' },
  durationButtonText: { color: '#A29BFE' },
  durationButtonTextActive: { color: '#FFF', fontWeight: 'bold' },

  costContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, padding: 15, backgroundColor: '#1E2340', borderRadius: 12 },
  costLabel: { color: '#FFF', fontSize: 16 },
  costValue: { color: '#00B894', fontSize: 20, fontWeight: 'bold' },

  notesInput: { backgroundColor: '#0A0E27', borderWidth: 1, borderColor: '#2D3561', borderRadius: 12, padding: 15, color: '#FFF', height: 80, textAlignVertical: 'top' },
  bookNowButton: { backgroundColor: '#00B894', padding: 18, borderRadius: 14, alignItems: 'center', marginTop: 30, marginBottom: 40 },
  bookNowText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});