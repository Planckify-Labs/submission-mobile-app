import React, { createContext, useContext, useEffect, useState } from "react";
import { InteractionManager, Platform } from "react-native";

type PerformanceContextType = {
  isReady: boolean;
  deferredTask: <T>(task: () => T, description?: string) => Promise<T>;
};

const PerformanceContext = createContext<PerformanceContextType>({
  isReady: false,
  deferredTask: async (task) => task(),
});

export const usePerformance = () => useContext(PerformanceContext);

export function PerformanceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const interactionPromise = InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
    });

    return () => {
      interactionPromise.cancel();
    };
  }, []);

  const deferredTask = async <T,>(
    task: () => T,
    description?: string,
  ): Promise<T> => {
    if (__DEV__) {
      console.log(`Deferring task: ${description || "unnamed task"}`);
    }

    if (Platform.OS === "ios") {
      return new Promise<T>((resolve) => {
        InteractionManager.runAfterInteractions(() => {
          const result = task();
          resolve(result);
        });
      });
    }

    return new Promise<T>((resolve) => {
      requestAnimationFrame(() => {
        const result = task();
        resolve(result);
      });
    });
  };

  return (
    <PerformanceContext.Provider value={{ isReady, deferredTask }}>
      {children}
    </PerformanceContext.Provider>
  );
}
