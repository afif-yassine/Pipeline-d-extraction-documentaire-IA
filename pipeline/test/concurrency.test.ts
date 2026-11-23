import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "../src/concurrency";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("mapWithConcurrency", () => {
  it("garde l'ordre des éléments même si les tâches finissent dans le désordre", async () => {
    const result = await mapWithConcurrency([30, 10, 20], 3, async (ms) => {
      await wait(ms);
      return ms;
    });
    expect(result).toEqual([30, 10, 20]);
  });

  it("ne dépasse jamais la limite de tâches en cours", async () => {
    let running = 0;
    let maxRunning = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 2, async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await wait(5);
      running--;
    });
    expect(maxRunning).toBe(2);
  });

  it("renvoie un tableau vide pour une liste vide", async () => {
    expect(await mapWithConcurrency([], 3, async (x: number) => x)).toEqual([]);
  });
});
