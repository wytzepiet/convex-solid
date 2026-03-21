import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
  }).index("by_name", ["name"]),

  posts: defineTable({
    title: v.string(),
    body: v.string(),
    authorId: v.id("users"),
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),

  comments: defineTable({
    postId: v.id("posts"),
    body: v.string(),
    authorId: v.id("users"),
    createdAt: v.number(),
  }).index("by_postId", ["postId"]),
});
