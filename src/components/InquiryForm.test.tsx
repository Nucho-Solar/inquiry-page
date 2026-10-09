// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InquiryForm from "@/components/InquiryForm";
import { submitInquiry } from "@/lib/submitInquiry";
import { trackConversion } from "@/lib/trackConversion";
import { readAttribution } from "@/lib/attribution";

vi.mock("@/lib/submitInquiry", () => ({ submitInquiry: vi.fn() }));
vi.mock("@/lib/trackConversion", () => ({ trackConversion: vi.fn() }));

const submitMock = vi.mocked(submitInquiry);
const trackMock = vi.mocked(trackConversion);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function fillValidForm(
  user: ReturnType<typeof userEvent.setup>,
  phone = "0712 345 678",
) {
  await user.click(screen.getByRole("combobox", { name: /what do you need solar for/i }));
  await user.click(await screen.findByRole("option", { name: "Home - Kenya" }));
  await user.click(await screen.findByRole("button", { name: "Solar Lighting Kit" }));
  await user.type(screen.getByLabelText(/full name/i), "Jane");
  const phoneInput = screen.getByLabelText(/phone number/i);
  await user.clear(phoneInput);
  await user.type(phoneInput, phone);
  await user.type(screen.getByLabelText(/your location/i), "Karen");
  await user.click(screen.getByRole("combobox", { name: /estimated budget/i }));
  await user.click(await screen.findByRole("option", { name: "KSh 50,000 - 100,000" }));
}

const submitButton = () => screen.getByRole("button", { name: /request my free quote|sending/i });

