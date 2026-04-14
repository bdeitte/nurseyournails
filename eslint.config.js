import css from "@eslint/css";

export default [
  {
    files: ["public/assets/css/**/*.css"],
    plugins: { css },
    language: "css/css",
    rules: {
      "css/use-baseline": ["error", { available: "widely" }],
    },
  },
];
