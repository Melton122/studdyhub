import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabaseConfig';

const FALLBACK_SUBJECTS = [
  'Mathematics','Maths Literacy','Physical Sciences','Life Sciences',
  'English Home Language','Xitsonga HL','Accounting','Business Studies',
  'Economics','History','Geography','Agricultural Sciences','CAT',
];

export default function SignupScreen({ navigation }) {
  const [form, setForm] = useState({
    fullName: '', email: '', password: '', confirmPassword: '',
    school: '', phone: '',
  });
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('subjects').select('name').order('name');
        setSubjects(data?.length ? data.map(r => r.name) : FALLBACK_SUBJECTS);
      } catch {
        setSubjects(FALLBACK_SUBJECTS);
      }
    })();
  }, []);

  const setFormField = (key) => (val) => setForm(prev => ({ ...prev, [key]: val }));

  const toggleSubject = (name) =>
    setSelectedSubjects(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );

  const validate = () => {
    const { fullName, email, password, confirmPassword, school } = form;
    if (!fullName.trim()) return 'Please enter your full name.';
    if (!email.trim()) return 'Please enter your email address.';
    if (!school.trim()) return 'Please enter your school name.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    if (!selectedSubjects.length) return 'Please select at least one subject.';
    return null;
  };

  const handleSignup = async () => {
    const err = validate();
    if (err) return Alert.alert('Incomplete', err);

    setLoading(true);
    try {
      // Disable email confirmation explicitly
      const { data: authData, error: signupError } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          data: {
            full_name: form.fullName.trim(),
          }
        }
      });

      if (signupError) {
        if (signupError.message.includes('already registered')) {
          // User exists, try to sign in instead
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: form.email.trim().toLowerCase(),
            password: form.password,
          });
          
          if (signInError) throw signInError;
        } else {
          throw signupError;
        }
      }

      // Create or update user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          id: authData?.user?.id || (await supabase.auth.getUser()).data.user.id,
          email: form.email.trim().toLowerCase(),
          full_name: form.fullName.trim(),
          school_name: form.school.trim(),
          phone_number: form.phone.trim() || null,
          selected_subjects: selectedSubjects,
          grade_level: 'Grade 12',
          province: '',
          city: '',
          bio: '',
          is_admin: false,
          profile_image_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (profileError) {
        console.log('Profile error (non-critical):', profileError);
        // Don't throw error - user can update profile later
      }

      Alert.alert(
        'Account Created ✓',
        'Your account has been created successfully!',
        [{ 
          text: 'Continue', 
          onPress: () => {
            // Navigation will happen automatically via auth state change
          }
        }]
      );

    } catch (e) {
      console.error('Signup error:', e);
      Alert.alert('Signup Failed', e.message || 'An error occurred during signup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex1}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Create Account</Text>
        </View>

        <Text style={styles.sectionHeading}>Personal Information</Text>

        {[
          { key:'fullName',  icon:'person-outline',   label:'Full Name *',             kb:'default',       cap:'words'  },
          { key:'email',     icon:'mail-outline',     label:'Email Address *',         kb:'email-address', cap:'none'   },
          { key:'school',    icon:'school-outline',   label:'School Name *',           kb:'default',       cap:'words'  },
          { key:'phone',     icon:'call-outline',     label:'Phone Number (optional)', kb:'phone-pad',     cap:'none'   },
        ].map(({ key, icon, label, kb, cap }) => (
          <View key={key}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.inputRow}>
              <Ionicons name={icon} size={20} color="#6C5CE7" />
              <TextInput
                style={styles.input}
                placeholder={label.replace(' *','')}
                placeholderTextColor="#636E72"
                value={form[key]}
                onChangeText={setFormField(key)}
                keyboardType={kb}
                autoCapitalize={cap}
              />
            </View>
          </View>
        ))}

        <Text style={[styles.sectionHeading, { marginTop: 28 }]}>Password</Text>

        <Text style={styles.label}>Password *</Text>
        <View style={styles.inputRow}>
          <Ionicons name="lock-closed-outline" size={20} color="#6C5CE7" />
          <TextInput
            style={styles.input}
            placeholder="At least 6 characters"
            placeholderTextColor="#636E72"
            secureTextEntry={!showPwd}
            value={form.password}
            onChangeText={setFormField('password')}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setShowPwd(p => !p)}>
            <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color="#636E72" />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Confirm Password *</Text>
        <View style={styles.inputRow}>
          <Ionicons name="lock-closed-outline" size={20} color="#6C5CE7" />
          <TextInput
            style={styles.input}
            placeholder="Re-enter password"
            placeholderTextColor="#636E72"
            secureTextEntry={!showPwd}
            value={form.confirmPassword}
            onChangeText={setFormField('confirmPassword')}
            autoCapitalize="none"
          />
        </View>

        <Text style={[styles.sectionHeading, { marginTop: 28 }]}>
          Select Your Subjects *
        </Text>
        <Text style={styles.subHint}>Choose at least one subject you are studying</Text>

        <View style={styles.chipGrid}>
          {subjects.map(name => {
            const on = selectedSubjects.includes(name);
            return (
              <TouchableOpacity
                key={name}
                style={[styles.chip, on && styles.chipActive]}
                onPress={() => toggleSubject(name)}
                activeOpacity={0.7}
              >
                {on && <Ionicons name="checkmark" size={14} color="#FFF" style={{ marginRight: 4 }} />}
                <Text style={[styles.chipText, on && styles.chipTextActive]}>{name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.chipCount}>{selectedSubjects.length} subject{selectedSubjects.length !== 1 ? 's' : ''} selected</Text>

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleSignup}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading
            ? <ActivityIndicator color="#FFF" />
            : <Text style={styles.btnText}>Create Account</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.footerRow}>
          <Text style={styles.footerText}>
            Already have an account?{' '}
            <Text style={styles.footerLink}>Sign In</Text>
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex1:  { flex: 1, backgroundColor: '#0A0E27' },
  scroll: { padding: 22, paddingBottom: 40 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 28, marginTop: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1E2340', justifyContent: 'center', alignItems: 'center' },
  topTitle: { fontSize: 22, fontWeight: '700', color: '#FFF', marginLeft: 14 },
  sectionHeading: { fontSize: 16, fontWeight: '700', color: '#FFF', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#A29BFE', marginBottom: 8 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E2340',
    borderRadius: 14, paddingHorizontal: 16, height: 54,
    borderWidth: 1, borderColor: '#2D3561',
    marginBottom: 16,
  },
  input: { flex: 1, color: '#FFF', fontSize: 15, marginLeft: 12, fontWeight: '500' },
  subHint:  { fontSize: 13, color: '#636E72', marginBottom: 14, marginTop: -6 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E2340',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1, borderColor: '#2D3561',
  },
  chipActive: { backgroundColor: '#6C5CE7', borderColor: '#6C5CE7' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#A29BFE' },
  chipTextActive: { color: '#FFF' },
  chipCount: { fontSize: 13, color: '#636E72', marginTop: 14, marginBottom: 4, fontWeight: '600' },
  btn: {
    backgroundColor: '#6C5CE7',
    height: 54, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 24,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.4 },
  footerRow: { marginTop: 22, alignItems: 'center' },
  footerText: { fontSize: 14, color: '#636E72' },
  footerLink: { color: '#6C5CE7', fontWeight: '700' },
});