// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InquiryForm from "@/components/InquiryForm";
import { submitInquiry } from "@/lib/submitInquiry";
import { trackConversion } from "@/lib/trackConversion";

vi.mock("@/lib/submitInquiry", () => ({ submitInquiry: vi.fn() }));
vi.mock("@/lib/trackConversion", () => ({ trackConversion: vi.fn() }));

const submitMock = vi.mocked(submitInquiry);
const trackMock = vi.mocked(trackConversion);

// The four goals sit on the landing page itself, so one click starts the enquiry.
async function start(user: ReturnType<typeof userEvent.setup>, route: string) {
  await user.click(screen.getByRole("button", { name: new RegExp(route, "i") }));
}

async function contactAndSend(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Full name"), "Jane Wanjiru");
  await user.type(screen.getByLabelText("Phone number"), "0712 345 678");
  await user.type(screen.getByLabelText("Town or area"), "Karen");
  await user.click(screen.getByRole("button", { name: /get my free quote/i }));
  await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1));
  return submitMock.mock.calls[0][0];
}

describe("InquiryForm landing page", () => {
  afterEach(() => cleanup());

  it("opens with the offer, the audience and the four goals, with nothing to click first", () => {
    render(<InquiryForm />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Get a free solar quote for your home, office or farm" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Answer 2 or 3 quick questions/)).toHaveTextContent("No technical knowledge needed.");
    // The promise lives on the last step and the success screen. A note under the goals crowded the page.
    expect(screen.queryByText(/Free quote\. We call or WhatsApp/)).not.toBeInTheDocument();
    for (const goal of [
      "Power my home, office or farm",
      "Buy panels, batteries or an inverter",
      "Fix or upgrade my solar system",
      "Get a site visit and quote",
      "not sure",
    ]) {
      expect(screen.getByRole("button", { name: new RegExp(goal, "i") })).toBeInTheDocument();
    }
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /find the right help/i })).not.toBeInTheDocument();
  });

  it("states what each goal gets the visitor, including who pays for a site visit", () => {
    render(<InquiryForm />);
    expect(screen.getByRole("button", { name: /Get a site visit and quote/i })).toHaveAccessibleName(
      /Transport is at your cost/,
    );
    expect(screen.getByRole("button", { name: /Buy panels, batteries or an inverter/i })).toHaveAccessibleName(
      /Panels, batteries, inverters, charge controllers/,
    );
  });

  it("puts a call link and a WhatsApp link in the header", () => {
    render(<InquiryForm />);
    const header = screen.getByRole("banner");
    expect(within(header).getByRole("link", { name: "Call 0758 330 507" })).toHaveAttribute("href", "tel:+254758330507");
    expect(within(header).getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/254758330507");
  });

  it("says where Nucho Solar works in the footer", () => {
    render(<InquiryForm />);
    expect(screen.getByRole("contentinfo")).toHaveTextContent("Serving homes, offices and farms across Kenya");
  });

  it("keeps filler and unsupported claims off the page", () => {
    const { container } = render(<InquiryForm />);
    const text = container.textContent ?? "";
    for (const filler of [
      /find the right help/i,
      /made for your needs/i,
      /take it from there/i,
      /next step/i,
      /relevant/i,
      /guided/i,
      /popular/i,
      /and more/i,
      /1500|5★|24\/7/,
    ]) {
      expect(text).not.toMatch(filler);
    }
  });
});

