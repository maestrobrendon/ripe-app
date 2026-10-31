import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // SQL injection guard. Prisma's query API and its tagged $queryRaw`...`
  // send every value separately from the SQL, so input can't become code.
  // These are the ways round that, so they fail the lint outright.
  {
    files: ["src/**/*.{ts,tsx}", "prisma/**/*.ts"],
    ignores: ["src/generated/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[property.name=/^\\$(queryRawUnsafe|executeRawUnsafe)$/]",
          message: "Unsafe raw SQL can be injected. Use the tagged form, prisma.$queryRaw`... ${value}`, which keeps values out of the SQL.",
        },
        {
          selector: "MemberExpression[object.name='Prisma'][property.name='raw']",
          message: "Prisma.raw pastes text straight into SQL. Pass values as ${value} in a tagged $queryRaw instead.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
