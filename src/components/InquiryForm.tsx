import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sun, Zap, Shield, Camera, Droplets, Sprout } from "lucide-react";

type UseCase = "home" | "office" | "farm" | "";

interface DeviceOption {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const deviceOptions: Record<UseCase, DeviceOption[]> = {
  "": [],
  home: [
    { id: "solar-lights", label: "Solar Lighting", icon: <Sun className="w-6 h-6" /> },
    { id: "inverter", label: "Backup Inverter", icon: <Zap className="w-6 h-6" /> },
    { id: "water-heater", label: "Solar Water Heater", icon: <Droplets className="w-6 h-6" /> },
    { id: "cctv", label: "CCTV Cameras", icon: <Camera className="w-6 h-6" /> },
    { id: "alarm", label: "Security Alarm", icon: <Shield className="w-6 h-6" /> },
    { id: "electric-fence", label: "Electric Fence", icon: <Zap className="w-6 h-6" /> },
  ],
  office: [
    { id: "solar-backup", label: "Solar Backup", icon: <Sun className="w-6 h-6" /> },
    { id: "monitoring", label: "Energy Monitoring", icon: <Zap className="w-6 h-6" /> },
    { id: "cctv", label: "CCTV Security", icon: <Camera className="w-6 h-6" /> },
    { id: "smart-lighting", label: "Smart Lighting", icon: <Sun className="w-6 h-6" /> },
    { id: "access-control", label: "Access Control", icon: <Shield className="w-6 h-6" /> },
  ],
  farm: [
    { id: "water-pump", label: "Solar Water Pump", icon: <Droplets className="w-6 h-6" /> },
    { id: "electric-fence", label: "Electric Fence", icon: <Shield className="w-6 h-6" /> },
    { id: "cctv", label: "CCTV Cameras", icon: <Camera className="w-6 h-6" /> },
    { id: "irrigation", label: "Smart Irrigation", icon: <Sprout className="w-6 h-6" /> },
    { id: "monitoring", label: "Livestock Monitor", icon: <Zap className="w-6 h-6" /> },
  ],
};

const budgetOptions = [
  "Under KSh 50,000",
  "KSh 50,000 - 100,000",
  "KSh 100,000 - 200,000",
  "KSh 200,000 - 500,000",
  "Over KSh 500,000",
  "Not sure yet",
];

export default function InquiryForm() {
  const [useCase, setUseCase] = useState<UseCase>("");
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [otherDevice, setOtherDevice] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleDevice = (deviceId: string) => {
    setSelectedDevices((prev) =>
      prev.includes(deviceId)
        ? prev.filter((d) => d !== deviceId)
        : [...prev, deviceId]
    );
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim() || name.length > 100) {
      newErrors.name = "Please enter your name (max 100 characters)";
    }

    const phoneRegex = /^[+]?[0-9]{10,15}$/;
    if (!phone.trim() || !phoneRegex.test(phone.replace(/\s/g, ""))) {
      newErrors.phone = "Please enter a valid phone number";
    }

    if (!useCase) {
      newErrors.useCase = "Please select a use case";
    }

    if (selectedDevices.length === 0 && !otherDevice.trim()) {
      newErrors.devices = "Please select at least one service or device";
    }

    if (!location.trim() || location.length > 100) {
      newErrors.location = "Please enter your location (max 100 characters)";
    }

    if (!budget) {
      newErrors.budget = "Please select your estimated budget";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const selectedDeviceLabels =
      useCase && deviceOptions[useCase]
        ? deviceOptions[useCase]
            .filter((d) => selectedDevices.includes(d.id))
            .map((d) => d.label)
        : [];

    if (otherDevice.trim()) {
      selectedDeviceLabels.push(otherDevice.trim());
    }

    const message = `*New Solar Inquiry*

*Name:* ${name.trim()}
*Phone:* ${phone.trim()}
*Use Case:* ${useCase}
*Location:* ${location.trim()}
*Budget:* ${budget}

*Services Requested:*
${selectedDeviceLabels.map((label) => `• ${label}`).join("\n")}`;

    const encodedMessage = encodeURIComponent(message);
    const phoneNumber = "254700000000"; // Replace with actual engineer's number
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

    window.open(whatsappUrl, "_blank");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Use Case Selection */}
      <div className="space-y-3">
        <Label htmlFor="useCase" className="text-lg font-semibold text-secondary">
          What's your use case?
        </Label>
        <Select value={useCase} onValueChange={(value) => setUseCase(value as UseCase)}>
          <SelectTrigger id="useCase" className="w-full">
            <SelectValue placeholder="Select your setup type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="home">🏠 Home</SelectItem>
            <SelectItem value="office">🏢 Office</SelectItem>
            <SelectItem value="farm">🌾 Farm</SelectItem>
          </SelectContent>
        </Select>
        {errors.useCase && <p className="text-sm text-destructive">{errors.useCase}</p>}
      </div>

      {/* Device Selection */}
      {useCase && (
        <div className="space-y-3">
          <Label className="text-lg font-semibold text-secondary">
            What services do you need?
          </Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {deviceOptions[useCase].map((device) => (
              <button
                key={device.id}
                type="button"
                onClick={() => toggleDevice(device.id)}
                className={`p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-center gap-2 hover:scale-105 ${
                  selectedDevices.includes(device.id)
                    ? "border-primary bg-primary/10 shadow-md"
                    : "border-border bg-card hover:border-accent"
                }`}
              >
                <div
                  className={
                    selectedDevices.includes(device.id)
                      ? "text-primary"
                      : "text-muted-foreground"
                  }
                >
                  {device.icon}
                </div>
                <span className="text-sm font-medium text-center">
                  {device.label}
                </span>
              </button>
            ))}
          </div>
          {errors.devices && <p className="text-sm text-destructive">{errors.devices}</p>}

          {/* Other Device Input */}
          <div className="pt-4">
            <Label htmlFor="otherDevice" className="text-sm">
              Need something else?
            </Label>
            <Input
              id="otherDevice"
              placeholder="Describe what you need..."
              value={otherDevice}
              onChange={(e) => setOtherDevice(e.target.value)}
              maxLength={100}
              className="mt-2"
            />
          </div>
        </div>
      )}

      {/* Contact Details */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-secondary">Your Contact Details</h3>

        <div className="space-y-2">
          <Label htmlFor="name">Full Name *</Label>
          <Input
            id="name"
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className={errors.name ? "border-destructive" : ""}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number *</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+254 700 000 000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={20}
            className={errors.phone ? "border-destructive" : ""}
          />
          {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location *</Label>
          <Input
            id="location"
            placeholder="e.g., Nairobi, Karen"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={100}
            className={errors.location ? "border-destructive" : ""}
          />
          {errors.location && (
            <p className="text-sm text-destructive">{errors.location}</p>
          )}
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
      </div>

      <Button
        type="submit"
        className="w-full py-6 text-lg font-semibold bg-secondary hover:bg-secondary/90 text-secondary-foreground"
      >
        Send Inquiry via WhatsApp
      </Button>
    </form>
  );
}
