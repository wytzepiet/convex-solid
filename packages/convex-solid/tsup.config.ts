import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.tsx"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  treeshake: true,
  esbuildOptions(options) {
    options.jsx = "preserve";
  },
  esbuildPlugins: [
    {
      name: "solid-jsx",
      setup(build) {
        build.onLoad({ filter: /\.tsx$/ }, async (args) => {
          const { readFile } = await import("fs/promises");
          const source = await readFile(args.path, "utf8");
          return {
            contents: source,
            loader: "tsx",
          };
        });
      },
    },
  ],
});
