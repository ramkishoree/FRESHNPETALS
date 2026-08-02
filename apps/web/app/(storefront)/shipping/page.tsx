import type { Metadata } from 'next';
import { LegalPage } from '@/components/storefront/legal-page';
import { BUSINESS, serviceCityList } from '@/lib/legal/business-details';

export const metadata: Metadata = {
  title: 'Shipping & Delivery Policy | Fresh & Petals',
  description:
    'Where Fresh & Petals delivers, what delivery costs, same-day cut-off times, delivery slots, and what happens when a delivery cannot be completed.',
};

/**
 * Razorpay's merchant activation checklist asks for a shipping/delivery
 * policy by name, and the Consumer Protection (E-Commerce) Rules 2020
 * require published delivery terms. The numbers here are the ones
 * checkout actually charges — they come from the same constants, so the
 * page cannot drift from the code the way a hand-typed policy would.
 */
export default function ShippingPage() {
  return (
    <LegalPage
      title="Shipping & Delivery Policy"
      updated="2026-08-02"
      intro={[
        'We are a florist, not a courier. Everything is made fresh the morning it goes out and delivered by our own people, which is why our terms look different from a parcel retailer’s.',
      ]}
      sections={[
        {
          heading: 'Where we deliver',
          body: [
            `We currently deliver in ${serviceCityList()}. Serviceable areas are limited by the distance from our nearest outlet, so a few outlying addresses within these cities may not be covered.`,
            'The delivery map at checkout is the authority: if you can drop a pin and see a delivery fee, we can deliver there. If the address is out of range, checkout will tell you before you pay.',
          ],
        },
        {
          heading: 'Delivery charges',
          body: [
            `Delivery is charged by distance from the outlet nearest to your delivery pin: ₹${BUSINESS.deliveryBaseFee} for the first ${BUSINESS.deliveryBaseKm} km, plus ₹${BUSINESS.deliveryPerKmFee} for each additional kilometre.`,
            'The exact amount is calculated and shown at checkout before payment. There are no other delivery charges, and no charge is added after you pay.',
          ],
        },
        {
          heading: 'Delivery times and same-day orders',
          body: [
            `Same-day delivery is available for orders placed before ${BUSINESS.sameDayCutoff}, subject to stock and slot availability. Orders placed after that are scheduled for the next available day.`,
            'You choose a delivery date and a time slot at checkout. Slots are allocated on a first-come basis and a slot can close once it is full.',
            'Delivery windows are honest estimates based on outlet workload, distance and traffic. They are not guaranteed times, and we do not offer timed-to-the-minute delivery.',
          ],
        },
        {
          heading: 'Getting the address right',
          body: [
            'You are responsible for the accuracy of the delivery pin, the address details, and the recipient’s phone number. A pin dropped on the wrong building is the single most common cause of a failed delivery.',
            'Add the flat or house number, floor, and a landmark in the address field — the map pin alone rarely gets a delivery person to a specific door.',
            'If you need to correct an address, contact us immediately. We can usually change it before dispatch; after dispatch we cannot.',
          ],
        },
        {
          heading: 'When the recipient is not available',
          body: [
            'Most of our deliveries are gifts, so the recipient may not know one is coming. Our delivery person will call the recipient, and then you, if there is no answer at the door.',
            'Where it is safe and reasonable to do so, we may leave the order with a neighbour, a building security desk, or a reception, and note who received it. This counts as delivered.',
            'If we cannot deliver at all, the order returns to the outlet. Because flowers perish within hours, we cannot generally hold, re-deliver or refund an order that failed because nobody was available at the address you gave. We will always call you before treating a delivery as failed.',
          ],
        },
        {
          heading: 'Delays outside our control',
          body: [
            'Extreme weather, floods, strikes, processions, curfews or restrictions imposed by authority, road closures and market supply failures can delay or prevent a delivery. Where that happens we will contact you as early as we can to reschedule, or refund you in full if rescheduling does not work for you.',
          ],
        },
        {
          heading: 'Proof of delivery',
          body: [
            'We record the time of delivery and, where the recipient was not the person who ordered, who accepted it. If you would like confirmation that a gift arrived, ask us and we will tell you.',
          ],
        },
        {
          heading: 'Something went wrong with a delivery',
          body: [
            `Contact us at ${BUSINESS.supportEmail} or ${BUSINESS.supportPhone} (${BUSINESS.supportHours}). If an order arrived damaged, was the wrong item, or never arrived, our Cancellation & Refund Policy sets out what you are entitled to and how to claim it.`,
          ],
        },
      ]}
    />
  );
}
