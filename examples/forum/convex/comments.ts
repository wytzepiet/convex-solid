import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_postId", (q) => q.eq("postId", args.postId))
      .order("asc")
      .take(100);
    return await Promise.all(
      comments.map(async (comment) => {
        const author = await ctx.db.get(comment.authorId);
        return { ...comment, authorName: author?.name ?? "Unknown" };
      }),
    );
  },
});

export const create = mutation({
  args: {
    postId: v.id("posts"),
    body: v.string(),
    authorId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("comments", {
      postId: args.postId,
      body: args.body,
      authorId: args.authorId,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("comments") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
