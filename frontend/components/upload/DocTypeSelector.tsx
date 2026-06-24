"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const DOC_TYPES = [
  {
    key: "gstr3b",
    label: "GSTR-3B",
    description:
      "Monthly GST return. Extracts outward supply figures, tax liability, and ITC breakdowns.",
    fields: [
      "GSTIN",
      "Tax Period & Financial Year",
      "Output IGST / CGST / SGST",
      "ITC matrix (IGST / CGST / SGST)",
      "Tax payable & net tax",
      "35 fields total",
    ],
  },
  {
    key: "esic",
    label: "ESIC",
    description:
      "ESIC challan. Extracts contribution details, IP counts, and challan metadata.",
    fields: [
      "Employer Code",
      "Contribution Period",
      "Challan Number & Date",
      "Number of IPs",
      "Employer Contribution",
      "Employee Contribution",
      "Total Amount",
    ],
  },
  {
    key: "pf_ecr",
    label: "PF ECR",
    description:
      "PF Electronic Challan cum Return. Extracts all account-wise contribution breakdowns.",
    fields: [
      "Establishment ID & Name",
      "Wage Month & TRRN",
      "AC01 / AC02 / AC10 / AC21 / AC22 breakdowns",
      "Total Members",
      "Admin Charges",
      "Total Amount",
    ],
  },
  {
    key: "ptrc",
    label: "PTRC",
    description:
      "Maharashtra Professional Tax Registration Certificate challan.",
    fields: [
      "PTRC Number",
      "TAN of Employer",
      "Employer Name",
      "Period",
      "Number of Employees",
      "PT Amount",
      "Challan Number",
    ],
  },
  {
    key: "tds_itns281",
    label: "TDS",
    description:
      "TDS / OLTAS challan (ITNS 281). Extracts all tax deposit details.",
    fields: [
      "TAN & PAN",
      "Assessment Year & Quarter",
      "Section Code & Major Head",
      "BSR Code & Challan Number",
      "Date of Deposit",
      "Tax / Surcharge / Cess / Interest / Penalty",
      "Total Amount",
      "16 fields total",
    ],
  },
];

interface DocTypeSelectorProps {
  selected: string;
  onSelect: (docType: string) => void;
}

export function DocTypeSelector({ selected, onSelect }: DocTypeSelectorProps) {
  return (
    <TabsPrimitive.Root value={selected} onValueChange={onSelect}>
      {/* Tab triggers */}
      <TabsPrimitive.List className="flex flex-wrap gap-1 p-1 bg-muted rounded-lg w-fit max-w-full">
        {DOC_TYPES.map((dt) => (
          <TabsPrimitive.Trigger
            key={dt.key}
            value={dt.key}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all duration-150 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected === dt.key
                ? "bg-primary text-white shadow-sm"
                : "bg-transparent text-primary hover:bg-white/60"
            )}
          >
            {dt.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      {/* Tab panels */}
      {DOC_TYPES.map((dt) => (
        <TabsPrimitive.Content
          key={dt.key}
          value={dt.key}
          className="mt-3 focus-visible:outline-none"
        >
          <div className="rounded-lg border border-border bg-white px-5 py-4">
            <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
              <span className="font-semibold text-foreground">{dt.label}: </span>
              {dt.description}
            </p>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Fields extracted
            </p>
            <ul className="flex flex-wrap gap-2">
              {dt.fields.map((field) => (
                <li
                  key={field}
                  className="text-xs bg-primary/5 text-primary border border-primary/10 rounded-md px-2.5 py-1 font-medium"
                >
                  {field}
                </li>
              ))}
            </ul>
          </div>
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
