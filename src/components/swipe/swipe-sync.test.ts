import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classifyStatus, createSwipeSync, type SendResult, type SwipeOp } from "./swipe-sync";

/** A fake `send` whose calls stay pending until the test resolves them. */
function fakeSend() {
  const calls: { op: SwipeOp; resolve: (r: SendResult) => void; reject: (e: unknown) => void }[] =
    [];
  const send = vi.fn(
    (op: SwipeOp) =>
      new Promise<SendResult>((resolve, reject) => calls.push({ op, resolve, reject })),
  );
  return { send, calls };
}

const save = (paperId: string): SwipeOp => ({ paperId, decision: "save" });
const skip = (paperId: string): SwipeOp => ({ paperId, decision: "skip" });
const undo = (paperId: string): SwipeOp => ({ paperId, decision: null });

/** Let pending promise callbacks run. */
const tick = () => vi.advanceTimersByTimeAsync(0);

describe("classifyStatus", () => {
  it.each([
    [200, "ok"],
    [204, "ok"],
    [401, "unauthorised"],
    [400, "fail"],
    [403, "fail"],
    [404, "fail"],
    [408, "retry"],
    [429, "retry"],
    [500, "retry"],
    [503, "retry"],
  ] as const)("%i → %s", (status, expected) => {
    expect(classifyStatus(status)).toBe(expected);
  });
});

describe("createSwipeSync", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sends an op straight away", () => {
    const { send } = fakeSend();
    const sync = createSwipeSync({ send, onFailure: vi.fn() });
    sync.enqueue(save("a"));
    expect(send).toHaveBeenCalledExactlyOnceWith(save("a"));
  });

  it("runs different papers in parallel", () => {
    const { send } = fakeSend();
    const sync = createSwipeSync({ send, onFailure: vi.fn() });
    sync.enqueue(save("a"));
    sync.enqueue(skip("b"));
    expect(send.mock.calls.map(([op]) => op)).toEqual([save("a"), skip("b")]);
  });

  it("waits for the in-flight op on the same paper, then sends the next", async () => {
    const { send, calls } = fakeSend();
    const sync = createSwipeSync({ send, onFailure: vi.fn() });
    sync.enqueue(save("a"));
    sync.enqueue(undo("a"));
    expect(send).toHaveBeenCalledTimes(1);
    calls[0]!.resolve("ok");
    await tick();
    expect(send).toHaveBeenLastCalledWith(undo("a"));
  });

  it("collapses queued ops on one paper to the latest", async () => {
    const { send, calls } = fakeSend();
    const sync = createSwipeSync({ send, onFailure: vi.fn() });
    sync.enqueue(save("a"));
    sync.enqueue(undo("a"));
    sync.enqueue(skip("a"));
    calls[0]!.resolve("ok");
    await tick();
    calls[1]!.resolve("ok");
    await tick();
    expect(send.mock.calls.map(([op]) => op)).toEqual([save("a"), skip("a")]);
    expect(sync.pending()).toBe(0);
  });

  it("counts pending papers", async () => {
    const { send, calls } = fakeSend();
    const sync = createSwipeSync({ send, onFailure: vi.fn() });
    sync.enqueue(save("a"));
    sync.enqueue(save("b"));
    expect(sync.pending()).toBe(2);
    calls[0]!.resolve("ok");
    await tick();
    expect(sync.pending()).toBe(1);
  });

  it("retries transient failures with backoff, then succeeds quietly", async () => {
    const { send, calls } = fakeSend();
    const onFailure = vi.fn();
    const sync = createSwipeSync({ send, onFailure, retryDelaysMs: [1000, 3000] });
    sync.enqueue(save("a"));
    calls[0]!.resolve("retry");
    await vi.advanceTimersByTimeAsync(999);
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(2);
    calls[1]!.resolve("ok");
    await tick();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("reports a failure once retries run out", async () => {
    const { send, calls } = fakeSend();
    const onFailure = vi.fn();
    const sync = createSwipeSync({ send, onFailure, retryDelaysMs: [1000, 3000] });
    sync.enqueue(save("a"));
    calls[0]!.resolve("retry");
    await vi.advanceTimersByTimeAsync(1000);
    calls[1]!.resolve("retry");
    await vi.advanceTimersByTimeAsync(3000);
    calls[2]!.resolve("retry");
    await tick();
    expect(send).toHaveBeenCalledTimes(3);
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(save("a"), "retry");
    expect(sync.pending()).toBe(0);
  });

  it("treats a thrown send (network error) as transient", async () => {
    const { send, calls } = fakeSend();
    const onFailure = vi.fn();
    const sync = createSwipeSync({ send, onFailure, retryDelaysMs: [] });
    sync.enqueue(save("a"));
    calls[0]!.reject(new TypeError("Failed to fetch"));
    await tick();
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(save("a"), "retry");
  });

  it.each(["fail", "unauthorised"] as const)("does not retry %s", async (result) => {
    const { send, calls } = fakeSend();
    const onFailure = vi.fn();
    const sync = createSwipeSync({ send, onFailure });
    sync.enqueue(skip("a"));
    calls[0]!.resolve(result);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(send).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(skip("a"), result);
  });

  it("drops a retrying op when a newer one for the paper arrives", async () => {
    const { send, calls } = fakeSend();
    const onFailure = vi.fn();
    const sync = createSwipeSync({ send, onFailure, retryDelaysMs: [1000] });
    sync.enqueue(save("a"));
    calls[0]!.resolve("retry");
    await tick();
    sync.enqueue(undo("a"));
    await tick();
    expect(send).toHaveBeenLastCalledWith(undo("a"));
    calls[1]!.resolve("ok");
    await vi.advanceTimersByTimeAsync(5000);
    expect(send).toHaveBeenCalledTimes(2);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("does not report a stale failure when a newer op is queued", async () => {
    const { send, calls } = fakeSend();
    const onFailure = vi.fn();
    const sync = createSwipeSync({ send, onFailure });
    sync.enqueue(save("a"));
    sync.enqueue(skip("a"));
    calls[0]!.resolve("fail");
    await tick();
    expect(onFailure).not.toHaveBeenCalled();
    expect(send).toHaveBeenLastCalledWith(skip("a"));
  });

  it("survives an onFailure callback that throws", async () => {
    const { send, calls } = fakeSend();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const sync = createSwipeSync({
      send,
      onFailure: () => {
        throw new Error("boom");
      },
    });
    sync.enqueue(save("a"));
    calls[0]!.resolve("fail");
    await tick();
    sync.enqueue(save("a"));
    expect(send).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it("idle() resolves only once every write, including retries, has finished", async () => {
    const { send, calls } = fakeSend();
    const sync = createSwipeSync({ send, onFailure: vi.fn(), retryDelaysMs: [1000] });
    await expect(sync.idle()).resolves.toBeUndefined();
    sync.enqueue(save("a"));
    sync.enqueue(skip("b"));
    let done = false;
    void sync.idle().then(() => (done = true));
    calls[0]?.resolve("ok");
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(false);
    calls[1]?.resolve("retry");
    await vi.advanceTimersByTimeAsync(1000);
    expect(done).toBe(false);
    calls[2]?.resolve("ok");
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(true);
  });
});
