import { describe, expect, it } from "vitest";
import { attributeDisplayValue } from "../lib/attribute-value";

describe("attributeDisplayValue", () => {
  it("formats padded numeric values from the API", () => {
    expect(attributeDisplayValue({ textValue: "9.0000", numValue: 9 })).toBe("9");
    expect(attributeDisplayValue({ textValue: "1.4400", numValue: null, numericValue: 1.44 })).toBe((1.44).toLocaleString());
    expect(attributeDisplayValue({ textValue: "1.4400", numValue: null })).toBe((1.44).toLocaleString());
  });

  it("keeps descriptive text as-is", () => {
    expect(attributeDisplayValue({ textValue: "60 × 60", numValue: null })).toBe("60 × 60");
    expect(attributeDisplayValue({ textValue: "8 mm", numValue: 8 })).toBe("8 mm");
  });

  it("returns null when there is no value", () => {
    expect(attributeDisplayValue({ textValue: null, numValue: null })).toBeNull();
    expect(attributeDisplayValue({ textValue: "  ", numValue: null })).toBeNull();
  });
});
