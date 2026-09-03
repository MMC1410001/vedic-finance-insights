/**
 * Zodiac sign image mapping — uses horoscope PNGs from assets/horoscopes/
 * instead of Unicode emoji symbols.
 */

import aries from "@/assets/horoscopes/aries.webp";
import taurus from "@/assets/horoscopes/taurus.webp";
import gemini from "@/assets/horoscopes/gemini.webp";
import cancer from "@/assets/horoscopes/cancer.webp";
import leo from "@/assets/horoscopes/leo.webp";
import virgo from "@/assets/horoscopes/virgo.webp";
import libra from "@/assets/horoscopes/libra.webp";
import scorpio from "@/assets/horoscopes/scorpio.webp";
import sagittarius from "@/assets/horoscopes/sagittarius.webp";
import capricorn from "@/assets/horoscopes/capricon.webp";
import aquarius from "@/assets/horoscopes/aquaris.webp";
import pisces from "@/assets/horoscopes/pisces.webp";

/** Ordered by sign number (0 = Aries, 11 = Pisces) */
export const ZODIAC_IMAGES: string[] = [
  aries, taurus, gemini, cancer, leo, virgo,
  libra, scorpio, sagittarius, capricorn, aquarius, pisces,
];

/** Map sign name → image path */
export const ZODIAC_IMAGE_BY_NAME: Record<string, string> = {
  Aries: aries,
  Taurus: taurus,
  Gemini: gemini,
  Cancer: cancer,
  Leo: leo,
  Virgo: virgo,
  Libra: libra,
  Scorpio: scorpio,
  Sagittarius: sagittarius,
  Capricorn: capricorn,
  Aquarius: aquarius,
  Pisces: pisces,
};
