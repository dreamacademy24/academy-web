export const HOTEL_PICKUP_MARKER = '[체크인 숙소 픽업]';
export const isHotelPickup = (notes?: string | null) => (notes || '').includes(HOTEL_PICKUP_MARKER);
