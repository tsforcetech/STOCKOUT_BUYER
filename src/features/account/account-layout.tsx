import { Outlet } from "react-router";

/** Account area inside the public site: grey canvas like the console, centred column. */
export default function AccountLayout() {
  return (
    <div className="bg-surface-muted">
      <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:py-10">
        <Outlet />
      </div>
    </div>
  );
}
