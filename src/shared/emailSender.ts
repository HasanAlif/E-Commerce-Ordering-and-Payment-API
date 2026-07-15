import nodemailer from "nodemailer";
import config from "../config/index.js";

let transporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: config.emailSender.email,
        pass: config.emailSender.app_pass,
      },
    });
  }
  return transporter;
};

const emailSender = async (
  to: string,
  html: string,
  subject: string,
): Promise<{ sent: boolean }> => {
  if (!config.emailSender.email || !config.emailSender.app_pass) {
    console.warn(
      "Email credentials not configured. Email not sent.",
      { to, subject }
    );
    return { sent: false };
  }

  try {
    await getTransporter().sendMail({
      from: `"${config.site_name || "E-Commerce"}" <${config.emailSender.email}>`,
      to,
      subject,
      html,
    });
    return { sent: true };
  } catch (err) {
    if (config.env === "production") {
      throw err;
    }
    console.warn(
      "Email send failed — continuing without email (non-production)",
      { to, subject, err: err instanceof Error ? err.message : String(err) }
    );
    return { sent: false };
  }
};

export default emailSender;
