import "../global.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { I18nProvider } from "@/lib/i18n";
import { queryClient } from "@/lib/query-client";
import { AmplitudeService } from "@/services/amplitude-service";

export default function RootLayout() {
  const pathname = usePathname();

  useEffect(() => {
    AmplitudeService.initOnce();
  }, []);

  useEffect(() => {
    AmplitudeService.trackScreen(pathname || "/", {
      path: pathname || "/"
    });
  }, [pathname]);

  return (
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: "#050507" },
            headerShown: false
          }}
        />
      </QueryClientProvider>
    </I18nProvider>
  );
}
