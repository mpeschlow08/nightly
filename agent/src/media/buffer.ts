import { EncryptedMediaStorage, MAX_SEGMENT_BYTES, type MediaRecord } from "./storage";

export class RollingMediaBuffer {
  private readonly pending = new Map<number, Buffer[]>();
  private readonly sizes = new Map<number, number>();

  constructor(private readonly storage: EncryptedMediaStorage, private readonly segmentBytes = MAX_SEGMENT_BYTES) {
    if (!Number.isSafeInteger(segmentBytes) || segmentBytes <= 0 || segmentBytes > MAX_SEGMENT_BYTES) throw new Error("Invalid rolling segment size.");
  }

  async push(sourceId: number, chunk: Buffer): Promise<MediaRecord[]> {
    if (!Number.isSafeInteger(sourceId) || sourceId <= 0 || !Buffer.isBuffer(chunk)) throw new Error("Invalid media chunk.");
    const saved: MediaRecord[] = [];
    let offset = 0;
    while (offset < chunk.length) {
      const size = this.sizes.get(sourceId) ?? 0;
      if (size === this.segmentBytes) {
        saved.push(await this.flush(sourceId) as MediaRecord);
        continue;
      }
      const take = Math.min(chunk.length - offset, this.segmentBytes - size);
      this.pending.set(sourceId, [...(this.pending.get(sourceId) ?? []), Buffer.from(chunk.subarray(offset, offset + take))]);
      this.sizes.set(sourceId, size + take);
      offset += take;
      if (size + take === this.segmentBytes) saved.push(await this.flush(sourceId) as MediaRecord);
    }
    return saved;
  }

  async flush(sourceId: number): Promise<MediaRecord | null> {
    const chunks = this.pending.get(sourceId);
    if (!chunks?.length) return null;
    const record = await this.storage.appendSegment(sourceId, Buffer.concat(chunks));
    this.pending.delete(sourceId);
    this.sizes.delete(sourceId);
    return record;
  }

  discard(sourceId: number): void {
    this.pending.delete(sourceId);
    this.sizes.delete(sourceId);
  }
}