"use client";

import { useState } from "react";

// Password field with a Show/Hide toggle. Works inside plain server-action
// forms (login, signup) via `name`, or controlled (reset-password) via
// `value`/`onChange` — everything else passes straight through to <input>.
export default function PasswordInput(
  props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
) {
  const [visible, setVisible] = useState(false);
  const { className, ...rest } = props;

  return (
    <div className="relative">
      <input
        {...rest}
        type={visible ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={`${className ?? ""} pr-16`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 px-3 font-mono text-xs text-gold hover:text-gold/80"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
