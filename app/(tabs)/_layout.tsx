import { useRef } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, Pressable, StyleSheet, Animated, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const hideFromTabBar = { href: null as const };

const PAW_ICON = require('../../assets/cathand.png');

/** 中央猫爪・摸一把 大按钮：cathand.png + 按下收爪动画 */
const TAB_PRIMARY = '#FF7A00';

function TabBarCenterButton({ onPress }: { onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.82,
      useNativeDriver: true,
      speed: 80,
      bounciness: 4,
    }).start();
  };
  const onPressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 60,
      bounciness: 8,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.centerBtn, { backgroundColor: TAB_PRIMARY }]}
    >
      <Animated.View style={[styles.pawContainer, { transform: [{ scale: scaleAnim }] }]}>
        <Image source={PAW_ICON} style={styles.pawIcon} resizeMode="contain" />
      </Animated.View>
      <Text style={[styles.centerBtnText, { color: '#fff' }]} numberOfLines={1}>摸一把</Text>
    </Pressable>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        // RN 7 / @react-navigation/elements 里 Screen 默认 headerShown=true；
        // 仅写外层有时不会落到每个 route，顶部会出现「今日/统计/…」系统标题栏，必须每层都关掉。
        headerShown: false,
        title: '',
        tabBarPosition: 'bottom',
        tabBarActiveTintColor: TAB_PRIMARY,
        tabBarInactiveTintColor: '#999999',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E5E5',
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
          shadowOpacity: 0,
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 0,
        },
        sceneStyle: { backgroundColor: '#FFFFFF' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          headerShown: false,
          title: '',
          tabBarLabel: '今日',
          tabBarIcon: ({ color, size }) => <Ionicons name="today" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          headerShown: false,
          title: '',
          tabBarLabel: '统计',
          tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="moyu"
        options={{
          headerShown: false,
          title: '',
          tabBarIcon: () => null,
          tabBarButton: (props) => (
            <View style={styles.centerTab}>
              <TabBarCenterButton onPress={props.onPress} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          headerShown: false,
          title: '',
          tabBarLabel: '羊毛工具箱',
          tabBarIcon: ({ color, size }) => <Ionicons name="gift" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          headerShown: false,
          title: '',
          tabBarLabel: '设置',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="toilet" options={{ headerShown: false, title: '', ...hideFromTabBar }} />
      <Tabs.Screen name="bailan" options={{ headerShown: false, title: '', ...hideFromTabBar }} />
      <Tabs.Screen name="coffee" options={{ headerShown: false, title: '', ...hideFromTabBar }} />
      <Tabs.Screen name="snacks" options={{ headerShown: false, title: '', ...hideFromTabBar }} />
      <Tabs.Screen name="drinks" options={{ headerShown: false, title: '', ...hideFromTabBar }} />
      <Tabs.Screen name="charge" options={{ headerShown: false, title: '', ...hideFromTabBar }} />
      <Tabs.Screen name="meeting" options={{ headerShown: false, title: '', ...hideFromTabBar }} />
      <Tabs.Screen name="offwork" options={{ headerShown: false, title: '', ...hideFromTabBar }} />
      <Tabs.Screen name="payday" options={{ headerShown: false, title: '', ...hideFromTabBar }} />
      <Tabs.Screen name="commute" options={{ headerShown: false, title: '', ...hideFromTabBar }} />
      <Tabs.Screen name="mortgage" options={{ headerShown: false, title: '', ...hideFromTabBar }} />
      <Tabs.Screen name="lunch" options={{ headerShown: false, title: '', ...hideFromTabBar }} />
      <Tabs.Screen name="expense" options={{ headerShown: false, title: '', ...hideFromTabBar }} />
      <Tabs.Screen name="achievements" options={{ headerShown: false, title: '', ...hideFromTabBar }} />
      <Tabs.Screen name="calendar" options={{ headerShown: false, title: '', ...hideFromTabBar }} />
      <Tabs.Screen name="leave" options={{ headerShown: false, title: '', ...hideFromTabBar }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centerTab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -8,
  },
  centerBtn: {
    width: 56,
    minHeight: 68,
    borderRadius: 28,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 4,
    elevation: 0,
    shadowOpacity: 0,
  },
  pawContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pawIcon: { width: 36, height: 36 },
  centerBtnText: { fontSize: 10, fontWeight: '600' },
});
