/**
 * The two halves of a delivery address, told apart.
 *
 * The map pin yields a Google-formatted line for the building, and the
 * customer types their flat or house number separately. Joining them
 * into "5/8, Vikalp Khand, Gomti Nagar" reads as one address that no map
 * agrees with — and leaves the rider unsure which part is the door and
 * which is the area. Two labelled lines instead.
 */
export function DeliveryAddress({
  flatNo,
  formattedAddress,
}: {
  flatNo?: string | undefined;
  formattedAddress?: string | undefined;
}) {
  if (!flatNo && !formattedAddress) {
    return <span className="text-body">No address on file</span>;
  }

  if (!flatNo) {
    return <span className="text-body">{formattedAddress}</span>;
  }

  return (
    <span className="text-body block">
      <span className="block font-medium">{flatNo}</span>
      {formattedAddress && (
        <span className="text-caption text-muted-foreground block">
          Pinned location: {formattedAddress}
        </span>
      )}
    </span>
  );
}
