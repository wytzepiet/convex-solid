import { mutation } from "./_generated/server";

export const reset = mutation({
  args: {},
  handler: async (ctx) => {
    // Delete all comments
    const comments = await ctx.db.query("comments").take(500);
    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }

    // Delete all posts
    const posts = await ctx.db.query("posts").take(500);
    for (const post of posts) {
      await ctx.db.delete(post._id);
    }

    // Delete all users
    const users = await ctx.db.query("users").take(500);
    for (const user of users) {
      await ctx.db.delete(user._id);
    }

    // Seed users
    const alice = await ctx.db.insert("users", { name: "Alice" });
    const bob = await ctx.db.insert("users", { name: "Bob" });
    const charlie = await ctx.db.insert("users", { name: "Charlie" });

    // Seed posts
    const now = Date.now();

    const post1 = await ctx.db.insert("posts", {
      title: "Welcome to the Forum!",
      body: "This is a demo forum built with SolidJS and Convex, powered by the convex-solid integration library.\n\nFeel free to create posts, leave comments, and try switching between accounts using the account switcher in the nav bar.",
      authorId: alice,
      createdAt: now - 3600_000,
    });

    const post2 = await ctx.db.insert("posts", {
      title: "Tips for using Convex with SolidJS",
      body: "Here are some things I've learned:\n\n1. useQuery returns a store with .data, .isLoading, .error, and .isStale\n2. useMutation gives you a .mutate() function and tracks loading/error state\n3. Queries automatically re-subscribe when reactive args change\n4. The query cache deduplicates identical subscriptions across components",
      authorId: bob,
      createdAt: now - 1800_000,
    });

    const post3 = await ctx.db.insert("posts", {
      title: "What are you building?",
      body: "I'm curious what everyone is working on. Share your projects!",
      authorId: charlie,
      createdAt: now - 600_000,
    });

    // Seed comments
    await ctx.db.insert("comments", {
      postId: post1,
      body: "Great to see this up and running!",
      authorId: bob,
      createdAt: now - 3000_000,
    });

    await ctx.db.insert("comments", {
      postId: post1,
      body: "The real-time updates are really smooth.",
      authorId: charlie,
      createdAt: now - 2400_000,
    });

    await ctx.db.insert("comments", {
      postId: post2,
      body: "This is super helpful, thanks for sharing!",
      authorId: alice,
      createdAt: now - 1200_000,
    });

    await ctx.db.insert("comments", {
      postId: post3,
      body: "I'm building a real-time dashboard. Convex subscriptions make it easy.",
      authorId: alice,
      createdAt: now - 300_000,
    });

    await ctx.db.insert("comments", {
      postId: post3,
      body: "Working on a collaborative note-taking app!",
      authorId: bob,
      createdAt: now - 120_000,
    });
  },
});