describe("InquiryForm", () => {
  beforeEach(() => {
    submitMock.mockReset();
    trackMock.mockReset();
    submitMock.mockResolvedValue({ ok: true });
    window.history.replaceState({}, "", "/?gclid=ad-123&utm_campaign=home");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("opens the first relevant question as soon as a goal is chosen", async () => {
    const user = userEvent.setup();
    render(<InquiryForm />);
    await start(user, "Power my home, office or farm");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Where will the system be used?" })).toBeInTheDocument();
    expect(screen.getByText("2 of 4")).toBeInTheDocument();
  });

  it.each([
    "Power my home, office or farm",
    "Buy panels, batteries or an inverter",
    "Fix or upgrade my solar system",
    "Get a site visit and quote",
    "not sure",
  ])("asks the 2 or 3 questions the landing page promises after the goal %s", async (goal) => {
    const user = userEvent.setup();
    render(<InquiryForm />);
    await start(user, goal);
    // The counter includes the goal itself as step 1, so the questions are one fewer.
    const total = Number((screen.getByText(/^2 of \d$/).textContent ?? "").split(" of ")[1]);
    expect(total - 1).toBeGreaterThanOrEqual(2);
    expect(total - 1).toBeLessThanOrEqual(3);
  });

  it("goes back to the goals from the first question", async () => {
    const user = userEvent.setup();
    render(<InquiryForm />);
    await start(user, "Fix or upgrade my solar system");
    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByRole("heading", { name: "What do you need?" })).toBeInTheDocument();
  });

  it("asks only relevant system questions and submits devices without quantities", async () => {
    const user = userEvent.setup();
    render(<InquiryForm />);
    await start(user, "Power my home, office or farm");
    await user.click(screen.getByRole("button", { name: /At home/i }));
    expect(screen.getByRole("heading", { name: "What do you need to power?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /\+ Lights/i }));
    expect(screen.queryByLabelText(/quantity/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /continue/i }));
    const payload = await contactAndSend(user);
    expect(payload).toMatchObject({
      intent: "system", useCase: "home", services: ["Lights"],
      phone: "+254712345678", installationHelp: false,
      attribution: { gclid: "ad-123", utm_campaign: "home" },
    });
    expect(payload).not.toHaveProperty("budget");
    expect(payload.submissionId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(await screen.findByText(/^Thanks, Jane Wanjiru\./)).toBeInTheDocument();
  });

  it("describes each setting by the devices people run there", async () => {
    const user = userEvent.setup();
    render(<InquiryForm />);
    await start(user, "Power my home, office or farm");
    expect(screen.getByRole("button", { name: /At home/i })).toHaveAccessibleName(/Lights, fridge, TV, Wi-Fi/);
    expect(screen.getByRole("button", { name: /At my business/i })).toHaveAccessibleName(/Computers, printers, CCTV, POS/);
    expect(screen.getByRole("button", { name: /On a farm/i })).toHaveAccessibleName(/Pumps, fences, cold rooms/);
  });

  it("labels the shortcuts as quick picks and drops the step labels", async () => {
    const user = userEvent.setup();
    render(<InquiryForm />);
    await start(user, "Power my home, office or farm");
    expect(screen.queryByText(/your setting/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /At home/i }));
    expect(screen.getByText("Quick picks")).toBeInTheDocument();
    expect(screen.queryByText(/common devices|popular/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/size your system/i)).not.toBeInTheDocument();
  });

  it("routes equipment buyers to a product search and installation choice", async () => {
    const user = userEvent.setup();
    render(<InquiryForm />);
    await start(user, "Buy panels, batteries or an inverter");
    expect(screen.getByRole("heading", { name: "Which equipment do you need?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /\+ Solar panels/i }));
    await user.click(screen.getByRole("checkbox", { name: /installation help/i }));
    await user.click(screen.getByRole("button", { name: /continue/i }));
    const payload = await contactAndSend(user);
    expect(payload).toMatchObject({ intent: "equipment", services: ["Solar panels"], installationHelp: true });
    expect(payload.useCase).toBeUndefined();
  });

  it("routes service requests through work type and a short description", async () => {
    const user = userEvent.setup();
    render(<InquiryForm />);
    await start(user, "Fix or upgrade my solar system");
    expect(screen.getByRole("heading", { name: "What do you need done?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Repair or troubleshoot/i }));
    expect(screen.getByRole("heading", { name: "What is the system doing?" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Your description"), "Inverter stopped charging.");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    const payload = await contactAndSend(user);
    expect(payload).toMatchObject({
      intent: "service", serviceType: "repair", explanation: "Inverter stopped charging.", services: [],
    });
  });

  it("tells the visitor about the site visit cost before they send anything", async () => {
    const user = userEvent.setup();
    render(<InquiryForm />);
    await start(user, "Get a site visit and quote");
    expect(screen.getByRole("heading", { name: "What is the visit for?" })).toBeInTheDocument();
    expect(screen.getByText("Quotes are free. For a site visit, you cover our transport.")).toBeInTheDocument();
  });

  it("routes site visits by purpose without asking for devices", async () => {
    const user = userEvent.setup();
    render(<InquiryForm />);
    await start(user, "Get a site visit and quote");
    await user.click(screen.getByRole("button", { name: /A business or farm project/i }));
    expect(document.querySelector(".enquiry-review")).toHaveTextContent("Site visit: for a business or farm project");
    const payload = await contactAndSend(user);
    expect(payload).toMatchObject({ intent: "survey", surveyFor: "project", services: [] });
  });

  it("accepts an undecided visitor's own description", async () => {
    const user = userEvent.setup();
    render(<InquiryForm />);
    await start(user, "not sure");
    expect(screen.getByRole("heading", { name: "What would you like help with?" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Your description"), "I need advice for a backup system.");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    const payload = await contactAndSend(user);
    expect(payload).toMatchObject({ intent: "unsure", explanation: "I need advice for a backup system." });
  });

  it("blocks an empty device selection and accepts a custom item typed before Continue", async () => {
    const user = userEvent.setup();
    render(<InquiryForm />);
    await start(user, "Power my home, office or farm");
    await user.click(screen.getByRole("button", { name: /At home/i }));
    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByRole("alert")).toHaveTextContent("Add at least one item");
    await user.type(screen.getByRole("combobox", { name: "Search devices you use" }), "Solar gate motor");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    const payload = await contactAndSend(user);
    expect(payload.services).toEqual(["Solar gate motor"]);
  });

  it("asks for contact details last, with the 24 hour promise and the free quote button", async () => {
    const user = userEvent.setup();
    render(<InquiryForm />);
    await start(user, "Get a site visit and quote");
    await user.click(screen.getByRole("button", { name: /A new installation/i }));
    expect(screen.getByText("Last step")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "How can we reach you?" })).toBeInTheDocument();
    expect(screen.getByText("We'll call or WhatsApp you within 24 hours on this number.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get my free quote" })).toBeInTheDocument();
    expect(screen.queryByText(/saved details/i)).not.toBeInTheDocument();
  });

  it("starts a fresh enquiry with a new id after a sent one is closed", async () => {
    const user = userEvent.setup();
    render(<InquiryForm />);
    await start(user, "Get a site visit and quote");
    await user.click(screen.getByRole("button", { name: /A new installation/i }));
    const first = await contactAndSend(user);
    expect(await screen.findByText(/^Thanks, Jane Wanjiru\./)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close enquiry" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await start(user, "Fix or upgrade my solar system");
    expect(screen.queryByText(/^Thanks, /)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What do you need done?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Repair or troubleshoot/i }));
    await user.type(screen.getByLabelText("Your description"), "Inverter stopped charging.");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByLabelText("Full name")).toHaveValue("");
    submitMock.mockClear();
    const second = await contactAndSend(user);
    expect(second.intent).toBe("service");
    expect(second.submissionId).not.toBe(first.submissionId);
  });

  it("keeps every contact field when a browser or password manager fills several at once", async () => {
    const user = userEvent.setup();
    render(<InquiryForm />);
    await start(user, "Get a site visit and quote");
    await user.click(screen.getByRole("button", { name: /A new installation/i }));
    expect(() =>
      act(() => {
        for (const [label, value] of [
          ["Full name", "Jane Wanjiru"],
          ["Phone number", "0712 345 678"],
          ["Town or area", "Karen"],
        ]) {
          const input = screen.getByLabelText(label) as HTMLInputElement;
          input.value = value;
          fireEvent.input(input);
        }
      }),
    ).not.toThrow();
    await user.click(screen.getByRole("button", { name: /get my free quote/i }));
    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1));
    expect(submitMock.mock.calls[0][0]).toMatchObject({ name: "Jane Wanjiru", phone: "+254712345678", location: "Karen" });
  });

  it("keeps all contact fields together with browser autofill hints and validates phone", async () => {
    const user = userEvent.setup();
    render(<InquiryForm />);
    await start(user, "Get a site visit and quote");
    await user.click(screen.getByRole("button", { name: /A new installation/i }));
    expect(screen.getByLabelText("Full name")).toHaveAttribute("autocomplete", "name");
    expect(screen.getByLabelText("Phone number")).toHaveAttribute("autocomplete", "tel");
    expect(screen.getByLabelText("Town or area")).toHaveAttribute("autocomplete", "address-level2");
    await user.type(screen.getByLabelText("Full name"), "Jane");
    await user.type(screen.getByLabelText("Phone number"), "123");
    await user.type(screen.getByLabelText("Town or area"), "Karen");
    await user.click(screen.getByRole("button", { name: /get my free quote/i }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid phone number");
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("shows the number to call when sending fails", async () => {
    submitMock.mockResolvedValue({ ok: false, reason: "server" });
    const user = userEvent.setup();
    render(<InquiryForm />);
    await start(user, "Get a site visit and quote");
    await user.click(screen.getByRole("button", { name: /A new installation/i }));
    await contactAndSend(user);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We could not send your request. Please try again or call us on 0758 330 507.");
    expect(within(alert).getByRole("link", { name: "0758 330 507" })).toHaveAttribute("href", "tel:+254758330507");
  });

  it("suppresses conversion for the honeypot and retains the same id after a failed retry", async () => {
    vi.stubEnv("VITE_ADS_CONVERSION_LABEL", "label");
    submitMock.mockResolvedValueOnce({ ok: false, reason: "server" }).mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    render(<InquiryForm />);
    await start(user, "Get a site visit and quote");
    await user.click(screen.getByRole("button", { name: /A new installation/i }));
    fireEvent.change(document.querySelector('input[name="website"]') as HTMLInputElement, { target: { value: "spam" } });
    await contactAndSend(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("We could not send your request");
    expect(screen.getByLabelText("Full name")).toHaveValue("Jane Wanjiru");
    await user.click(screen.getByRole("button", { name: /get my free quote/i }));
    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(2));
    expect(submitMock.mock.calls[1][0].submissionId).toBe(submitMock.mock.calls[0][0].submissionId);
    expect(trackMock).not.toHaveBeenCalled();
  });
});
