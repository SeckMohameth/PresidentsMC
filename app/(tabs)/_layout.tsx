import { Tabs } from "expo-router";
import { Home, Route, Images, BarChart3, Menu } from "lucide-react-native";
import React from "react";
import { Platform, View, StyleSheet, useWindowDimensions } from "react-native";
import Colors from "@/constants/colors";

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const tabBarWidth = isTablet ? Math.min(width - 48, 640) : undefined;
  const tabBarSide = isTablet && tabBarWidth ? (width - tabBarWidth) / 2 : 14;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.dark.primary,
        tabBarInactiveTintColor: Colors.dark.tabIconDefault,
        tabBarStyle: {
          position: 'absolute',
          left: tabBarSide,
          right: tabBarSide,
          bottom: Platform.OS === 'ios' ? 18 : 12,
          backgroundColor: 'rgba(12,12,13,0.92)',
          borderTopColor: Colors.dark.borderLight,
          borderTopWidth: 1,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderBottomWidth: 1,
          borderLeftColor: Colors.dark.border,
          borderRightColor: Colors.dark.border,
          borderBottomColor: '#050505',
          borderRadius: 28,
          paddingTop: 10,
          height: Platform.OS === 'ios' ? 74 : 66,
          shadowColor: '#000',
          shadowOpacity: 0.55,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
          elevation: 18,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '800',
          marginTop: 2,
          textTransform: 'uppercase',
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused && styles.activeIconContainer}>
              <Home size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="rides"
        options={{
          title: "Rides",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused && styles.activeIconContainer}>
              <Route size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="albums"
        options={{
          title: "Albums",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused && styles.activeIconContainer}>
              <Images size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Stats",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused && styles.activeIconContainer}>
              <BarChart3 size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused && styles.activeIconContainer}>
              <Menu size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeIconContainer: {
    backgroundColor: 'rgba(229,229,229,0.14)',
    borderRadius: 14,
    padding: 7,
    marginBottom: -5,
    borderWidth: 1,
    borderColor: 'rgba(229,229,229,0.22)',
  },
});
