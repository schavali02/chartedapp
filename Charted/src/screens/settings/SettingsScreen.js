import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const SettingsScreen = ({ navigation }) => {
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(true);
  const [dataSaverEnabled, setDataSaverEnabled] = useState(false);
  
  // Function to handle logout
  const handleLogout = async () => {
    try {
      setLoading(true);
      console.log('⚙️ SettingsScreen: Logging out...');
      await signOut();
      console.log('✅ SettingsScreen: Logout successful, auth context will handle navigation.');
      // No need to navigate manually, the AuthContext state change will trigger the navigator switch.
    } catch (error) {
      console.error('❌ SettingsScreen: Error during logout:', error);
      Alert.alert('Error', 'An unexpected error occurred during logout.');
      setLoading(false);
    }
  };
  
  // Function to confirm logout
  const confirmLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Log Out", 
          onPress: handleLogout,
          style: "destructive"
        }
      ]
    );
  };
  
  // Render a settings section header
  const renderSectionHeader = (title) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
  
  // Render a settings item with toggle
  const renderToggleItem = (icon, title, value, onValueChange) => (
    <View style={styles.settingsItem}>
      <View style={styles.settingsItemLeft}>
        <Ionicons name={icon} size={22} color="#FFFFFF" style={styles.settingsItemIcon} />
        <Text style={styles.settingsItemText}>{title}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#333333", true: "#007AFF" }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
  
  // Render a settings item with chevron
  const renderNavigationItem = (icon, title, onPress) => (
    <TouchableOpacity style={styles.settingsItem} onPress={onPress}>
      <View style={styles.settingsItemLeft}>
        <Ionicons name={icon} size={22} color="#FFFFFF" style={styles.settingsItemIcon} />
        <Text style={styles.settingsItemText}>{title}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#777777" />
    </TouchableOpacity>
  );
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.spacer} />
      </View>
      
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}
      
      {/* Settings Content */}
      <ScrollView style={styles.scrollView}>
        {/* Account Section */}
        {renderSectionHeader("Account")}
        {renderNavigationItem("person-outline", "Update Display Name", () => navigation.navigate("UpdateDisplayName"))}
        {renderNavigationItem("at-outline", "Update Username", () => navigation.navigate("UpdateUsername"))}
        
        {/* Profile Section */}
        {renderSectionHeader("Profile")}
        {renderNavigationItem("text-outline", "Update Bio", () => navigation.navigate("UpdateBio"))}

        {/* Monetization Section */}
        {renderSectionHeader("Monetization")}
        {renderNavigationItem("wallet-outline", "Balance", () => navigation.navigate("Balance"))}

        {/* Feedback Section */}
        {renderSectionHeader("Feedback")}
        {renderNavigationItem("bulb-outline", "Suggest a Feature", () => {
          const featureRequestUrl = 'https://charted.canny.io/feature-requests'; 
          Linking.openURL(featureRequestUrl).catch(() => {
            Alert.alert("Error", "Could not open the feedback page.");
          });
        })}
        {renderNavigationItem("bug-outline", "Report a Bug", () => {
          const bugReportUrl = 'https://charted.canny.io/bugs'; 
          Linking.openURL(bugReportUrl).catch(() => {
            Alert.alert("Error", "Could not open the bug report page.");
          });
        })}

        {/* Support Section */}
        {renderSectionHeader("Support")}
        {renderNavigationItem("document-text-outline", "Terms of Service", () => navigation.navigate("TermsOfService"))}
        {renderNavigationItem("shield-checkmark-outline", "Privacy Policy", () => navigation.navigate("PrivacyPolicy"))}
        
        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={confirmLogout}>
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
        
        {/* Version info */}
        <Text style={styles.versionText}>Version 1.0.0</Text>
        
        {/* Add extra padding at bottom for navigation bar */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spacer: {
    width: 32, // Same width as back button for balanced spacing
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  scrollView: {
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#777777',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  settingsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsItemIcon: {
    marginRight: 16,
  },
  settingsItemText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  logoutButton: {
    marginTop: 24,
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: '#333333',
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30', // Red color for logout
  },
  versionText: {
    textAlign: 'center',
    color: '#777777',
    fontSize: 14,
    marginTop: 24,
    marginBottom: 16,
  },
});

export default SettingsScreen;