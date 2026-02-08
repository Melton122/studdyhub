import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../context/AuthContext';

const PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal',
  'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'
];

const GRADE_LEVELS = [
  'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'Matric Rewrite'
];

export default function EditProfileScreen({ navigation }) {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    school_name: '',
    phone_number: '',
    whatsapp_number: '',
    bio: '',
    province: '',
    city: '',
    grade_level: 'Grade 12',
  });
  const [imageUri, setImageUri] = useState(null);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [selectedSubjects, setSelectedSubjects] = useState([]);

  useEffect(() => {
    fetchProfile();
    fetchSubjects();
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        'Camera roll permissions are required to upload profile images.',
        [{ text: 'OK' }]
      );
    }
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      
      if (profile) {
        setFormData({
          full_name: profile.full_name || '',
          school_name: profile.school_name || '',
          phone_number: profile.phone_number || '',
          whatsapp_number: profile.whatsapp_number || '',
          bio: profile.bio || '',
          province: profile.province || '',
          city: profile.city || '',
          grade_level: profile.grade_level || 'Grade 12',
        });
        setImageUri(profile.profile_image_url);
        setSelectedSubjects(profile.selected_subjects || []);
      }
    } catch (error) {
      console.error('Fetch profile error:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async () => {
    try {
      const { data } = await supabase
        .from('subjects')
        .select('name')
        .order('name');
      setAvailableSubjects(data?.map(item => item.name) || []);
    } catch (error) {
      console.error('Error fetching subjects:', error);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadImage = async (uri) => {
    try {
      setUploading(true);
      
      if (!user) throw new Error('No user logged in');

      // Convert image to blob
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const fileExt = uri.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const filePath = `profile-images/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.full_name.trim() || !formData.school_name.trim()) {
      Alert.alert('Error', 'Full name and school name are required');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to update your profile');
      return;
    }

    setSaving(true);
    try {
      let profileImageUrl = imageUri;
      
      // Upload new image if it's a local URI
      if (imageUri && imageUri.startsWith('file://')) {
        profileImageUrl = await uploadImage(imageUri);
      }

      const updateData = {
        full_name: formData.full_name.trim(),
        school_name: formData.school_name.trim(),
        phone_number: formData.phone_number.trim() || null,
        whatsapp_number: formData.whatsapp_number.trim() || null,
        bio: formData.bio.trim() || null,
        province: formData.province.trim() || null,
        city: formData.city.trim() || null,
        grade_level: formData.grade_level,
        profile_image_url: profileImageUrl,
        selected_subjects: selectedSubjects,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      // Also update auth user email if changed
      if (formData.email && formData.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.email.trim(),
        });
        
        if (emailError) {
          Alert.alert('Note', 'Profile updated but email change requires verification');
        }
      }

      Alert.alert('Success', 'Profile updated successfully', [
        { 
          text: 'OK', 
          onPress: async () => {
            await refreshProfile();
            navigation.goBack();
          }
        }
      ]);
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', error.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const toggleSubject = (subject) => {
    setSelectedSubjects(prev => 
      prev.includes(subject)
        ? prev.filter(s => s !== subject)
        : [...prev, subject]
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            disabled={saving}
          >
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Profile Image */}
        <View style={styles.imageSection}>
          <TouchableOpacity onPress={pickImage} disabled={uploading || saving}>
            <View style={styles.imageContainer}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.profileImage} />
              ) : (
                <View style={styles.placeholderImage}>
                  <Ionicons name="person" size={40} color="#FFF" />
                </View>
              )}
              <View style={styles.editImageOverlay}>
                {uploading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Ionicons name="camera" size={20} color="#FFF" />
                )}
              </View>
            </View>
          </TouchableOpacity>
          <Text style={styles.imageHint}>
            {uploading ? 'Uploading...' : 'Tap to change photo'}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Full Name */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Ionicons name="person" size={16} color="#6C5CE7" />
              <Text style={styles.label}>
                Full Name *
              </Text>
            </View>
            <TextInput
              style={styles.input}
              value={formData.full_name}
              onChangeText={(text) => handleInputChange('full_name', text)}
              placeholder="Your full name"
              placeholderTextColor="#636E72"
              editable={!saving}
            />
          </View>

          {/* School Name */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Ionicons name="school" size={16} color="#6C5CE7" />
              <Text style={styles.label}>
                School Name *
              </Text>
            </View>
            <TextInput
              style={styles.input}
              value={formData.school_name}
              onChangeText={(text) => handleInputChange('school_name', text)}
              placeholder="Your school name"
              placeholderTextColor="#636E72"
              editable={!saving}
            />
          </View>

          {/* Email (Read-only) */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Ionicons name="mail" size={16} color="#6C5CE7" />
              <Text style={styles.label}>Email</Text>
            </View>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              value={user?.email || ''}
              placeholder="Your email"
              placeholderTextColor="#636E72"
              editable={false}
            />
            <Text style={styles.fieldNote}>Email can only be changed via account settings</Text>
          </View>

          {/* Phone Numbers */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={formData.phone_number}
                onChangeText={(text) => handleInputChange('phone_number', text)}
                placeholder="+27 XXX XXX XXXX"
                placeholderTextColor="#636E72"
                keyboardType="phone-pad"
                editable={!saving}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>WhatsApp</Text>
              <TextInput
                style={styles.input}
                value={formData.whatsapp_number}
                onChangeText={(text) => handleInputChange('whatsapp_number', text)}
                placeholder="+27 XXX XXX XXXX"
                placeholderTextColor="#636E72"
                keyboardType="phone-pad"
                editable={!saving}
              />
            </View>
          </View>

          {/* Location */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Province</Text>
              <View style={styles.pickerContainer}>
                {PROVINCES.map(province => (
                  <TouchableOpacity
                    key={province}
                    style={[
                      styles.pickerOption,
                      formData.province === province && styles.pickerOptionActive
                    ]}
                    onPress={() => handleInputChange('province', province)}
                    disabled={saving}
                  >
                    <Text style={[
                      styles.pickerOptionText,
                      formData.province === province && styles.pickerOptionTextActive
                    ]}>
                      {province}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>City/Town</Text>
              <TextInput
                style={styles.input}
                value={formData.city}
                onChangeText={(text) => handleInputChange('city', text)}
                placeholder="Your city"
                placeholderTextColor="#636E72"
                editable={!saving}
              />
            </View>
          </View>

          {/* Grade Level */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Grade Level</Text>
            <View style={styles.gradeButtons}>
              {GRADE_LEVELS.map(grade => (
                <TouchableOpacity
                  key={grade}
                  style={[
                    styles.gradeButton,
                    formData.grade_level === grade && styles.gradeButtonActive
                  ]}
                  onPress={() => handleInputChange('grade_level', grade)}
                  disabled={saving}
                >
                  <Text style={[
                    styles.gradeButtonText,
                    formData.grade_level === grade && styles.gradeButtonTextActive
                  ]}>
                    {grade}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Subjects */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Subjects You're Studying</Text>
            <Text style={styles.subLabel}>Select all that apply</Text>
            <View style={styles.subjectsGrid}>
              {availableSubjects.map(subject => (
                <TouchableOpacity
                  key={subject}
                  style={[
                    styles.subjectChip,
                    selectedSubjects.includes(subject) && styles.subjectChipActive
                  ]}
                  onPress={() => toggleSubject(subject)}
                  disabled={saving}
                >
                  {selectedSubjects.includes(subject) && (
                    <Ionicons name="checkmark" size={14} color="#FFF" style={styles.chipIcon} />
                  )}
                  <Text style={[
                    styles.subjectChipText,
                    selectedSubjects.includes(subject) && styles.subjectChipTextActive
                  ]}>
                    {subject}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.selectedCount}>
              {selectedSubjects.length} subject{selectedSubjects.length !== 1 ? 's' : ''} selected
            </Text>
          </View>

          {/* Bio */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Ionicons name="document-text" size={16} color="#6C5CE7" />
              <Text style={styles.label}>Bio</Text>
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.bio}
              onChangeText={(text) => handleInputChange('bio', text)}
              placeholder="Tell us about yourself, your goals, interests..."
              placeholderTextColor="#636E72"
              multiline
              numberOfLines={4}
              editable={!saving}
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => navigation.goBack()}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.saveButton, saving && styles.disabledButton]}
            onPress={handleSave}
            disabled={saving || !formData.full_name.trim() || !formData.school_name.trim()}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color="#FFF" />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Validation Message */}
        {(!formData.full_name.trim() || !formData.school_name.trim()) && (
          <Text style={styles.validationText}>
            * Full name and school name are required
          </Text>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </KeyboardAvoidingView>
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
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#1E2340',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  headerRight: {
    width: 40,
  },
  imageSection: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
  },
  imageContainer: {
    position: 'relative',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#6C5CE7',
  },
  placeholderImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#6C5CE7',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#6C5CE7',
  },
  editImageOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#6C5CE7',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0A0E27',
  },
  imageHint: {
    fontSize: 13,
    color: '#636E72',
    marginTop: 8,
  },
  form: {
    paddingHorizontal: 20,
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A29BFE',
  },
  subLabel: {
    fontSize: 12,
    color: '#636E72',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#1E2340',
    borderWidth: 1,
    borderColor: '#2D3561',
    borderRadius: 12,
    padding: 14,
    color: '#FFF',
    fontSize: 15,
  },
  disabledInput: {
    opacity: 0.7,
  },
  fieldNote: {
    fontSize: 12,
    color: '#636E72',
    marginTop: 4,
    fontStyle: 'italic',
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E2340',
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  pickerOptionActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  pickerOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A29BFE',
  },
  pickerOptionTextActive: {
    color: '#FFF',
  },
  gradeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gradeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1E2340',
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  gradeButtonActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  gradeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A29BFE',
  },
  gradeButtonTextActive: {
    color: '#FFF',
  },
  subjectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1E2340',
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  subjectChipActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  chipIcon: {
    marginRight: 6,
  },
  subjectChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A29BFE',
  },
  subjectChipTextActive: {
    color: '#FFF',
  },
  selectedCount: {
    fontSize: 13,
    color: '#636E72',
    marginTop: 8,
    fontWeight: '600',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 30,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#2D3561',
    borderWidth: 1,
    borderColor: '#636E72',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  saveButton: {
    backgroundColor: '#6C5CE7',
    flexDirection: 'row',
    gap: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  validationText: {
    color: '#FF7675',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 20,
  },
});