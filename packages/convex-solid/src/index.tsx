import {
  type FunctionReference,
  type FunctionArgs,
  type FunctionReturnType,
  getFunctionName,
} from "convex/server";
import { ConvexClient } from "convex/browser";
import { createContextProvider } from "@solid-primitives/context";
import { isServer } from "solid-js/web";
import {
  type Accessor,
  type JSX,
  createEffect,
  createSignal,
  on,
  onCleanup,
} from "solid-js";
import { createStore, reconcile, type SetStoreFunction, type Store } from "solid-js/store";

// ---------------------------------------------------------------------------
// Utility types
// ---------------------------------------------------------------------------

export type MaybeAccessor<T> = T | Accessor<T>;

function resolve<T>(value: MaybeAccessor<T>): T {
  return typeof value === "function" ? (value as Accessor<T>)() : value;
}

function stableStringify(value: unknown): string {
  if (value === undefined) return "undefined";
  return JSON.stringify(value, (_, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.keys(v)
        .sort()
        .reduce<Record<string, unknown>>((sorted, key) => {
          sorted[key] = v[key];
          return sorted;
        }, {});
    }
    return v;
  });
}

// ---------------------------------------------------------------------------
// Cache types
// ---------------------------------------------------------------------------

interface CacheEntry {
  store: Store<QueryState<any>>;
  setState: SetStoreFunction<QueryState<any>>;
  count: number;
  unsub: () => void;
  retainTimer: ReturnType<typeof setTimeout> | undefined;
}

type QueryCache = Map<string, CacheEntry>;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ConvexContext {
  client: ConvexClient;
  cache: QueryCache;
}

const [ConvexProvider, useConvexContext] = createContextProvider(
  (props: { url: string; children?: JSX.Element }) => {
    const client = new ConvexClient(props.url, {
      disabled: isServer,
    });
    const cache: QueryCache = new Map();

    if (!isServer) {
      onCleanup(() => {
        for (const entry of cache.values()) {
          entry.unsub();
          if (entry.retainTimer !== undefined) clearTimeout(entry.retainTimer);
        }
        cache.clear();
        client.close();
      });
    }

    return { client, cache };
  },
);

function useConvexClient(): ConvexClient {
  const ctx = useConvexContext();
  if (!ctx) {
    throw new Error("useConvexClient must be used within a ConvexProvider");
  }
  return ctx.client;
}

// ---------------------------------------------------------------------------
// useQuery
// ---------------------------------------------------------------------------

interface QueryState<T> {
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
  isStale: boolean;
}

interface UseQueryOptions<T> {
  enabled?: MaybeAccessor<boolean>;
  initialData?: T;
  keepPreviousData?: boolean;
}

const RETAIN_MS = 30_000;

function useQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args?: MaybeAccessor<FunctionArgs<Query>>,
  options?: UseQueryOptions<FunctionReturnType<Query>>,
): Store<QueryState<FunctionReturnType<Query>>> {
  // Server-side: return static store
  if (isServer) {
    const [store] = createStore<QueryState<FunctionReturnType<Query>>>({
      data: options?.initialData,
      error: undefined,
      isLoading: options?.initialData !== undefined ? false : true,
      isStale: false,
    });
    return store;
  }

  const ctx = useConvexContext();
  if (!ctx) {
    throw new Error("useQuery must be used within a ConvexProvider");
  }
  const { client, cache } = ctx;

  const queryName = getFunctionName(query);

  // Local store that this component instance reads from.
  // It may point at a shared cache entry or a local disabled-state store.
  const [store, setState] = createStore<QueryState<FunctionReturnType<Query>>>({
    data: options?.initialData,
    error: undefined,
    isLoading: true,
    isStale: false,
  });

  let currentKey: string | undefined;

  // Subscribe / resubscribe whenever args or enabled changes
  const getArgs = () => (args !== undefined ? resolve(args) : ({} as FunctionArgs<Query>));
  const getEnabled = () => (options?.enabled !== undefined ? resolve(options.enabled) : true);

  // Reload signal for forcing resubscribe
  const [reloadKey, setReloadKey] = createSignal(0);
  void setReloadKey; // may be used in the future

  function subscribe(resolvedArgs: FunctionArgs<Query>) {
    const key = queryName + ":" + stableStringify(resolvedArgs);

    // If we're already subscribed to this exact key, nothing to do
    if (key === currentKey) return;

    // Unsubscribe from previous key
    unsubscribeFromKey();

    currentKey = key;

    const existing = cache.get(key);
    if (existing) {
      // Reuse existing cache entry
      existing.count++;
      if (existing.retainTimer !== undefined) {
        clearTimeout(existing.retainTimer);
        existing.retainTimer = undefined;
      }
      // Sync local store with cached store
      setState("data", reconcile(existing.store.data));
      setState("error", existing.store.error);
      setState("isLoading", existing.store.isLoading);
      setState("isStale", false);
      return;
    }

    // New subscription
    if (!options?.keepPreviousData) {
      setState("data", options?.initialData);
    } else {
      setState("isStale", true);
    }
    setState("error", undefined);
    setState("isLoading", true);

    const unsub = client.onUpdate(
      query,
      resolvedArgs,
      (result: FunctionReturnType<Query>) => {
        setState("data", reconcile(result));
        setState("isLoading", false);
        setState("isStale", false);
        setState("error", undefined);
        // Also update the cache entry's store if it exists
        const entry = cache.get(key);
        if (entry && entry.setState !== setState) {
          entry.setState("data", reconcile(result));
          entry.setState("isLoading", false);
          entry.setState("isStale", false);
          entry.setState("error", undefined);
        }
      },
      (error: Error) => {
        setState("error", error);
        setState("isLoading", false);
        const entry = cache.get(key);
        if (entry && entry.setState !== setState) {
          entry.setState("error", error);
          entry.setState("isLoading", false);
        }
      },
    );

    // Try to seed with local query result synchronously
    try {
      const localResult = client.client.localQueryResult(queryName, resolvedArgs);
      if (localResult !== undefined) {
        setState("data", reconcile(localResult as FunctionReturnType<Query>));
        setState("isLoading", false);
      }
    } catch {
      // localQueryResult may throw if not available; ignore
    }

    const entry: CacheEntry = {
      store,
      setState,
      count: 1,
      unsub: () => unsub.unsubscribe(),
      retainTimer: undefined,
    };
    cache.set(key, entry);
  }

  function unsubscribeFromKey() {
    if (currentKey === undefined) return;
    const entry = cache.get(currentKey);
    if (!entry) {
      currentKey = undefined;
      return;
    }
    entry.count--;
    if (entry.count <= 0) {
      const keyToClean = currentKey;
      entry.retainTimer = setTimeout(() => {
        const e = cache.get(keyToClean);
        if (e && e.count <= 0) {
          e.unsub();
          cache.delete(keyToClean);
        }
      }, RETAIN_MS);
    }
    currentKey = undefined;
  }

  createEffect(
    on(
      [getArgs, getEnabled, reloadKey],
      ([resolvedArgs, enabled]) => {
        if (!enabled) {
          unsubscribeFromKey();
          setState("data", options?.initialData);
          setState("error", undefined);
          setState("isLoading", false);
          setState("isStale", false);
          return;
        }
        subscribe(resolvedArgs);
      },
    ),
  );

  onCleanup(() => {
    unsubscribeFromKey();
  });

  return store;
}

// ---------------------------------------------------------------------------
// useMutation
// ---------------------------------------------------------------------------

interface MutationState<T> {
  mutate: (args: any) => Promise<T>;
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
  reset: () => void;
}

function useMutation<Mutation extends FunctionReference<"mutation">>(
  mutation: Mutation,
): Store<MutationState<FunctionReturnType<Mutation>>> {
  const ctx = useConvexContext();
  if (!ctx) {
    throw new Error("useMutation must be used within a ConvexProvider");
  }
  const { client } = ctx;

  const [store, setState] = createStore<MutationState<FunctionReturnType<Mutation>>>({
    mutate: async (args: FunctionArgs<Mutation>) => {
      setState("isLoading", true);
      setState("error", undefined);
      try {
        const result = await client.mutation(mutation, args);
        setState("data", reconcile(result) as any);
        setState("isLoading", false);
        return result;
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        setState("error", error);
        setState("isLoading", false);
        throw error;
      }
    },
    data: undefined,
    error: undefined,
    isLoading: false,
    reset: () => {
      setState("data", undefined);
      setState("error", undefined);
      setState("isLoading", false);
    },
  });

  return store;
}

// ---------------------------------------------------------------------------
// useAction
// ---------------------------------------------------------------------------

interface ActionState<T> {
  mutate: (args: any) => Promise<T>;
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
  reset: () => void;
}

function useAction<Action extends FunctionReference<"action">>(
  action: Action,
): Store<ActionState<FunctionReturnType<Action>>> {
  const ctx = useConvexContext();
  if (!ctx) {
    throw new Error("useAction must be used within a ConvexProvider");
  }
  const { client } = ctx;

  const [store, setState] = createStore<ActionState<FunctionReturnType<Action>>>({
    mutate: async (args: FunctionArgs<Action>) => {
      setState("isLoading", true);
      setState("error", undefined);
      try {
        const result = await client.action(action, args);
        setState("data", reconcile(result) as any);
        setState("isLoading", false);
        return result;
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        setState("error", error);
        setState("isLoading", false);
        throw error;
      }
    },
    data: undefined,
    error: undefined,
    isLoading: false,
    reset: () => {
      setState("data", undefined);
      setState("error", undefined);
      setState("isLoading", false);
    },
  });

  return store;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  ConvexProvider,
  useConvexClient,
  useQuery,
  useMutation,
  useAction,
};

export type { QueryState, UseQueryOptions, MutationState, ActionState };
