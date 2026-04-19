# Changelog

## 2.0.0-beta.1

Rewritten for Solid 2.0. The API is dramatically simplified — async is handled by Solid's `Loading` boundaries, and queries suspend until data arrives.

### Breaking changes

- **`useQuery` returns `Accessor<T>`** instead of `Store<QueryState<T>>`. Call `posts()` to get the value — it suspends if not ready. No more `.data`, `.isLoading`, `.error`.
- **`useMutation` / `useAction` return plain async functions** instead of `Store<MutationState<T>>`. Call `deletePost({ id })` directly — no more `.mutate()`, `.isLoading`, `.reset`.
- **Removed `@solid-primitives/context` peer dependency** — uses native Solid 2.0 context.
- **Removed `QueryState`, `MutationState`, `ActionState`, `UseQueryOptions` types**.
- **Removed query cache** — Convex client handles subscription dedup internally.
- **Requires `solid-js ^2.0.0-beta.4`**.

### How to migrate

```tsx
// Before (1.x)
const posts = useQuery(api.posts.list);
posts.data          // T | undefined
posts.isLoading     // boolean
<For each={posts.data}>{(post) => ...}</For>

const del = useMutation(api.posts.remove);
await del.mutate({ id });

// After (2.0)
const posts = useQuery(api.posts.list);
posts()             // T — suspends if not ready
<For each={posts()} keyed={(p) => p._id}>{(post) => ...}</For>

const del = useMutation(api.posts.remove);
await del({ id });
```

Use `<Loading>` / `<Errored>` boundaries for loading and error UI. Use `isPending()` for revalidation indicators.

## 1.0.0

Initial release.

- `ConvexProvider` — context provider with SSR support
- `useQuery` — reactive queries with deduplication, caching, and stale-while-revalidate
- `useMutation` — mutation wrapper with loading/error state
- `useAction` — action wrapper with loading/error state
- `useConvexClient` — direct access to the Convex client
