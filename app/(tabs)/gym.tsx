import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useIntervalTimerAudio } from "@/hooks/use-interval-timer-audio";
import { AmplitudeService } from "@/services/amplitude-service";
import { XpiritDataService } from "@/services/xpirit-data-service";

type GymSet = {
  activity: string;
  date: string;
  id: number;
  isoDate: string;
  reps: string;
  weight: string;
};

const activities = ["Bench Press", "Squat", "Deadlift", "Pull-Ups"];
const rangeOptions = ["This week", "Last week", "Last month", "Custom dates"];

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
    { activity: "Bench Press", date: "Jun 11, 2026", id: 1, isoDate: "2026-06-11", reps: "8", weight: "60" },
    { activity: "Squat", date: "Jun 10, 2026", id: 2, isoDate: "2026-06-10", reps: "10", weight: "80" },
    { activity: "Deadlift", date: "Jun 6, 2026", id: 3, isoDate: "2026-06-06", reps: "5", weight: "110" }
  ]);
  const [isSetRangeOpen, setIsSetRangeOpen] = useState(false);
  const [editingSetId, setEditingSetId] = useState<number | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editReps, setEditReps] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [selectedSetRange, setSelectedSetRange] = useState("This week");
  const [setCustomStart, setSetCustomStart] = useState("");
  const [setCustomEnd, setSetCustomEnd] = useState("");
  const [workSeconds, setWorkSeconds] = useState("45");
  const [restSeconds, setRestSeconds] = useState("30");
  const [remaining, setRemaining] = useState(45);
  const [phase, setPhase] = useState<"Work" | "Recovery">("Work");
  const [isRunning, setIsRunning] = useState(false);
  const { playTick, playTransition } = useIntervalTimerAudio();

  const selectedActivity = customActivity.trim() || activity;
  const canAddSet = selectedActivity.length > 0 && weight.length > 0 && reps.length > 0;
  const totalVolume = useMemo(
    () => sets.reduce((sum, item) => sum + Number(item.weight || 0) * Number(item.reps || 0), 0),
    [sets]
  );
  const customSetDateError = getCustomDateError(setCustomStart, setCustomEnd);
  const visibleSets = sets.filter((item) => isInsideRange(item.isoDate, selectedSetRange, setCustomStart, setCustomEnd));

  const selectSetRange = (range: string) => {
    setSelectedSetRange(range);
    setIsSetRangeOpen(range === "Custom dates");
  };

  useEffect(() => {
    if (!isRunning) {
      return undefined;
    }

    const interval = setInterval(() => {
      setRemaining((current) => {
        if (current > 1) {
          const nextRemaining = current - 1;

          if (phase === "Recovery" && [3, 2, 1].includes(nextRemaining)) {
            playTick();
          }

          return nextRemaining;
        }

        if (phase === "Recovery") {
          playTransition();
        }

        const nextPhase = phase === "Work" ? "Recovery" : "Work";
        setPhase(nextPhase);
        return Number(nextPhase === "Work" ? workSeconds : restSeconds) || 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, phase, playTick, playTransition, restSeconds, workSeconds]);

  function addSet() {
    if (!canAddSet) {
      return;
    }

    setSets((current) => [
      {
        activity: selectedActivity,
        date: formatDateLabel(new Date()),
        id: Date.now(),
        isoDate: formatIsoDate(new Date()),
        reps,
        weight
      },
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

  const startEditingSet = (item: GymSet) => {
    setEditingSetId(item.id);
    setEditWeight(item.weight ?? "");
    setEditReps(item.reps ?? "");
    setEditError(null);
  };

  const cancelEditing = () => {
    setEditingSetId(null);
    setEditWeight("");
    setEditReps("");
    setEditError(null);
  };

  const saveEditing = async (id: number) => {
    const weightNum = Number(editWeight);
    const repsNum = Number(editReps);

    if (Number.isNaN(weightNum) || Number.isNaN(repsNum) || weightNum < 0 || repsNum < 0) {
      setEditError("Enter valid non-negative numbers for weight and reps.");
      return;
    }

    // update local state
    setSets((current) => current.map((s) => (s.id === id ? { ...s, weight: String(weightNum), reps: String(repsNum) } : s)));

    // persist
    try {
      await XpiritDataService.updateGymSet(id, { reps: repsNum, weightKg: weightNum });
    } catch (e) {
      // ignore persistence errors for now
    }

    // exit edit mode
    setEditingSetId(null);
    setEditError(null);
  };

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
          <View className="min-w-0 flex-1">
            <Text className="text-xl font-semibold tracking-[-0.6px] text-black">Saved Sets</Text>
            <Text className="mt-1 text-base text-[#808080]">{totalVolume} kg volume</Text>
          </View>
          <Pressable className="shrink-0 rounded-[300px] bg-[#eef0ff] px-4 py-3" onPress={() => setIsSetRangeOpen((value) => !value)}>
            <Text className="text-xs font-semibold uppercase tracking-widest text-[#4a53ff]" numberOfLines={1}>
              {selectedSetRange}
            </Text>
          </Pressable>
        </View>

        {isSetRangeOpen ? (
          <View className="mb-3 rounded-[24px] bg-[#f3f5f9] p-2">
            {rangeOptions.map((option) => {
              const isSelected = option === selectedSetRange;

              return (
                <Pressable
                  key={option}
                  className={`rounded-[300px] px-4 py-3 ${isSelected ? "bg-white" : "bg-transparent"}`}
                  onPress={() => selectSetRange(option)}
                >
                  <Text className={`text-sm font-semibold ${isSelected ? "text-black" : "text-[#808080]"}`}>{option}</Text>
                </Pressable>
              );
            })}

            {selectedSetRange === "Custom dates" ? (
              <>
                <View className="mt-2 flex-row gap-2 px-1">
                  <TextInput
                    className="min-w-0 flex-1 rounded-[24px] bg-white px-4 py-3 text-sm text-black"
                    keyboardType="numbers-and-punctuation"
                    maxLength={10}
                    onChangeText={(value) => setSetCustomStart(formatDateInput(value))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#808080"
                    value={setCustomStart}
                  />
                  <TextInput
                    className="min-w-0 flex-1 rounded-[24px] bg-white px-4 py-3 text-sm text-black"
                    keyboardType="numbers-and-punctuation"
                    maxLength={10}
                    onChangeText={(value) => setSetCustomEnd(formatDateInput(value))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#808080"
                    value={setCustomEnd}
                  />
                </View>
                {customSetDateError ? <Text className="px-3 pb-1 pt-2 text-xs font-semibold text-[#d14343]">{customSetDateError}</Text> : null}
              </>
            ) : null}
          </View>
        ) : null}

        <View className="gap-3">
          {visibleSets.map((item) => {
            const isEditing = editingSetId === item.id;

            return (
              <View key={item.id} className="flex-row items-center justify-between gap-3 rounded-[24px] bg-[#f3f5f9] p-5">
                <View className="min-w-0 flex-1">
                  <Text className="text-xl font-semibold tracking-[-0.6px] text-black" numberOfLines={1}>
                    {item.activity}
                  </Text>
                  <Text className="mt-1 text-base text-[#808080]">{item.date}</Text>
                  {isEditing ? (
                    <TextInput
                      value={editWeight}
                      onChangeText={setEditWeight}
                      placeholder="Weight kg"
                      placeholderTextColor="#808080"
                      keyboardType="decimal-pad"
                      className="mt-2 min-w-0 rounded-[12px] bg-white px-3 py-2 text-sm text-black"
                    />
                  ) : (
                    <Text className="mt-1 text-sm font-semibold text-[#4a53ff]">{item.weight} kg</Text>
                  )}
                </View>

                <View className="items-end">
                  <View className="flex-row items-center gap-2">
                    {isEditing ? (
                      <>
                        <Pressable onPress={() => saveEditing(item.id)}>
                          <Ionicons name="checkmark" size={18} color="#4a53ff" />
                        </Pressable>
                        <Pressable onPress={cancelEditing}>
                          <Ionicons name="close" size={18} color="#999999" />
                        </Pressable>
                      </>
                    ) : (
                      <Pressable onPress={() => startEditingSet(item)}>
                        <Ionicons name="pencil" size={16} color="#4a53ff" />
                      </Pressable>
                    )}
                  </View>

                  {isEditing ? (
                    <>
                      <TextInput
                        value={editReps}
                        onChangeText={setEditReps}
                        placeholder="Reps"
                        placeholderTextColor="#808080"
                        keyboardType="number-pad"
                        className="mt-2 w-12 rounded-[12px] bg-white px-3 py-2 text-center text-2xl font-normal text-black"
                      />
                      {editError ? <Text className="mt-2 text-xs font-semibold text-[#d14343]">{editError}</Text> : null}
                    </>
                  ) : (
                    <Text className="shrink-0 text-3xl font-normal tracking-[-1px] text-black">{item.reps}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDateInput(value: string) {
  return value.replace(/[^\d-]/g, "").slice(0, 10);
}

function getCustomDateError(start: string, end: string) {
  if (!start && !end) {
    return null;
  }

  if (!isValidIsoDate(start) || !isValidIsoDate(end)) {
    return "Use YYYY-MM-DD for both dates.";
  }

  if (end <= start) {
    return "End date must be after start date.";
  }

  return null;
}

function isInsideRange(isoDate: string, selectedRange: string, customStart: string, customEnd: string) {
  if (selectedRange === "Custom dates") {
    if (getCustomDateError(customStart, customEnd)) {
      return true;
    }

    return isoDate >= customStart && isoDate <= customEnd;
  }

  if (selectedRange === "Last week") {
    return isoDate >= "2026-06-02" && isoDate <= "2026-06-08";
  }

  if (selectedRange === "Last month") {
    return isoDate >= "2026-05-01" && isoDate <= "2026-05-31";
  }

  return isoDate >= "2026-06-09" && isoDate <= "2026-06-15";
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