describe("InquiryForm", () => {
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    submitMock.mockReset();
    trackMock.mockReset();
    openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    cleanup();
    openSpy.mockRestore();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("shows the confirmation, tracks the conversion and removes the form on success", async () => {
    vi.stubEnv("VITE_ADS_CONVERSION_LABEL", "lbl");
    submitMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<InquiryForm />);
    await fillValidForm(user);
    await user.click(submitButton());

    expect(
      await screen.findByText("Thanks Jane, we'll contact you on +254712345678."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /request my free quote/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
    expect(openSpy).not.toHaveBeenCalled();
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith("lbl");
  });

  it("keeps the typed values and shows a tel link when the server fails", async () => {
    vi.stubEnv("VITE_CONTACT_PHONE", "254700111222");
    submitMock.mockResolvedValue({ ok: false, reason: "server" });
    const user = userEvent.setup();
    render(<InquiryForm />);
    await fillValidForm(user);
    await user.click(submitButton());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't send your request. Please try again or call us on");
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "tel:+254700111222");
    expect(link).toHaveTextContent("254700111222");
    expect(screen.getByLabelText(/full name/i)).toHaveValue("Jane");
    expect(screen.getByLabelText(/your location/i)).toHaveValue("Karen");
    expect(trackMock).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("falls back to the default contact phone when none is configured", async () => {
    vi.stubEnv("VITE_CONTACT_PHONE", "");
    submitMock.mockResolvedValue({ ok: false, reason: "validation" });
    const user = userEvent.setup();
    render(<InquiryForm />);
    await fillValidForm(user);
    await user.click(submitButton());

    expect(await screen.findByRole("link")).toHaveAttribute("href", "tel:+254758330507");
  });

  it("sends once when submit fires twice before React re-renders, and disables the button while pending", async () => {
    let resolve!: (value: { ok: true }) => void;
    submitMock.mockImplementation(
      () => new Promise((r) => { resolve = r; }),
    );
    const user = userEvent.setup();
    const { container } = render(<InquiryForm />);
    await fillValidForm(user);

    const form = container.querySelector("form") as HTMLFormElement;
    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });

    expect(submitMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(submitButton()).toBeDisabled());
    expect(submitButton()).toHaveTextContent("Sending…");

    resolve({ ok: true });
    expect(await screen.findByText(/^Thanks Jane/)).toBeInTheDocument();
  });

  it("still renders and submits when crypto.randomUUID is unavailable", async () => {
    const realCrypto = globalThis.crypto;
    vi.stubGlobal("crypto", { getRandomValues: realCrypto.getRandomValues.bind(realCrypto) });
    submitMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<InquiryForm />);
    await fillValidForm(user);
    await user.click(submitButton());
    await screen.findByText(/^Thanks Jane/);

    expect(submitMock.mock.calls[0][0].submissionId).toMatch(UUID);
  });

  it("sends the honeypot, a uuid, a timestamp and attribution, and reuses the submission id on retry", async () => {
    window.history.replaceState({}, "", "/?gclid=abc&utm_campaign=solar");
    submitMock.mockResolvedValueOnce({ ok: false, reason: "network" });
    submitMock.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    render(<InquiryForm />);
    await fillValidForm(user);
    await user.click(submitButton());
    await screen.findByRole("alert");
    await user.click(submitButton());
    await screen.findByText(/^Thanks Jane/);

    expect(submitMock).toHaveBeenCalledTimes(2);
    const first = submitMock.mock.calls[0][0];
    const second = submitMock.mock.calls[1][0];
    expect(first.website).toBe("");
    expect(first.submissionId).toMatch(UUID);
    expect(Number.isInteger(first.fillMs)).toBe(true);
    expect(first.fillMs).toBeGreaterThanOrEqual(0);
    expect(first.attribution).toEqual(readAttribution(window.location.search));
    expect(first.attribution).toEqual({ gclid: "abc", utm_campaign: "solar" });
    expect(first.phone).toBe("+254712345678");
    expect(first.services).toEqual(["Solar Lighting Kit"]);
    expect(second.submissionId).toBe(first.submissionId);
    expect(second.fillMs).toBeGreaterThanOrEqual(first.fillMs);
  });

  it("sends fillMs as a performance.now() delta from mount, not a wall-clock time", async () => {
    let clock = 5000;
    const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => clock);
    // A wall clock that is wildly wrong must not affect the value.
    const dateSpy = vi.spyOn(Date, "now").mockReturnValue(4102444800000);
    submitMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<InquiryForm />);
    await fillValidForm(user);
    clock = 5000 + 12345.4;
    await user.click(submitButton());
    await screen.findByText(/^Thanks Jane/);

    expect(submitMock.mock.calls[0][0].fillMs).toBe(12345);
    nowSpy.mockRestore();
    dateSpy.mockRestore();
  });

  it("rejects an invalid phone without calling the API", async () => {
    const user = userEvent.setup();
    render(<InquiryForm />);
    await fillValidForm(user, "07123");
    await user.click(submitButton());

    expect(
      await screen.findByText("Enter a valid phone number, e.g. 0712 345 678"),
    ).toBeInTheDocument();
    expect(submitMock).not.toHaveBeenCalled();
  });

  it.each([
    ["a Kenyan landline", "020 234 5678", "+254202345678"],
    ["an international number", "+1 415 555 0100", "+14155550100"],
  ])("accepts %s and sends it normalised", async (_label, typed, sent) => {
    submitMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<InquiryForm />);
    await fillValidForm(user, typed);
    await user.click(submitButton());
    await screen.findByText(/^Thanks Jane/);

    expect(submitMock.mock.calls[0][0].phone).toBe(sent);
  });

  it("shows a message per field when the form is empty", async () => {
    const user = userEvent.setup();
    render(<InquiryForm />);
    await user.click(submitButton());

    expect(await screen.findByText("Please select a use case")).toBeInTheDocument();
    expect(screen.getByText("Name is required (max 100 characters)")).toBeInTheDocument();
    expect(screen.getByText("Location is required (max 100 characters)")).toBeInTheDocument();
    expect(screen.getByText("Please select your estimated budget")).toBeInTheDocument();
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("labels the phone field without naming a channel", () => {
    const { container } = render(<InquiryForm />);
    expect(screen.getByLabelText("Phone Number *")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/whatsapp/i);
  });

  it("renders the honeypot hidden from assistive tech and the tab order", () => {
    const { container } = render(<InquiryForm />);
    const honeypot = container.querySelector('input[name="website"]');
    expect(honeypot).not.toBeNull();
    expect(honeypot).toHaveAttribute("aria-hidden", "true");
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot).toHaveAttribute("autocomplete", "off");
  });
});
