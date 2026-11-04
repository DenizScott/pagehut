import { beforeEach, describe, expect, it } from "vitest";
import { useStatus } from "./status";

describe("save status", () => {
  beforeEach(() => useStatus.setState({ save: "idle", pending: new Set(), failed: new Set() }));

  it("stays 'saving' until every saver has finished", () => {
    const s = useStatus.getState();
    s.markPending("title");
    s.markPending("content");
    s.markSaved("title");
    expect(useStatus.getState().save).toBe("saving");
    s.markSaved("content");
    expect(useStatus.getState().save).toBe("saved");
  });

  it("reports an error until the failing saver succeeds again", () => {
    const s = useStatus.getState();
    s.markPending("content");
    s.markFailed("content");
    expect(useStatus.getState().save).toBe("error");
    s.markPending("content");
    expect(useStatus.getState().save).toBe("error");
    s.markSaved("content");
    expect(useStatus.getState().save).toBe("saved");
  });
});
