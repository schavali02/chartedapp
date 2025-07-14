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

const TermsOfServiceScreen = ({ navigation }) => {
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
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={styles.spacer} />
      </View>
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.lastUpdated}>Last Updated: October 20, 2023</Text>
          
          <Text style={styles.sectionTitle}>1. Introduction</Text>
          <Text style={styles.paragraph}>
            Welcome to Charted. These Terms of Service govern your use of our platform, including any services, features, applications, and content offered by Charted.
          </Text>
          
          <Text style={styles.sectionTitle}>2. Acceptance of Terms</Text>
          <Text style={styles.paragraph}>
            By accessing or using Charted, you agree to be bound by these Terms. If you do not agree to these Terms, please do not use our platform.
          </Text>
          
          <Text style={styles.sectionTitle}>3. Privacy Policy</Text>
          <Text style={styles.paragraph}>
            Your privacy is important to us. Our Privacy Policy explains how we collect, use, and protect your personal information. By using Charted, you also agree to our Privacy Policy.
          </Text>
          
          <Text style={styles.sectionTitle}>4. User Accounts</Text>
          <Text style={styles.paragraph}>
            To access certain features of our platform, you may need to create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.
          </Text>
          
          <Text style={styles.sectionTitle}>5. User Content</Text>
          <Text style={styles.paragraph}>
            You retain ownership of the content you post on Charted. However, by posting content, you grant us a non-exclusive, royalty-free license to use, display, and distribute your content on our platform.
          </Text>
          
          <Text style={styles.sectionTitle}>6. Prohibited Conduct</Text>
          <Text style={styles.paragraph}>
            While using Charted, you agree not to:
          </Text>
          <Text style={styles.bulletPoint}>• Violate any applicable laws or regulations</Text>
          <Text style={styles.bulletPoint}>• Infringe on the rights of others</Text>
          <Text style={styles.bulletPoint}>• Post illegal, harmful, or offensive content</Text>
          <Text style={styles.bulletPoint}>• Attempt to gain unauthorized access to our platform</Text>
          <Text style={styles.bulletPoint}>• Use our platform for any commercial purposes without our consent</Text>
          
          <Text style={styles.sectionTitle}>7. Termination</Text>
          <Text style={styles.paragraph}>
            We reserve the right to suspend or terminate your account at any time for any reason, including violation of these Terms.
          </Text>
          
          <Text style={styles.sectionTitle}>8. Disclaimer of Warranties</Text>
          <Text style={styles.paragraph}>
            Charted is provided "as is" without any warranties, express or implied. We do not guarantee that our platform will be error-free or uninterrupted.
          </Text>
          
          <Text style={styles.sectionTitle}>9. Limitation of Liability</Text>
          <Text style={styles.paragraph}>
            To the maximum extent permitted by law, Charted shall not be liable for any indirect, incidental, special, consequential, or punitive damages.
          </Text>
          
          <Text style={styles.sectionTitle}>10. Changes to Terms</Text>
          <Text style={styles.paragraph}>
            We may update these Terms from time to time. We will notify you of any material changes by posting the new Terms on our platform.
          </Text>
          
          <Text style={styles.sectionTitle}>11. Contact Us</Text>
          <Text style={styles.paragraph}>
            If you have any questions about these Terms, please contact us at support@charted.com.
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 20,
    marginBottom: 10,
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

export default TermsOfServiceScreen; 