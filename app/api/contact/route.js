import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
    try {
        const body = await request.json();
        const { name, email, phone, company, message, formType, sqlRequired, teamSize } = body;

        // Validate required fields
        if (!email || !phone || !company || !name) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // Build the detail rows based on form type
        const isBookDemo = formType === "book-demo";
        const formLabel = isBookDemo ? "Book a Demo" : "Contact Form";

        const detailRows = [
            `<tr><td style="padding:12px 16px;font-weight:600;color:#334155;border-bottom:1px solid #f1f5f9;width:180px;">Full Name</td><td style="padding:12px 16px;color:#0f172a;border-bottom:1px solid #f1f5f9;">${name}</td></tr>`,
            `<tr><td style="padding:12px 16px;font-weight:600;color:#334155;border-bottom:1px solid #f1f5f9;">Email</td><td style="padding:12px 16px;color:#0f172a;border-bottom:1px solid #f1f5f9;"><a href="mailto:${email}" style="color:#6366f1;">${email}</a></td></tr>`,
            `<tr><td style="padding:12px 16px;font-weight:600;color:#334155;border-bottom:1px solid #f1f5f9;">Phone</td><td style="padding:12px 16px;color:#0f172a;border-bottom:1px solid #f1f5f9;"><a href="tel:${phone}" style="color:#6366f1;">${phone}</a></td></tr>`,
            `<tr><td style="padding:12px 16px;font-weight:600;color:#334155;border-bottom:1px solid #f1f5f9;">Company</td><td style="padding:12px 16px;color:#0f172a;border-bottom:1px solid #f1f5f9;">${company}</td></tr>`,
        ];

        if (isBookDemo && sqlRequired) {
            detailRows.push(`<tr><td style="padding:12px 16px;font-weight:600;color:#334155;border-bottom:1px solid #f1f5f9;">SQLs Required</td><td style="padding:12px 16px;color:#0f172a;border-bottom:1px solid #f1f5f9;">${sqlRequired}</td></tr>`);
        }
        if (isBookDemo && teamSize) {
            detailRows.push(`<tr><td style="padding:12px 16px;font-weight:600;color:#334155;border-bottom:1px solid #f1f5f9;">Sales Team Size</td><td style="padding:12px 16px;color:#0f172a;border-bottom:1px solid #f1f5f9;">${teamSize}</td></tr>`);
        }
        if (message) {
            detailRows.push(`<tr><td style="padding:12px 16px;font-weight:600;color:#334155;vertical-align:top;">Message</td><td style="padding:12px 16px;color:#0f172a;">${message}</td></tr>`);
        }

        // ── Email to the user (thank-you) ──────────────────────────
        const userSubject = isBookDemo
            ? "Your Demo Request is Confirmed – AltLeads"
            : "Thanks for Reaching Out – AltLeads";

        const userHtml = `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
            <div style="background:#0f2440;padding:32px 40px;border-radius:16px 16px 0 0;">
                <h1 style="color:#ffffff;font-size:24px;margin:0;">AltLeads</h1>
            </div>
            <div style="padding:40px;">
                <h2 style="color:#0f172a;font-size:22px;margin:0 0 16px;">Hi ${name},</h2>
                <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 24px;">
                    Thank you for connecting with us! We've received your ${isBookDemo ? "demo request" : "inquiry"} and our deployment team will get back to you within <strong>2 hours</strong>.
                </p>
                <div style="background:#f8fafc;border-radius:12px;padding:6px;margin-bottom:24px;">
                    <table style="width:100%;border-collapse:collapse;">
                        ${detailRows.join("")}
                    </table>
                </div>
                <p style="color:#475569;font-size:15px;line-height:1.7;">
                    In the meantime, feel free to explore our <a href="https://altleads.com/solutions/crm" style="color:#6366f1;text-decoration:none;font-weight:600;">CRM Solution</a> or <a href="https://altleads.com/solutions/data" style="color:#6366f1;text-decoration:none;font-weight:600;">Data Platform</a>.
                </p>
            </div>
            <div style="background:#f8fafc;padding:24px 40px;border-radius:0 0 16px 16px;text-align:center;">
                <p style="color:#94a3b8;font-size:12px;margin:0;">© ${new Date().getFullYear()} AltLeads by Amplior. All rights reserved.</p>
            </div>
        </div>`;

        // ── Internal notification email ────────────────────────────
        const internalSubject = `[${formLabel}] New submission from ${name} – ${company}`;

        const internalHtml = `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#0f2440;padding:24px 32px;border-radius:12px 12px 0 0;">
                <h2 style="color:#ffffff;font-size:18px;margin:0;">New ${formLabel} Submission</h2>
            </div>
            <div style="padding:24px 32px;background:#ffffff;">
                <table style="width:100%;border-collapse:collapse;">
                    ${detailRows.join("")}
                </table>
            </div>
            <div style="background:#f8fafc;padding:16px 32px;border-radius:0 0 12px 12px;">
                <p style="color:#94a3b8;font-size:12px;margin:0;">Submitted via altleads.com ${formLabel}</p>
            </div>
        </div>`;

        // ── Send user email ────────────────────────────────────────
        // TO: form filler | BCC: ankit.s@amplior.com
        // CC: contact@altleads.com (disabled for testing — uncomment for production)
        await resend.emails.send({
            from: "AltLeads <noreply@altleads.com>",
            to: [email],
            // cc: ["contact@altleads.com"],   // ← uncomment for production
            bcc: ["ankit.s@amplior.com"],
            subject: userSubject,
            html: userHtml,
        });

        // Internal team already receives via BCC on the user email above

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Email send error:", error);
        return NextResponse.json(
            { error: "Failed to send email" },
            { status: 500 }
        );
    }
}
