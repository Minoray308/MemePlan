import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../hooks/useTheme';
import { RootStackParamList, MainTabParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen';
import { CategoriesScreen } from '../screens/CategoriesScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { DetailScreen } from '../screens/DetailScreen';
import { TagsScreen } from '../screens/TagsScreen';
import { Icon } from '../components/Icon';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const theme = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.72)',
        tabBarStyle: {
          backgroundColor: theme.colors.primary,
          borderTopColor: 'transparent',
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: '表情包',
          tabBarIcon: ({ color }) => <Icon name="image-multiple-outline" size={20} color={color} />,
        }}
      />
      <Tab.Screen
        name="Categories"
        component={CategoriesScreen}
        options={{
          title: '分类',
          tabBarIcon: ({ color }) => <Icon name="folder-multiple-outline" size={20} color={color} />,
        }}
      />
      <Tab.Screen
        name="Tags"
        component={TagsScreen}
        options={{
          title: '标签',
          tabBarIcon: ({ color }) => <Icon name="tag-multiple-outline" size={20} color={color} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: '设置',
          tabBarIcon: ({ color }) => <Icon name="cog-outline" size={20} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const theme = useTheme();
  const navTheme = theme.dark ? DarkTheme : DefaultTheme;
  const merged = {
    ...navTheme,
    colors: {
      ...navTheme.colors,
      background: theme.colors.background,
      card: theme.colors.card,
      primary: theme.colors.primary,
      text: theme.colors.text,
      border: theme.colors.divider,
    },
  };

  return (
    <NavigationContainer theme={merged}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="Detail" component={DetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

