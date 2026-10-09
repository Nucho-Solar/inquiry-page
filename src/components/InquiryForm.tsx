import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Sun,
  BatteryCharging,
  Flame,
  Camera,
  Bell,
  Lightbulb,
  Shield,
  Zap,
  Tv,
  Plug,
  PlusCircle,
  Droplet,
  AlertTriangle,
  X,
} from "lucide-react";
import InquirySuccess from "@/components/InquirySuccess";
import { budgetOptions, inquiryFormSchema, MIN_FILL_MS } from "@/lib/inquirySchema";
import { submitInquiry } from "@/lib/submitInquiry";
import { readAttribution } from "@/lib/attribution";
import { trackConversion } from "@/lib/trackConversion";
import { newId } from "@/lib/uuid";

type UseCase = "home" | "office" | "farm" | "";

interface DeviceOption {
  id: string;
  label: string;
  icon: React.ElementType;
}

const deviceOptions: Record<string, DeviceOption[]> = {
  "": [],
  home: [
    { id: "solar-lights", label: "Solar Lighting Kit", icon: Sun },
    { id: "inverter", label: "Backup Inverter", icon: BatteryCharging },
    { id: "water-heater", label: "Solar Water Heater", icon: Flame },
    { id: "cctv", label: "CCTV Cameras", icon: Camera },
    { id: "doorbell", label: "Smart Doorbell", icon: Bell },
    { id: "motion-lights", label: "Motion Sensor Lights", icon: Lightbulb },
    { id: "alarm", label: "Alarm System", icon: AlertTriangle },
    { id: "electric-fence", label: "Electric Fence", icon: Zap },
    { id: "tv-kit", label: "Solar TV Kit", icon: Tv },
    { id: "smart-socket", label: "Smart Power Socket", icon: Plug },
    { id: "other", label: "Other", icon: PlusCircle },
  ],
  office: [
    { id: "solar-backup", label: "Solar Backup System", icon: BatteryCharging },
    { id: "energy-monitor", label: "Energy Monitoring", icon: Sun },
    { id: "cctv", label: "CCTV Security System", icon: Camera },
    { id: "smart-lighting", label: "Smart Lighting", icon: Lightbulb },
    { id: "server-backup", label: "Server Power Backup", icon: Zap },
    { id: "motion-detector", label: "Motion Detector", icon: Camera },
    { id: "biometric", label: "Biometric Access", icon: Shield },
    { id: "security-alarm", label: "Security Alarm", icon: AlertTriangle },
    { id: "other", label: "Other", icon: PlusCircle },
  ],
  farm: [
    { id: "water-pump", label: "Solar Water Pump", icon: Droplet },
    { id: "electric-fence", label: "Electric Fence", icon: Zap },
    { id: "cctv", label: "CCTV Cameras", icon: Camera },
    { id: "irrigation", label: "Smart Irrigation Controller", icon: Droplet },
    { id: "greenhouse-fan", label: "Greenhouse Fan", icon: Sun },
    { id: "livestock-monitor", label: "Livestock Monitoring", icon: Camera },
    { id: "motion-lights", label: "Motion Lights", icon: Lightbulb },
    { id: "inverter", label: "Power Inverter", icon: BatteryCharging },
    { id: "battery-pack", label: "Solar Battery Pack", icon: BatteryCharging },
    { id: "other", label: "Other", icon: PlusCircle },
  ],
};

const fieldMessages = {
  useCase: "Please select a use case",
  services: "Please select at least one device or add a custom device",
  name: "Name is required (max 100 characters)",
  phone: "Enter a valid phone number, e.g. 0712 345 678",
  location: "Location is required (max 100 characters)",
  budget: "Please select your estimated budget",
  explanation: "Keep this under 500 characters",
} as const;

const errorKeyForField: Record<keyof typeof fieldMessages, string> = {
  useCase: "useCase",
  services: "devices",
  name: "name",
  phone: "phone",
  location: "location",
  budget: "budget",
  explanation: "explanation",
};

