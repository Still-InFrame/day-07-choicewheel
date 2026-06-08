"use client";

import "react-phone-number-input/style.css";
import PhoneInput, { isValidPhoneNumber, type Country } from "react-phone-number-input";
import { useState } from "react";
import { submitClaim } from "@/lib/api";
import { isValidEmail } from "@/lib/validation";

// Shown only to the device that submitted the winning item, to collect prize contact info.
export function ClaimForm({ itemId, onDone }: { itemId: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState<string | undefined>(undefined);
  const [country, setCountry] = useState<Country | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const phoneValid = !!phone && isValidPhoneNumber(phone);
  const emailValid = isValidEmail(email);
  const nameValid = name.trim().length > 0;
  const canSubmit = nameValid && emailValid && phoneValid && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !phone) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitClaim({ itemId, name: name.trim(), email: email.trim(), phone, country: country ?? null });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mt-5 rounded-xl bg-emerald-500/15 border border-emerald-400/40 p-4 text-center">
        <p className="font-semibold text-emerald-200">You&apos;re in! 🎉</p>
        <p className="text-sm text-emerald-100/80 mt-1">
          Your details were sent to the organizer. They&apos;ll be in touch.
        </p>
        <button onClick={onDone} className="mt-3 text-sm underline text-emerald-100/90">
          Close
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 text-left space-y-3">
      <p className="text-sm text-white/70">You won! Enter your details to claim your prize:</p>

      <div>
        <label className="block text-xs uppercase tracking-wide text-white/50 mb-1">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2.5 outline-none focus:border-violet-400"
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wide text-white/50 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2.5 outline-none focus:border-violet-400"
        />
        {email.length > 0 && !emailValid && (
          <p className="text-xs text-rose-300 mt-1">Enter a valid email address.</p>
        )}
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wide text-white/50 mb-1">Phone</label>
        <PhoneInput
          international
          defaultCountry="US"
          value={phone}
          onChange={setPhone}
          onCountryChange={setCountry}
          placeholder="Phone number"
        />
        {phone && phone.length > 4 && !phoneValid && (
          <p className="text-xs text-rose-300 mt-1">Enter a valid phone number for the selected country.</p>
        )}
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-lg bg-violet-500 hover:bg-violet-400 disabled:opacity-40 disabled:hover:bg-violet-500 font-semibold py-2.5 transition"
      >
        {submitting ? "Sending…" : "Claim prize"}
      </button>
    </form>
  );
}
