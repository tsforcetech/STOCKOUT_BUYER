import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithApp } from "@/test/render";
import { makeZip } from "@/test/zip";
import type { BulkImportRowPreviewDto } from "@/api/types/bulk-import";
import { RowPhotos } from "../row-photos";
import { rememberZip } from "../shared";

const orig = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
afterEach(() => {
  URL.createObjectURL = orig.create;
  URL.revokeObjectURL = orig.revoke;
});

const row = (over: Partial<BulkImportRowPreviewDto> = {}) =>
  ({
    rowId: "r1", rowNumber: 2, sellerSku: "ROW-0001", status: "VALID", title: "Soundproof Pipe 50mm – Wavin", categoryId: null, categoryCode: null, brandNameOrId: null, conditionNameOrId: null, gradeNameOrId: null,
    quantity: 158, unitNameOrId: null, price: 31.5, currency: "AED", pricingMode: null, description: null, location: null, matchedImageCount: 2,
    imageReferences: ["002_Pipe_01.jpg", "Shalom Inventory/002_Pipe_02.jpg"], errors: [], warnings: [], createdListingId: null, ...over,
  }) as unknown as BulkImportRowPreviewDto;
const at = (el: React.ReactNode) => renderWithApp([{ path: "/x", element: el }], "/x");

describe("View photos before import", () => {
  it("shows each matched photo from the seller's ZIP, the first as cover", async () => {
    URL.createObjectURL = vi.fn(() => `blob:${Math.random()}`);
    URL.revokeObjectURL = vi.fn();
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    rememberZip("job-1", new File([await makeZip([{ path: "002_Pipe_01.jpg", data: jpg }, { path: "Shalom Inventory/002_Pipe_02.JPG", data: jpg }])], "photos.zip"));
    at(<RowPhotos jobId="job-1" row={row()} />);
    await userEvent.click(screen.getByRole("button", { name: "View photos for row 2" }));
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByText(/2 photos matched/)).toBeInTheDocument();
    await waitFor(() => expect(within(dlg).getAllByRole("img")).toHaveLength(2));
    expect(within(dlg).getByText("Cover")).toBeInTheDocument();
    expect(within(dlg).queryByRole("button", { name: /Choose ZIP/ })).not.toBeInTheDocument();
  });

  it("after a reload asks for the ZIP again (nothing uploaded) and lists photos not found", async () => {
    at(
      <RowPhotos
        jobId="job-2"
        row={row({ matchedImageCount: 1, imageReferences: ["002_Pipe_01.jpg"], warnings: [{ code: "IMAGE_FILE_NOT_FOUND_IN_ZIP", field: "ImageReferences", message: "Explicit image reference 'Not found' was not found in the uploaded ZIP file" }] as never })}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "View photos for row 2" }));
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByText("002_Pipe_01.jpg")).toBeInTheDocument();
    expect(within(dlg).getByRole("button", { name: /Choose ZIP/ })).toBeInTheDocument();
    expect(within(dlg).getByText(/nothing is uploaded/)).toBeInTheDocument();
    expect(within(dlg).getByText(/'Not found' was not found/)).toBeInTheDocument();
  });

  it("a row without photos just shows 0", () => {
    at(<RowPhotos jobId="job-3" row={row({ matchedImageCount: 0, imageReferences: [] })} />);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
