import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-20">
      <Card className="text-center">
        <p className="text-sm uppercase tracking-[0.25em] text-primary/80">404</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Stock not found</h1>
        <p className="mt-3 text-sm leading-7 text-muted">
          The symbol could not be loaded right now. Try another NSE or BSE symbol.
        </p>
        <Link href="/" className="mt-6 inline-block">
          <Button>Back to dashboard</Button>
        </Link>
      </Card>
    </div>
  );
}
