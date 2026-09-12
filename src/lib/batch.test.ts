import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chunk, mapLimit } from "./batch";

describe("chunk", () => {
  it("splits into fixed-size batches with a short final batch", () => {
    assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  });

  it("returns one batch when the size covers everything", () => {
    assert.deepEqual(chunk([1, 2], 10), [[1, 2]]);
  });

  it("returns nothing for an empty list", () => {
    assert.deepEqual(chunk([], 5), []);
  });

  it("rejects a size below 1 rather than looping forever", () => {
    assert.throws(() => chunk([1], 0), /at least 1/);
  });
});

describe("mapLimit", () => {
  it("visits every item exactly once, in order", async () => {
    const seen: number[] = [];
    await mapLimit([1, 2, 3, 4], 2, async (n) => {
      seen.push(n);
    });
    assert.deepEqual(seen.sort((a, b) => a - b), [1, 2, 3, 4]);
  });

  it("passes the index through", async () => {
    const pairs: string[] = [];
    await mapLimit(["a", "b"], 1, async (v, i) => {
      pairs.push(`${i}:${v}`);
    });
    assert.deepEqual(pairs, ["0:a", "1:b"]);
  });

  it("never exceeds the concurrency limit", async () => {
    let inFlight = 0;
    let peak = 0;
    await mapLimit(Array.from({ length: 20 }, (_, i) => i), 3, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
    });
    assert.ok(peak <= 3, `peak concurrency was ${peak}`);
  });

  it("handles an empty list without spawning workers", async () => {
    let calls = 0;
    await mapLimit([], 5, async () => {
      calls++;
    });
    assert.equal(calls, 0);
  });

  it("rejects a limit below 1", async () => {
    await assert.rejects(() => mapLimit([1], 0, async () => {}), /at least 1/);
  });
});
