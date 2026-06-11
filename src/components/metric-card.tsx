import { Text, View } from "react-native";

type Accent = "volt" | "pool" | "ember";

type MetricCardProps = {
  accent: Accent;
  label: string;
  locked?: boolean;
  value: string;
};

const accentClass: Record<Accent, string> = {
  ember: "bg-ember",
  pool: "bg-pool",
  volt: "bg-volt"
};

export function MetricCard({ accent, label, locked, value }: MetricCardProps) {
  return (
    <View className="rounded-lg border border-[#242733] bg-graphite p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm text-muted">{label}</Text>
        <View className={`h-2.5 w-2.5 rounded-full ${accentClass[accent]}`} />
      </View>
      <Text className="mt-3 text-2xl font-semibold text-mist">{value}</Text>
      {locked ? <Text className="mt-2 text-sm text-muted">Premium</Text> : null}
    </View>
  );
}
