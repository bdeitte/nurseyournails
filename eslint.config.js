import css from "@eslint/css";

export default [
  {
    files: ["src/assets/css/**/*.css"],
    plugins: { css },
    language: "css/css",
    rules: {
      "css/use-baseline": ["error", { available: "widely" }],
    },
  },
];
