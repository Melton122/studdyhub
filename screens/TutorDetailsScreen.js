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
import DateTimePicker from '@react-native-community/datetimepicker';
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
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [bookingDetails, setBookingDetails] = useState({
    date: new Date(),
    time: new Date(),
    duration: 60,
    subject: '',
    notes: '',
  });
  const [subjects, setSubjects] = useState([]);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [availableTimes, setAvailableTimes] = useState([]);

  // Pre-written messages
  const readyMessages = [
    `Hi ${tutor.name?.split(' ')[0] || 'Tutor'}, I found you on StuddyHub and I'm interested in booking a session!`,
    `Hello ${tutor.name?.split(' ')[0] || 'Tutor'}, I need help preparing for my exams. Can we schedule a session?`,
    `Hi, I saw your profile on StuddyHub and would like to book a tutoring session.`,
    `Hello, I'm struggling with ${tutor.subjects?.[0] || 'my subject'} and need your help.`,
  ];

  useEffect(() => {
    console.log('Tutor data from params:', tutor);
    fetchTutorDetails();
    checkIfFavorite();
    if (tutor.subjects && tutor.subjects.length > 0) {
      setSubjects(tutor.subjects);
      if (tutor.subjects[0]) {
        setBookingDetails(prev => ({ ...prev, subject: tutor.subjects[0] }));
      }
    }
    setMessageText(readyMessages[0]);
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
        generateAvailableTimes(sessionsData || []);
      }

      // Fetch tutor reviews
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('tutor_reviews')
        .select('*, user_profiles(full_name, profile_image_url)')
        .eq('tutor_id', tutor.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!reviewsError) {
        setReviews(reviewsData || []);
      }

      // Update tutor details with fresh data
      const { data: freshTutorData, error: tutorError } = await supabase
        .from('tutors')
        .select('*')
        .eq('id', tutor.id)
        .single();

      if (!tutorError && freshTutorData) {
        console.log('Fresh tutor data:', freshTutorData);
        setTutorDetails(freshTutorData);
        
        // Make sure we have subjects
        if (freshTutorData.subjects && freshTutorData.subjects.length > 0) {
          setSubjects(freshTutorData.subjects);
          if (freshTutorData.subjects[0]) {
            setBookingDetails(prev => ({ ...prev, subject: freshTutorData.subjects[0] }));
          }
        }
      }

    } catch (error) {
      console.error('Error fetching tutor details:', error);
    } finally {
      setLoading(false);
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

      if (!error && data) {
        setIsFavorite(true);
      }
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
        const { error } = await supabase
          .from('tutor_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('tutor_id', tutor.id);

        if (!error) {
          setIsFavorite(false);
          Alert.alert('Removed from Favorites', `${tutorDetails.name} has been removed from your favorites.`);
        }
      } else {
        const { error } = await supabase
          .from('tutor_favorites')
          .insert([{
            user_id: user.id,
            tutor_id: tutor.id,
            created_at: new Date().toISOString(),
          }]);

        if (!error) {
          setIsFavorite(true);
          Alert.alert('Added to Favorites', `${tutorDetails.name} has been added to your favorites.`);
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert('Error', 'Could not update favorites. Please try again.');
    }
  };

  const generateAvailableTimes = (sessionsData) => {
    const times = [];
    // Generate time slots from 8 AM to 8 PM
    for (let hour = 8; hour <= 20; hour++) {
      for (let minute = 0; minute < 60; minute += 60) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const isBooked = sessionsData.some(session => 
          session.start_time === time && session.status === 'booked'
        );
        if (!isBooked) {
          times.push(time);
        }
      }
    }
    setAvailableTimes(times);
  };

  const handleBookSession = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to book a session.');
      return;
    }

    if (!bookingDetails.subject) {
      Alert.alert('Select Subject', 'Please select a subject for the session.');
      return;
    }

    try {
      setLoading(true);
      
      const bookingData = {
        tutor_id: tutor.id,
        student_id: user.id,
        subject: bookingDetails.subject,
        session_date: bookingDetails.date.toISOString().split('T')[0],
        start_time: bookingDetails.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        duration: bookingDetails.duration,
        notes: bookingDetails.notes,
        status: 'pending',
        amount: (tutorDetails.hourly_rate || 200) * (bookingDetails.duration / 60),
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('tutor_bookings')
        .insert([bookingData])
        .select()
        .single();

      if (error) throw error;

      Alert.alert(
        'Booking Request Sent!',
        'Your session request has been sent to the tutor. They will confirm shortly.',
        [
          { 
            text: 'OK', 
            onPress: () => {
              setShowBookingModal(false);
              fetchTutorDetails();
            }
          }
        ]
      );

      // Send notification to tutor
      await supabase
        .from('notifications')
        .insert([{
          user_id: tutor.user_id,
          title: 'New Session Request',
          message: `${user.email} requested a ${bookingDetails.duration}-minute session for ${bookingDetails.subject}`,
          type: 'booking_request',
          data: { booking_id: data.id },
          created_at: new Date().toISOString(),
        }]);

    } catch (error) {
      console.error('Booking error:', error);
      Alert.alert('Booking Failed', error.message || 'Failed to book session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle sending message via app
  const handleSendMessage = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to send a message.');
      return;
    }

    if (!messageText.trim()) {
      Alert.alert('Empty Message', 'Please enter a message.');
      return;
    }

    try {
      setSendingMessage(true);
      
      // Create a conversation or message record
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          sender_id: user.id,
          receiver_id: tutor.user_id,
          content: messageText,
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) throw error;

      // Send notification
      await supabase
        .from('notifications')
        .insert([{
          user_id: tutor.user_id,
          title: 'New Message',
          message: `New message from ${profile?.full_name || 'Student'}`,
          type: 'message',
          data: { message_id: data.id },
          created_at: new Date().toISOString(),
        }]);

      Alert.alert('Message Sent!', 'Your message has been sent to the tutor.', [
        { text: 'OK', onPress: () => setShowContactModal(false) }
      ]);
      setMessageText(readyMessages[0]);

    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  // Open WhatsApp with pre-written message
  const openWhatsApp = () => {
    if (!tutorDetails.whatsapp_number) {
      Alert.alert('No WhatsApp', 'This tutor has not provided a WhatsApp number.');
      return;
    }

    const message = `Hi ${tutorDetails.name?.split(' ')[0] || 'Tutor'}, I found you on StuddyHub and I'm interested in booking a session for ${subjects[0] || 'tutoring'}.`;
    const url = `https://wa.me/${tutorDetails.whatsapp_number}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open WhatsApp.');
    });
  };

  // Open email with pre-written message
  const openEmail = () => {
    if (!tutorDetails.email) {
      Alert.alert('No Email', 'This tutor has not provided an email address.');
      return;
    }

    const subject = `Booking Request - StuddyHub`;
    const body = `Dear ${tutorDetails.name},\n\nI found your profile on StuddyHub and I am interested in booking a tutoring session for ${subjects[0] || 'my subject'}.\n\nBest regards,\n${profile?.full_name || 'Student'}`;
    
    const url = `mailto:${tutorDetails.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open email client.');
    });
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Ionicons key={i} name="star" size={16} color="#FDCB6E" />);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<Ionicons key={i} name="star-half" size={16} color="#FDCB6E" />);
      } else {
        stars.push(<Ionicons key={i} name="star-outline" size={16} color="#FDCB6E" />);
      }
    }
    return stars;
  };

  const calculateAverageRating = () => {
    if (!reviews.length) return { average: 0, count: 0 };
    
    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    return {
      average: (total / reviews.length).toFixed(1),
      count: reviews.length,
    };
  };

  const renderReviewItem = ({ item }) => (
    <View style={styles.reviewItem}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewRating}>
          {renderStars(item.rating)}
        </View>
        <Text style={styles.reviewDate}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
      <Text style={styles.reviewComment}>{item.comment}</Text>
      <Text style={styles.reviewAuthor}>- {item.user_profiles?.full_name || 'Anonymous'}</Text>
    </View>
  );

  const ContactModal = () => (
    <Modal
      visible={showContactModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowContactModal(false)}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <LinearGradient colors={['#1E2340', '#0A0E27']} style={styles.modalGradient}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Contact {tutorDetails.name?.split(' ')[0] || 'Tutor'}</Text>
              <TouchableOpacity onPress={() => setShowContactModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.formLabel}>Quick Templates</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.messageTemplates}>
                {readyMessages.map((msg, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.messageTemplate}
                    onPress={() => setMessageText(msg)}
                  >
                    <Text style={styles.messageTemplateText} numberOfLines={2}>{msg}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.formLabel}>Your Message</Text>
              <TextInput
                style={styles.messageInput}
                placeholder="Type your message here..."
                placeholderTextColor="#636E72"
                value={messageText}
                onChangeText={setMessageText}
                multiline
                numberOfLines={4}
              />

              <TouchableOpacity
                style={[styles.sendButton, sendingMessage && styles.sendButtonDisabled]}
                onPress={handleSendMessage}
                disabled={sendingMessage}
              >
                {sendingMessage ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={20} color="#FFF" />
                    <Text style={styles.sendButtonText}>Send Message</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.directContactButtons}>
                {tutorDetails.whatsapp_number && (
                  <TouchableOpacity 
                    style={styles.whatsappButton}
                    onPress={openWhatsApp}
                  >
                    <Ionicons name="logo-whatsapp" size={20} color="#FFF" />
                    <Text style={styles.whatsappButtonText}>WhatsApp</Text>
                  </TouchableOpacity>
                )}
                
                {tutorDetails.email && (
                  <TouchableOpacity 
                    style={styles.emailButton}
                    onPress={openEmail}
                  >
                    <Ionicons name="mail" size={20} color="#FFF" />
                    <Text style={styles.emailButtonText}>Email</Text>
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
    <Modal
      visible={showBookingModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowBookingModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Book Session with {tutorDetails.name}</Text>
            <TouchableOpacity onPress={() => setShowBookingModal(false)}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Subject Selection */}
            <Text style={styles.formLabel}>Subject *</Text>
            <View style={styles.subjectsGrid}>
              {subjects.map((subject, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.subjectChip,
                    bookingDetails.subject === subject && styles.subjectChipActive
                  ]}
                  onPress={() => setBookingDetails(prev => ({ ...prev, subject }))}
                >
                  <Text style={[
                    styles.subjectChipText,
                    bookingDetails.subject === subject && styles.subjectChipTextActive
                  ]}>
                    {subject}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Duration */}
            <Text style={styles.formLabel}>Duration *</Text>
            <View style={styles.durationButtons}>
              {[30, 60, 90, 120].map(duration => (
                <TouchableOpacity
                  key={duration}
                  style={[
                    styles.durationButton,
                    bookingDetails.duration === duration && styles.durationButtonActive
                  ]}
                  onPress={() => setBookingDetails(prev => ({ ...prev, duration }))}
                >
                  <Text style={[
                    styles.durationButtonText,
                    bookingDetails.duration === duration && styles.durationButtonTextActive
                  ]}>
                    {duration} min
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Cost */}
            <View style={styles.costContainer}>
              <Text style={styles.costLabel}>Session Cost:</Text>
              <Text style={styles.costValue}>
                R{((tutorDetails.hourly_rate || 200) * (bookingDetails.duration / 60)).toFixed(2)}
              </Text>
            </View>

            {/* Notes */}
            <Text style={styles.formLabel}>Additional Notes (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Any specific topics or requirements..."
              placeholderTextColor="#636E72"
              value={bookingDetails.notes}
              onChangeText={(text) => setBookingDetails(prev => ({ ...prev, notes: text }))}
              multiline
              numberOfLines={4}
            />

            {/* Book Button */}
            <TouchableOpacity
              style={[styles.bookNowButton, loading && styles.bookNowButtonDisabled]}
              onPress={handleBookSession}
              disabled={loading || !bookingDetails.subject}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="calendar" size={20} color="#FFF" />
                  <Text style={styles.bookNowText}>Request Session</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.bookingNote}>
              The tutor will confirm your session within 24 hours. Payment will be processed upon confirmation.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C5CE7" />
        <Text style={styles.loadingText}>Loading tutor details...</Text>
      </View>
    );
  }

  const ratingInfo = calculateAverageRating();
  const tutorName = tutorDetails.name || 'Tutor';
  const tutorInitials = tutorName.charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <ContactModal />
      <BookingModal />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Tutor Header */}
        <LinearGradient colors={['#1E2340', '#6C5CE7']} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            
            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={toggleFavorite}
              >
                <Ionicons 
                  name={isFavorite ? "heart" : "heart-outline"} 
                  size={22} 
                  color={isFavorite ? "#FF7675" : "#FFF"} 
                />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => {
                  Share.share({
                    message: `Check out ${tutorName} on StuddyHub - Expert tutor for ${subjects.join(', ')}`,
                    title: `${tutorName} - StuddyHub Tutor`,
                  });
                }}
              >
                <Ionicons name="share-outline" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              {tutorDetails.profile_image_url && !imageError ? (
                <Image
                  source={{ uri: tutorDetails.profile_image_url }}
                  style={styles.avatar}
                  onError={() => setImageError(true)}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitials}>
                    {tutorInitials}
                  </Text>
                </View>
              )}
              {tutorDetails.is_verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#00B894" />
                </View>
              )}
            </View>

            <Text style={styles.tutorName}>{tutorName}</Text>
            
            <View style={styles.ratingContainer}>
              <View style={styles.starsContainer}>
                {renderStars(parseFloat(ratingInfo.average))}
              </View>
              <TouchableOpacity onPress={() => setShowReviewsModal(true)}>
                <Text style={styles.ratingText}>
                  {ratingInfo.average} ({ratingInfo.count} reviews)
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.priceTag}>
              <Ionicons name="cash-outline" size={16} color="#00B894" />
              <Text style={styles.priceText}>
                R{tutorDetails.hourly_rate || 200}/hour
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Ionicons name="book" size={20} color="#6C5CE7" />
            <Text style={styles.statNumber}>{subjects.length}</Text>
            <Text style={styles.statLabel}>Subjects</Text>
          </View>
          
          <View style={styles.statItem}>
            <Ionicons name="school" size={20} color="#00B894" />
            <Text style={styles.statNumber}>{tutorDetails.experience_years || 1}+</Text>
            <Text style={styles.statLabel}>Years Exp</Text>
          </View>
          
          <View style={styles.statItem}>
            <Ionicons name="people" size={20} color="#FD79A8" />
            <Text style={styles.statNumber}>{tutorDetails.students_taught || 0}</Text>
            <Text style={styles.statLabel}>Students</Text>
          </View>
          
          <View style={styles.statItem}>
            <Ionicons name="checkmark-circle" size={20} color="#FDCB6E" />
            <Text style={styles.statNumber}>{tutorDetails.success_rate || 95}%</Text>
            <Text style={styles.statLabel}>Success Rate</Text>
          </View>
        </View>

        {/* Quick Contact Card */}
        <TouchableOpacity 
          style={styles.quickContactCard}
          onPress={() => setShowContactModal(true)}
        >
          <LinearGradient colors={['#6C5CE720', '#6C5CE710']} style={styles.quickContactGradient}>
            <View style={styles.quickContactContent}>
              <View style={styles.quickContactIcon}>
                <Ionicons name="chatbubble-ellipses" size={28} color="#6C5CE7" />
              </View>
              <View style={styles.quickContactTextContainer}>
                <Text style={styles.quickContactTitle}>Send a Quick Message</Text>
                <Text style={styles.quickContactText}>
                  "Hi {tutorName.split(' ')[0]}, I found you on StuddyHub..."
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color="#6C5CE7" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Book Now Button */}
        <TouchableOpacity 
          style={styles.bookNowLargeButton}
          onPress={() => setShowBookingModal(true)}
        >
          <LinearGradient colors={['#6C5CE7', '#A29BFE']} style={styles.bookNowGradient}>
            <Ionicons name="calendar" size={24} color="#FFF" />
            <Text style={styles.bookNowLargeText}>Book Session Now</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Subjects Offered */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subjects Offered</Text>
          <View style={styles.subjectsGridSection}>
            {subjects.map((subject, index) => (
              <View key={index} style={styles.subjectCard}>
                <Ionicons name="book" size={20} color="#6C5CE7" />
                <Text style={styles.subjectName}>{subject}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About Tutor</Text>
          <Text style={styles.bioText}>
            {tutorDetails.bio || `${tutorName} is an experienced tutor specializing in ${subjects.join(', ')}.`}
          </Text>
          
          {/* Qualifications */}
          {tutorDetails.credentials && tutorDetails.credentials.length > 0 && (
            <View style={styles.qualifications}>
              <Text style={styles.qualificationsTitle}>Qualifications:</Text>
              {tutorDetails.credentials.map((cred, index) => (
                <View key={index} style={styles.qualificationItem}>
                  <Ionicons name="school" size={16} color="#00B894" />
                  <Text style={styles.qualificationText}>{cred}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Teaching Style */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Teaching Style</Text>
          <View style={styles.teachingTags}>
            {tutorDetails.teaching_style?.map((style, index) => (
              <View key={index} style={styles.styleTag}>
                <Text style={styles.styleTagText}>{style}</Text>
              </View>
            )) || (
              <>
                <View style={styles.styleTag}>
                  <Text style={styles.styleTagText}>Interactive</Text>
                </View>
                <View style={styles.styleTag}>
                  <Text style={styles.styleTagText}>Patient</Text>
                </View>
                <View style={styles.styleTag}>
                  <Text style={styles.styleTagText}>Exam-focused</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Available Sessions */}
        {sessions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Available Time Slots</Text>
              <TouchableOpacity onPress={() => navigation.navigate('TutorSessions', { sessions, tutor: tutorDetails })}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sessionsScroll}>
              {sessions.slice(0, 5).map((session, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.sessionCard}
                  onPress={() => {
                    setBookingDetails(prev => ({
                      ...prev,
                      date: new Date(session.session_date),
                      duration: session.duration || 60,
                    }));
                    setShowBookingModal(true);
                  }}
                >
                  <LinearGradient colors={['#1E2340', '#2D3561']} style={styles.sessionGradient}>
                    <Text style={styles.sessionDay}>
                      {new Date(session.session_date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </Text>
                    <Text style={styles.sessionDate}>
                      {new Date(session.session_date).getDate()}
                    </Text>
                    <Text style={styles.sessionTime}>
                      {session.start_time}
                    </Text>
                    <View style={styles.sessionPriceBadge}>
                      <Text style={styles.sessionPriceText}>R{session.price || tutorDetails.hourly_rate}</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Contact Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Tutor</Text>
          
          <View style={styles.contactGrid}>
            {tutorDetails.whatsapp_number && (
              <TouchableOpacity 
                style={styles.contactCard}
                onPress={openWhatsApp}
              >
                <View style={[styles.contactIcon, { backgroundColor: '#25D36620' }]}>
                  <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
                </View>
                <Text style={styles.contactLabel}>WhatsApp</Text>
              </TouchableOpacity>
            )}
            
            {tutorDetails.phone_number && (
              <TouchableOpacity 
                style={styles.contactCard}
                onPress={() => Linking.openURL(`tel:${tutorDetails.phone_number}`)}
              >
                <View style={[styles.contactIcon, { backgroundColor: '#0984E320' }]}>
                  <Ionicons name="call" size={24} color="#0984E3" />
                </View>
                <Text style={styles.contactLabel}>Call</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={styles.contactCard}
              onPress={() => setShowContactModal(true)}
            >
              <View style={[styles.contactIcon, { backgroundColor: '#6C5CE720' }]}>
                <Ionicons name="chatbubble" size={24} color="#6C5CE7" />
              </View>
              <Text style={styles.contactLabel}>Message</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Reviews Preview */}
        {reviews.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Student Reviews</Text>
              <TouchableOpacity onPress={() => navigation.navigate('TutorReviews', { reviews, tutorName })}>
                <Text style={styles.viewAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            
            {reviews.slice(0, 2).map((review, index) => (
              <View key={index} style={styles.reviewPreview}>
                <LinearGradient colors={['#1E2340', '#2D3561']} style={styles.reviewGradient}>
                  <View style={styles.reviewPreviewHeader}>
                    <View style={styles.reviewRating}>
                      {renderStars(review.rating)}
                    </View>
                    <Text style={styles.reviewPreviewDate}>
                      {new Date(review.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.reviewPreviewComment} numberOfLines={2}>
                    "{review.comment}"
                  </Text>
                  <Text style={styles.reviewPreviewAuthor}>
                    - {review.user_profiles?.full_name || 'Student'}
                  </Text>
                </LinearGradient>
              </View>
            ))}
          </View>
        )}

        {/* Similar Tutors */}
        {subjects.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Similar Tutors</Text>
            <TouchableOpacity 
              style={styles.similarTutorsButton}
              onPress={() => navigation.navigate('Tutors', { subject: subjects[0] })}
            >
              <Text style={styles.similarTutorsText}>
                Find more tutors for {subjects[0] || 'your subjects'}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#6C5CE7" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Fixed Bottom Book Button */}
      <View style={styles.bottomBookBar}>
        <View style={styles.priceSummary}>
          <Text style={styles.priceSummaryText}>From R{tutorDetails.hourly_rate || 200}/hour</Text>
          <Text style={styles.priceSummarySubtext}>Flexible scheduling</Text>
        </View>
        <TouchableOpacity 
          style={styles.bottomBookButton}
          onPress={() => setShowBookingModal(true)}
        >
          <Ionicons name="calendar" size={20} color="#FFF" />
          <Text style={styles.bottomBookText}>Book Session</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E27',
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
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#A29BFE',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 8,
  },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#FFF',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#6C5CE7',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFF',
  },
  avatarInitials: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFF',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tutorName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  ratingContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#FDCB6E',
    fontWeight: '600',
  },
  priceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#00B89420',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00B894',
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00B894',
  },
  statsGrid: {
    flexDirection: 'row',
    marginTop: -20,
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#1E2340',
    padding: 16,
    borderRadius: 16,
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
  quickContactCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  quickContactGradient: {
    padding: 20,
    borderWidth: 1,
    borderColor: '#6C5CE730',
  },
  quickContactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickContactIcon: {
    marginRight: 15,
  },
  quickContactTextContainer: {
    flex: 1,
  },
  quickContactTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6C5CE7',
    marginBottom: 4,
  },
  quickContactText: {
    fontSize: 13,
    color: '#FFF',
    opacity: 0.9,
    fontStyle: 'italic',
  },
  bookNowLargeButton: {
    marginHorizontal: 20,
    marginBottom: 25,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 5,
  },
  bookNowGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 18,
  },
  bookNowLargeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    color: '#6C5CE7',
    fontWeight: '600',
  },
  subjectsGridSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  subjectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2D3561',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    flex: 1,
    minWidth: '45%',
  },
  subjectName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A29BFE',
  },
  bioText: {
    fontSize: 15,
    color: '#A29BFE',
    lineHeight: 22,
    marginBottom: 16,
  },
  qualifications: {
    backgroundColor: '#1E2340',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  qualificationsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 12,
  },
  qualificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  qualificationText: {
    fontSize: 14,
    color: '#A29BFE',
    flex: 1,
  },
  teachingTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  styleTag: {
    backgroundColor: '#2D3561',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  styleTagText: {
    fontSize: 13,
    color: '#A29BFE',
    fontWeight: '600',
  },
  sessionsScroll: {
    marginLeft: -20,
    paddingLeft: 20,
  },
  sessionCard: {
    marginRight: 12,
    width: 100,
    borderRadius: 16,
    overflow: 'hidden',
  },
  sessionGradient: {
    padding: 16,
    alignItems: 'center',
    height: 120,
    justifyContent: 'center',
  },
  sessionDay: {
    fontSize: 12,
    color: '#A29BFE',
    fontWeight: '600',
    marginBottom: 4,
  },
  sessionDate: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
  },
  sessionTime: {
    fontSize: 14,
    color: '#A29BFE',
    marginBottom: 8,
  },
  sessionPriceBadge: {
    backgroundColor: '#00B89420',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sessionPriceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00B894',
  },
  contactGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  contactCard: {
    flex: 1,
    backgroundColor: '#1E2340',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center',
  },
  reviewPreview: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  reviewGradient: {
    padding: 16,
  },
  reviewPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewPreviewDate: {
    fontSize: 12,
    color: '#636E72',
  },
  reviewPreviewComment: {
    fontSize: 14,
    color: '#A29BFE',
    lineHeight: 20,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  reviewPreviewAuthor: {
    fontSize: 12,
    color: '#636E72',
    fontStyle: 'italic',
  },
  similarTutorsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E2340',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  similarTutorsText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  bottomSpacer: {
    height: 100,
  },
  bottomBookBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1E2340',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#2D3561',
  },
  priceSummary: {
    flex: 1,
  },
  priceSummaryText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  priceSummarySubtext: {
    fontSize: 12,
    color: '#636E72',
  },
  bottomBookButton: {
    backgroundColor: '#6C5CE7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  bottomBookText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: height * 0.85,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  modalGradient: {
    flex: 1,
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
  messageTemplates: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  messageTemplate: {
    backgroundColor: '#1E2340',
    padding: 12,
    borderRadius: 12,
    marginRight: 10,
    width: 200,
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  messageTemplateText: {
    fontSize: 13,
    color: '#A29BFE',
    lineHeight: 18,
  },
  messageInput: {
    backgroundColor: '#1E2340',
    borderWidth: 1,
    borderColor: '#2D3561',
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    fontSize: 15,
    height: 120,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  sendButton: {
    backgroundColor: '#6C5CE7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 18,
    borderRadius: 14,
    marginBottom: 20,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2D3561',
  },
  dividerText: {
    color: '#636E72',
    fontSize: 12,
    fontWeight: '600',
    marginHorizontal: 10,
  },
  directContactButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  whatsappButton: {
    flex: 1,
    backgroundColor: '#25D366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  whatsappButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  emailButton: {
    flex: 1,
    backgroundColor: '#EA4335',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  emailButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  subjectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectChip: {
    backgroundColor: '#1E2340',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
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
  costContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E2340',
    padding: 16,
    borderRadius: 12,
    marginVertical: 16,
  },
  costLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  costValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#00B894',
  },
  notesInput: {
    backgroundColor: '#1E2340',
    borderWidth: 1,
    borderColor: '#2D3561',
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    fontSize: 15,
    height: 120,
    textAlignVertical: 'top',
  },
  bookNowButton: {
    backgroundColor: '#6C5CE7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 18,
    borderRadius: 14,
    marginTop: 20,
  },
  bookNowButtonDisabled: {
    opacity: 0.6,
  },
  bookNowText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  bookingNote: {
    fontSize: 12,
    color: '#636E72',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
  },
  // Review Item Styles
  reviewItem: {
    backgroundColor: '#1E2340',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewRating: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewDate: {
    fontSize: 12,
    color: '#636E72',
  },
  reviewComment: {
    fontSize: 14,
    color: '#A29BFE',
    lineHeight: 20,
    marginBottom: 8,
  },
  reviewAuthor: {
    fontSize: 12,
    color: '#636E72',
    fontStyle: 'italic',
  },
});