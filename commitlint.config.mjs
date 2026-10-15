const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "header-max-length": [2, "always", 72],
    "subject-case": [2, "always", "lower-case"],
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "chore",
        "docs",
        "refactor",
        "style",
        "test",
        "perf",
        "build",
        "ci",
        "revert",
      ],
    ],
    "scope-enum": [
      2,
      "always",
      [
        "marketing",
        "search",
        "ai",
        "swipe",
        "projects",
        "library",
        "export",
        "group",
        "ranking",
        "a11y",
        "design",
        "db",
        "infra",
        "deps",
        "contracts",
        "release",
        "checklist",
      ],
    ],
  },
};

export default config;
