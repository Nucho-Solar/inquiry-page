import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowLeft, ArrowRight, BatteryCharging, Building2, Home, MapPinned,
  MessageCircle, Phone, Search, Sprout, Sun, Wrench, X, type LucideIcon,
} from "lucide-react";
import InquirySuccess from "@/components/InquirySuccess";
import { deviceCatalog, equipmentCatalog, findCatalogItems, type UseCase } from "@/lib/inquiryCatalog";
import {
  inquiryFormSchema, MIN_FILL_MS, type inquiryIntents, type serviceTypes, type surveyPurposes,
} from "@/lib/inquirySchema";
import { submitInquiry } from "@/lib/submitInquiry";
import { readAttribution } from "@/lib/attribution";
import { trackConversion } from "@/lib/trackConversion";
import { newId } from "@/lib/uuid";
import { callHref, contactDigits, formatPhone, whatsappHref } from "@/lib/contact";
import heroImage from "@/assets/hero-solar.jpg";
import darkLogo from "@/assets/nucho-logo.png";
import lightLogo from "@/assets/nucho-logo-light.png";

type Intent = (typeof inquiryIntents)[number];
type ServiceType = (typeof serviceTypes)[number];
type SurveyFor = (typeof surveyPurposes)[number];
type Step = "intent" | "property" | "items" | "serviceType" | "surveyFor" | "description" | "contact";

const paths: Record<Intent, Step[]> = {
  system: ["intent", "property", "items", "contact"],
  equipment: ["intent", "items", "contact"],
  service: ["intent", "serviceType", "description", "contact"],
  survey: ["intent", "surveyFor", "contact"],
  unsure: ["intent", "description", "contact"],
};

const intentNames: Record<Intent, string> = {
  system: "Solar system",
  equipment: "Equipment",
  service: "Service",
  survey: "Site visit",
  unsure: "Enquiry",
};
const serviceNames: Record<ServiceType, string> = {
  repair: "Repair or troubleshoot",
  maintenance: "Maintenance",
  upgrade: "Upgrade or expand",
  reinstallation: "Remove and reinstall",
};
const surveyNames: Record<SurveyFor, string> = {
  new: "a new installation",
  upgrade: "an existing system upgrade",
  project: "a business or farm project",
  unknown: "an undecided project",
};

type ChoiceProps = {
  icon: LucideIcon;
  title: string;
  detail: string;
  onClick: () => void;
  selected?: boolean;
};

function Choice({ icon: Icon, title, detail, onClick, selected = false }: ChoiceProps) {
  return (
    <button
      type="button"
      className={"enquiry-choice" + (selected ? " is-selected" : "")}
      onClick={onClick}
      aria-label={title + ". " + detail}
    >
      <span className="enquiry-choice-icon" aria-hidden="true"><Icon size={20} /></span>
      <span className="enquiry-choice-copy"><strong>{title}</strong><small>{detail}</small></span>
      <ArrowRight size={18} className="enquiry-choice-arrow" aria-hidden="true" />
    </button>
  );
}

const goals: { intent: Intent; icon: LucideIcon; title: string; detail: string }[] = [
  { intent: "system", icon: Sun, title: "Power my home, office or farm", detail: "We size a system around the devices you use." },
  { intent: "equipment", icon: BatteryCharging, title: "Buy panels, batteries or an inverter", detail: "Panels, batteries, inverters, charge controllers." },
  { intent: "service", icon: Wrench, title: "Fix or upgrade my solar system", detail: "Repair, maintenance, upgrades or moving a system." },
  { intent: "survey", icon: MapPinned, title: "Get a site visit and quote", detail: "We visit before quoting. Transport is at your cost." },
];

// The four goals and the "not sure" link: shown on the landing page, and again when the visitor goes back.
function GoalChoices({ onChoose }: { onChoose: (intent: Intent) => void }) {
  return (
    <>
      {goals.map((goal) => (
        <Choice key={goal.intent} icon={goal.icon} title={goal.title} detail={goal.detail} onClick={() => onChoose(goal.intent)} />
      ))}
      <button type="button" className="enquiry-unsure" onClick={() => onChoose("unsure")}>
        I'm not sure yet. Help me decide. <ArrowRight size={14} />
      </button>
    </>
  );
}

const honeypotStyle = {
  position: "absolute", left: "-10000px", width: "1px", height: "1px", overflow: "hidden",
} as const;

