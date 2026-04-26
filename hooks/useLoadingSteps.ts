import { useCallback, useState } from "react";

type LoadingStep = {
  message: string;
  completed: boolean;
};

export function useLoadingSteps(stepMessages: string[]) {
  const [isLoading, setIsLoading] = useState(false);
  const [steps, setSteps] = useState<LoadingStep[]>(() =>
    stepMessages.map((message) => ({ message, completed: false })),
  );
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const completeStep = useCallback((index: number) => {
    setSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, completed: true } : step)),
    );
    setCurrentStepIndex(index);
  }, []);

  const start = useCallback(() => {
    setSteps(stepMessages.map((message) => ({ message, completed: false })));
    setCurrentStepIndex(0);
    setIsLoading(true);
  }, [stepMessages]);

  const stop = useCallback(() => {
    setIsLoading(false);
  }, []);

  const delay = useCallback((ms: number) => {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }, []);

  return {
    isLoading,
    steps,
    currentStepIndex,
    currentMessage: steps[currentStepIndex]?.message,
    completeStep,
    start,
    stop,
    delay,
  };
}
