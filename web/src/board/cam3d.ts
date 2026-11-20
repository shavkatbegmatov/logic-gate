import { signal } from '@preact/signals';

export type CamAngle = 'studio' | 'top';

/** 3D kamera boshqaruvi (ViewTools va Board3D o'rtasidagi yengil holat — WebGL kodini bosh yuklamaga tortmaydi). */
export const cam3d = signal<{ orbitMode: boolean; angle: CamAngle; resetSeq: number }>({
  orbitMode: false,
  angle: 'studio',
  resetSeq: 0,
});
