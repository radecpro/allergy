# E2E Testing Rules

- Use `getByRole`, `getByLabel`, and `getByText` as primary locators.
- Fall back to `getByTestId` only when accessibility attributes are ambiguous.
- Never use CSS selectors, XPath, or DOM structure for locating elements.
- Each test must be independently runnable with its own setup, actions, and assertions.
- Never use `page.waitForTimeout()`. Wait for specific UI state, URL changes, or responses.
- Assert the business outcome, not implementation details.
- Use unique identifiers for created data and clean up in the same test when persistence is involved.
- Use `storageState` for authentication. Do not log in through the UI inside individual tests.
