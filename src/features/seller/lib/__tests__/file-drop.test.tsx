import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ImagesIcon } from "@phosphor-icons/react";
import { describeAccept, matchesAccept } from "../file-drop";
import { DropZone } from "../../bulk/drop-zone";

const file = (name: string, type: string) => new File(["x"], name, { type });

describe("matchesAccept", () => {
  it("matches mime types, wildcards and extensions", () => {
    expect(matchesAccept(file("a.png", "image/png"), "image/jpeg,image/png")).toBe(true);
    expect(matchesAccept(file("a.pdf", "application/pdf"), "image/jpeg,image/png")).toBe(false);
    expect(matchesAccept(file("a.webp", "image/webp"), "image/*")).toBe(true);
    expect(matchesAccept(file("LIST.CSV", ""), ".csv,text/csv")).toBe(true);
    expect(describeAccept("image/jpeg,image/png,image/webp")).toBe("JPG, PNG, WEBP");
  });
});

describe("DropZone", () => {
  const drop = (el: HTMLElement, files: File[]) => {
    const dataTransfer = { files, types: ["Files"], dropEffect: "none" };
    fireEvent.dragEnter(el, { dataTransfer });
    fireEvent.dragOver(el, { dataTransfer });
    fireEvent.drop(el, { dataTransfer });
  };

  it("passes dropped files that match accept and skips the rest", () => {
    const onFiles = vi.fn();
    render(<DropZone id="z" label="Add photos" hint="JPG or PNG" accept="image/jpeg,image/png" multiple icon={ImagesIcon} buttonLabel="Choose photos" onFiles={onFiles} />);
    const zone = screen.getByText("Add photos").closest("div[class*='border-dashed']") as HTMLElement;
    drop(zone, [file("a.png", "image/png"), file("spec.pdf", "application/pdf"), file("b.jpg", "image/jpeg")]);
    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0]![0].map((f: File) => f.name)).toEqual(["a.png", "b.jpg"]);
  });

  it("shows a drop hint while dragging and keeps only one file when not multiple", () => {
    const onFiles = vi.fn();
    render(<DropZone id="z" label="Listings file (.csv)" hint="CSV" accept=".csv" icon={ImagesIcon} buttonLabel="Choose CSV" onFiles={onFiles} />);
    const zone = screen.getByText("Listings file (.csv)").closest("div[class*='border-dashed']") as HTMLElement;
    fireEvent.dragEnter(zone, { dataTransfer: { files: [], types: ["Files"] } });
    expect(screen.getByText("Drop to add file")).toBeInTheDocument();
    drop(zone, [file("a.csv", "text/csv"), file("b.csv", "text/csv")]);
    expect(onFiles.mock.calls[0]![0]).toHaveLength(1);
  });
});
