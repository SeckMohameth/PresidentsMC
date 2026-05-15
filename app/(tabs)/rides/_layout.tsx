import { Stack } from "expo-router";
import Colors from "@/constants/colors";

export default function RidesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.dark.background },
        headerTintColor: Colors.dark.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: Colors.dark.background },
      }}
    >
      <Stack.Screen 
        name="index" 
        options={{ 
          headerShown: false,
        }} 
      />
    </Stack>
  );
}
