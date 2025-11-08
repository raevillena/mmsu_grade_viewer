import { Resend } from "resend";

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

interface SendAccessCodeEmailParams {
  to: string;
  studentName: string;
  studentNumber: string;
  accessCode: string;
  subjectName: string;
  gradesUrl: string;
}

/**
 * Send access code email to student
 */
export async function sendAccessCodeEmail({
  to,
  studentName,
  studentNumber,
  accessCode,
  subjectName,
  gradesUrl,
}: SendAccessCodeEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error("[Email] RESEND_API_KEY not configured");
      return { success: false, error: "Email service not configured" };
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();
    if (!fromEmail || fromEmail === "undefined" || fromEmail === "") {
      console.error("[Email] RESEND_FROM_EMAIL not configured or invalid");
      return { 
        success: false, 
        error: "RESEND_FROM_EMAIL environment variable is required. Please set it in your .env.local file. For testing, use: onboarding@resend.dev" 
      };
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
      console.error("[Email] RESEND_FROM_EMAIL has invalid format:", fromEmail);
      return { 
        success: false, 
        error: `RESEND_FROM_EMAIL has invalid format: "${fromEmail}". Please use a valid email address like "noreply@yourdomain.com" or "onboarding@resend.dev" for testing.` 
      };
    }

    const appName = process.env.APP_NAME || "MMSU Grade Viewer";
    
    // Validate gradesUrl
    if (!gradesUrl || gradesUrl.includes("undefined")) {
      console.error("[Email] Invalid gradesUrl:", gradesUrl);
      return { 
        success: false, 
        error: `Invalid grades URL: "${gradesUrl}". Please set NEXT_PUBLIC_BASE_URL environment variable.` 
      };
    }
    
    console.log("[Email] Sending email:", {
      from: fromEmail,
      to,
      subjectName,
      appName,
      gradesUrl,
    });

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject: `Your Access Code for ${subjectName} - ${appName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Your Access Code</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">${appName}</h1>
            </div>
            
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
              <h2 style="color: #333; margin-top: 0;">Hello ${studentName},</h2>
              
              <p>Your access code for <strong>${subjectName}</strong> has been generated.</p>
              
              <div style="background: white; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Your Access Code:</p>
                <p style="margin: 0; font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 4px;">${accessCode}</p>
              </div>
              
              <p><strong>Student Number:</strong> ${studentNumber}</p>
              
              <div style="margin: 30px 0;">
                <a href="${gradesUrl}" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Your Grades</a>
              </div>
              
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                To view your grades, visit: <a href="${gradesUrl}" style="color: #667eea;">${gradesUrl}</a>
              </p>
              
              <p style="color: #666; font-size: 14px;">
                You will need to enter:
                <ul style="color: #666; font-size: 14px;">
                  <li>Your email: <strong>${to}</strong></li>
                  <li>Your student number: <strong>${studentNumber}</strong></li>
                  <li>Your access code: <strong>${accessCode}</strong></li>
                </ul>
              </p>
              
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
              
              <p style="color: #999; font-size: 12px; margin: 0;">
                This is an automated message. Please do not reply to this email.
              </p>
            </div>
          </body>
        </html>
      `,
      text: `
${appName}

Hello ${studentName},

Your access code for ${subjectName} has been generated.

Your Access Code: ${accessCode}
Student Number: ${studentNumber}

To view your grades, visit: ${gradesUrl}

You will need to enter:
- Your email: ${to}
- Your student number: ${studentNumber}
- Your access code: ${accessCode}

This is an automated message. Please do not reply to this email.
      `.trim(),
    });

    if (error) {
      console.error("[Email] Error sending email:", error);
      return { success: false, error: error.message || "Failed to send email" };
    }

    console.log("[Email] Email sent successfully:", data?.id);
    return { success: true };
  } catch (error) {
    console.error("[Email] Exception sending email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

