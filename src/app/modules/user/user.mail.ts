import config from "../../../config/index.js";
import { PASSWORD_RESET_TEMPLATE } from "../../../utils/Template.js";

export const OtpEmailTemplate = (otp: string) => PASSWORD_RESET_TEMPLATE(otp);

export const WelcomeEmailTemplate = (name: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${config.site_name || "E-Commerce"}</title>
  <style>
      body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f4f4f7; margin: 0; padding: 0; }
      .container { max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
      .header { background: linear-gradient(135deg, #3B82F6, #60A5FA, #93C5FD); padding: 32px; text-align: center; }
      .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
      .body { padding: 32px; text-align: center; }
      .body p { color: #555; font-size: 15px; line-height: 1.6; margin: 8px 0; }
      .footer { text-align: center; padding: 20px 32px; background: #fafafa; color: #999; font-size: 12px; }
  </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to ${config.site_name || "E-Commerce"}!</h1>
        </div>
        <div class="body">
            <p>Hi ${name},</p>
            <p>Thank you for joining us! Your account has been created successfully.</p>
            <p>If you have any questions, feel free to reach out to our support team.</p>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${config.site_name || "E-Commerce"}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`;
