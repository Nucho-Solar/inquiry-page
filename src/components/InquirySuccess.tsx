import { CheckCircle2 } from "lucide-react";

interface InquirySuccessProps {
  name: string;
  phone: string;
}

export default function InquirySuccess({ name, phone }: InquirySuccessProps) {
  return (
    <div role="status" className="py-10 text-center space-y-4">
      <CheckCircle2 className="w-16 h-16 mx-auto text-primary" aria-hidden="true" />
      <p className="text-xl font-semibold text-foreground">
        {`Thanks ${name}, we'll contact you on ${phone}.`}
      </p>
    </div>
  );
}
