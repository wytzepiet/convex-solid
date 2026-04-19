import {
  type FunctionReference,
  type FunctionArgs,
  type FunctionReturnType,
} from "convex/server";
import { ConvexClient } from "convex/browser";
import {
  createContext,
  createEffect,
  useContext,
  createMemo,
  onCleanup,
  type Accessor,
  type JSX,
} from "solid-js";
// ---------------------------------------------------------------------------
// Utility types
// ---------------------------------------------------------------------------

export type MaybeAccessor<T> = T | Accessor<T>;

function resolve<T>(value: MaybeAccessor<T>): T {
  return typeof value === "function" ? (value as Accessor<T>)() : value;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ConvexContext = createContext<ConvexClient>();

function ConvexProvider(props: {
  url: string;
  fetchToken?: () => Promise<string | null>;
  disabled?: boolean;
  skipConvexDeploymentUrlCheck?: boolean;
  children?: JSX.Element;
}) {
  const client = new ConvexClient(props.url, {
    disabled: props.disabled,
    skipConvexDeploymentUrlCheck: props.skipConvexDeploymentUrlCheck,
  });

  createEffect(
    () => props.fetchToken,
    (fetchToken) => {
      if (fetchToken) {
        client.setAuth(
          async () => {
            const token = await fetchToken();
            return token ? { token } : null;
          },
          () => {},
        );
      } else {
        client.clearAuth();
      }
    },
  );

  onCleanup(() => client.close());

  return ConvexContext({ value: client, get children() { return props.children; } });
}

function useConvexClient(): ConvexClient {
  const client = useContext(ConvexContext);
  if (!client) {
    throw new Error("useConvexClient must be used within a ConvexProvider");
  }
  return client;
}

// ---------------------------------------------------------------------------
// useQuery
// ---------------------------------------------------------------------------

function useQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args?: MaybeAccessor<FunctionArgs<Query>>,
): Accessor<FunctionReturnType<Query>> {
  const client = useConvexClient();

  return createMemo(async function* () {
    const resolvedArgs =
      args !== undefined ? resolve(args) : ({} as FunctionArgs<Query>);

    let next!: (value: FunctionReturnType<Query>) => void;
    const { unsubscribe } = client.onUpdate(
      query,
      resolvedArgs,
      (v: FunctionReturnType<Query>) => next(v),
    );

    try {
      while (true) {
        yield await new Promise<FunctionReturnType<Query>>(
          (r) => (next = r),
        );
      }
    } finally {
      unsubscribe();
    }
  });
}

// ---------------------------------------------------------------------------
// useMutation
// ---------------------------------------------------------------------------

function useMutation<Mutation extends FunctionReference<"mutation">>(
  mutation: Mutation,
): (args: FunctionArgs<Mutation>) => Promise<FunctionReturnType<Mutation>> {
  const client = useConvexClient();
  return (args: FunctionArgs<Mutation>) => client.mutation(mutation, args);
}

// ---------------------------------------------------------------------------
// useAction
// ---------------------------------------------------------------------------

function useAction<Action extends FunctionReference<"action">>(
  action: Action,
): (args: FunctionArgs<Action>) => Promise<FunctionReturnType<Action>> {
  const client = useConvexClient();
  return (args: FunctionArgs<Action>) => client.action(action, args);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { ConvexProvider, useConvexClient, useQuery, useMutation, useAction };
