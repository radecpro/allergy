import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("renders disabled actions with native disabled semantics", () => {
    const html = renderToStaticMarkup(
      <Button disabled tone="danger">
        Usuwam...
      </Button>,
    );

    expect(html).toContain("disabled");
    expect(html).toContain("Usuwam...");
    expect(html).toContain("disabled:cursor-not-allowed");
  });
});
