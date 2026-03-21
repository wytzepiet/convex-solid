import { MetaProvider, Title } from "@solidjs/meta";
import { A, Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import {
  type Accessor,
  type JSX,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  For,
  Suspense,
  useContext,
} from "solid-js";
import { ConvexProvider, useQuery, useMutation } from "convex-solid";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import "./app.css";

// ---------------------------------------------------------------------------
// Account context — picks a user from the DB
// ---------------------------------------------------------------------------

const AccountContext = createContext<{
  userId: () => Id<"users"> | undefined;
  userName: () => string;
  setUserId: (id: Id<"users">) => void;
}>();

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used within App");
  return ctx;
}

// ---------------------------------------------------------------------------
// Nav-bar widgets
// ---------------------------------------------------------------------------

function AccountSwitcher() {
  const { userId, setUserId } = useAccount();
  const users = useQuery(api.users.list);

  return (
    <div class="account-switcher">
      <For each={users.data}>
        {(user) => (
          <button
            class={userId() === user._id ? "active" : ""}
            onClick={() => setUserId(user._id)}
          >
            {user.name}
          </button>
        )}
      </For>
    </div>
  );
}

function SeedButton() {
  const seedDb = useMutation(api.seed.reset);

  return (
    <button
      class="seed-btn"
      disabled={seedDb.isLoading}
      onClick={() => seedDb.mutate({})}
    >
      {seedDb.isLoading ? "Resetting..." : "Reset & Seed DB"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// App shell
// ---------------------------------------------------------------------------

export default function App() {
  const [userId, setUserId] = createSignal<Id<"users"> | undefined>(undefined);

  return (
    <Router
      root={(props) => (
        <MetaProvider>
          <ConvexProvider url={import.meta.env.VITE_CONVEX_URL}>
            <AccountContextInner userId={userId} setUserId={setUserId}>
              <Title>Forum</Title>
              <nav>
                <div class="nav-links">
                  <A href="/">Home</A>
                  <A href="/posts/new">New Post</A>
                </div>
                <div class="nav-right">
                  <SeedButton />
                  <AccountSwitcher />
                </div>
              </nav>
              <Suspense>{props.children}</Suspense>
            </AccountContextInner>
          </ConvexProvider>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}

// ---------------------------------------------------------------------------
// Inner component — inside ConvexProvider, auto-selects first user
// ---------------------------------------------------------------------------

function AccountContextInner(props: {
  userId: Accessor<Id<"users"> | undefined>;
  setUserId: (id: Id<"users">) => void;
  children: JSX.Element;
}) {
  const users = useQuery(api.users.list);

  createEffect(() => {
    if (!props.userId() && users.data && users.data.length > 0) {
      props.setUserId(users.data[0]._id);
    }
  });

  const userName = createMemo(() => {
    const id = props.userId();
    if (!id || !users.data) return "—";
    const user = users.data.find((u) => u._id === id);
    return user?.name ?? "—";
  });

  return (
    <AccountContext.Provider
      value={{
        userId: props.userId,
        userName,
        setUserId: props.setUserId,
      }}
    >
      {props.children}
    </AccountContext.Provider>
  );
}
