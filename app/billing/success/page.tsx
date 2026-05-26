import { Suspense } from "react";
import BillingSuccessClient from "./BillingSuccessClient";

export default function BillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-void-black" />
      }
    >
      <BillingSuccessClient />
    </Suspense>
  );
}
