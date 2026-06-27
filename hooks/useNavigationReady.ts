import { useNavigation } from "expo-router";
import { useEffect, useState } from "react";

/**
 * Returns `false` during the navigation push animation, then `true` once
 * the push animation completes AND the JS thread is idle.
 *
 * Two-phase deferral:
 *   1. `transitionEnd` navigation event — react-native-screens fires
 *      `onAppear` (mapped to `transitionEnd` with `closing: false`) only
 *      after the native animation finishes.  In RN 0.81.x,
 *      `requestIdleCallback` is backed by JSTimers' frame-budget logic and
 *      fires whenever the JS thread has ≥1 ms of spare time — which can be
 *      mid-transition.  Mounting the heavy screen tree mid-transition causes
 *      a Fabric/Yoga shadow-node parent-child assertion crash (SIGABRT)
 *      because Yoga is updating a large new subtree while the animation
 *      shadow clone still references the previous minimal layout.
 *   2. `requestIdleCallback` — once the animation is done, defer the actual
 *      setState until the JS thread has spare frame time so the first user
 *      interaction after navigation isn't blocked by a synchronous render.
 *
 * NOTE: In RN ≥ 0.85 (bridgeless Hermes EventLoop), `requestIdleCallback`
 * is animation-aware and the `transitionEnd` wrapper is no longer needed.
 * Revert to the simpler single-`requestIdleCallback` form when upgrading to
 * Expo SDK 56 / RN 0.85.
 *
 * Requires: must be called from a screen that is a child of a native-stack
 * navigator (expo-router's `<Stack>`) so that `useNavigation` resolves and
 * `transitionEnd` is emitted.
 *
 * Usage:
 *   const ready = useNavigationReady();
 *   if (!ready) return <View style={{ flex: 1, backgroundColor: "#f5f6f9" }} />;
 */
export function useNavigationReady(): boolean {
  const [ready, setReady] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    let idleId: ReturnType<typeof requestIdleCallback> | undefined;

    // 'transitionEnd' is a native-stack-specific event not present in the
    // generic NavigationProp EventMap; cast to bypass the constraint.
    const unsubscribe = navigation.addListener(
      "transitionEnd" as never,
      (e: unknown) => {
        const event = e as { data?: { closing?: boolean } };
        if (event.data?.closing) return; // pop animation — not interested
        if (idleId === undefined) {
          idleId = requestIdleCallback(() => setReady(true));
        }
      },
    );

    return () => {
      unsubscribe();
      if (idleId !== undefined) cancelIdleCallback(idleId);
    };
  }, [navigation]);

  return ready;
}
