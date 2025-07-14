import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
  Alert,
  Dimensions,
  TextInput,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

// API base URL
const BASE_URL = 'http://10.0.0.107:8080';

const BalanceScreen = ({ navigation }) => {
  const { collectFinancialConnectionsAccounts } = useStripe();
  
  const [availableBalance, setAvailableBalance] = useState(0);
  const [lifetimeEarnings, setLifetimeEarnings] = useState(0);
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [isBalanceLoading, setIsBalanceLoading] = useState(true);
  
  // Calculate next payout date
  const getNextPayoutDate = () => {
    const today = new Date();
    const startDate = new Date('2025-09-01T00:00:00'); // September 1st, 2025

    // If today is before September 1st, 2025, the next payout is on that date.
    if (today < startDate) {
      return startDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    
    // Otherwise, calculate the 1st of the next month
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    
    const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
    
    return nextMonthDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const [nextPayoutDate] = useState(getNextPayoutDate());
  const [currencySearchQuery, setCurrencySearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [recentPayouts, setRecentPayouts] = useState([]);
  
  // Bank connection states
  const [bankConnectionStatus, setBankConnectionStatus] = useState(null);
  const [loadingBankStatus, setLoadingBankStatus] = useState(true);
  const [connectingBank, setConnectingBank] = useState(false);
  
  const currencies = [
    // Major World Currencies
    { code: 'USD', symbol: '$', name: 'US Dollar', rate: 1.0 },
    { code: 'EUR', symbol: '€', name: 'Euro', rate: 0.85 },
    { code: 'GBP', symbol: '£', name: 'British Pound', rate: 0.73 },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen', rate: 110.0 },
    
    // North America
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', rate: 1.25 },
    { code: 'MXN', symbol: '$', name: 'Mexican Peso', rate: 18.5 },
    
    // Asia Pacific
    { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', rate: 6.45 },
    { code: 'KRW', symbol: '₩', name: 'South Korean Won', rate: 1150.0 },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', rate: 1.35 },
    { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', rate: 1.45 },
    { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', rate: 1.32 },
    { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', rate: 7.85 },
    { code: 'TWD', symbol: 'NT$', name: 'Taiwan Dollar', rate: 28.5 },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee', rate: 74.2 },
    { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', rate: 14250.0 },
    { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', rate: 4.15 },
    { code: 'THB', symbol: '฿', name: 'Thai Baht', rate: 32.8 },
    { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', rate: 23000.0 },
    { code: 'PHP', symbol: '₱', name: 'Philippine Peso', rate: 50.5 },
    
    // Europe
    { code: 'CHF', symbol: 'Fr.', name: 'Swiss Franc', rate: 0.92 },
    { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', rate: 8.65 },
    { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', rate: 8.95 },
    { code: 'DKK', symbol: 'kr.', name: 'Danish Krone', rate: 6.35 },
    { code: 'PLN', symbol: 'zł', name: 'Polish Zloty', rate: 3.85 },
    { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna', rate: 21.5 },
    { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint', rate: 295.0 },
    { code: 'RON', symbol: 'lei', name: 'Romanian Leu', rate: 4.15 },
    { code: 'BGN', symbol: 'лв', name: 'Bulgarian Lev', rate: 1.66 },
    { code: 'HRK', symbol: 'kn', name: 'Croatian Kuna', rate: 6.42 },
    { code: 'RUB', symbol: '₽', name: 'Russian Ruble', rate: 72.5 },
    { code: 'UAH', symbol: '₴', name: 'Ukrainian Hryvnia', rate: 26.8 },
    
    // Middle East & Africa
    { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', rate: 3.67 },
    { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal', rate: 3.75 },
    { code: 'QAR', symbol: 'ر.ق', name: 'Qatari Riyal', rate: 3.64 },
    { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar', rate: 0.30 },
    { code: 'BHD', symbol: '.د.ب', name: 'Bahraini Dinar', rate: 0.377 },
    { code: 'OMR', symbol: 'ر.ع.', name: 'Omani Rial', rate: 0.385 },
    { code: 'JOD', symbol: 'د.ا', name: 'Jordanian Dinar', rate: 0.71 },
    { code: 'LBP', symbol: 'ل.ل', name: 'Lebanese Pound', rate: 1507.5 },
    { code: 'EGP', symbol: 'ج.م', name: 'Egyptian Pound', rate: 15.65 },
    { code: 'ZAR', symbol: 'R', name: 'South African Rand', rate: 14.25 },
    { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', rate: 411.0 },
    { code: 'KES', symbol: 'Sh', name: 'Kenyan Shilling', rate: 107.5 },
    { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi', rate: 5.85 },
    { code: 'MAD', symbol: 'د.م.', name: 'Moroccan Dirham', rate: 8.95 },
    { code: 'TND', symbol: 'د.ت', name: 'Tunisian Dinar', rate: 2.75 },
    
    // Latin America
    { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', rate: 5.15 },
    { code: 'ARS', symbol: '$', name: 'Argentine Peso', rate: 98.5 },
    { code: 'CLP', symbol: '$', name: 'Chilean Peso', rate: 725.0 },
    { code: 'COP', symbol: '$', name: 'Colombian Peso', rate: 3650.0 },
    { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol', rate: 3.65 },
    { code: 'UYU', symbol: '$U', name: 'Uruguayan Peso', rate: 42.5 },
    { code: 'BOB', symbol: 'Bs.', name: 'Bolivian Boliviano', rate: 6.91 },
    { code: 'PYG', symbol: '₲', name: 'Paraguayan Guarani', rate: 6850.0 },
    { code: 'VES', symbol: 'Bs.S', name: 'Venezuelan Bolívar', rate: 4.18 },
    { code: 'GTQ', symbol: 'Q', name: 'Guatemalan Quetzal', rate: 7.72 },
    { code: 'CRC', symbol: '₡', name: 'Costa Rican Colón', rate: 620.0 },
    { code: 'HNL', symbol: 'L', name: 'Honduran Lempira', rate: 24.1 },
    { code: 'NIO', symbol: 'C$', name: 'Nicaraguan Córdoba', rate: 34.8 },
    { code: 'DOP', symbol: '$', name: 'Dominican Peso', rate: 56.5 },
    { code: 'JMD', symbol: '$', name: 'Jamaican Dollar', rate: 145.0 },
    
    // Other Regional Currencies
    { code: 'TRY', symbol: '₺', name: 'Turkish Lira', rate: 8.45 },
    { code: 'ILS', symbol: '₪', name: 'Israeli Shekel', rate: 3.25 },
    { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', rate: 168.0 },
    { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', rate: 84.8 },
    { code: 'LKR', symbol: '₨', name: 'Sri Lankan Rupee', rate: 198.5 },
    { code: 'MMK', symbol: 'Ks', name: 'Myanmar Kyat', rate: 1665.0 },
    { code: 'LAK', symbol: '₭', name: 'Lao Kip', rate: 9500.0 },
    { code: 'KHR', symbol: '៛', name: 'Cambodian Riel', rate: 4065.0 },
    { code: 'BND', symbol: '$', name: 'Brunei Dollar', rate: 1.32 },
    { code: 'MOP', symbol: 'P', name: 'Macanese Pataca', rate: 8.02 },
    { code: 'FJD', symbol: '$', name: 'Fijian Dollar', rate: 2.08 },
    { code: 'TOP', symbol: 'T$', name: 'Tongan Paʻanga', rate: 2.27 },
    { code: 'WST', symbol: 'T', name: 'Samoan Tala', rate: 2.58 },
    { code: 'VUV', symbol: 'Vt', name: 'Vanuatu Vatu', rate: 110.0 },
    { code: 'PGK', symbol: 'K', name: 'Papua New Guinea Kina', rate: 3.52 },
    { code: 'SBD', symbol: '$', name: 'Solomon Islands Dollar', rate: 8.02 },
    { code: 'NCX', symbol: '₣', name: 'CFP Franc', rate: 101.0 },
    
    // Digital/Crypto Currencies (for future expansion)
    // { code: 'BTC', symbol: '₿', name: 'Bitcoin', rate: 0.000023 },
    // { code: 'ETH', symbol: 'Ξ', name: 'Ethereum', rate: 0.00035 },
  ];
  
  // Check existing bank connection status on component mount
  useEffect(() => {
    fetchInitialBalance();
    checkBankConnectionStatus();
  }, []);

  const fetchInitialBalance = () => {
    setIsBalanceLoading(true);
    // Simulate fetching initial balance data from an API
    setTimeout(() => {
      // Generate a random 3-digit number for available balance
      const randomBalance = Math.floor(Math.random() * 900) + 100;
      
      setAvailableBalance(randomBalance);
      setLifetimeEarnings(0); // Set lifetime earnings to 0 for everyone
      setIsBalanceLoading(false);
    }, 1500); // Simulate network delay
  };

  // Function to get JWT token from SecureStore
  const getJWTToken = async () => {
    try {
      const token = await SecureStore.getItemAsync('jwtToken');
      if (!token) {
        throw new Error('No JWT token found. Please sign in again.');
      }
      return token;
    } catch (error) {
      console.error('Error getting JWT token:', error);
      throw error;
    }
  };

  // Function to check existing bank connection status
  const checkBankConnectionStatus = async () => {
    try {
      setLoadingBankStatus(true);
      const jwtToken = await getJWTToken();
      
      const response = await axios.get(`${BASE_URL}/api/financial-connections/status`, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
        },
        timeout: 10000,
      });

      if (response.status === 200) {
        setBankConnectionStatus(response.data.isConnected ? 'connected' : 'not_connected');
      }
    } catch (error) {
      if (error.response?.status === 404) {
        // User has never attempted to connect bank account
        setBankConnectionStatus('not_connected');
      } else {
        console.error('Error checking bank connection status:', error);
        setBankConnectionStatus('not_connected');
      }
    } finally {
      setLoadingBankStatus(false);
    }
  };

  // Function to create financial connections session
  const createFinancialConnectionsSession = async () => {
    try {
      const jwtToken = await getJWTToken();
      
      const response = await axios.post(
        `${BASE_URL}/api/financial-connections/sessions`,
        {}, // Empty body as per API documentation
        {
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      if (response.status === 200 && response.data.status === 'success') {
        return {
          clientSecret: response.data.clientSecret,
          sessionId: response.data.sessionId,
        };
      } else {
        throw new Error(response.data.message || 'Failed to create session');
      }
    } catch (error) {
      console.error('Error creating financial connections session:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error('Failed to create bank connection session. Please try again.');
    }
  };

  // Function to update connection status
  const updateConnectionStatus = async (isConnected) => {
    try {
      const jwtToken = await getJWTToken();
      
      const response = await axios.put(
        `${BASE_URL}/api/financial-connections/status`,
        { isConnected },
        {
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      if (response.status === 200) {
        return response.data;
      } else {
        throw new Error('Failed to update connection status');
      }
    } catch (error) {
      console.error('Error updating connection status:', error);
      throw error;
    }
  };

  // Function to handle bank account linking
  const handleLinkBankAccount = () => {
    if (connectingBank) return;
    
    Alert.alert(
      "Secure Connection via Stripe",
      "Charted partners with Stripe to securely link your bank account. Your information is encrypted and sent directly to Stripe; we do not store your credentials.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        { 
          text: "Continue", 
          onPress: async () => {
            setConnectingBank(true);
            try {
              // Step 1: Create financial connections session
              const { clientSecret } = await createFinancialConnectionsSession();
              
              // Step 2: Launch Stripe Financial Connections flow
              const { session, error } = await collectFinancialConnectionsAccounts(clientSecret);
              
              if (error) {
                Alert.alert('Connection Error', error.message);
                return;
              }
              
              if (session && session.accounts && session.accounts.length > 0) {
                // Step 3: Update connection status in backend
                await updateConnectionStatus(true);
                setBankConnectionStatus('connected');
                
                Alert.alert(
                  'Success!', 
                  'Your bank account has been successfully connected. You can now receive payouts.',
                  [{ text: 'OK' }]
                );
              } else {
                Alert.alert('Connection Error', 'No accounts were linked. Please try again.');
              }
              
            } catch (error) {
              console.error('Bank linking failed:', error);
              Alert.alert(
                'Connection Error', 
                error.message || 'Failed to link bank account. Please try again.'
              );
            } finally {
              setConnectingBank(false);
            }
          }
        }
      ]
    );
  };

  // Function to handle bank account reconnection/update
  const handleUpdateBankAccount = async () => {
    Alert.alert(
      'Update Bank Account',
      'Would you like to connect a different bank account?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, Update', onPress: handleLinkBankAccount }
      ]
    );
  };
  
  const getCurrentCurrency = () => {
    return currencies.find(c => c.code === selectedCurrency) || currencies[0];
  };
  
  const formatAmount = (amount) => {
    const currency = getCurrentCurrency();
    const convertedAmount = amount * currency.rate;
    return `${currency.symbol}${convertedAmount.toFixed(2)}`;
  };
  
  const handleCurrencySelect = (currency) => {
    setSelectedCurrency(currency.code);
    setShowCurrencyModal(false);
    setCurrencySearchQuery(''); // Clear search when modal closes
  };
  
  const filteredCurrencies = currencies.filter(currency => 
    currency.code.toLowerCase().includes(currencySearchQuery.toLowerCase()) ||
    currency.name.toLowerCase().includes(currencySearchQuery.toLowerCase())
  );
  
  const onRefresh = () => {
    setRefreshing(true);
    
    // Simulate fetching updated balance data
    setTimeout(() => {
      // Slightly update the balance to show refresh worked
      const randomChange = (Math.random() - 0.5) * 100; // Random change between -50 and +50
      setAvailableBalance(prev => Math.max(0, prev + randomChange));
      
      // Update lifetime earnings slightly
      setLifetimeEarnings(prev => prev + Math.abs(randomChange));
      
      setRefreshing(false);
    }, 1500); // 1.5 second refresh time
  };
  
  const handleVerification = () => {
    Alert.alert("Complete Verification", "You'll be redirected to complete identity verification.", [
      { text: "Cancel", style: "cancel" },
      { text: "Continue", onPress: () => {
        setBankConnectionStatus('connected');
        Alert.alert("Success", "Verification completed!");
      }}
    ]);
  };
  
  const renderPayoutItem = ({ item }) => (
    <TouchableOpacity style={styles.payoutItem} onPress={() => {
      Alert.alert("Payout Details", `${item.description}\nDate: ${item.date}\nStatus: ${item.status.charAt(0).toUpperCase() + item.status.slice(1)}\nAmount: ${formatAmount(item.amount)}`);
    }}>
      <View style={styles.payoutLeft}>
        <Ionicons 
          name="card-outline" 
          size={20} 
          color="#007AFF" 
          style={styles.payoutIcon}
        />
        <View style={styles.payoutDetails}>
          <Text style={styles.payoutDescription}>{item.description}</Text>
          <Text style={styles.payoutDate}>{item.date}</Text>
        </View>
      </View>
      <View style={styles.payoutRight}>
        <Text style={styles.payoutAmount}>{formatAmount(item.amount)}</Text>
        <Text style={[styles.payoutStatus, {
          color: item.status === 'paid' ? '#4CAF50' : item.status === 'pending' ? '#FFB800' : '#FF6B6B'
        }]}>
          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </Text>
      </View>
    </TouchableOpacity>
  );
  
  const renderCurrencyItem = ({ item }) => (
    <TouchableOpacity 
      style={[
        styles.currencyItem,
        selectedCurrency === item.code && styles.selectedCurrencyItem
      ]}
      onPress={() => handleCurrencySelect(item)}
    >
      <View style={styles.currencyLeft}>
        <Text style={styles.currencySymbol}>{item.symbol}</Text>
        <View>
          <Text style={styles.currencyCode}>{item.code}</Text>
          <Text style={styles.currencyName}>{item.name}</Text>
        </View>
      </View>
      {selectedCurrency === item.code && (
        <Ionicons name="checkmark" size={20} color="#007AFF" />
      )}
    </TouchableOpacity>
  );
  
  // Function to render bank connection status section
  const renderBankConnectionSection = () => {
    if (loadingBankStatus) {
      return (
        <View style={styles.verificationBanner}>
            <ActivityIndicator size="small" color="#FFB800" />
            <Text style={styles.verificationText}>Checking bank connection...</Text>
        </View>
      );
    }

    if (bankConnectionStatus === 'connected') {
      return (
        <TouchableOpacity style={styles.verifiedBanner} onPress={handleUpdateBankAccount} disabled={connectingBank}>
            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            <Text style={styles.verifiedText}>Bank Account Connected</Text>
            <Ionicons name="chevron-forward" size={16} color="#777777" />
        </TouchableOpacity>
      );
    }

    // Not connected state
    return (
        <TouchableOpacity 
            style={styles.verificationBanner} 
            onPress={handleLinkBankAccount} 
            disabled={connectingBank}
        >
            {connectingBank ? (
                <>
                    <ActivityIndicator size="small" color="#FFB800" />
                    <Text style={styles.verificationText}>Connecting...</Text>
                </>
            ) : (
                <>
                    <Ionicons name="warning" size={20} color="#FFB800" />
                    <Text style={styles.verificationText}>Action Required: Connect Your Bank Account</Text>
                    <Ionicons name="chevron-forward" size={16} color="#FFB800" />
                </>
            )}
        </TouchableOpacity>
    );
  };
  
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
        <Text style={styles.headerTitle}>Balance</Text>
        <TouchableOpacity 
          style={styles.currencyButton}
          onPress={() => setShowCurrencyModal(true)}
        >
          <Text style={styles.currencyButtonText}>{selectedCurrency}</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
            colors={["#007AFF"]}
            progressBackgroundColor="#1a1a1a"
          />
        }
      >
        {/* 1. Balance Summary Card */}
        <View style={styles.balanceSummaryCard}>
          <View style={styles.mainBalance}>
            <View style={styles.balanceHeaderContainer}>
              <Text style={styles.availableLabel}>Available Balance</Text>
            </View>
            {isBalanceLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.loadingText}>Calculating...</Text>
              </View>
            ) : (
              <View style={styles.balanceAmountContainer}>
                <Text style={styles.availableAmount}>{formatAmount(availableBalance)}</Text>
                <BlurView
                  intensity={35}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
              </View>
            )}
          </View>
          <View style={styles.balanceBreakdown}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceSubLabel}>Lifetime Earnings</Text>
              <Text style={styles.balanceSubAmount}>{formatAmount(lifetimeEarnings)}</Text>
            </View>
          </View>
        </View>
        
        {/* 2. Verification Banner */}
        {renderBankConnectionSection()}
        
        {/* 3. Payout Status & Actions */}
        <View style={styles.payoutSection}>
          <View style={styles.payoutInfoCard}>
            <View style={styles.payoutInfoContent}>
              <Ionicons name="calendar-outline" size={24} color="#007AFF" />
              <View style={styles.payoutTextContainer}>
                <Text style={styles.payoutSubLabel}>Next Scheduled Payout</Text>
                <Text style={styles.payoutDateLabel}>{nextPayoutDate}</Text>
              </View>
            </View>
          </View>
        </View>
        
        {/* 4. Recent Payouts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Payouts</Text>
          <FlatList
            data={recentPayouts}
            renderItem={renderPayoutItem}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
            ListEmptyComponent={
              <View style={styles.emptyPayoutsContainer}>
                <Ionicons name="receipt-outline" size={32} color="#888888" />
                <Text style={styles.emptyPayoutsText}>No Payouts Yet</Text>
                <Text style={styles.emptyPayoutsSubtext}>
                  Your payout history will appear here once you receive your first payment.
                </Text>
              </View>
            }
          />
        </View>
        
        {/* 5. Help & Support Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Help & Support</Text>
          <TouchableOpacity style={styles.helpItem} onPress={() => Alert.alert("FAQ", "Why is my payout pending?\n\nPayouts typically take 1-3 business days to process after reaching the minimum threshold.")}>
            <Text style={styles.helpText}>Why is my payout pending?</Text>
            <Ionicons name="chevron-forward" size={16} color="#777777" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.helpItem} onPress={() => Alert.alert("Support", "Contact support feature coming soon!")}>
            <Text style={styles.helpText}>Contact Support</Text>
            <Ionicons name="chevron-forward" size={16} color="#777777" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.helpItem} onPress={() => Alert.alert("Terms", "Payout terms and conditions coming soon!")}>
            <Text style={styles.helpText}>Terms & Conditions</Text>
            <Ionicons name="chevron-forward" size={16} color="#777777" />
          </TouchableOpacity>
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>
      
      {/* Currency Selection Modal */}
      <Modal
        visible={showCurrencyModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowCurrencyModal(false);
          setCurrencySearchQuery('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Currency</Text>
              <TouchableOpacity 
                onPress={() => {
                  setShowCurrencyModal(false);
                  setCurrencySearchQuery('');
                }}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#888888" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search currencies..."
                placeholderTextColor="#888888"
                value={currencySearchQuery}
                onChangeText={setCurrencySearchQuery}
                autoFocus={false}
              />
              {currencySearchQuery.length > 0 && (
                <TouchableOpacity 
                  onPress={() => setCurrencySearchQuery('')}
                  style={styles.clearSearchButton}
                >
                  <Ionicons name="close-circle" size={20} color="#888888" />
                </TouchableOpacity>
              )}
            </View>
            
            <FlatList
              data={filteredCurrencies}
              renderItem={renderCurrencyItem}
              keyExtractor={(item) => item.code}
              style={styles.currencyList}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.emptySearchContainer}>
                  <Ionicons name="search" size={48} color="#555555" />
                  <Text style={styles.emptySearchText}>No currencies found</Text>
                  <Text style={styles.emptySearchSubtext}>Try searching for a different currency</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    flex: 1,
  },
  currencyButton: {
    backgroundColor: '#333333',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  currencyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  
  // 1. Balance Summary Card
  balanceSummaryCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  mainBalance: {
    alignItems: 'center',
    marginBottom: 20,
  },
  balanceHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  availableLabel: {
    fontSize: 16,
    color: '#888888',
  },
  balanceAmountContainer: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  availableAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 18,
    color: '#888888',
    marginLeft: 8,
    fontStyle: 'italic',
  },
  balanceBreakdown: {
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  balanceItem: {
    alignItems: 'center',
  },
  balanceSubLabel: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 4,
  },
  balanceSubAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // 2. Verification Banner
  verificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A1F00',
    borderColor: '#FFB800',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  verificationText: {
    flex: 1,
    fontSize: 14,
    color: '#FFB800',
    fontWeight: '600',
    marginHorizontal: 12,
  },
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0A2A0A',
    borderColor: '#4CAF50',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  verifiedText: {
    flex: 1,
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 12,
  },
  
  // 3. Payout Section
  payoutSection: {
    marginBottom: 24,
  },
  payoutInfoCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333333',
  },
  payoutInfoContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  payoutTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  payoutSubLabel: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 4,
  },
  payoutDateLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  
  // 4. Payouts
  payoutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  payoutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  payoutIcon: {
    marginRight: 12,
  },
  payoutDetails: {
    flex: 1,
  },
  payoutDescription: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  payoutDate: {
    fontSize: 12,
    color: '#888888',
  },
  payoutRight: {
    alignItems: 'flex-end',
  },
  payoutAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  payoutStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  
  // 5. Help & Support
  helpItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  helpText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  
  // Currency Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalCloseButton: {
    padding: 4,
  },
  
  // Search Bar Styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333333',
    borderRadius: 12,
    margin: 20,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    padding: 0,
  },
  clearSearchButton: {
    marginLeft: 8,
    padding: 4,
  },
  
  // Empty Search State
  emptySearchContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptySearchText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySearchSubtext: {
    fontSize: 14,
    color: '#888888',
    marginTop: 8,
    textAlign: 'center',
  },
  
  currencyList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  currencyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  selectedCurrencyItem: {
    backgroundColor: '#333333',
  },
  currencyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    width: 40,
    textAlign: 'center',
    marginRight: 16,
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  currencyName: {
    fontSize: 14,
    color: '#888888',
  },
  emptyPayoutsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  emptyPayoutsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 12,
  },
  emptyPayoutsSubtext: {
    fontSize: 14,
    color: '#888888',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default BalanceScreen; 