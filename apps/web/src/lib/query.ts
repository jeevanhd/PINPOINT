import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000,
      refetchOnWindowFocus: true,
    },
  },
});

export const queryKeys = {
  me: ['me'] as const,
  dashboard: ['dashboard'] as const,
  topics: ['topics'] as const,
  topic: (id: string) => ['topic', id] as const,
  units: ['units'] as const,
  places: ['places'] as const,
  place: (id: string) => ['place', id] as const,
  recall: (id: string) => ['recall', id] as const,
  exams: ['exams'] as const,
  explanations: (id: string) => ['explanations', id] as const,
};
