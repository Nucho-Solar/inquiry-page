import { CheckCircle2, MessageCircle, Phone } from "lucide-react";
import { callHref, contactDigits, formatPhone, whatsappHref } from "@/lib/contact";

interface InquirySuccessProps {
  name: string;
  phone: string;
}

export default function InquirySuccess({ name, phone }: InquirySuccessProps) {
  const digits = contactDigits();
  return (
    <div role="status" className="enquiry-success">
      <CheckCircle2 className="enquiry-success-icon" aria-hidden="true" />
      <p className="enquiry-success-title">{`Thanks, ${name}.`}</p>
      <p className="enquiry-success-next">{`We'll call or WhatsApp you on ${phone} within 24 hours.`}</p>
      <p className="enquiry-success-sooner">Need us sooner?</p>
      <div className="enquiry-success-actions">
        <a href={callHref(digits)} className="enquiry-primary">
          <Phone size={18} aria-hidden="true" />
          {`Call ${formatPhone(digits)}`}
        </a>
        <a href={whatsappHref(digits)} className="enquiry-secondary">
          <MessageCircle size={18} aria-hidden="true" />
          WhatsApp
        </a>
      </div>
    </div>
  );
}
