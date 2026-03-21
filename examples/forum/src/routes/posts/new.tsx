import { Title } from "@solidjs/meta";
import { A, useNavigate } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import { useMutation } from "convex-solid";
import { api } from "../../../convex/_generated/api";
import { useAccount } from "../../app";

export default function NewPost() {
  const navigate = useNavigate();
  const createPost = useMutation(api.posts.create);
  const { userId, userName } = useAccount();

  const [title, setTitle] = createSignal("");
  const [body, setBody] = createSignal("");

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const authorId = userId();
    if (!authorId) return;
    await createPost.mutate({
      title: title(),
      body: body(),
      authorId,
    });
    navigate("/");
  };

  return (
    <main>
      <Title>New Post</Title>
      <A href="/" class="back-link">
        &larr; Back
      </A>
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
          <button type="submit" disabled={createPost.isLoading}>
            {createPost.isLoading ? "Posting..." : "Create Post"}
          </button>
        </form>
      </Show>
    </main>
  );
}
