# Enquiry page design direction

Status: approved prototype direction for the enquiry page, 9 October 2026.

## Direction

Calm, photo-led solar advice: a brief invitation followed by one relevant question at a time. The four customer goals are a compact vertical list because their text, rather than an image, distinguishes them. The final contact step groups three related fields for browser autofill.

## References

- Approved `prototypes/intent-routed-enquiry/` landing and desktop goal selector.
- Approved prototype at a 320px mobile viewport: one-column goal selector and fixed progress and navigation.
- Approved prototype device selection and final contact screen: searchable suggestions, compact selected labels, and three contact fields together.

These are the screens reviewed in the enquiry design conversation. The existing storefront photograph and Nucho Solar identity are reused; no metrics or service guarantees are invented.

## Colour and type

- Deep navy `hsl(207 77% 15%)`: hero, sidebar, and strong headings.
- Warm yellow `hsl(43 79% 59%)`: primary action and progress.
- Soft off-white `hsl(75 22% 96%)`: form surface.
- Muted blue-grey `hsl(192 13% 45%)`: supporting text.
- Outfit for display headings; DM Sans for labels, fields, and body copy. Arial and sans-serif are fallbacks.

The storefront's roof-and-sun logo is used in two supplied colourways: yellow and white lettering on the dark hero/sidebar, and dark lettering with a green tagline in the light mobile form header. The favicon keeps the roof-and-sun mark without tiny unreadable lettering.

Enquiry colours and layout live in `src/styles/enquiry.css` to keep the rest of the app's theme untouched; generated `src/components/ui/` components remain untouched.

## Interaction and accessibility

- Keep the question, choices, and progress visible without horizontal scrolling at 320px.
- Show only questions relevant to the chosen goal. Reduced-motion users receive an immediate transition.
- Use real labels and stable `name`, `id`, `autocomplete`, and `type` values for contact fields. Browser autofill is offered only when the visitor has saved details.
- Keep a visible Back action, preserve answers when moving between steps, and show errors beside their fields.
- Final submission remains through `/api/inquiry`; the honeypot, fill timing, retry id, attribution, and conversion rules stay in effect.

## Out of scope

- Automatic system sizing or a price estimate.
- Claims that a particular service, site visit, or product is guaranteed available.
- Changes to the storefront, legacy deployment files, or production configuration.
