import { describe, expect, it } from "vitest";

import { headers as detailHeaders } from "./history.$checkId";
import { headers as listHeaders } from "./history";

describe("history document cache headers", () => {
  it("forwards private no-store from list loader responses", () => {
    expect(
      listHeaders({
        loaderHeaders: new Headers({
          "Cache-Control": "private, no-store",
        }),
      } as never),
    ).toEqual({
      "Cache-Control": "private, no-store",
    });
  });

  it("forwards private no-store from detail error responses", () => {
    expect(
      detailHeaders({
        loaderHeaders: new Headers(),
        errorHeaders: new Headers({
          "Cache-Control": "private, no-store",
        }),
      } as never),
    ).toEqual({
      "Cache-Control": "private, no-store",
    });
  });
});