export default function InquiryForm() {
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [useCase, setUseCase] = useState<UseCase | null>(null);
  const [items, setItems] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [installationHelp, setInstallationHelp] = useState(false);
  const [serviceType, setServiceType] = useState<ServiceType | null>(null);
  const [surveyFor, setSurveyFor] = useState<SurveyFor | null>(null);
  const [explanation, setExplanation] = useState("");
  const [contact, setContact] = useState({ name: "", phone: "", location: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const [confirmation, setConfirmation] = useState<{ name: string; phone: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const contactFormRef = useRef<HTMLFormElement>(null);
  const submitLock = useRef(false);
  const submissionId = useRef<string | null>(null);
  const mountedAt = useRef<number | null>(null);
  if (submissionId.current === null) submissionId.current = newId();
  if (mountedAt.current === null) mountedAt.current = performance.now();

  const path = intent ? paths[intent] : (["intent"] as Step[]);
  const step = path[stepIndex] ?? "intent";
  const catalog = intent === "system" ? deviceCatalog[useCase ?? "home"] : equipmentCatalog;
  const suggestions = findCatalogItems(catalog, query, items);
  const trimmedQuery = query.trim().replace(/\s+/g, " ");
  const customSuggestion = trimmedQuery.length >= 3 && trimmedQuery.length <= 50 &&
    !items.some((item) => item.toLocaleLowerCase() === trimmedQuery.toLocaleLowerCase()) &&
    !catalog.some((item) => item.name.toLocaleLowerCase() === trimmedQuery.toLocaleLowerCase());
  const suggestionNames = [...suggestions.map((item) => item.name), ...(customSuggestion ? [trimmedQuery] : [])];
  const popupOpen = showSuggestions && trimmedQuery.length >= 2 && suggestionNames.length > 0;
  const progress = confirmation ? 100 : Math.round((stepIndex / path.length) * 100);

  const clearError = (key: string) => setErrors((previous) => {
    if (!previous[key]) return previous;
    const next = { ...previous };
    delete next[key];
    return next;
  });

  // After a sent enquiry is closed, the next goal starts clean with its own id and its own timer.
  const resetEnquiry = () => {
    setConfirmation(null);
    setIntent(null);
    setStepIndex(0);
    setUseCase(null);
    setItems([]);
    setQuery("");
    setInstallationHelp(false);
    setServiceType(null);
    setSurveyFor(null);
    setExplanation("");
    setContact({ name: "", phone: "", location: "" });
    setErrors({});
    setSubmitFailed(false);
    submissionId.current = newId();
    mountedAt.current = performance.now();
  };

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next && confirmation) resetEnquiry();
  };

  const chooseIntent = (value: Intent) => {
    if (intent !== value) {
      setUseCase(null);
      setItems([]);
      setQuery("");
      setInstallationHelp(false);
      setServiceType(null);
      setSurveyFor(null);
      setExplanation("");
    }
    setIntent(value);
    setErrors({});
    setStepIndex(1);
    setOpen(true);
  };

  const addItem = (name: string, focusSearch = false) => {
    const clean = name.trim().replace(/\s+/g, " ");
    const knownItem = catalog.some((item) => item.name.toLocaleLowerCase() === clean.toLocaleLowerCase());
    if ((clean.length < 3 && !knownItem) || clean.length > 50) {
      setErrors((previous) => ({ ...previous, items: "Use a name between 3 and 50 characters." }));
      return;
    }
    setItems((previous) => previous.some((item) => item.toLocaleLowerCase() === clean.toLocaleLowerCase())
      ? previous : [...previous, clean]);
    setQuery("");
    setShowSuggestions(false);
    setActiveSuggestion(-1);
    clearError("items");
    if (focusSearch) searchRef.current?.focus();
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && popupOpen) {
      event.preventDefault();
      setActiveSuggestion((previous) => (previous + 1) % suggestionNames.length);
    } else if (event.key === "ArrowUp" && popupOpen) {
      event.preventDefault();
      setActiveSuggestion((previous) => (previous - 1 + suggestionNames.length) % suggestionNames.length);
    } else if (event.key === "Escape") {
      setShowSuggestions(false);
      event.stopPropagation();
    } else if (event.key === "Enter" && trimmedQuery) {
      event.preventDefault();
      addItem(activeSuggestion >= 0 ? suggestionNames[activeSuggestion] : trimmedQuery, true);
    }
  };

  const readContact = () => {
    const data = new FormData(contactFormRef.current as HTMLFormElement);
    const details = {
      name: String(data.get("name") ?? "").trim(),
      phone: String(data.get("phone") ?? "").trim(),
      location: String(data.get("location") ?? "").trim(),
    };
    setContact(details);
    return { ...details, website: String(data.get("website") ?? "") };
  };

  const goBack = () => {
    if (stepIndex === 0) return;
    if (step === "contact" && contactFormRef.current) readContact();
    setErrors({});
    setStepIndex((previous) => previous - 1);
  };

  const continueStep = () => {
    if (step === "items") {
      const pending = trimmedQuery && !items.some((item) => item.toLocaleLowerCase() === trimmedQuery.toLocaleLowerCase())
        ? trimmedQuery : "";
      const knownPending = catalog.some((item) => item.name.toLocaleLowerCase() === pending.toLocaleLowerCase());
      if (pending && ((pending.length < 3 && !knownPending) || pending.length > 50)) {
        setErrors({ items: "Use a name between 3 and 50 characters." });
        searchRef.current?.focus();
        return;
      }
      if (!items.length && !pending) {
        setErrors({ items: "Add at least one item to continue." });
        searchRef.current?.focus();
        return;
      }
      if (pending) setItems((previous) => [...previous, pending]);
      setQuery("");
    }
    if (step === "description" && explanation.trim().length < 5) {
      setErrors({ explanation: "Please add a short description." });
      return;
    }
    setErrors({});
    setStepIndex((previous) => previous + 1);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitLock.current || !intent) return;
    submitLock.current = true;
    try {
      const details = readContact();
      const result = inquiryFormSchema.safeParse({
        intent, useCase: useCase ?? undefined, services: items,
        serviceType: serviceType ?? undefined, surveyFor: surveyFor ?? undefined,
        installationHelp, explanation: explanation.trim(),
        name: details.name, phone: details.phone, location: details.location,
      });
      if (!result.success) {
        const nextErrors: Record<string, string> = {};
        for (const issue of result.error.issues) {
          const field = String(issue.path[0] ?? "form");
          if (!nextErrors[field]) nextErrors[field] = issue.message;
        }
        setErrors(nextErrors);
        const first = contactFormRef.current?.querySelector<HTMLInputElement>(
          "[name='" + Object.keys(nextErrors)[0] + "']",
        );
        first?.focus();
        return;
      }
      setErrors({});
      setSubmitFailed(false);
      setSubmitting(true);
      const fillMs = Math.max(0, Math.round(performance.now() - (mountedAt.current as number)));
      const outcome = await submitInquiry({
        ...result.data,
        submissionId: submissionId.current as string,
        website: details.website,
        fillMs,
        attribution: readAttribution(window.location.search),
      });
      if (outcome.ok) {
        if (details.website.trim() === "" && fillMs >= MIN_FILL_MS) {
          trackConversion(import.meta.env.VITE_ADS_CONVERSION_LABEL);
        }
        setConfirmation({ name: result.data.name, phone: result.data.phone });
      } else {
        setSubmitFailed(true);
      }
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  const digits = contactDigits();
  const summary = intent === "system" || intent === "equipment"
    ? items.join(", ") + (intent === "equipment" && installationHelp ? " · Installation help requested" : "")
    : intent === "service" ? (serviceType ? serviceNames[serviceType] : "Service") + " · " + explanation
      : intent === "survey" ? "for " + (surveyFor ? surveyNames[surveyFor] : "a site") : explanation;

  let kicker: string | null = null;
  let heading = "What do you need?";
  let hint = "Pick the closest one.";
  if (step === "property") {
    heading = "Where will the system be used?";
    hint = "This tells us which devices to suggest.";
  } else if (step === "items") {
    heading = intent === "system" ? "What do you need to power?" : "Which equipment do you need?";
    hint = intent === "system"
      ? "Add the devices you use. We can confirm the details later."
      : "Search for what you want to buy. Not sure of the name? Type it in your own words.";
  } else if (step === "serviceType") {
    heading = "What do you need done?";
    hint = "Pick the closest one. You can explain more next.";
  } else if (step === "surveyFor") {
    heading = "What is the visit for?";
    hint = "Quotes are free. For a site visit, you cover our transport.";
  } else if (step === "description") {
    heading = intent === "service" ? "What is the system doing?" : "What would you like help with?";
    hint = "A short description is enough. No technical terms needed.";
  } else if (step === "contact") {
    kicker = "Last step";
    heading = "How can we reach you?";
    hint = "We'll call or WhatsApp you within 24 hours on this number.";
  }

  return (
    <div className="enquiry-page">
      <div className="enquiry-landing">
        <img src={heroImage} alt="" className="enquiry-hero-image" />
        <header className="enquiry-header">
          <img src={darkLogo} alt="Nucho Solar Green Energy" className="enquiry-brand-logo enquiry-brand-logo-dark" />
          <div className="enquiry-header-actions">
            <a href={callHref(digits)} className="enquiry-header-link">
              <Phone size={16} aria-hidden="true" />
              <span>Call</span>{" "}<span className="enquiry-header-number">{formatPhone(digits)}</span>
            </a>
            <a href={whatsappHref(digits)} className="enquiry-header-link">
              <MessageCircle size={16} aria-hidden="true" />
              <span>WhatsApp</span>
            </a>
          </div>
        </header>
        <main className="enquiry-landing-content">
          <h1>Get a <span className="enquiry-accent">free solar quote</span> for your home, office or farm</h1>
          <p className="enquiry-landing-subtitle">
            Answer 2 or 3 quick questions and we'll contact you with a quote. No technical knowledge needed.
          </p>
          <p className="enquiry-landing-ask" id="enquiry-goals-label">What do you need?</p>
          <div className="enquiry-options enquiry-intent-list" role="group" aria-labelledby="enquiry-goals-label">
            <GoalChoices onChoose={chooseIntent} />
          </div>
        </main>
        <footer className="enquiry-landing-footer">
          <p>Nucho Solar. Serving homes, offices and farms across Kenya.</p>
        </footer>
      </div>
      <Dialog.Root open={open} onOpenChange={changeOpen}>
            <Dialog.Portal>
              <Dialog.Overlay className="enquiry-overlay" />
              <Dialog.Content className="enquiry-dialog">
                <aside className="enquiry-sidebar">
                  <img src={darkLogo} alt="Nucho Solar Green Energy" className="enquiry-brand-logo enquiry-brand-logo-dark" />
                  <div className="enquiry-sidebar-message"><span className="enquiry-mini-rule" /><h2>Tell us what you need. We'll send you a quote.</h2><span>Use your own words. We'll sort out the technical details.</span></div>
                  <a className="enquiry-sidebar-call" href={callHref(digits)}>Prefer to talk? Call {formatPhone(digits)}</a>
                </aside>
                <div className="enquiry-wizard-main">
                  <div className="enquiry-topbar">
                    <Dialog.Close className="enquiry-close" aria-label="Close enquiry"><X size={21} /></Dialog.Close>
                    <img src={lightLogo} alt="Nucho Solar Green Energy" className="enquiry-brand-logo enquiry-brand-logo-light" />
                    <span className="enquiry-step-number">{confirmation ? "Complete" : intent ? String(stepIndex + 1) + " of " + path.length : "Start"}</span>
                  </div>
                  <div className="enquiry-progress" role="progressbar" aria-label="Enquiry progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                    <span style={{ width: String(progress) + "%" }} />
                  </div>
                  <div className="enquiry-stage" key={confirmation ? "complete" : intent + "-" + stepIndex}>
                    {confirmation ? <><Dialog.Title className="sr-only">Enquiry sent</Dialog.Title><Dialog.Description className="sr-only">Your enquiry was sent.</Dialog.Description><InquirySuccess name={confirmation.name} phone={confirmation.phone} /></> : (
                      <div className="enquiry-question">
                        {kicker && <p className="enquiry-kicker">{kicker}</p>}
                        <Dialog.Title className="enquiry-title">{heading}</Dialog.Title>
                        <Dialog.Description className="enquiry-hint">{hint}</Dialog.Description>

                        {step === "intent" && (
                          <div className="enquiry-options enquiry-intent-list">
                            <GoalChoices onChoose={chooseIntent} />
                          </div>
                        )}

                        {step === "property" && (
                          <div className="enquiry-options">
                            <Choice icon={Home} title="At home" detail="Lights, fridge, TV, Wi-Fi" selected={useCase === "home"} onClick={() => { if (useCase !== "home") setItems([]); setUseCase("home"); setStepIndex(2); }} />
                            <Choice icon={Building2} title="At my business" detail="Computers, printers, CCTV, POS" selected={useCase === "office"} onClick={() => { if (useCase !== "office") setItems([]); setUseCase("office"); setStepIndex(2); }} />
                            <Choice icon={Sprout} title="On a farm" detail="Pumps, fences, cold rooms" selected={useCase === "farm"} onClick={() => { if (useCase !== "farm") setItems([]); setUseCase("farm"); setStepIndex(2); }} />
                          </div>
                        )}

                        {step === "serviceType" && (
                          <div className="enquiry-options">
                            <Choice icon={Wrench} title="Repair or troubleshoot" detail="Something is not working" selected={serviceType === "repair"} onClick={() => { setServiceType("repair"); setStepIndex(2); }} />
                            <Choice icon={Sun} title="Maintenance" detail="Check or service an existing system" selected={serviceType === "maintenance"} onClick={() => { setServiceType("maintenance"); setStepIndex(2); }} />
                            <Choice icon={BatteryCharging} title="Upgrade or expand" detail="Add capacity or replace components" selected={serviceType === "upgrade"} onClick={() => { setServiceType("upgrade"); setStepIndex(2); }} />
                            <Choice icon={ArrowRight} title="Remove and reinstall" detail="Move a system to another site" selected={serviceType === "reinstallation"} onClick={() => { setServiceType("reinstallation"); setStepIndex(2); }} />
                          </div>
                        )}

                        {step === "surveyFor" && (
                          <div className="enquiry-options">
                            <Choice icon={Sun} title="A new installation" detail="We look at your site for a new solar system" selected={surveyFor === "new"} onClick={() => { setSurveyFor("new"); setStepIndex(2); }} />
                            <Choice icon={BatteryCharging} title="An existing system" detail="We check whether it can be upgraded" selected={surveyFor === "upgrade"} onClick={() => { setSurveyFor("upgrade"); setStepIndex(2); }} />
                            <Choice icon={Building2} title="A business or farm project" detail="A larger business or farm site" selected={surveyFor === "project"} onClick={() => { setSurveyFor("project"); setStepIndex(2); }} />
                            <Choice icon={MapPinned} title="I am not sure yet" detail="We help you work out what you need" selected={surveyFor === "unknown"} onClick={() => { setSurveyFor("unknown"); setStepIndex(2); }} />
                          </div>
                        )}

                        {step === "items" && (
                          <div className="enquiry-items">
                            <label className="sr-only" htmlFor="enquiry-item-search">{intent === "system" ? "Search devices you use" : "Search solar equipment"}</label>
                            <div className="enquiry-search-wrap">
                              <Search size={20} aria-hidden="true" />
                              <input
                                ref={searchRef} id="enquiry-item-search" type="text" autoComplete="off"
                                role="combobox" aria-autocomplete="list" aria-controls="enquiry-suggestions"
                                aria-expanded={popupOpen} aria-activedescendant={activeSuggestion >= 0 && popupOpen ? "enquiry-suggestion-" + activeSuggestion : undefined}
                                placeholder={intent === "system" ? "Search fridge, lights, water pump…" : "Search battery, panel, inverter…"}
                                value={query}
                                onChange={(event) => { setQuery(event.target.value); setShowSuggestions(true); setActiveSuggestion(-1); clearError("items"); }}
                                onFocus={() => setShowSuggestions(true)}
                                onBlur={() => setShowSuggestions(false)}
                                onKeyDown={onSearchKeyDown}
                              />
                              {popupOpen && (
                                <div id="enquiry-suggestions" className="enquiry-suggestions" role="listbox">
                                  {suggestionNames.map((name, index) => (
                                    <button
                                      key={name} id={"enquiry-suggestion-" + index} type="button" role="option"
                                      aria-selected={activeSuggestion === index}
                                      onMouseDown={(event) => event.preventDefault()}
                                      onClick={() => addItem(name, true)}
                                    >
                                      <span>{customSuggestion && index === suggestionNames.length - 1 ? "Add “" + name + "”" : name}</span>
                                      <small>{customSuggestion && index === suggestionNames.length - 1 ? "Your own item" : "Suggested"}</small>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <p className="enquiry-quick-label">Quick picks</p>
                            <div className="enquiry-quick-picks">
                              {catalog.slice(0, 5).filter((item) => !items.includes(item.name)).map((item) => (
                                <button key={item.name} type="button" onClick={() => addItem(item.name)}>+ {item.name}</button>
                              ))}
                            </div>
                            {items.length > 0 && (
                              <div className="enquiry-selected" role="list" aria-label="Selected items">
                                {items.map((item) => (
                                  <span key={item} className="enquiry-selected-item" role="listitem">
                                    {item}
                                    <button type="button" aria-label={"Remove " + item} onClick={() => setItems((previous) => previous.filter((name) => name !== item))}><X size={15} /></button>
                                  </span>
                                ))}
                              </div>
                            )}
                            {intent === "equipment" && (
                              <label className="enquiry-install-toggle"><input type="checkbox" checked={installationHelp} onChange={(event) => setInstallationHelp(event.target.checked)} /> I also need installation help</label>
                            )}
                            {errors.items && <p role="alert" className="enquiry-field-error">{errors.items}</p>}
                          </div>
                        )}

                        {step === "description" && (
                          <div className="enquiry-field">
                            <label htmlFor="enquiry-description">Your description</label>
                            <textarea
                              id="enquiry-description" rows={5} maxLength={500} value={explanation}
                              placeholder={intent === "service" ? "e.g. The inverter has stopped charging the battery" : "e.g. I have frequent blackouts and need advice"}
                              onChange={(event) => { setExplanation(event.target.value); clearError("explanation"); }}
                              aria-invalid={Boolean(errors.explanation)}
                              aria-describedby={errors.explanation ? "enquiry-description-error" : undefined}
                            />
                            {errors.explanation && <p id="enquiry-description-error" role="alert" className="enquiry-field-error">{errors.explanation}</p>}
                          </div>
                        )}

                        {step === "contact" && (
                          <>
                            <form id="enquiry-contact-form" ref={contactFormRef} onSubmit={handleSubmit} autoComplete="on" noValidate className="enquiry-contact-form">
                              {([
                                ["name", "Full name", "text", "name", "Your full name"],
                                ["phone", "Phone number", "tel", "tel", "e.g. 0712 345 678"],
                                ["location", "Town or area", "text", "address-level2", "e.g. Karen, Nairobi"],
                              ] as const).map(([field, label, type, autoComplete, placeholder]) => (
                                <div className="enquiry-field" key={field}>
                                  <label htmlFor={"enquiry-" + field}>{label}</label>
                                  <input
                                    id={"enquiry-" + field} name={field} type={type} autoComplete={autoComplete}
                                    inputMode={field === "phone" ? "tel" : undefined}
                                    placeholder={placeholder} defaultValue={contact[field]} required
                                    maxLength={field === "phone" ? 30 : 100}
                                    aria-invalid={Boolean(errors[field])}
                                    aria-describedby={errors[field] ? "enquiry-" + field + "-error" : undefined}
                                    onInput={(event) => {
                                      // Read the value now: React clears currentTarget before a delayed update runs.
                                      const value = event.currentTarget.value;
                                      setContact((previous) => ({ ...previous, [field]: value }));
                                      clearError(field);
                                    }}
                                  />
                                  {errors[field] && <p id={"enquiry-" + field + "-error"} role="alert" className="enquiry-field-error">{errors[field]}</p>}
                                </div>
                              ))}
                              <div style={honeypotStyle}>
                                <input type="text" name="website" autoComplete="off" tabIndex={-1} aria-hidden="true" />
                              </div>
                            </form>
                            <div className="enquiry-review"><b>{intentNames[intent as Intent]}: </b>{summary}</div>
                            {submitFailed && (
                              <p role="alert" className="enquiry-submit-error">
                                We could not send your request. Please try again or call us on{" "}
                                <a href={callHref(digits)}>{formatPhone(digits)}</a>.
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {!confirmation && (
                    <div className="enquiry-footer">
                      {stepIndex > 0 ? <button type="button" className="enquiry-back" onClick={goBack}><ArrowLeft size={17} /> Back</button> : <span />}
                      {step === "items" && <span className="enquiry-next-hint">{items.length} item{items.length === 1 ? "" : "s"} added</span>}
                      {(step === "items" || step === "description") && <button type="button" className="enquiry-primary" onClick={continueStep}>Continue <ArrowRight size={18} /></button>}
                      {step === "contact" && <button type="submit" form="enquiry-contact-form" className="enquiry-primary" disabled={submitting}>{submitting ? "Sending…" : "Get my free quote"} {!submitting && <ArrowRight size={18} />}</button>}
                    </div>
                  )}
                </div>
              </Dialog.Content>
            </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
