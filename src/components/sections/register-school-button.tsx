"use client";

import { useState } from "react";
import type { RegistrationFormData } from "@/lib/forms";
import { Button } from "../../components/ui/button";
import RegistrationModal from "./registration-modal";

export default function RegisterSchoolButton({
  label = "Register Your School",
  autoOpen = false,
  prefill,
  inviteToken,
}: {
  label?: string;
  autoOpen?: boolean;
  prefill?: Partial<RegistrationFormData>;
  inviteToken?: string;
} = {}) {
  const [isOpen, setIsOpen] = useState(autoOpen);

  return (
    <>
      <Button
        variant="default"
        className="py-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
        onClick={() => setIsOpen(true)}
      >
        {label}
      </Button>
      <RegistrationModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        prefill={prefill}
        inviteToken={inviteToken}
      />
    </>
  );
}