const honeypotStyle: React.CSSProperties = {
  position: "absolute",
  left: "-10000px",
  width: "1px",
  height: "1px",
  overflow: "hidden",
};

export default function InquiryForm() {
  const [useCase, setUseCase] = useState<UseCase>("");
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [otherDevices, setOtherDevices] = useState<string[]>([]);
  const [currentOtherInput, setCurrentOtherInput] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [explanation, setExplanation] = useState("");
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const [confirmation, setConfirmation] = useState<{ name: string; phone: string } | null>(null);
  const submitLock = useRef(false);
  const submissionId = useRef<string | null>(null);
  const mountedAt = useRef<number | null>(null);
  if (submissionId.current === null) submissionId.current = newId();
  // performance.now() is monotonic, so a wrong or changed device clock cannot skew fillMs.
  if (mountedAt.current === null) mountedAt.current = performance.now();

  const toggleDevice = (deviceId: string) => {
    setSelectedDevices((prev) =>
      prev.includes(deviceId)
        ? prev.filter((id) => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const handleAddOtherDevice = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmedInput = currentOtherInput.trim();
      
      if (!trimmedInput) {
        setErrors({ ...errors, otherDevice: "Device name cannot be empty" });
        return;
      }

      if (trimmedInput.length < 3 || trimmedInput.length > 50) {
        setErrors({ ...errors, otherDevice: "Device name must be between 3-50 characters" });
        return;
      }

      if (otherDevices.includes(trimmedInput)) {
        setErrors({ ...errors, otherDevice: "Device already added" });
        return;
      }


      setOtherDevices([...otherDevices, trimmedInput]);
      setCurrentOtherInput("");
      setErrors({ ...errors, otherDevice: "" });
    }
  };

  const removeOtherDevice = (deviceToRemove: string) => {
    setOtherDevices(otherDevices.filter((d) => d !== deviceToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitLock.current) return;
    submitLock.current = true;

    try {
      const selectedDeviceNames = selectedDevices
        .filter((id) => id !== "other")
        .map((id) => {
          const device = deviceOptions[useCase as string]?.find((d) => d.id === id);
          return device ? device.label : id;
        });

      const result = inquiryFormSchema.safeParse({
        useCase,
        services: [...selectedDeviceNames, ...otherDevices],
        name,
        phone,
        location,
        budget,
        explanation,
      });

      if (!result.success) {
        const newErrors: Record<string, string> = {};
        for (const issue of result.error.issues) {
          const field = issue.path[0] as keyof typeof fieldMessages;
          if (field in fieldMessages) {
            newErrors[errorKeyForField[field]] = fieldMessages[field];
          }
        }
        setErrors(newErrors);
        return;
      }

      setErrors({});
      setSubmitFailed(false);
      setSubmitting(true);

      const fillMs = Math.max(0, Math.round(performance.now() - (mountedAt.current as number)));
      const outcome = await submitInquiry({
        ...result.data,
        submissionId: submissionId.current as string,
        website,
        fillMs,
        attribution: readAttribution(window.location.search),
      });

      if (outcome.ok) {
        // The function fakes success for a filled honeypot or a fill under MIN_FILL_MS and sends
        // nothing, so those submissions must not count as Google Ads conversions.
        const looksReal = website.trim() === "" && fillMs >= MIN_FILL_MS;
        if (looksReal) trackConversion(import.meta.env.VITE_ADS_CONVERSION_LABEL);
        setConfirmation({ name: result.data.name, phone: result.data.phone });
      } else {
        setSubmitFailed(true);
      }
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  const contactPhone: string = import.meta.env.VITE_CONTACT_PHONE || "254758330507";

  if (confirmation) {
    return <InquirySuccess name={confirmation.name} phone={confirmation.phone} />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Use Case */}
      <div className="space-y-2">
        <Label htmlFor="use-case" className="text-lg font-semibold">
          What do you need solar for? *
        </Label>
        <Select value={useCase} onValueChange={(value) => setUseCase(value as UseCase)}>
          <SelectTrigger id="use-case" className={errors.useCase ? "border-destructive" : ""}>
            <SelectValue placeholder="Select use case" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="home">Home - Kenya</SelectItem>
            <SelectItem value="office">Office - Kenya</SelectItem>
            <SelectItem value="farm">Farm - Kenya</SelectItem>
          </SelectContent>
        </Select>
        {errors.useCase && <p className="text-sm text-destructive">{errors.useCase}</p>}
      </div>

      {/* Device Selection */}
      {useCase && (
        <div className="space-y-3">
          <Label className="text-lg font-semibold">
            What devices or services do you need? *
          </Label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {deviceOptions[useCase].map((device) => {
              const Icon = device.icon;
              const isSelected = selectedDevices.includes(device.id);
              return (
                <button
                  key={device.id}
                  type="button"
                  onClick={() => toggleDevice(device.id)}
                  className={`p-4 rounded-xl border-2 transition-all hover:scale-105 ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-md"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  <Icon className={`w-8 h-8 mx-auto mb-2 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                  <p className={`text-sm font-medium text-center ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                    {device.label}
                  </p>
                </button>
              );
            })}
          </div>
          {errors.devices && <p className="text-sm text-destructive">{errors.devices}</p>}
        </div>
      )}

      {/* Custom Device Input - Only show if "Other" is selected */}
      {selectedDevices.includes("other") && (
        <div className="space-y-2">
          <Label htmlFor="other-device" className="font-semibold">
            Add Custom Devices (Press Enter to add) *
          </Label>
          <Input
            id="other-device"
            type="text"
            placeholder="Type device name and press Enter..."
            value={currentOtherInput}
            onChange={(e) => setCurrentOtherInput(e.target.value)}
            onKeyDown={handleAddOtherDevice}
            className={errors.otherDevice ? "border-destructive" : ""}
          />
          <p className="text-xs text-muted-foreground">
            Press Enter after typing each device (3-50 characters)
          </p>
          {errors.otherDevice && <p className="text-sm text-destructive">{errors.otherDevice}</p>}
          
          {/* Display custom devices as badges */}
          {otherDevices.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {otherDevices.map((device, index) => (
                <Badge key={index} variant="secondary" className="text-sm py-1.5 px-3">
                  {device}
                  <button
                    type="button"
                    onClick={() => removeOtherDevice(device)}
                    className="ml-2 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contact Details */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Your Contact Details</h3>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+254 7XX XXX XXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={errors.phone ? "border-destructive" : ""}
            />
            {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Your Location *</Label>
          <Input
            id="location"
            type="text"
            placeholder="e.g., Nairobi, Karen"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={errors.location ? "border-destructive" : ""}
          />
          {errors.location && <p className="text-sm text-destructive">{errors.location}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="budget">Estimated Budget *</Label>
          <Select value={budget} onValueChange={setBudget}>
            <SelectTrigger id="budget" className={errors.budget ? "border-destructive" : ""}>
              <SelectValue placeholder="Select your budget range" />
            </SelectTrigger>
            <SelectContent>
              {budgetOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.budget && <p className="text-sm text-destructive">{errors.budget}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="explanation">Briefly Explain the service you Want.</Label>
          <Textarea
            id="explanation"
            placeholder="Tell us more about what you need..."
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            className="min-h-[100px] resize-none"
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground">Optional - Max 500 characters</p>
          {errors.explanation && <p className="text-sm text-destructive">{errors.explanation}</p>}
        </div>
      </div>

      {/* Honeypot: off-screen, ignored by people, filled by bots */}
      <div style={honeypotStyle}>
        <input
          type="text"
          name="website"
          autoComplete="off"
          tabIndex={-1}
          aria-hidden="true"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {submitFailed && (
        <p role="alert" className="text-sm text-destructive">
          We couldn't send your request. Please try again or call us on{" "}
          <a href={`tel:+${contactPhone.replace(/\D/g, "")}`} className="underline font-medium">
            {contactPhone}
          </a>
        </p>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={submitting}
        className="w-full text-lg py-6 font-semibold hover:scale-105 transition-transform"
      >
        {submitting ? "Sending…" : "Request My Free Quote"}
      </Button>
    </form>
  );
}
