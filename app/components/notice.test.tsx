import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Notice } from "./notice";

describe("Notice", () => {
  it("preserves alert and status roles independently from visual tone", () => {
    const alertHtml = renderToStaticMarkup(
      <Notice role="alert" tone="error">
        Nie udało się zapisać.
      </Notice>,
    );
    const statusHtml = renderToStaticMarkup(
      <Notice role="status" tone="success">
        Zapisano.
      </Notice>,
    );

    expect(alertHtml).toContain('role="alert"');
    expect(alertHtml).toContain("Nie udało się zapisać.");
    expect(statusHtml).toContain('role="status"');
    expect(statusHtml).toContain("Zapisano.");
  });
});
