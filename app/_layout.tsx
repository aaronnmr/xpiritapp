import "../global.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { queryClient } from "@/lib/query-client";
import { AmplitudeService } from "@/services/amplitude-service";

export default function RootLayout() {
  useEffect(() => {
    AmplitudeService.initOnce();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: "#050507" },
          headerShown: false
        }}
      />
    </QueryClientProvider>
  );
}
