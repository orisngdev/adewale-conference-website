import AccountSettings from "@/components/portal/account-settings";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Settings", "Manage your account.");
export const dynamic = "force-dynamic";

export default function SchoolSettings() {
  return (
    <div className="space-y-6">
      <AccountSettings />
    </div>
  );
}
