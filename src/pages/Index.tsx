import { Sun, Zap, Shield } from "lucide-react";
import InquiryForm from "@/components/InquiryForm";

export default function Index() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-accent/10">
      {/* Header */}
      <header className="bg-secondary text-secondary-foreground py-6 shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-3">
            <Sun className="w-10 h-10 text-primary" />
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">Nucho Solar</h1>
              <p className="text-sm md:text-base text-secondary-foreground/80">
                Powering Kenya with Smart Energy Solutions
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12 md:py-16">
        <div className="text-center mb-12 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold text-secondary">
            Go Green. Save Costs.
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Get a free consultation for solar installation, CCTV security, electric fencing, 
            and smart energy solutions for your home, office, or farm.
          </p>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-12 max-w-4xl mx-auto">
            <div className="bg-card p-6 rounded-xl shadow-md border border-border hover:shadow-lg transition-shadow">
              <Sun className="w-12 h-12 text-primary mx-auto mb-3" />
              <h3 className="font-semibold text-lg mb-2">Solar Power</h3>
              <p className="text-sm text-muted-foreground">
                Clean, reliable energy that pays for itself
              </p>
            </div>

            <div className="bg-card p-6 rounded-xl shadow-md border border-border hover:shadow-lg transition-shadow">
              <Shield className="w-12 h-12 text-accent mx-auto mb-3" />
              <h3 className="font-semibold text-lg mb-2">Security Systems</h3>
              <p className="text-sm text-muted-foreground">
                CCTV, alarms, and electric fencing
              </p>
            </div>

            <div className="bg-card p-6 rounded-xl shadow-md border border-border hover:shadow-lg transition-shadow">
              <Zap className="w-12 h-12 text-primary mx-auto mb-3" />
              <h3 className="font-semibold text-lg mb-2">Smart Solutions</h3>
              <p className="text-sm text-muted-foreground">
                Energy monitoring and automation
              </p>
            </div>
          </div>
        </div>

        {/* Form Section */}
        <div className="max-w-3xl mx-auto bg-card p-8 md:p-12 rounded-2xl shadow-2xl border border-border">
          <div className="mb-8 text-center">
            <h3 className="text-2xl md:text-3xl font-bold text-secondary mb-2">
              Get Your Free Quote
            </h3>
            <p className="text-muted-foreground">
              Tell us what you need, and we'll reach out on WhatsApp instantly.
            </p>
          </div>

          <InquiryForm />
        </div>

        {/* Footer Note */}
        <div className="text-center mt-12 text-muted-foreground text-sm">
          <p>Serving homes, offices, and farms across Kenya 🇰🇪</p>
          <p className="mt-2">
            © 2024 Nucho Solar. All rights reserved.
          </p>
        </div>
      </section>
    </div>
  );
}
