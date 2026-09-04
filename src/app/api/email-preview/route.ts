import { NextResponse } from "next/server";
import {
  buildAnnouncementEmail,
  buildRegistrationEmail,
  buildSponsorshipEmail,
  sendEmail,
} from "@/lib/email";
import { markdownToEmailHtml } from "@/lib/markdown-email";

export const runtime = "nodejs";

// Dev-only: preview or test-send the confirmation emails.
//   Preview in browser:  /api/email-preview?type=registration
//   Real test send:      /api/email-preview?type=registration&send=you@example.com
// Types: registration (default), sponsorship, announcement.
// The test send goes straight through SendGrid, independent of Airtable.
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const params = new URL(request.url).searchParams;
  const type = params.get("type") ?? "registration";
  const sendTo = params.get("send");

  // buildRegistrationEmail now returns one message per recipient — preview the
  // teacher's copy (the one that carries the activation link).
  const email =
    type === "announcement"
      ? buildAnnouncementEmail({
          title: "Zonal finals venue has changed",
          bodyHtml: markdownToEmailHtml(
            [
              "The **Sagamu** zonal centre has moved to the Town Hall, off Akarigbo Road.",
              "",
              "What this means for your school:",
              "",
              "- Arrive by 8:30 a.m. — accreditation closes at 9:00",
              "- Bring the two printed consent forms per representative",
              "- Transport reimbursement is unchanged",
              "",
              "## Questions",
              "",
              "Reply to this email or reach us at [hello@adewaleconference.org](mailto:hello@adewaleconference.org).",
            ].join("\n"),
          ),
          announcementPath: "/portal/announcements/preview",
          editionYear: 2026,
          targetRole: "all",
          sentAt: new Date(),
          inlineNames: ["revised-directions.pdf"],
          linkOnlyNames: ["centre-map-hi-res.png"],
        })
      : type === "sponsorship"
        ? buildSponsorshipEmail({
            org: "Bluewave Industries Ltd",
            contact: "Adaeze Okafor",
            email: "adaeze@example.com",
            tier: "Gold - ₦5M",
          })
        : buildRegistrationEmail({
            schoolFullName: "Mayflower Secondary School",
            schoolLGA: "Ikenne",
            zonalFinalsLocation: "Sagamu",
            principalFullName: "Mrs. Folake Adeyemi",
            principalEmail: "principal@example.com",
            teacherFullName: "Mr. Tunde Bello",
            teacherEmail: "teacher@example.com",
          })[0];

  if (sendTo) {
    try {
      const accepted = await sendEmail({
        to: [{ email: sendTo }],
        subject: email.subject,
        html: email.html,
      });
      return NextResponse.json({ sentTo: sendTo, accepted });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Send failed." },
        { status: 500 },
      );
    }
  }

  return new NextResponse(email.html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
