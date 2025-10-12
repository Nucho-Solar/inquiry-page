import { Sun, Zap, Shield } from "lucide-react";
import InquiryForm from "@/components/InquiryForm";
import heroImage from "@/assets/hero-solar.jpg";
import logo from "@/assets/nucho-logo.png";

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section with Background Image */}
      <div className="relative min-h-[90vh] md:min-h-screen overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src={heroImage} 
            alt="Professional solar panel installation"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-secondary-dark/95 via-secondary/85 to-blue-primary/70" 
               style={{
                 background: 'linear-gradient(135deg, hsl(210 70% 25% / 0.95), hsl(210 60% 35% / 0.85), hsl(210 60% 35% / 0.7))'
               }}
          />
        </div>
        
        {/* Transparent Header */}
        <header className="relative z-10 backdrop-blur-md bg-white/10 border-b border-white/20 py-4">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-center gap-3">
              <img src={logo} alt="Nucho Solar Logo" className="h-16 md:h-20 w-auto" />
            </div>
          </div>
        </header>

        {/* Hero Content */}
        <section className="relative z-10 container mx-auto px-4 py-12 md:py-20 lg:py-24">
          <div className="max-w-5xl mx-auto text-center text-white space-y-6 md:space-y-8 animate-fade-in">
            {/* Main Heading with Gradient Text */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold leading-tight">
              <span className="bg-gradient-to-r from-primary via-yellow-300 to-primary bg-clip-text text-transparent">
                Free Quotation for
              </span>
              <br />
              <span className="text-white">Solar Installation Today</span>
            </h1>
            
            {/* Subheading */}
            <p className="text-lg md:text-xl lg:text-2xl text-white/90 max-w-3xl mx-auto leading-relaxed px-4">
              Power your home, office, or farm with reliable solar energy.
              Save on electricity bills and enjoy uninterrupted power — from Kenya Trusted Solar Experts.
            </p>

            {/* CTA Button */}
            <div className="pt-4">
              <a 
                href="#get-quote" 
                className="inline-block bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg px-8 py-4 rounded-lg shadow-2xl transition-all hover:scale-105 hover:shadow-primary/50"
              >
                Get Your Free Quote
              </a>
            </div>

            {/* Trust Indicators */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mt-12 md:mt-16 max-w-4xl mx-auto px-4">
              <div className="text-center backdrop-blur-sm bg-white/10 p-4 rounded-xl border border-white/20">
                <div className="text-3xl md:text-4xl font-bold text-primary">1500+</div>
                <div className="text-xs md:text-sm text-white/90 mt-1">Installations</div>
              </div>
              <div className="text-center backdrop-blur-sm bg-white/10 p-4 rounded-xl border border-white/20">
                <div className="text-3xl md:text-4xl font-bold text-primary">5★</div>
                <div className="text-xs md:text-sm text-white/90 mt-1">Customer Rating</div>
              </div>
              <div className="text-center backdrop-blur-sm bg-white/10 p-4 rounded-xl border border-white/20">
                <div className="text-3xl md:text-4xl font-bold text-primary">24/7</div>
                <div className="text-xs md:text-sm text-white/90 mt-1">Support</div>
              </div>
              <div className="text-center backdrop-blur-sm bg-white/10 p-4 rounded-xl border border-white/20">
                <div className="text-3xl md:text-4xl font-bold text-primary">🇰🇪</div>
                <div className="text-xs md:text-sm text-white/90 mt-1">Kenya-wide</div>
              </div>
            </div>
          </div>
        </section>
      </div>
      <br />
      <div className="mb-8 text-center">
       <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold text-secondary mb-3">Why Kenyans Trust Nucho Solar</h3>
       </div>
      {/* Features Section */}
      <section className="py-12 md:py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
            <div className="backdrop-blur-sm bg-card/95 p-6 md:p-8 rounded-2xl shadow-lg border border-border hover:shadow-2xl hover:scale-105 transition-all duration-300">
              <Sun className="w-12 h-12 md:w-14 md:h-14 text-primary mx-auto mb-4" />
              <h3 className="font-bold text-lg md:text-xl mb-3 text-center">Solar Power</h3>
              <p className="text-sm md:text-base text-muted-foreground text-center leading-relaxed">
                Clean, reliable energy that pays for itself
              </p>
            </div>

            <div className="backdrop-blur-sm bg-card/95 p-6 md:p-8 rounded-2xl shadow-lg border border-border hover:shadow-2xl hover:scale-105 transition-all duration-300">
              <Shield className="w-12 h-12 md:w-14 md:h-14 text-accent mx-auto mb-4" />
              <h3 className="font-bold text-lg md:text-xl mb-3 text-center">Security Systems</h3>
              <p className="text-sm md:text-base text-muted-foreground text-center leading-relaxed">
                CCTV, alarms, and electric fencing
              </p>
            </div>

            <div className="backdrop-blur-sm bg-card/95 p-6 md:p-8 rounded-2xl shadow-lg border border-border hover:shadow-2xl hover:scale-105 transition-all duration-300 sm:col-span-2 lg:col-span-1">
              <Zap className="w-12 h-12 md:w-14 md:h-14 text-success mx-auto mb-4" />
              <h3 className="font-bold text-lg md:text-xl mb-3 text-center">Smart Solutions</h3>
              <p className="text-sm md:text-base text-muted-foreground text-center leading-relaxed">
                Energy monitoring and automation
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Form Section */}
      <section id="get-quote" className="py-12 md:py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto bg-card p-6 md:p-12 rounded-2xl shadow-2xl border border-border">
            <div className="mb-8 text-center">
              <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold text-secondary mb-3">
                Get Your Free Quote
              </h3>
              <p className="text-muted-foreground text-sm md:text-base">
                Tell us what you need, and we'll reach out on WhatsApp instantly.
              </p>
            </div>

            <InquiryForm />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-secondary text-secondary-foreground py-8 md:py-12">
        <div className="container mx-auto px-4 text-center space-y-3">
          <p className="text-sm md:text-base">Serving homes, offices, and farms across Kenya 🇰🇪</p>
          <p className="text-xs md:text-sm opacity-80">
            © 2024 Nucho Solar. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
)}