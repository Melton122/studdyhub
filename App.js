import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StudyProvider } from './context/StudyContext';


// Import screens
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import SubjectsScreen from './screens/SubjectsScreen';
import TutorsScreen from './screens/TutorsScreen';
import TutorDetailsScreen from './screens/TutorDetailsScreen';
import TutorSessionsScreen from './screens/TutorSessionsScreen';
import TutorReviewsScreen from './screens/TutorReviewsScreen';
import RequestTutorScreen from './screens/RequestTutorScreen';
import ResourcesScreen from './screens/ResourcesScreen';
import ResourceDetailsScreen from './screens/ResourceDetailsScreen';
import DownloadsScreen from './screens/DownloadsScreen';
import MySessionsScreen from './screens/MySessionsScreen';
import ProgressScreen from './screens/ProgressScreen';
import SettingsScreen from './screens/SettingsScreen';
import AdminPanel from './screens/AdminPanel';
import StudyTipsScreen from './screens/StudyTipsScreen';
import PomodoroTimerScreen from './screens/PomodoroTimerScreen';
import StudyReminderScreen from './screens/StudyReminderScreen';
import StudyAnalyticsScreen from './screens/StudyAnalyticsScreen';
import FlashCardsScreen from './screens/FlashCardsScreen';
import StudyPlanScreen from './screens/StudyPlanScreen';
import TutorBookingsScreen from './screens/TutorBookingsScreen';
import StudySessionScreen from './screens/StudySessionScreen';
import GoalSettingScreen from './screens/GoalSettingScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#1E2340',
          borderTopColor: '#2D3561',
          height: 70,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: '#6C5CE7',
        tabBarInactiveTintColor: '#636E72',
        headerShown: false,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Study"
        component={StudySessionScreen}
        options={{
          tabBarLabel: 'Study',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Tutors"
        component={TutorsScreen}
        options={{
          tabBarLabel: 'Tutors',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Resources"
        component={ResourcesScreen}
        options={{
          tabBarLabel: 'Resources',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="folder" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
}

function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0E27' }}>
        <ActivityIndicator size="large" color="#6C5CE7" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#1E2340' },
        headerTintColor: '#FFF',
        headerShadowVisible: false,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
        },
      }}
    >
      {!user ? (
        <Stack.Screen 
          name="Auth" 
          component={AuthStack} 
          options={{ headerShown: false }}
        />
      ) : (
        <>
          <Stack.Screen 
            name="Main" 
            component={MainTabs} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="EditProfile" 
            component={EditProfileScreen}
            options={{ title: 'Edit Profile' }}
          />
          <Stack.Screen 
            name="Subjects" 
            component={SubjectsScreen}
            options={{ title: 'My Subjects' }}
          />
          <Stack.Screen 
            name="ResourceDetails" 
            component={ResourceDetailsScreen}
            options={{ title: 'Resource Details' }}
          />
          <Stack.Screen 
            name="TutorDetails" 
            component={TutorDetailsScreen}
            options={{ title: 'Tutor Profile' }}
          />
          <Stack.Screen 
            name="TutorSessions" 
            component={TutorSessionsScreen}
            options={{ title: 'Available Sessions' }}
          />
          <Stack.Screen 
            name="TutorReviews" 
            component={TutorReviewsScreen}
            options={{ title: 'Reviews' }}
          />
          <Stack.Screen 
            name="RequestTutor" 
            component={RequestTutorScreen}
            options={{ title: 'Request Tutor' }}
          />
          <Stack.Screen 
            name="Downloads" 
            component={DownloadsScreen}
            options={{ title: 'My Downloads' }}
          />
          <Stack.Screen 
            name="MySessions" 
            component={MySessionsScreen}
            options={{ title: 'My Sessions' }}
          />
          <Stack.Screen 
            name="MyBookings" 
            component={TutorBookingsScreen}
            options={{ title: 'My Bookings' }}
          />
          <Stack.Screen 
            name="Progress" 
            component={ProgressScreen}
            options={{ title: 'Study Progress' }}
          />
          <Stack.Screen 
            name="Settings" 
            component={SettingsScreen}
            options={{ title: 'Settings' }}
          />
          <Stack.Screen 
            name="AdminPanel" 
            component={AdminPanel}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="StudyReminder" 
            component={StudyReminderScreen}
            options={{ title: 'Study Reminders' }}
          />
          <Stack.Screen 
            name="FlashCards" 
            component={FlashCardsScreen}
            options={{ title: 'Flash Cards' }}
          />
          <Stack.Screen 
            name="Pomodoro" 
            component={PomodoroTimerScreen}
            options={{ title: 'Study Timer' }}
          />
          <Stack.Screen 
            name="StudyAnalytics" 
            component={StudyAnalyticsScreen}
            options={{ title: 'Study Analytics' }}
          />
          <Stack.Screen 
            name="StudyTips" 
            component={StudyTipsScreen}
            options={{ title: 'Study Tips' }}
          />
          <Stack.Screen 
            name="StudyPlan" 
            component={StudyPlanScreen}
            options={{ title: 'Study Plan' }}
          />
          <Stack.Screen 
            name="GoalSetting" 
            component={GoalSettingScreen}
            options={{ title: 'Set Goals' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StudyProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </StudyProvider>
    </AuthProvider>
  );
}