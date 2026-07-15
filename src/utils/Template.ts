import config from "../config/index.js";

export const LANDING_PAGE_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.site_name || "E-Commerce"} - Ordering & Payment API</title>
    <style>
        :root {
            --bg-color: #1A283A;
            --card-bg-dark: rgba(20, 35, 55, 0.95);
            --card-bg-light: rgba(30, 50, 75, 0.95);
            --text-primary: #f5f0ff;
            --text-secondary: #b8c5d6;
            --accent-primary: #3B82F6;
            --accent-secondary: #60A5FA;
            --accent-light: #93C5FD;
            --gradient-main: linear-gradient(135deg, #3B82F6, #60A5FA, #93C5FD);
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background-color: var(--bg-color);
            color: var(--text-primary);
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .stage { width: 100%; max-width: 600px; padding: 2rem; text-align: center; }
        h1 { font-size: 2.5rem; font-weight: 900; margin-bottom: 1rem; }
        .gtext { background: var(--gradient-main); -webkit-background-clip: text; background-clip: text; color: transparent; }
        p { color: var(--text-secondary); font-size: 1.1rem; line-height: 1.6; }
        .status-badge {
            display: inline-flex; align-items: center;
            padding: 0.5rem 1.2rem; margin-top: 1.5rem;
            background: rgba(40, 167, 69, 0.12);
            border: 1px solid rgba(40, 167, 69, 0.4);
            border-radius: 50px; color: #4cd964;
            font-size: 0.9rem; font-weight: 600;
        }
        .status-dot {
            width: 9px; height: 9px;
            background-color: #4cd964; border-radius: 50%;
            margin-right: 9px; box-shadow: 0 0 8px #4cd964;
            animation: blink 2s ease-in-out infinite;
        }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    </style>
</head>
<body>
    <main class="stage">
        <h1><span class="gtext">${config.site_name || "E-Commerce"}</span></h1>
        <p>E-commerce Ordering & Payment System API</p>
        <div class="status-badge">
            <span class="status-dot"></span>
            System Online
        </div>
    </main>
</body>
</html>
`;

export const PASSWORD_RESET_TEMPLATE = (otp: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset OTP</title>
    <style>
        body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f4f4f7; margin: 0; padding: 0; }
        .container { max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #3B82F6, #60A5FA, #93C5FD); padding: 32px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
        .body { padding: 32px; text-align: center; }
        .otp-code { display: inline-block; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #3B82F6; background: rgba(59,130,246,0.08); padding: 16px 32px; border-radius: 8px; margin: 24px 0; border: 1px solid rgba(59,130,246,0.2); }
        .body p { color: #555; font-size: 15px; line-height: 1.6; margin: 8px 0; }
        .footer { text-align: center; padding: 20px 32px; background: #fafafa; color: #999; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header"><h1>${config.site_name || "E-Commerce"}</h1></div>
        <div class="body">
            <h2>Reset Your Password</h2>
            <p>Use the OTP below to reset your password:</p>
            <div class="otp-code">${otp}</div>
            <p>This code expires in 15 minutes. If you did not request this, please ignore this email.</p>
        </div>
        <div class="footer"><p>&copy; ${new Date().getFullYear()} ${config.site_name || "E-Commerce"}. All rights reserved.</p></div>
    </div>
</body>
</html>
`;

export const EMAIL_VERIFICATION_TEMPLATE = (otp: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification OTP</title>
    <style>
        body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f4f4f7; margin: 0; padding: 0; }
        .container { max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #3B82F6, #60A5FA, #93C5FD); padding: 32px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
        .body { padding: 32px; text-align: center; }
        .otp-code { display: inline-block; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #3B82F6; background: rgba(59,130,246,0.08); padding: 16px 32px; border-radius: 8px; margin: 24px 0; border: 1px solid rgba(59,130,246,0.2); }
        .body p { color: #555; font-size: 15px; line-height: 1.6; margin: 8px 0; }
        .footer { text-align: center; padding: 20px 32px; background: #fafafa; color: #999; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header"><h1>${config.site_name || "E-Commerce"}</h1></div>
        <div class="body">
            <h2>Verify Your Email</h2>
            <p>Welcome to <strong>${config.site_name || "E-Commerce"}</strong>! Use the OTP below to verify your email:</p>
            <div class="otp-code">${otp}</div>
            <p>This code expires in 15 minutes. If you did not create an account, please ignore this email.</p>
        </div>
        <div class="footer"><p>&copy; ${new Date().getFullYear()} ${config.site_name || "E-Commerce"}. All rights reserved.</p></div>
    </div>
</body>
</html>
`;
