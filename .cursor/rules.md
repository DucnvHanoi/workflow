# Next.js Project Rules

# Tech Stack - refer to the packages.json

## Coding Standards - **Server First:** Default to React Server Components. Only use 'use client' if strictly necessary for hooks (useState, useEffect) or interactivity. - **Naming:** Use PascalCase for components (e.g., `UserButton.tsx`) and kebab-case for directories (e.g., `auth-hooks/`). - **Data Fetching:** Use async Server Components for data fetching. Use the `fetch` API with appropriate caching/revalidation tags. - **TypeScript:** No 'any' type. Use interfaces for component props and export them.

## Agent Behavior - **Concise:** Do not explain basic Next.js concepts. Just provide the code. - **No Placeholders:** Never leave "TODO" or "// rest of code here" comments. Complete the entire logic or ask for clarification. - **Security:** Always check for environment variables using a validation schema (like Zod) before usage.
