# convex-solid

SolidJS bindings for [Convex](https://convex.dev). Brings real-time queries, mutations, and actions to Solid with fine-grained reactivity via Solid stores.

## Features

- **Real-time queries** — subscribe to Convex queries with automatic updates
- **Fine-grained reactivity** — uses `createStore` + `reconcile` so only changed data triggers re-renders
- **Query deduplication** — multiple components subscribing to the same query share one subscription
- **Stale-while-revalidate** — optionally keep showing previous data while new args load
- **30-second cache retention** — unmounted queries stay alive briefly so remounting is instant
- **SSR-safe** — works with SolidStart out of the box
- **Full TypeScript** — return types are inferred from your Convex function references

## Installation

```bash
npm install convex-solid convex solid-js @solid-primitives/context
```

## Quick start

### 1. Wrap your app with `ConvexProvider`

```tsx
import { ConvexProvider } from "convex-solid";

function App() {
  return (
    <ConvexProvider url="https://your-deployment.convex.cloud">
      <MyApp />
    </ConvexProvider>
  );
}
```

### 2. Query data with `useQuery`

```tsx
import { useQuery } from "convex-solid";
import { api } from "../convex/_generated/api";
import { Show, For } from "solid-js";

function PostList() {
  const posts = useQuery(api.posts.list);

  return (
    <>
      <Show when={posts.isLoading}>
        <p>Loading...</p>
      </Show>
      <For each={posts.data}>
        {(post) => <div>{post.title}</div>}
      </For>
    </>
  );
}
```

### 3. Run mutations with `useMutation`

```tsx
import { useMutation } from "convex-solid";
import { api } from "../convex/_generated/api";

function CreatePost() {
  const createPost = useMutation(api.posts.create);

  const handleClick = async () => {
    await createPost.mutate({ title: "Hello", body: "World" });
  };

  return (
    <button onClick={handleClick} disabled={createPost.isLoading}>
      Create Post
    </button>
  );
}
```

## API

### `ConvexProvider`

Wraps your app and provides the Convex client to all hooks.

```tsx
<ConvexProvider url={string}>
  {children}
</ConvexProvider>
```

On the server (`isServer`), the client is created in disabled mode — no WebSocket connections are opened during SSR.

### `useConvexClient()`

Returns the underlying `ConvexClient` instance for advanced use cases.

```tsx
const client = useConvexClient();
```

### `useQuery(query, args?, options?)`

Subscribes to a Convex query and returns a reactive store.

```tsx
const result = useQuery(api.posts.list);
// or with args:
const result = useQuery(api.posts.get, () => ({ id: postId() }));
```

**Returns:** `Store<QueryState<T>>`

| Property    | Type              | Description                              |
|-------------|-------------------|------------------------------------------|
| `data`      | `T \| undefined`  | The query result                         |
| `error`     | `Error \| undefined` | Error if the query failed             |
| `isLoading` | `boolean`         | `true` while waiting for the first result |
| `isStale`   | `boolean`         | `true` when showing previous data after args changed |

**Options:**

| Option             | Type                      | Description                                           |
|--------------------|---------------------------|-------------------------------------------------------|
| `enabled`          | `MaybeAccessor<boolean>`  | Disable/enable the subscription reactively            |
| `initialData`      | `T`                       | Data to show before the first result arrives          |
| `keepPreviousData` | `boolean`                 | Keep showing old data when args change (sets `isStale`) |

**Reactive args:** Pass an accessor to re-subscribe when args change:

```tsx
const post = useQuery(api.posts.get, () => ({ id: selectedId() }));
```

**Conditional queries:** Use the `enabled` option:

```tsx
const post = useQuery(api.posts.get, () => ({ id: id() }), {
  enabled: () => id() !== undefined,
});
```

### `useMutation(mutation)`

Returns a store for executing a Convex mutation.

```tsx
const createPost = useMutation(api.posts.create);
await createPost.mutate({ title: "Hello", body: "World" });
```

**Returns:** `Store<MutationState<T>>`

| Property    | Type                          | Description                          |
|-------------|-------------------------------|--------------------------------------|
| `mutate`    | `(args) => Promise<T>`        | Call the mutation                    |
| `data`      | `T \| undefined`              | Result of the last successful call   |
| `error`     | `Error \| undefined`          | Error from the last failed call      |
| `isLoading` | `boolean`                     | `true` while the mutation is running |
| `reset`     | `() => void`                  | Clear `data` and `error`             |

### `useAction(action)`

Same API as `useMutation`, but for Convex actions.

```tsx
const sendEmail = useAction(api.emails.send);
await sendEmail.mutate({ to: "alice@example.com", body: "Hi!" });
```

## Caching behavior

**Deduplication:** Multiple components calling `useQuery` with the same query + args share a single WebSocket subscription and store.

**Retain on unmount:** When the last subscriber unmounts, the subscription stays alive for 30 seconds. If a component remounts within that window, it gets the cached data instantly with no loading flash.

**Stale-while-revalidate:** When args change and `keepPreviousData: true`, the store keeps showing the old data with `isStale: true` until the new result arrives.

## SSR

`ConvexProvider` creates the client with `{ disabled: true }` on the server. `useQuery` returns a static store during SSR:

- If `initialData` is provided: `{ data: initialData, isLoading: false }`
- Otherwise: `{ data: undefined, isLoading: true }`

This ensures hydration matches — the client starts in the same loading state.

## License

MIT
