import {
  createContext,
  useContext,
  createSignal,
  createEffect,
  createMemo,
  For,
  Show,
  Switch,
  Match,
  Loading,
  Errored,
} from "solid-js";
import { ConvexProvider, useQuery, useMutation } from "convex-solid";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import "./app.css";

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

type Page =
  | { view: "home" }
  | { view: "post"; postId: Id<"posts"> }
  | { view: "new" };

// ---------------------------------------------------------------------------
// Account context
// ---------------------------------------------------------------------------

const AccountContext = createContext<{
  userId: () => Id<"users"> | undefined;
  userName: () => string;
  setUserId: (id: Id<"users">) => void;
}>();

function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) {
    return {
      userId: () => undefined as Id<"users"> | undefined,
      userName: () => "—",
      setUserId: () => {},
    };
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// AccountSetup — inside ConvexProvider, auto-selects first user
// ---------------------------------------------------------------------------

function AccountSetup(props: {
  userId: () => Id<"users"> | undefined;
  setUserId: (id: Id<"users">) => void;
  children: any;
}) {
  const users = useQuery(api.users.list);

  createEffect(
    () => ({ id: props.userId(), users: users() }),
    ({ id, users }) => {
      if (!id && users && users.length > 0) {
        props.setUserId(users[0]._id);
      }
    },
  );

  const userName = createMemo(() => {
    const id = props.userId();
    const u = users();
    if (!id || !u) return "—";
    const user = u.find((x: any) => x._id === id);
    return user?.name ?? "—";
  });

  return (
    <AccountContext
      value={{
        userId: props.userId,
        userName,
        setUserId: props.setUserId,
      }}
    >
      {props.children}
    </AccountContext>
  );
}

// ---------------------------------------------------------------------------
// Nav-bar widgets
// ---------------------------------------------------------------------------

function AccountSwitcher() {
  const { userId, setUserId } = useAccount();
  const users = useQuery(api.users.list);

  return (
    <div class="account-switcher">
      <For each={users()} keyed={(u: any) => u._id}>
        {(user) => (
          <button
            class={userId() === user()._id ? "active" : ""}
            onClick={() => setUserId(user()._id)}
          >
            {user().name}
          </button>
        )}
      </For>
    </div>
  );
}

function SeedButton() {
  const seedDb = useMutation(api.seed.reset);
  const [seeding, setSeeding] = createSignal(false);

  const handleClick = async () => {
    setSeeding(true);
    try {
      await seedDb({});
    } finally {
      setSeeding(false);
    }
  };

  return (
    <button class="seed-btn" disabled={seeding()} onClick={handleClick}>
      {seeding() ? "Resetting..." : "Reset & Seed DB"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

function Home(props: { navigate: (page: Page) => void }) {
  const posts = useQuery(api.posts.list);
  const deletePost = useMutation(api.posts.remove);
  const { userId } = useAccount();

  return (
    <main>
      <h1>Forum</h1>

      <Show when={posts()?.length === 0}>
        <p>No posts yet. Be the first to create one!</p>
      </Show>

      <For each={posts()} keyed={(p: any) => p._id}>
        {(post) => (
          <div class="post-card">
            <div class="post-card-header">
              <h2>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    props.navigate({ view: "post", postId: post()._id });
                  }}
                >
                  {post().title}
                </a>
              </h2>
              <Show when={post().authorId === userId()}>
                <button
                  class="delete-btn"
                  onClick={() => deletePost({ id: post()._id })}
                >
                  Delete
                </button>
              </Show>
            </div>
            <p class="post-meta">
              by {post().authorName} &middot;{" "}
              {new Date(post().createdAt).toLocaleDateString()}
            </p>
          </div>
        )}
      </For>
    </main>
  );
}

function PostDetail(props: {
  postId: Id<"posts">;
  navigate: (page: Page) => void;
}) {
  const { userId, userName } = useAccount();
  const post = useQuery(api.posts.get, () => ({ id: props.postId }));
  const comments = useQuery(api.comments.list, () => ({
    postId: props.postId,
  }));
  const createComment = useMutation(api.comments.create);
  const deleteComment = useMutation(api.comments.remove);
  const deletePost = useMutation(api.posts.remove);

  const [commentBody, setCommentBody] = createSignal("");

  const handleComment = async (e: Event) => {
    e.preventDefault();
    const authorId = userId();
    if (!authorId) return;
    await createComment({
      postId: props.postId,
      body: commentBody(),
      authorId,
    });
    setCommentBody("");
  };

  const handleDeletePost = async () => {
    await deletePost({ id: props.postId });
    props.navigate({ view: "home" });
  };

  return (
    <main>
      <a
        href="#"
        class="back-link"
        onClick={(e) => {
          e.preventDefault();
          props.navigate({ view: "home" });
        }}
      >
        &larr; Back
      </a>

      <Show when={post()}>
        {(p) => (
          <>
            <div class="post-header">
              <h1>{p().title}</h1>
              <Show when={p().authorId === userId()}>
                <button class="delete-btn" onClick={handleDeletePost}>
                  Delete Post
                </button>
              </Show>
            </div>
            <p class="post-meta">
              by {p().authorName} &middot;{" "}
              {new Date(p().createdAt).toLocaleDateString()}
            </p>
            <div class="post-body">{p().body}</div>
          </>
        )}
      </Show>

      <Show when={post()}>
        <h2>Comments</h2>

        <Show when={comments()?.length === 0}>
          <p>No comments yet.</p>
        </Show>

        <For each={comments()} keyed={(c: any) => c._id}>
          {(comment) => (
            <div class="comment">
              <div class="comment-header">
                <p class="post-meta">
                  {comment().authorName} &middot;{" "}
                  {new Date(comment().createdAt).toLocaleDateString()}
                </p>
                <Show when={comment().authorId === userId()}>
                  <button
                    class="delete-btn small"
                    onClick={() => deleteComment({ id: comment()._id })}
                  >
                    Delete
                  </button>
                </Show>
              </div>
              <p>{comment().body}</p>
            </div>
          )}
        </For>

        <Show when={userId()}>
          <h3>Add a Comment</h3>
          <p class="post-meta">Commenting as {userName()}</p>
          <form onSubmit={handleComment}>
            <textarea
              placeholder="Write a comment..."
              value={commentBody()}
              onInput={(e) => setCommentBody(e.currentTarget.value)}
              required
            />
            <button type="submit">Add Comment</button>
          </form>
        </Show>
      </Show>
    </main>
  );
}

function NewPost(props: { navigate: (page: Page) => void }) {
  const createPost = useMutation(api.posts.create);
  const { userId, userName } = useAccount();

  const [title, setTitle] = createSignal("");
  const [body, setBody] = createSignal("");

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const authorId = userId();
    if (!authorId) return;
    await createPost({
      title: title(),
      body: body(),
      authorId,
    });
    props.navigate({ view: "home" });
  };

  return (
    <main>
      <a
        href="#"
        class="back-link"
        onClick={(e) => {
          e.preventDefault();
          props.navigate({ view: "home" });
        }}
      >
        &larr; Back
      </a>
      <h1>New Post</h1>

      <Show when={!userId()}>
        <p class="error">
          No users yet. Click "Reset & Seed DB" to create some.
        </p>
      </Show>

      <Show when={userId()}>
        <p class="post-meta">Posting as {userName()}</p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Title"
            value={title()}
            onInput={(e) => setTitle(e.currentTarget.value)}
            required
          />
          <textarea
            placeholder="Write your post..."
            value={body()}
            onInput={(e) => setBody(e.currentTarget.value)}
            required
          />
          <button type="submit">Create Post</button>
        </form>
      </Show>
    </main>
  );
}

// ---------------------------------------------------------------------------
// App shell
// ---------------------------------------------------------------------------

export default function App() {
  const [userId, setUserId] = createSignal<Id<"users"> | undefined>(undefined);
  const [page, setPage] = createSignal<Page>({ view: "home" });

  return (
    <ConvexProvider url={import.meta.env.VITE_CONVEX_URL!}>
      <Loading
        fallback={
          <p class="loading" style="padding: 2rem">
            Loading...
          </p>
        }
      >
        <Errored
          fallback={(err, reset) => (
            <main>
              <p class="error">Something went wrong: {String(err)}</p>
              <button onClick={reset}>Retry</button>
            </main>
          )}
        >
          <AccountSetup userId={userId} setUserId={setUserId}>
            <nav>
              <div class="nav-links">
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setPage({ view: "home" });
                  }}
                >
                  Home
                </a>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setPage({ view: "new" });
                  }}
                >
                  New Post
                </a>
              </div>
              <div class="nav-right">
                <SeedButton />
                <AccountSwitcher />
              </div>
            </nav>

            <Switch>
              <Match when={page().view === "home"}>
                <Home navigate={setPage} />
              </Match>
              <Match when={page().view === "new"}>
                <NewPost navigate={setPage} />
              </Match>
              <Match when={page().view === "post" && page()}>
                {(p) => (
                  <PostDetail
                    postId={
                      (p() as { view: "post"; postId: Id<"posts"> }).postId
                    }
                    navigate={setPage}
                  />
                )}
              </Match>
            </Switch>
          </AccountSetup>
        </Errored>
      </Loading>
    </ConvexProvider>
  );
}
