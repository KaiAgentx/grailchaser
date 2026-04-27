"use client";
import { useState } from "react";
import { BottomSheet } from "@/components/atoms/BottomSheet";
import { ModalTopBar } from "@/components/shell/ModalTopBar";
import { ActionButton } from "@/components/atoms/ActionButton";
import { MoneyInput } from "@/components/atoms/MoneyInput";

/**
 * NegotiateModal — bottom sheet to enter a counter-offer.
 *
 * The actual POST happens in ShowModeResult. This modal just collects the
 * counter-offer amount and hands it back via onSubmit, so ShowModeResult
 * can wrap the negotiation into a single decision call (decision='negotiated'
 * + negotiated_price_usd).
 */

interface Props {
  open: boolean;
  /** Initial value — typically the current Dealer Ask. */
  initialOffer?: number;
  onClose: () => void;
  onSubmit: (counterOffer: number) => void;
}

export function NegotiateModal({ open, initialOffer = 0, onClose, onSubmit }: Props) {
  const [offer, setOffer] = useState(initialOffer);

  const handleClose = () => {
    setOffer(initialOffer);
    onClose();
  };

  const handleSubmit = () => {
    if (offer <= 0) return;
    onSubmit(offer);
  };

  return (
    <BottomSheet open={open} onClose={handleClose} ariaLabel="Negotiate counter-offer">
      <ModalTopBar title="Negotiate" onClose={handleClose} />
      <div className="font-gc-ui" style={{ padding: "16px 20px 24px" }}>
        <div style={{ fontSize: 13, color: "var(--gc-text-secondary)", marginBottom: 16 }}>
          Enter your counter-offer. The dealer's original ask stays recorded.
        </div>
        <div style={{ fontSize: 11, color: "var(--gc-text-muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 6 }}>
          Counter-offer
        </div>
        <div style={{ marginBottom: 20 }}>
          <MoneyInput value={offer} onChange={setOffer} autoFocus />
        </div>
        <ActionButton
          variant="negotiate"
          label="OFFER"
          size="lg"
          onClick={handleSubmit}
          disabled={offer <= 0}
        />
      </div>
    </BottomSheet>
  );
}
