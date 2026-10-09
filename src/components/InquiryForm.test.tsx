// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InquiryForm from "@/components/InquiryForm";
import { submitInquiry } from "@/lib/submitInquiry";
import { trackConversion } from "@/lib/trackConversion";

vi.mock("@/lib/submitInquiry", () => ({ submitInquiry: vi.fn() }));
vi.mock("@/lib/trackConversion", () => ({ trackConversion: vi.fn() }));

const submitMock = vi.mocked(submitInquiry);
const trackMock = vi.mocked(trackConversion);

async function start(user: ReturnType<typeof userEvent.setup>, route: string) {
  await user.click(screen.getByRole("button", { name: /find the right help/i }));
  await user.click(screen.getByRole("button", { name: new RegExp(route, "i") }));
}

async function contactAndSend(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Full name"), "Jane Wanjiru");
  await user.type(screen.getByLabelText("Phone number"), "0712 345 678");
  await user.type(screen.getByLabelText("Town or area"), "Karen");
  await user.click(screen.getByRole("button", { name: /send enquiry/i }));
  await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1));
  return submitMock.mock.calls[0][0];
}

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

  it("asks only relevant system questions and submits devices without quantities", async () => {
    const user = userEvent.setup();
    render(<InquiryForm />);
    await start(user, "Get a solar system");
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

  it("routes equipment buyers to a product search and installation choice", async () => {
    const user = userEvent.setup();
    render(<InquiryForm />);
    await start(user, "Buy solar equipment");
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
    await start(user, "Service an existing system");
    await user.click(screen.getByRole("button", { name: /Repair or troubleshoot/i }));
    await user.type(screen.getByLabelText("Your description"), "Inverter stopped charging.");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    const payload = await contactAndSend(user);
    expect(payload).toMatchObject({
      intent: "service", serviceType: "repair", explanation: "Inverter stopped charging.", services: [],
    });
  });

  it("routes assessments by purpose without asking for devices", async () => {
    const user = userEvent.setup();
    render(<InquiryForm />);
    await start(user, "Request a site assessment");
    await user.click(screen.getByRole("button", { name: /A business or farm project/i }));
    const payload = await contactAndSend(user);
    expect(payload).toMatchObject({ intent: "survey", surveyFor: "project", services: [] });
  });

  it("accepts an undecided visitor's own description", async () => {
    const user = userEvent.setup();
    render(<InquiryForm />);
    await start(user, "I am not sure");
    await user.type(screen.getByLabelText("Your description"), "I need advice for a backup system.");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    const payload = await contactAndSend(user);
    expect(payload).toMatchObject({ intent: "unsure", explanation: "I need advice for a backup system." });
  });

  it("blocks an empty device selection and accepts a custom item typed before Continue", async () => {
    const user = userEvent.setup();
    render(<InquiryForm />);
    await start(user, "Get a solar system");
    await user.click(screen.getByRole("button", { name: /At home/i }));
    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByRole("alert")).toHaveTextContent("Add at least one item");
    await user.type(screen.getByRole("combobox", { name: "Search devices you use" }), "Solar gate motor");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    const payload = await contactAndSend(user);
    expect(payload.services).toEqual(["Solar gate motor"]);
  });

  it("keeps all contact fields together with browser autofill hints and validates phone", async () => {
    const user = userEvent.setup();
    render(<InquiryForm />);
    await start(user, "Request a site assessment");
    await user.click(screen.getByRole("button", { name: /A new installation/i }));
    expect(screen.getByLabelText("Full name")).toHaveAttribute("autocomplete", "name");
    expect(screen.getByLabelText("Phone number")).toHaveAttribute("autocomplete", "tel");
    expect(screen.getByLabelText("Town or area")).toHaveAttribute("autocomplete", "address-level2");
    await user.type(screen.getByLabelText("Full name"), "Jane");
    await user.type(screen.getByLabelText("Phone number"), "123");
    await user.type(screen.getByLabelText("Town or area"), "Karen");
    await user.click(screen.getByRole("button", { name: /send enquiry/i }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid phone number");
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("suppresses conversion for the honeypot and retains the same id after a failed retry", async () => {
    vi.stubEnv("VITE_ADS_CONVERSION_LABEL", "label");
    submitMock.mockResolvedValueOnce({ ok: false, reason: "server" }).mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    render(<InquiryForm />);
    await start(user, "Request a site assessment");
    await user.click(screen.getByRole("button", { name: /A new installation/i }));
    fireEvent.change(document.querySelector('input[name="website"]') as HTMLInputElement, { target: { value: "spam" } });
    await contactAndSend(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("We could not send your request");
    expect(screen.getByLabelText("Full name")).toHaveValue("Jane Wanjiru");
    await user.click(screen.getByRole("button", { name: /send enquiry/i }));
    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(2));
    expect(submitMock.mock.calls[1][0].submissionId).toBe(submitMock.mock.calls[0][0].submissionId);
    expect(trackMock).not.toHaveBeenCalled();
  });
});
