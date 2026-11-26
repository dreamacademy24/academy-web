// Capacity belongs to the registered inventory. Bookings already assigned to
// another numbered house do not consume that inventory; unassigned ones do.
export function countRoomOccupancy(rooms: string[], inventory: string[]): number {
  const normalize = (room: string) => room.trim().replace(/\s+/g, '').replace(/^b(\d+)-(\d+)$/i, 'b$1l$2').toLowerCase();
  const known = new Set(inventory.map(normalize));
  const occupied = new Set<string>();
  let unassigned = 0;
  for (const value of rooms) {
    const room = normalize(value);
    if (known.has(room)) occupied.add(room);
    else if (!/^b\d+l\d+$/.test(room)) unassigned++;
  }
  return occupied.size + unassigned;
}
