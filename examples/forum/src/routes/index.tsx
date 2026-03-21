import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { For, Show } from "solid-js";
import { useQuery, useMutation } from "convex-solid";
import { api } from "../../convex/_generated/api";
import { useAccount } from "../app";

export default function Home() {
  const posts = useQuery(api.posts.list);
  const deletePost = useMutation(api.posts.remove);
  const { userId } = useAccount();

  return (
    <main>
      <Title>Forum</Title>
      <h1>Forum</h1>

      <Show when={posts.isLoading}>
        <p class="loading">Loading posts...</p>
      </Show>

      <Show when={posts.error}>
        <p class="error">Error: {posts.error?.message}</p>
      </Show>

      <Show when={!posts.isLoading && posts.data?.length === 0}>
        <p>No posts yet. Be the first to create one!</p>
      </Show>

      <For each={posts.data}>
        {(post) => (
          <div class="post-card">
            <div class="post-card-header">
              <h2>
                <A href={`/posts/${post._id}`}>{post.title}</A>
              </h2>
              <Show when={post.authorId === userId()}>
                <button
                  class="delete-btn"
                  onClick={() => deletePost.mutate({ id: post._id })}
                >
                  Delete
                </button>
              </Show>
            </div>
            <p class="post-meta">
              by {post.authorName} &middot;{" "}
              {new Date(post.createdAt).toLocaleDateString()}
            </p>
          </div>
        )}
      </For>
    </main>
  );
}
