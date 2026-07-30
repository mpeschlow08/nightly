import type { VenuePlaceDetails } from "@/app/owner/lib/google-places";

export type GooglePhotoCandidate = {
  reference: string;
  widthPx: number | null;
  heightPx: number | null;
  ratioScore: number;
  areaScore: number;
};

export function rankGooglePhotoCandidates(details: VenuePlaceDetails, targetRatio: number) {
  return details.photos
    .map((photo) => {
      const width = photo.widthPx ?? null;
      const height = photo.heightPx ?? null;
      const ratio = width && height && height > 0 ? width / height : null;
      const ratioScore = ratio ? Math.abs(ratio - targetRatio) : 0.9;
      const areaScore = width && height ? width * height : 0;

      return {
        reference: photo.reference,
        widthPx: width,
        heightPx: height,
        ratioScore,
        areaScore,
      } satisfies GooglePhotoCandidate;
    })
    .sort((a, b) => {
      if (a.ratioScore !== b.ratioScore) {
        return a.ratioScore - b.ratioScore;
      }

      return b.areaScore - a.areaScore;
    });
}
