import { Title } from "@solidjs/meta";
import { A, useNavigate, useParams } from "@solidjs/router";
import { createSignal, For, Show } from "solid-js";
import { useQuery, useMutation } from "convex-solid";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAccount } from "../../app";

export default function PostDetail() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userId, userName } = useAccount();

  const post = useQuery(api.posts.get, () => ({
    id: params.id as Id<"posts">,
  }));

  const comments = useQuery(api.comments.list, () => ({
    postId: params.id as Id<"posts">,
  }));

  const createComment = useMutation(api.comments.create);
  const deleteComment = useMutation(api.comments.remove);
  const deletePost = useMutation(api.posts.remove);

  const [commentBody, setCommentBody] = createSignal("");

  const handleComment = async (e: Event) => {
    e.preventDefault();
    const authorId = userId();
    if (!authorId) return;
    await createComment.mutate({
      postId: params.id as Id<"posts">,
      body: commentBody(),
      authorId,
    });
    setCommentBody("");
  };

  const handleDeletePost = async () => {
    await deletePost.mutate({ id: params.id as Id<"posts"> });
    navigate("/");
  };

  return (
    <main>
      <A href="/" class="back-link">
        &larr; Back
      </A>

      <Show when={post.isLoading}>
        <p class="loading">Loading...</p>
      </Show>

      <Show when={post.error}>
        <p class="error">Error: {post.error?.message}</p>
      </Show>

      <Show when={post.data}>
        {(p) => (
          <>
            <Title>{p().title}</Title>
            <div class="post-header">
              <h1>{p().title}</h1>
              <Show when={p().authorId === userId()}>
                <button
                  class="delete-btn"
                  onClick={handleDeletePost}
                  disabled={deletePost.isLoading}
                >
                  {deletePost.isLoading ? "Deleting..." : "Delete Post"}
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

      <Show when={!post.isLoading && post.data}>
        <h2>Comments</h2>

        <Show when={comments.data?.length === 0}>
          <p>No comments yet.</p>
        </Show>

        <For each={comments.data}>
          {(comment) => (
            <div class="comment">
              <div class="comment-header">
                <p class="post-meta">
                  {comment.authorName} &middot;{" "}
                  {new Date(comment.createdAt).toLocaleDateString()}
                </p>
                <Show when={comment.authorId === userId()}>
                  <button
                    class="delete-btn small"
                    onClick={() =>
                      deleteComment.mutate({ id: comment._id })
                    }
                  >
                    Delete
                  </button>
                </Show>
              </div>
              <p>{comment.body}</p>
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
            <button type="submit" disabled={createComment.isLoading}>
              {createComment.isLoading ? "Posting..." : "Add Comment"}
            </button>
          </form>
        </Show>
      </Show>
    </main>
  );
}
