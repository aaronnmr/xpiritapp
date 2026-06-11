import { Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { decodePolyline, pointsToSvgPath } from "@/lib/polyline";

const fallbackRoute = "gfo}EtohhUxD@bAxJmGF";

type RouteMapCardProps = {
  distance: string;
  pace: string;
  polyline?: string | null;
  title: string;
};

export function RouteMapCard({ distance, pace, polyline, title }: RouteMapCardProps) {
  const points = decodePolyline(polyline || fallbackRoute);
  const path = pointsToSvgPath(points, 320, 160);

  return (
    <View className="mt-4 overflow-hidden rounded-[24px] bg-[#f3f5f9] p-5">
      <View className="flex-row items-start justify-between">
        <View>
          <Text className="text-sm font-semibold uppercase tracking-widest text-[#808080]">Latest Route</Text>
          <Text className="mt-2 text-2xl font-semibold tracking-[-0.8px] text-black">{title}</Text>
        </View>
        <View className="rounded-full bg-white px-4 py-2">
          <Text className="text-sm font-semibold text-[#4a53ff]">Synced</Text>
        </View>
      </View>

      <View className="mt-4 h-40 overflow-hidden rounded-[22px] bg-white">
        <View className="absolute inset-0 opacity-70">
          <View className="absolute left-8 top-7 h-24 w-24 rounded-full bg-[#edf0ff]" />
          <View className="absolute bottom-5 right-8 h-20 w-20 rounded-full bg-[#f3f5f9]" />
        </View>
        <Svg width="100%" height="100%" viewBox="0 0 320 160">
          <Path d={path} fill="none" stroke="#d9def0" strokeLinecap="round" strokeLinejoin="round" strokeWidth={16} />
          <Path d={path} fill="none" stroke="#4a53ff" strokeLinecap="round" strokeLinejoin="round" strokeWidth={8} />
          {points.length > 0 ? (
            <>
              <Circle cx={18} cy={142} fill="#000000" r={6} />
              <Circle cx={302} cy={18} fill="#4a53ff" r={7} />
            </>
          ) : null}
        </Svg>
      </View>

      <View className="mt-4 flex-row gap-3">
        <View className="flex-1 rounded-[20px] bg-white p-4">
          <Text className="text-xs font-semibold uppercase tracking-widest text-[#808080]">Distance</Text>
          <Text className="mt-2 text-2xl font-semibold text-black">{distance}</Text>
        </View>
        <View className="flex-1 rounded-[20px] bg-white p-4">
          <Text className="text-xs font-semibold uppercase tracking-widest text-[#808080]">Pace</Text>
          <Text className="mt-2 text-2xl font-semibold text-black">{pace}</Text>
        </View>
      </View>
    </View>
  );
}
