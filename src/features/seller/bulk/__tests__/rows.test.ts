import { describe, expect, it } from "vitest";
import type { ListingRequirementsResponse } from "@/api/types/seller-listings";
import { createCategoryMatcher, readSheet, validateRow, MAX_BULK_ROWS, BULK_COLUMNS, type BulkContext, type BulkRecord, type RequirementsState } from "../rows";
import { buildTemplateCsv } from "../template";

const categories = [
  { categoryId: "c-elec", path: ["Electrical"] },
  { categoryId: "c-switch", path: ["Electrical", "Switchgear"] },
  { categoryId: "c-cables", path: ["Electrical", "Cables"] },
  { categoryId: "c-steel", path: ["Construction", "Steel"] },
  { categoryId: "c-cables2", path: ["Networking", "Cables"] },
];

const requirements: ListingRequirementsResponse = {
  categoryId: "c-switch",
  attributes: [],
  brands: [],
  unitRules: {
    categoryId: "c-switch",
    defaultUnitId: "u-pcs",
    units: [
      { unitId: "u-pcs", code: "PCS", name: "Pieces", symbol: "pcs", unitType: "COUNT", minQuantity: null, maxQuantity: null, quantityDecimalPrecision: 0, isInherited: false, sourceCategoryId: "c-switch" },
      { unitId: "u-kg", code: "KG", name: "Kilogram", symbol: "kg", unitType: "MASS", minQuantity: null, maxQuantity: null, quantityDecimalPrecision: 2, isInherited: false, sourceCategoryId: "c-switch" },
    ],
  },
  conditionRules: {
    categoryId: "c-switch",
    isConditionRequired: true,
    conditions: [
      { conditionId: "k-new", code: "NEW", name: "New", isInherited: false, isGradeRequired: false, grades: [] },
      { conditionId: "k-used", code: "USED", name: "Used", isInherited: false, isGradeRequired: true, grades: [] },
    ],
  },
};

function file(name: string, type: string, size = 1000): File {
  return new File([new Uint8Array(size)], name, { type });
}

function ctx(overrides: Partial<BulkContext> = {}): BulkContext {
  return {
    matchCategory: createCategoryMatcher(categories),
    requirements: (): RequirementsState => ({ state: "ready", data: requirements }),
    images: new Map([["photo.jpg", file("photo.jpg", "image/jpeg")]]),
    defaultCurrency: "AED",
    ...overrides,
  };
}

function record(values: Partial<BulkRecord["values"]>): BulkRecord {
  const base = Object.fromEntries(BULK_COLUMNS.map((c) => [c, ""])) as BulkRecord["values"];
  return { id: "r1", line: 2, values: { ...base, title: "Contactors", category: "Electrical > Switchgear", price: "100", quantity: "5", ...values } };
}

describe("createCategoryMatcher", () => {
  const match = createCategoryMatcher(categories);
  it("matches a unique name case-insensitively", () => {
    expect(match("switchgear")).toEqual({ ok: true, value: categories[1] });
  });
  it("matches a full path with flexible spacing and › separators", () => {
    expect(match("electrical>  SWITCHGEAR")).toMatchObject({ ok: true, value: { categoryId: "c-switch" } });
    expect(match("Electrical › Cables")).toMatchObject({ ok: true, value: { categoryId: "c-cables" } });
  });
  it("prefers an exact top-level match over deeper paths", () => {
    expect(match("Electrical")).toMatchObject({ ok: true, value: { categoryId: "c-elec" } });
  });
  it("rejects ambiguous names and asks for the full path", () => {
    const res = match("Cables");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/matches 2 categories.*Electrical > Cables.*Networking > Cables.*full path/);
  });
  it("rejects unknown categories", () => {
    expect(match("Furniture").ok).toBe(false);
  });
});

