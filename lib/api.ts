import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Entry {
  id: string;
  title: string;
  status: "CREATED" | "STAGE_1" | "STAGE_2" | "COMPLETED" | "FAILED";
  progress: number;
  result?: string;
  createdAt: string;
  updatedAt: string;
}

async function fetchEntries(): Promise<Entry[]> {
  const response = await fetch("/api/entries");
  if (!response.ok) {
    throw new Error("Failed to fetch entries");
  }
  const data = await response.json();
  return data.entries;
}

async function createEntry(title: string): Promise<Entry> {
  const response = await fetch("/api/entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) {
    throw new Error("Failed to create entry");
  }
  return response.json();
}

export function useEntries() {
  return useQuery({
    queryKey: ["entries"],
    queryFn: fetchEntries,
    refetchInterval: (query) => {
      if (!query.state.data) return 2000;

      const isAllDone =
        query.state.data.length > 0 &&
        query.state.data.every(
          (e) => e.status === "COMPLETED" || e.status === "FAILED",
        );

      return isAllDone ? false : 2000;
    },
    staleTime: 0,
  });
}

export function useCreateEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createEntry,
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ["entries"] });
    },
  });
}
