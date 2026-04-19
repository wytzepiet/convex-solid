# convex-solid

SolidJS 2.0 bindings for [Convex](https://convex.dev). Real-time queries that suspend, mutations that return promises, all with full TypeScript support.

## Installation

```bash
npm install convex-solid convex solid-js@next
```

> Requires `solid-js ^2.0.0-beta.4`. For Solid 1.x, use `convex-solid@1`.

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
import { For, Loading } from "solid-js";

function PostList() {
  const posts = useQuery(api.posts.list);

  return (
    <Loading fallback={<p>Loading...</p>}>
      <For each={posts()} keyed={(p) => p._id}>
        {(post) => <div>{post().title}</div>}
      </For>
    </Loading>
  );
}
```

`useQuery` returns an `Accessor<T>` that suspends until the first result arrives. Wrap it in a `<Loading>` boundary for fallback UI. The value updates in real-time as data changes on the server.

### 3. Run mutations

```tsx
import { useMutation } from "convex-solid";
import { api } from "../convex/_generated/api";

function CreatePost() {
  const createPost = useMutation(api.posts.create);

  const handleClick = () => {
    createPost({ title: "Hello", body: "World" });
  };

  return <button onClick={handleClick}>Create Post</button>;
}
```

`useMutation` and `useAction` return plain async functions.

---

## API

### `ConvexProvider`

Wraps your app and provides the Convex client to all hooks.

```tsx
<ConvexProvider url={string}>
  {children}
</ConvexProvider>
```

### `useConvexClient()`

Returns the underlying `ConvexClient` for advanced use cases.

```tsx
const client = useConvexClient();
```

### `useQuery(query, args?)`

Subscribes to a Convex query. Returns `Accessor<T>` that suspends until data is ready.

```tsx
const posts = useQuery(api.posts.list);
const post = useQuery(api.posts.get, () => ({ id: params.id }));
```

- **Suspends** until the first result — use `<Loading>` for fallback UI
- **Updates in real-time** as data changes on the server
- **Reactive args** — pass an accessor to re-subscribe when args change
- **Errors** propagate to `<Errored>` boundaries

#### Conditional queries

Use control flow to conditionally render components that use queries:

```tsx
<Show when={params.id}>
  {(id) => {
    const post = useQuery(api.posts.get, () => ({ id: id() }));
    return <PostDetail post={post()} />;
  }}
</Show>
```

#### Fine-grained reactivity for lists

For large lists, opt into store-level reconciliation with `createProjection`:

```tsx
import { createProjection } from "solid-js";

const posts = useQuery(api.posts.list);
const postsStore = createProjection(() => posts(), [], { key: "_id" });
```

### `useMutation(mutation)`

Returns an async function to call a Convex mutation.

```tsx
const createPost = useMutation(api.posts.create);
await createPost({ title: "Hello", body: "World" });
```

### `useAction(action)`

Returns an async function to call a Convex action.

```tsx
const sendEmail = useAction(api.emails.send);
await sendEmail({ to: "alice@example.com", body: "Hi!" });
```

## Loading and error UI

Solid 2.0 uses `<Loading>` and `<Errored>` boundaries:

```tsx
<Loading fallback={<Spinner />}>
  <Errored fallback={(err, reset) => <ErrorPage error={err} retry={reset} />}>
    <MyApp />
  </Errored>
</Loading>
```

For "stale while revalidating" indicators, use `isPending`:

```tsx
import { isPending } from "solid-js";

const posts = useQuery(api.posts.list);
const refreshing = () => isPending(posts);
```

## License

MIT
