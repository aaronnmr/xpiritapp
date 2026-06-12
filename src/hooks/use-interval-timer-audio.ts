import { Audio } from "expo-av";
import { useCallback, useEffect, useRef } from "react";

type TimerCue = "tick" | "transition";

const cueSources = {
  tick: require("../../assets/audio/countdown_tick.mp3"),
  transition: require("../../assets/audio/transition_bell.mp3")
};

export function useIntervalTimerAudio() {
  const sounds = useRef<Partial<Record<TimerCue, Audio.Sound>>>({});
  const isReady = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function preloadSounds() {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true
        });

        const [tick, transition] = await Promise.all([
          Audio.Sound.createAsync(cueSources.tick, { shouldPlay: false, volume: 0.72 }),
          Audio.Sound.createAsync(cueSources.transition, { shouldPlay: false, volume: 0.82 })
        ]);

        if (!isMounted) {
          await Promise.all([tick.sound.unloadAsync(), transition.sound.unloadAsync()]);
          return;
        }

        sounds.current = {
          tick: tick.sound,
          transition: transition.sound
        };
        isReady.current = true;
      } catch {
        isReady.current = false;
      }
    }

    void preloadSounds();

    return () => {
      isMounted = false;
      isReady.current = false;
      const loadedSounds = Object.values(sounds.current);
      sounds.current = {};
      loadedSounds.forEach((sound) => {
        void sound.unloadAsync();
      });
    };
  }, []);

  const playCue = useCallback((cue: TimerCue) => {
    if (!isReady.current) {
      return;
    }

    const sound = sounds.current[cue];

    if (!sound) {
      return;
    }

    void sound.replayAsync().catch(() => undefined);
  }, []);

  return {
    playTick: useCallback(() => playCue("tick"), [playCue]),
    playTransition: useCallback(() => playCue("transition"), [playCue])
  };
}
