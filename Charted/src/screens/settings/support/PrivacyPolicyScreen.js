import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PrivacyPolicyScreen = ({ navigation }) => {
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
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.spacer} />
      </View>
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.lastUpdated}>Last Updated: October 20, 2023</Text>
          
          <Text style={styles.introText}>
            At Charted, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.
          </Text>
          
          <Text style={styles.sectionTitle}>1. Information We Collect</Text>
          <Text style={styles.paragraph}>
            We may collect information about you in various ways:
          </Text>
          <Text style={styles.subSectionTitle}>Personal Data:</Text>
          <Text style={styles.bulletPoint}>• Name, email address, and username</Text>
          <Text style={styles.bulletPoint}>• Profile pictures and bio information</Text>
          <Text style={styles.bulletPoint}>• Music preferences and playlists</Text>
          
          <Text style={styles.subSectionTitle}>Usage Data:</Text>
          <Text style={styles.bulletPoint}>• How you interact with our platform</Text>
          <Text style={styles.bulletPoint}>• Device information and IP address</Text>
          <Text style={styles.bulletPoint}>• Browser type and operating system</Text>
          
          <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
          <Text style={styles.paragraph}>
            We use the information we collect for various purposes:
          </Text>
          <Text style={styles.bulletPoint}>• To provide and maintain our service</Text>
          <Text style={styles.bulletPoint}>• To personalize your experience</Text>
          <Text style={styles.bulletPoint}>• To improve our platform</Text>
          <Text style={styles.bulletPoint}>• To communicate with you</Text>
          <Text style={styles.bulletPoint}>• To ensure the security of our platform</Text>
          
          <Text style={styles.sectionTitle}>3. How We Share Your Information</Text>
          <Text style={styles.paragraph}>
            We may share your information with:
          </Text>
          <Text style={styles.bulletPoint}>• Service providers that help us operate our platform</Text>
          <Text style={styles.bulletPoint}>• Partners with your consent</Text>
          <Text style={styles.bulletPoint}>• Law enforcement when required by law</Text>
          
          <Text style={styles.sectionTitle}>4. Data Security</Text>
          <Text style={styles.paragraph}>
            We implement appropriate security measures to protect your personal information. However, no method of transmission over the Internet or electronic storage is 100% secure.
          </Text>
          
          <Text style={styles.sectionTitle}>5. Your Privacy Rights</Text>
          <Text style={styles.paragraph}>
            Depending on your location, you may have certain rights regarding your personal information, such as:
          </Text>
          <Text style={styles.bulletPoint}>• The right to access your data</Text>
          <Text style={styles.bulletPoint}>• The right to correct your data</Text>
          <Text style={styles.bulletPoint}>• The right to delete your data</Text>
          <Text style={styles.bulletPoint}>• The right to object to processing</Text>
          
          <Text style={styles.sectionTitle}>6. Children's Privacy</Text>
          <Text style={styles.paragraph}>
            Our platform is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13.
          </Text>
          
          <Text style={styles.sectionTitle}>7. Changes to This Privacy Policy</Text>
          <Text style={styles.paragraph}>
            We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.
          </Text>
          
          <Text style={styles.sectionTitle}>8. Contact Us</Text>
          <Text style={styles.paragraph}>
            If you have any questions about this Privacy Policy, please contact us at privacy@charted.com.
          </Text>
        </View>
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
    width: 32,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  lastUpdated: {
    fontSize: 14,
    color: '#777777',
    marginBottom: 20,
  },
  introText: {
    fontSize: 16,
    color: '#CCCCCC',
    lineHeight: 24,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 20,
    marginBottom: 10,
  },
  subSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 10,
    marginBottom: 5,
  },
  paragraph: {
    fontSize: 16,
    color: '#CCCCCC',
    lineHeight: 24,
    marginBottom: 15,
  },
  bulletPoint: {
    fontSize: 16,
    color: '#CCCCCC',
    lineHeight: 24,
    marginLeft: 15,
    marginBottom: 5,
  },
});

export default PrivacyPolicyScreen; 