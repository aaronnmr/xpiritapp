import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { AmplitudeService } from "@/services/amplitude-service";
import { XpiritDataService } from "@/services/xpirit-data-service";

type GymSet = {
  activity: string;
  id: number;
  reps: string;
  weight: string;
};

const activities = ["Bench Press", "Squat", "Deadlift", "Pull-Ups"];

function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function GymScreen() {
  const [activity, setActivity] = useState(activities[0]);
  const [customActivity, setCustomActivity] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [sets, setSets] = useState<GymSet[]>([
    { activity: "Bench Press", id: 1, reps: "8", weight: "60" },
    { activity: "Squat", id: 2, reps: "10", weight: "80" }
  ]);
  const [workSeconds, setWorkSeconds] = useState("45");
  const [restSeconds, setRestSeconds] = useState("30");
  const [remaining, setRemaining] = useState(45);
  const [phase, setPhase] = useState<"Work" | "Rest">("Work");
  const [isRunning, setIsRunning] = useState(false);

  const selectedActivity = customActivity.trim() || activity;
  const canAddSet = selectedActivity.length > 0 && weight.length > 0 && reps.length > 0;
  const totalVolume = useMemo(
    () => sets.reduce((sum, item) => sum + Number(item.weight || 0) * Number(item.reps || 0), 0),
    [sets]
  );

  useEffect(() => {
    if (!isRunning) {
      return undefined;
    }

    const interval = setInterval(() => {
      setRemaining((current) => {
        if (current > 1) {
          return current - 1;
        }

        const nextPhase = phase === "Work" ? "Rest" : "Work";
        setPhase(nextPhase);
        return Number(nextPhase === "Work" ? workSeconds : restSeconds) || 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, phase, restSeconds, workSeconds]);

  function addSet() {
    if (!canAddSet) {
      return;
    }

    setSets((current) => [
      { activity: selectedActivity, id: Date.now(), reps, weight },
      ...current
    ]);
    setWeight("");
    setReps("");
    setCustomActivity("");
    AmplitudeService.track("gym_set_saved", {
      activity: selectedActivity,
      reps: Number(reps),
      weight_kg: Number(weight)
    });
    void XpiritDataService.saveGymSet({
      activity: selectedActivity,
      reps: Number(reps),
      weightKg: Number(weight)
    });
  }

  function startTimer() {
    setPhase("Work");
    setRemaining(Number(workSeconds) || 1);
    setIsRunning(true);
    AmplitudeService.track("interval_timer_started", {
      activity_seconds: Number(workSeconds) || 1,
      repeats: 1,
      rest_seconds: Number(restSeconds) || 0
    });
    void XpiritDataService.saveIntervalTimer(Number(workSeconds) || 1, Number(restSeconds) || 0, 1);
  }

  return (
    <ScrollView className="flex-1 bg-white px-5 pt-14" contentContainerStyle={{ paddingBottom: 120 }}>
      <Text className="text-sm font-semibold uppercase tracking-widest text-[#808080]">Gym Logger</Text>
      <Text className="mt-3 text-5xl font-normal leading-[44px] tracking-[-2px] text-black">Log strength without friction.</Text>

      <View className="mt-6 rounded-[24px] bg-[#f3f5f9] p-5">
        <Text className="text-xl font-semibold tracking-[-0.6px] text-black">New Set</Text>
        <View className="mt-4 flex-row flex-wrap gap-2">
          {activities.map((item) => {
            const isSelected = activity === item && !customActivity;

            return (
              <Pressable
                key={item}
                className={`min-h-[44px] max-w-full justify-center rounded-[300px] px-4 py-3 ${isSelected ? "bg-[#4a53ff]" : "bg-white"}`}
                onPress={() => {
                  setActivity(item);
                  setCustomActivity("");
                }}
              >
                <Text
                  className={`text-xs font-semibold uppercase tracking-widest ${isSelected ? "text-white" : "text-black"}`}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={customActivity}
          onChangeText={setCustomActivity}
          placeholder="Custom activity"
          placeholderTextColor="#808080"
          className="mt-3 rounded-[24px] bg-white px-4 py-4 text-base text-black"
        />
        <View className="mt-3 flex-row gap-3">
          <TextInput
            value={weight}
            onChangeText={setWeight}
            placeholder="Weight kg"
            placeholderTextColor="#808080"
            keyboardType="decimal-pad"
            className="min-w-0 flex-1 rounded-[24px] bg-white px-4 py-4 text-base text-black"
          />
          <TextInput
            value={reps}
            onChangeText={setReps}
            placeholder="Reps"
            placeholderTextColor="#808080"
            keyboardType="number-pad"
            className="min-w-0 flex-1 rounded-[24px] bg-white px-4 py-4 text-base text-black"
          />
        </View>
        <Pressable className={`mt-4 rounded-full px-6 py-4 ${canAddSet ? "bg-[#4a53ff]" : "bg-[#e5e7eb]"}`} onPress={addSet}>
          <Text className={`text-center text-sm font-semibold uppercase tracking-widest ${canAddSet ? "text-white" : "text-[#808080]"}`}>Save Set</Text>
        </Pressable>
      </View>

      <View className="mt-5 rounded-[24px] bg-black p-5">
        <View className="flex-row items-center justify-between gap-3">
          <Text className="min-w-0 flex-1 text-xl font-semibold tracking-[-0.6px] text-white" numberOfLines={1}>
            Interval Timer
          </Text>
          <Text className="shrink-0 text-sm font-semibold uppercase tracking-widest text-[#4a53ff]">{phase}</Text>
        </View>
        <Text className="mt-5 text-center text-6xl font-normal tracking-[-2px] text-white" numberOfLines={1} adjustsFontSizeToFit>
          {formatSeconds(remaining)}
        </Text>
        <View className="mt-5 flex-row gap-3">
          <TextInput
            value={workSeconds}
            onChangeText={setWorkSeconds}
            placeholder="Work sec"
            placeholderTextColor="#999999"
            keyboardType="number-pad"
            className="min-w-0 flex-1 rounded-[24px] bg-[#191919] px-4 py-4 text-base text-white"
          />
          <TextInput
            value={restSeconds}
            onChangeText={setRestSeconds}
            placeholder="Rest sec"
            placeholderTextColor="#999999"
            keyboardType="number-pad"
            className="min-w-0 flex-1 rounded-[24px] bg-[#191919] px-4 py-4 text-base text-white"
          />
        </View>
        <View className="mt-4 flex-row gap-3">
          <Pressable className="min-w-0 flex-1 rounded-[300px] bg-white px-4 py-4" onPress={startTimer}>
            <Text className="text-center text-xs font-semibold uppercase tracking-widest text-black" numberOfLines={1} adjustsFontSizeToFit>
              Start
            </Text>
          </Pressable>
          <Pressable className="min-w-0 flex-1 rounded-[300px] border border-white px-4 py-4" onPress={() => setIsRunning((current) => !current)}>
            <Text className="text-center text-xs font-semibold uppercase tracking-widest text-white" numberOfLines={1} adjustsFontSizeToFit>
              {isRunning ? "Pause" : "Resume"}
            </Text>
          </Pressable>
        </View>
      </View>

      <View className="mt-5">
        <View className="mb-3 flex-row items-center justify-between gap-3">
          <Text className="text-xl font-semibold tracking-[-0.6px] text-black">Saved Sets</Text>
          <Text className="shrink text-right text-base text-[#808080]">{totalVolume} kg volume</Text>
        </View>
        <View className="gap-3">
          {sets.map((item) => (
            <View key={item.id} className="flex-row items-center justify-between gap-3 rounded-[24px] bg-[#f3f5f9] p-5">
              <View className="min-w-0 flex-1">
                <Text className="text-xl font-semibold tracking-[-0.6px] text-black" numberOfLines={1}>
                  {item.activity}
                </Text>
                <Text className="mt-1 text-base text-[#808080]">{item.weight} kg</Text>
              </View>
              <Text className="shrink-0 text-3xl font-normal tracking-[-1px] text-black">{item.reps}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
