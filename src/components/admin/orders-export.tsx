"use client";

import { useState } from "react";
import { downloadCsv, toCsv } from "@/lib/csv";
import { Button } from "@/components/ui";

export interface ExportableOrder {
  order_number: string;
  customer_name: string;
  customer_phone: string;
  address_line: string;
  area: string | null;
  district: string;
  division: string;
  postcode: string | null;
  total: number;
  payment_method: string;
  total_lot?: number;
  delivery_note?: string | null;
}

/**
 * অর্ডার CSV এক্সপোর্ট।
 *
 * কেন দরকার? বাংলাদেশের অনেক ছোট দোকানদার কুরিয়ারের **নিজস্ব পোর্টালে**
 * কপি-পেস্ট করে অর্ডার তোলেন (SteadFast / Pathao / RedX সবখানেই এই সুবিধা আছে)।
 * API ইন্টিগ্রেশন না থাকলেও এই CSV দিয়ে এক বসায় ৫০টি অর্ডার তোলা যায়।
 *
 * কলামগুলো ইচ্ছাকৃতভাবে ইংরেজিতে — কারণ কুরিয়ারের পোর্টাল ইংরেজি
 * হেডার খোঁজে। বাংলা মান ঠিক রাখতে BOM যোগ করা হয় (Excel এর জন্য)।
 */
export function OrdersExport({
  orders,
  courierName,
}: {
  orders: ExportableOrder[];
  courierName?: string;
}) {
  const [busy, setBusy] = useState(false);

  function handleExport() {
    if (orders.length === 0) return;
    setBusy(true);

    const headers = [
      "invoice",
      "recipient_name",
      "recipient_phone",
      "recipient_address",
      "cod_amount",
      "item_description",
      "note",
      "order_number",
      "payment_method",
    ];

    const rows = orders.map((o) => {
      const address = [o.address_line, o.area, o.district, o.division, o.postcode]
        .filter(Boolean)
        .join(", ");

      return [
        o.order_number,
        o.customer_name,
        o.customer_phone,
        address,
        // অগ্রিম পেমেন্ট হলে কুরিয়ারকে টাকা তুলতে বলা যাবে না
        o.payment_method === "cod" ? o.total : 0,
        `${o.total_lot ?? 1} item(s)`,
        o.delivery_note ?? "",
        o.order_number,
        o.payment_method,
      ];
    });

    const today = new Date().toISOString().slice(0, 10);
    const prefix = courierName
      ? courierName.toLowerCase().replace(/\s+/g, "-")
      : "orders";

    downloadCsv(`${prefix}-${today}.csv`, toCsv(headers, rows, { bom: true }));
    setBusy(false);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={busy || orders.length === 0}
      title="কুরিয়ারের পোর্টালে পেস্ট করার জন্য CSV"
    >
      ⬇️ কুরিয়ারের জন্য CSV ({orders.length})
    </Button>
  );
}
