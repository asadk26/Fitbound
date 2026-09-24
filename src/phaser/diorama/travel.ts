/**
 * Distance travelled in the diorama this session, split by how: marching
 * (physical activity) vs keyboard / gamepad / auto-walk (not activity).
 */
export const travel = {
  active: 0,
  assisted: 0,
  reset(): void {
    this.active = 0;
    this.assisted = 0;
  },
};
