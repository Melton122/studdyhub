import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, KeyboardAvoidingView,
  Platform, ActivityIndicator, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../context/AuthContext';

const FALLBACK_SUBJECTS = [
  'Mathematics','Maths Literacy','Physical Sciences','Life Sciences',
  'English Home Language','Xitsonga HL','Accounting','Business Studies',
  'Economics','History','Geography','Agricultural Sciences','CAT',
];

export default function RequestTutorScreen({ route, navigation }) {
  const { user } = useAuth();
  const selectedTutor = route.params?.selectedTutor;

  const [form, setForm] = useState({
    studentName: '', 
    studentEmail: '', 
    studentPhone: '',
    studentGrade: '',
    subject: '', 
    message: '',
    urgency: 'normal', // normal, urgent, flexible
  });
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      // Load subjects from database
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('id, name')
        .order('name');

      if (!subjectsError && subjectsData?.length > 0) {
        setSubjects(subjectsData);
      } else {
        // Use fallback if no subjects in database
        setSubjects(FALLBACK_SUBJECTS.map((name, index) => ({ id: index, name })));
      }

      // Load user profile if logged in
      if (user) {
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('full_name, phone_number, whatsapp_number, grade_level')
          .eq('id', user.id)
          .single();

        if (!profileError && profile) {
          setUserProfile(profile);
          setForm(prev => ({
            ...prev,
            studentName: profile.full_name || '',
            studentPhone: profile.phone_number || profile.whatsapp_number || '',
            studentGrade: profile.grade_level || '',
            studentEmail: user.email || '',
          }));
        }
      }
    } catch (error) {
      console.error('Initialization error:', error);
      // Set fallback subjects
      setSubjects(FALLBACK_SUBJECTS.map((name, index) => ({ id: index, name })));
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!form.studentName.trim()) {
      Alert.alert('Missing Information', 'Please enter your full name');
      return;
    }
    
    if (!form.studentPhone.trim()) {
      Alert.alert('Missing Information', 'Please enter your phone number');
      return;
    }
    
    if (!form.subject) {
      Alert.alert('Missing Information', 'Please select a subject');
      return;
    }

    setLoading(true);
    try {
      const requestData = {
        user_id: user?.id || null,
        student_name: form.studentName.trim(),
        student_email: form.studentEmail.trim() || null,
        student_phone: form.studentPhone.trim(),
        student_grade: form.studentGrade.trim() || null,
        subject: form.subject,
        preferred_tutor_id: selectedTutor?.id || null,
        preferred_tutor_name: selectedTutor?.name || null,
        message: form.message.trim() || null,
        urgency: form.urgency,
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('tutor_requests')
        .insert([requestData]);

      if (error) throw error;

      // If tutor selected, create a direct booking request
      if (selectedTutor?.id) {
        await supabase
          .from('direct_booking_requests')
          .insert([{
            tutor_id: selectedTutor.id,
            student_name: form.studentName.trim(),
            student_phone: form.studentPhone.trim(),
            subject: form.subject,
            message: form.message.trim() || null,
            status: 'pending',
            created_at: new Date().toISOString(),
          }]);
      }

      Alert.alert(
        'Request Submitted Successfully!',
        'Your tutoring request has been sent. A tutor will contact you within 24-48 hours.',
        [
          { 
            text: 'OK', 
            onPress: () => navigation.navigate('Tutors', { refresh: true })
          }
        ]
      );
    } catch (error) {
      console.error('Submission error:', error);
      Alert.alert(
        'Submission Error',
        error.message || 'Failed to submit request. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const directContact = async (type) => {
    if (!selectedTutor) return;

    let contactInfo, url;
    
    switch (type) {
      case 'whatsapp':
        contactInfo = selectedTutor.whatsapp_number || selectedTutor.phone_number;
        if (!contactInfo) {
          Alert.alert('WhatsApp Unavailable', 'This tutor has not provided a WhatsApp number.');
          return;
        }
        const cleanPhone = contactInfo.replace(/[^0-9+]/g, '');
        const message = `Hello ${selectedTutor.name}, I found your profile on StuddyHub and I'm interested in ${form.subject || 'tutoring'}.`;
        url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
        break;
        
      case 'phone':
        contactInfo = selectedTutor.phone_number;
        if (!contactInfo) {
          Alert.alert('Phone Unavailable', 'This tutor has not provided a phone number.');
          return;
        }
        url = `tel:${contactInfo}`;
        break;
        
      case 'email':
        contactInfo = selectedTutor.email;
        if (!contactInfo) {
          Alert.alert('Email Unavailable', 'This tutor has not provided an email address.');
          return;
        }
        const subject = `Tutoring Request - ${form.subject || 'General'}`;
        url = `mailto:${contactInfo}?subject=${encodeURIComponent(subject)}`;
        break;
    }

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('App Not Available', `Please install the required app to contact via ${type}.`);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not initiate contact. Please try again.');
    }
  };

  const setFormField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Tutor Info Card (if tutor selected) */}
        {selectedTutor && (
          <View style={styles.tutorCard}>
            <View style={styles.tutorInfo}>
              <Text style={styles.tutorCardTitle}>Requesting Tutor:</Text>
              <Text style={styles.tutorName}>{selectedTutor.name}</Text>
              {selectedTutor.rate_per_session && (
                <Text style={styles.tutorRate}>R{selectedTutor.rate_per_session}/session</Text>
              )}
            </View>
            <View style={styles.quickContactButtons}>
              <TouchableOpacity 
                style={styles.quickContactButton}
                onPress={() => directContact('whatsapp')}
              >
                <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.quickContactButton}
                onPress={() => directContact('phone')}
              >
                <Ionicons name="call-outline" size={22} color="#0984E3" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Form Title */}
        <Text style={styles.formTitle}>
          {selectedTutor ? 'Tutoring Request Form' : 'Find a Tutor Request'}
        </Text>
        <Text style={styles.formSubtitle}>
          Fill in your details and we'll match you with the perfect tutor
        </Text>

        {/* Personal Information */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          <Text style={styles.label}>Full Name *</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#6C5CE7" />
            <TextInput
              style={styles.input}
              placeholder="Your full name"
              placeholderTextColor="#636E72"
              value={form.studentName}
              onChangeText={(text) => setFormField('studentName', text)}
              editable={!loading}
            />
          </View>

          <Text style={styles.label}>Phone Number *</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="call-outline" size={20} color="#6C5CE7" />
            <TextInput
              style={styles.input}
              placeholder="+27 XXX XXX XXXX"
              placeholderTextColor="#636E72"
              value={form.studentPhone}
              onChangeText={(text) => setFormField('studentPhone', text)}
              keyboardType="phone-pad"
              editable={!loading}
            />
          </View>

          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#6C5CE7" />
            <TextInput
              style={styles.input}
              placeholder="your@email.com"
              placeholderTextColor="#636E72"
              value={form.studentEmail}
              onChangeText={(text) => setFormField('studentEmail', text)}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
            />
          </View>

          <Text style={styles.label}>Grade Level</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="school-outline" size={20} color="#6C5CE7" />
            <TextInput
              style={styles.input}
              placeholder="e.g., Grade 12"
              placeholderTextColor="#636E72"
              value={form.studentGrade}
              onChangeText={(text) => setFormField('studentGrade', text)}
              editable={!loading}
            />
          </View>
        </View>

        {/* Subject Selection */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Subject Needed *</Text>
          <Text style={styles.sectionSubtitle}>Select the subject you need help with</Text>
          
          <View style={styles.subjectsGrid}>
            {subjects.map((subject) => (
              <TouchableOpacity
                key={subject.id || subject}
                style={[
                  styles.subjectChip,
                  form.subject === (subject.name || subject) && styles.subjectChipActive
                ]}
                onPress={() => setFormField('subject', subject.name || subject)}
                disabled={loading}
              >
                <Text style={[
                  styles.subjectChipText,
                  form.subject === (subject.name || subject) && styles.subjectChipTextActive
                ]}>
                  {subject.name || subject}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Additional Information */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Additional Information</Text>
          
          <Text style={styles.label}>Urgency</Text>
          <View style={styles.urgencyButtons}>
            {['flexible', 'normal', 'urgent'].map((level) => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.urgencyButton,
                  form.urgency === level && styles.urgencyButtonActive,
                  { borderColor: getUrgencyColor(level) + '40' }
                ]}
                onPress={() => setFormField('urgency', level)}
                disabled={loading}
              >
                <Text style={[
                  styles.urgencyButtonText,
                  form.urgency === level && styles.urgencyButtonTextActive,
                  { color: form.urgency === level ? '#FFF' : getUrgencyColor(level) }
                ]}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Message (Optional)</Text>
          <View style={[styles.inputContainer, styles.textAreaContainer]}>
            <Ionicons name="chatbubble-outline" size={20} color="#6C5CE7" style={styles.textAreaIcon} />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell us about your specific needs, preferred schedule, or any other requirements..."
              placeholderTextColor="#636E72"
              value={form.message}
              onChangeText={(text) => setFormField('message', text)}
              multiline
              numberOfLines={4}
              editable={!loading}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading || !form.studentName || !form.studentPhone || !form.subject}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#FFF" />
              <Text style={styles.submitButtonText}>
                Submit Tutoring Request
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getUrgencyColor = (urgency) => {
  switch (urgency) {
    case 'urgent': return '#FF7675';
    case 'normal': return '#FDCB6E';
    case 'flexible': return '#00B894';
    default: return '#636E72';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E27',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  tutorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E2340',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#6C5CE7',
  },
  tutorInfo: {
    flex: 1,
  },
  tutorCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#636E72',
    marginBottom: 4,
  },
  tutorName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  tutorRate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00B894',
  },
  quickContactButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  quickContactButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0A0E27',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#A29BFE',
    marginBottom: 24,
  },
  formSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#636E72',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A29BFE',
    marginBottom: 8,
    marginTop: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2340',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  input: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    marginLeft: 12,
  },
  textAreaContainer: {
    height: 'auto',
    alignItems: 'flex-start',
    paddingVertical: 16,
  },
  textAreaIcon: {
    marginTop: 4,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  subjectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  subjectChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1E2340',
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  subjectChipActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  subjectChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A29BFE',
  },
  subjectChipTextActive: {
    color: '#FFF',
  },
  urgencyButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  urgencyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgencyButtonActive: {
    backgroundColor: '#6C5CE7',
  },
  urgencyButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  urgencyButtonTextActive: {
    color: '#FFF',
  },
  submitButton: {
    backgroundColor: '#6C5CE7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 18,
    borderRadius: 14,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  bottomSpacer: {
    height: 20,
  },
});