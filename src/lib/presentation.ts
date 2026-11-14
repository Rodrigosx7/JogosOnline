export const ELEVEN_NOTICE_MS = 1800;

// The UI positions run clockwise from the viewer at the bottom. Turns run the other way.
export function tablePosition(seat: number, viewerSeat: number | null | undefined, seatCount: number) {
  return ((viewerSeat ?? 0) - seat + seatCount) % seatCount;
}
