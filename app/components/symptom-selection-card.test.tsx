import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SymptomSelectionCard } from "./symptom-selection-card";

describe("SymptomSelectionCard", () => {
  it("renders selected content and helper text through the shared card shell", () => {
    const selectedHtml = renderToStaticMarkup(
      <SymptomSelectionCard label="Kichanie" selected onChange={vi.fn()}>
        <p>Nasilenie</p>
      </SymptomSelectionCard>,
    );
    const unselectedHtml = renderToStaticMarkup(
      <SymptomSelectionCard
        label="Kaszel"
        selected={false}
        helper="Wybierz objaw"
        onChange={vi.fn()}
      />,
    );

    expect(selectedHtml).toContain("Kichanie");
    expect(selectedHtml).toContain("Nasilenie");
    expect(unselectedHtml).toContain("Kaszel");
    expect(unselectedHtml).toContain("Wybierz objaw");
  });
});
