import { describe, expect, it } from "vitest";
import { isSameItem, sameItemQuery, titleTokens } from "../same-item";

describe("same item matching", () => {
  it("ignores bracketed notes and filler words", () => {
    expect(titleTokens("PPR Pipe PN20 25 mm x 4 m (Green)")).toEqual(["ppr", "pipe", "pn20", "25", "mm", "4", "m"]);
    expect(sameItemQuery("Hex Bolts M20 (Box of 50)")).toBe("Hex Bolts M20");
  });

  it("matches the same product and rejects other sizes or products", () => {
    expect(isSameItem("PPR Pipe PN20 25 mm x 4 m (Green)", "PPR Pipe PN20 25 mm x 4 m (Grey)")).toBe(true);
    expect(isSameItem("Hex Bolts M20 Grade 10.9 Galvanised (Box of 50)", "Hex Bolts M16 Grade 8.8 Galvanised (Box of 100)")).toBe(false);
    expect(isSameItem("PPR Pipe PN20 25 mm x 4 m", "Self-Drilling Screw 5.5x25 Hex Head")).toBe(false);
    expect(isSameItem("Portland Cement, 50 kg Bag", "OPC Cement 42.5N, 50 kg Bag")).toBe(true);
  });
});