describe("validateRow", () => {
  it("builds the create body for a valid row", () => {
    const res = validateRow(record({ description: " Boxed ", currency: "usd", unit: "kg", quantity: "12.5", condition: "new", emirate: "Dubai", city: "Jebel Ali", image_file: "PHOTO.JPG" }), ctx());
    expect(res.state).toBe("valid");
    expect(res.errors).toEqual([]);
    expect(res.quantity).toBe(12.5);
    expect(res.image?.name).toBe("photo.jpg");
    expect(res.draft).toEqual({
      categoryId: "c-switch",
      title: "Contactors",
      description: "Boxed",
      pricingMode: "FIXED_PRICE",
      currency: "USD",
      basePrice: 100,
      brandId: null,
      conditionId: "k-new",
      gradeId: null,
      quantityUnitId: "u-kg",
      location: { countryCode: "AE", stateOrEmirate: "Dubai", city: "Jebel Ali" },
      expiresAtUtc: null,
    });
  });

  it("uses the default currency and the category's default unit when empty", () => {
    const res = validateRow(record({ condition: "NEW" }), ctx());
    expect(res.draft).toMatchObject({ currency: "AED", quantityUnitId: "u-pcs", location: null, description: null });
  });

  it("accepts Excel-style thousands separators", () => {
    expect(validateRow(record({ price: "1,250.50", condition: "NEW" }), ctx()).draft?.basePrice).toBe(1250.5);
  });

  it("enforces title, price, currency and location rules", () => {
    const res = validateRow(record({ title: "x".repeat(256), price: "0", currency: "DIRHAM", emirate: "Dubai" }), ctx());
    expect(res.state).toBe("invalid");
    expect(res.errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/255 or fewer/),
        "Price must be above 0.",
        expect.stringMatching(/3-letter code/),
        "Fill in both emirate and city, or leave both empty.",
      ]),
    );
  });

  it("rejects bad numbers and too many price decimals", () => {
    expect(validateRow(record({ price: "abc" }), ctx()).errors[0]).toMatch(/isn't a valid number/);
    expect(validateRow(record({ price: "1.12345" }), ctx()).errors[0]).toMatch(/up to 4 decimals/);
    expect(validateRow(record({ quantity: "-1" }), ctx()).errors).toEqual(expect.arrayContaining([expect.stringMatching(/Quantity "-1"/)]));
  });

  it("respects the unit's decimal precision", () => {
    expect(validateRow(record({ quantity: "2.5", unit: "PCS" }), ctx()).errors).toContain("Quantity must be a whole number for Pieces (pcs).");
    expect(validateRow(record({ quantity: "2.125", unit: "kg" }), ctx()).errors).toContain("Quantity can have at most 2 decimals for Kilogram (kg).");
    expect(validateRow(record({ quantity: "0", unit: "pieces", condition: "New" }), ctx()).state).toBe("valid");
  });

  it("requires units and conditions offered for the category", () => {
    const res = validateRow(record({ unit: "litre", condition: "refurbished" }), ctx());
    expect(res.errors).toEqual([
      'Unit "litre" isn\'t offered for "Switchgear". Use one of: PCS, KG.',
      'Condition "refurbished" isn\'t offered for "Switchgear". Use one of: NEW, USED.',
    ]);
  });

  it("warns about conditions/grades needed for approval", () => {
    expect(validateRow(record({}), ctx()).warnings[0]).toMatch(/requires a condition/);
    expect(validateRow(record({ condition: "used" }), ctx()).warnings[0]).toMatch(/needs a grade/);
  });

  it("reports category problems", () => {
    expect(validateRow(record({ category: "" }), ctx()).errors).toContain("Enter a category.");
    expect(validateRow(record({ category: "Cables" }), ctx()).errors[0]).toMatch(/matches 2 categories/);
  });

  it("checks images: missing, wrong type and too large", () => {
    const images = new Map([
      ["doc.pdf", file("doc.pdf", "application/pdf")],
      ["big.png", file("big.png", "image/png", 10 * 1024 * 1024 + 1)],
    ]);
    expect(validateRow(record({ image_file: "nope.jpg" }), ctx({ images })).errors[0]).toMatch(/hasn't been added/);
    expect(validateRow(record({ image_file: "doc.pdf" }), ctx({ images })).errors[0]).toMatch(/must be \.jpg/);
    expect(validateRow(record({ image_file: "folder/big.png" }), ctx({ images })).errors[0]).toMatch(/larger than 10 MB/);
  });

  it("is 'checking' while the tree or requirements load, and invalid if requirements fail", () => {
    expect(validateRow(record({}), ctx({ matchCategory: null })).state).toBe("checking");
    expect(validateRow(record({}), ctx({ requirements: () => ({ state: "loading" }) })).state).toBe("checking");
    const failed = validateRow(record({}), ctx({ requirements: () => ({ state: "error", message: "boom" }) }));
    expect(failed.state).toBe("invalid");
    expect(failed.errors[0]).toMatch(/Couldn't load the units and conditions for "Switchgear": boom/);
  });
});

describe("readSheet", () => {
  it("maps headers case-insensitively, skips blank and # rows, records line numbers", () => {
    const csv = 'Title,Category,Price,Quantity,Image File,Notes\n# example,x,1,1,,\n\n"Bolts, M8",Steel,5,10,a.jpg,whatever\n';
    const sheet = readSheet(csv);
    expect(sheet.errors).toEqual([]);
    expect(sheet.warnings).toEqual(["Ignored unknown column: Notes."]);
    expect(sheet.records).toHaveLength(1);
    expect(sheet.records[0].line).toBe(4);
    expect(sheet.records[0].values).toMatchObject({ title: "Bolts, M8", category: "Steel", price: "5", quantity: "10", image_file: "a.jpg", unit: "" });
  });

  it("detects semicolon-separated files", () => {
    expect(readSheet("title;category;price;quantity\nA;B;1;2").records[0].values).toMatchObject({ title: "A", category: "B" });
  });

  it("reports missing required columns", () => {
    expect(readSheet("title,price\nA,1").errors[0]).toMatch(/Missing required columns: category, quantity/);
  });

  it("rejects files over the row limit", () => {
    const rows = Array.from({ length: MAX_BULK_ROWS + 1 }, (_, i) => `T${i},C,1,1`);
    expect(readSheet(["title,category,price,quantity", ...rows].join("\n")).errors[0]).toMatch(/201 listing rows.*limit is 200/);
  });

  it("reports a header-only file", () => {
    expect(readSheet("title,category,price,quantity\n").errors[0]).toMatch(/no listing rows/);
  });

  it("reads the generated template: correct header and only commented example rows", () => {
    const sheet = readSheet(buildTemplateCsv("Electrical > Switchgear"));
    expect(sheet.errors).toEqual(["The file has a header row but no listing rows (rows starting with # are ignored)."]);
    expect(sheet.warnings).toEqual([]);
  });
});
