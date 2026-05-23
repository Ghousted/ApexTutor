import { Suspense } from "react";
import BillingSuccessClient from "./BillingSuccessClient";

export default function BillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-to-b from-[#fde6d3] via-[#fdeede] to-white" />
      }
    >
      <BillingSuccessClient />
    </Suspense>
  );
}
