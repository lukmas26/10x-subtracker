import type { ReactNode } from "react";
import { Repeat, Save, Tag } from "lucide-react";
import { FormField } from "@/components/form/FormField";
import { SelectField } from "@/components/form/SelectField";
import { ServerError } from "@/components/form/ServerError";
import { SubmitButton } from "@/components/form/SubmitButton";
import { CYCLES } from "@/types";

// Fixture-only block for the dev kitchen sink (`src/pages/dev/kitchen-sink.astro`).
// Rendered on the server without hydration: focus, hover and typing still work in the browser.

interface Props {
  /** Keeps element ids unique when the block is rendered once per theme column. */
  idPrefix: string;
}

const noop = () => undefined;

export function StateLabel({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">{children}</p>;
}

function CycleOptions() {
  return (
    <>
      <option value="" disabled>
        Choose a cycle
      </option>
      {CYCLES.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </>
  );
}

export default function KitchenSinkFields({ idPrefix }: Props) {
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <StateLabel>FormField — default (empty)</StateLabel>
          <FormField
            id={id("name-empty")}
            label="Name"
            value=""
            onChange={noop}
            placeholder="e.g. Netflix"
            icon={<Tag className="size-4" />}
          />
        </div>
        <div>
          <StateLabel>FormField — default (filled)</StateLabel>
          <FormField
            id={id("name-filled")}
            label="Name"
            value="Netflix"
            onChange={noop}
            icon={<Tag className="size-4" />}
          />
        </div>
        <div>
          <StateLabel>FormField — error</StateLabel>
          <FormField
            id={id("name-error")}
            label="Name"
            value=""
            onChange={noop}
            placeholder="e.g. Netflix"
            error="Name is required"
            icon={<Tag className="size-4" />}
          />
        </div>
        <div>
          <StateLabel>FormField — disabled</StateLabel>
          <FormField
            id={id("name-disabled")}
            label="Name"
            value="Netflix"
            onChange={noop}
            disabled
            icon={<Tag className="size-4" />}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <StateLabel>SelectField — default</StateLabel>
          <SelectField
            id={id("cycle-default")}
            label="Billing cycle"
            value="monthly"
            onChange={noop}
            icon={<Repeat className="size-4" />}
          >
            <CycleOptions />
          </SelectField>
        </div>
        <div>
          <StateLabel>SelectField — error</StateLabel>
          <SelectField
            id={id("cycle-error")}
            label="Billing cycle"
            value=""
            onChange={noop}
            error="Choose a cycle"
            icon={<Repeat className="size-4" />}
          >
            <CycleOptions />
          </SelectField>
        </div>
        <div>
          <StateLabel>SelectField — disabled</StateLabel>
          <SelectField
            id={id("cycle-disabled")}
            label="Billing cycle"
            value="yearly"
            onChange={noop}
            disabled
            icon={<Repeat className="size-4" />}
          >
            <CycleOptions />
          </SelectField>
        </div>
      </div>

      <div>
        <StateLabel>ServerError</StateLabel>
        <ServerError message="Could not save the subscription. Please try again." />
      </div>

      <div className="space-y-4">
        <form>
          <StateLabel>SubmitButton — default</StateLabel>
          <SubmitButton pendingText="Saving..." icon={<Save className="size-4" />}>
            Add subscription
          </SubmitButton>
        </form>
        <form>
          <StateLabel>SubmitButton — disabled</StateLabel>
          <SubmitButton pendingText="Saving..." icon={<Save className="size-4" />} disabled>
            Add subscription
          </SubmitButton>
        </form>
        <form>
          <StateLabel>SubmitButton — pending (loading)</StateLabel>
          <SubmitButton pendingText="Saving..." icon={<Save className="size-4" />} pending>
            Add subscription
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
