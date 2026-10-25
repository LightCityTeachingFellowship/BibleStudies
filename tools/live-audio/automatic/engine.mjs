import { publishSnapshot } from '../publish-test.mjs';
import { registerBroadcast } from '../publish-site.mjs';
import { discoverBroadcast } from './discovery.mjs';
export class AutomaticPublisher {
  constructor({ context, origin, uploadKey, library, lookup, status = () => {}, now = Date.now, publish = publishSnapshot, register = registerBroadcast }) {
    Object.assign(this, { context, origin, uploadKey, library, lookup, status, now, publish, register });
    this.entry = null; this.receipts = {}; this.nextScan = 0; this.nextProbe = 0; this.misses = 0; this.fingerprint = ''; this.retired = false;
  }
  async close({ keepReplay = false } = {}) {
    if (this.entry && keepReplay) {
      const snapshot = await this.publish({ folder: this.context.folder, origin: this.origin, uploadKey: this.uploadKey, receipts: this.receipts });
      if (!snapshot.ended) throw Error('Waiting for the finalized audio playlist');
    }
    if (this.entry) { await this.register({ origin: this.origin, uploadKey: this.uploadKey, entry: { ...this.entry, active: false, expiresAt: this.now() + 3600000 } }); this.entry = null; }
  }
  async tick(signal) {
    if (this.retired) return;
    const library = await this.library(), fingerprint = library.map(item => item.id + ':' + item.visibility).join(',');
    const changed = fingerprint !== this.fingerprint; this.fingerprint = fingerprint;
    if (this.entry && !library.some(item => item.id === this.entry.videoId)) { await this.close(); this.nextScan = 0; }
    if (!this.entry) {
      if (this.context.ended) { this.retired = true; this.status('idle', 'OBS audio capture ended.'); return; }
      if (!changed && this.now() < this.nextScan) return;
      if (!library.length) { this.status('waiting', 'Add the live video ID to the public or members file.'); this.nextScan = this.now() + 30000; return; }
      const result = await discoverBroadcast(library, this.lookup, signal);
      this.nextScan = this.now() + [10000, 30000, 60000, 120000][Math.min(this.misses++, 3)];
      if (!result.video) { this.status('waiting', result.reason); return; }
      let latest = (await this.library()).find(item => item.id === result.video.id);
      if (!latest) { this.nextScan = 0; return; }
      const snapshot = await this.publish({ folder: this.context.folder, origin: this.origin, uploadKey: this.uploadKey, receipts: this.receipts });
      if (snapshot.ended || this.context.ended || signal?.aborted) { this.retired = true; return; }
      latest = (await this.library()).find(item => item.id === result.video.id);
      if (!latest) { this.nextScan = 0; return; }
      const offsetSeconds = Math.round(this.context.streamStartedAt - this.context.captureStartedAt) / 1000;
      if (!Number.isFinite(offsetSeconds) || Math.abs(offsetSeconds) > 57600) throw Error('The audio timing window is invalid');
      const entry = { videoId: result.video.id, session: this.context.session, title: result.video.title, visibility: latest.visibility === 'public' ? 'public' : 'members', offsetSeconds, active: true, expiresAt: this.now() + 12 * 3600000 };
      await this.register({ origin: this.origin, uploadKey: this.uploadKey, entry });
      this.entry = entry; this.nextProbe = this.now() + 30000;
      this.status('live', 'Live Listen is active. Access follows the video ID files.', { videoId: entry.videoId, visibility: entry.visibility }); return;
    }
    const declared = library.find(item => item.id === this.entry.videoId);
    if (declared.visibility !== this.entry.visibility || this.entry.expiresAt - this.now() < 3600000) {
      const entry = { ...this.entry, visibility: declared.visibility === 'public' ? 'public' : 'members', expiresAt: this.now() + 12 * 3600000 };
      await this.register({ origin: this.origin, uploadKey: this.uploadKey, entry }); this.entry = entry;
    }
    const snapshot = await this.publish({ folder: this.context.folder, origin: this.origin, uploadKey: this.uploadKey, receipts: this.receipts });
    if (snapshot.ended || this.context.ended) { await this.close({ keepReplay: true }); this.retired = true; this.status('idle', 'OBS stopped; live audio was finalized.'); return; }
    if (this.now() >= this.nextProbe) {
      this.nextProbe = this.now() + 30000;
      const current = await this.lookup([this.entry.videoId]);
      if (!current.some(item => item.id === this.entry.videoId && item.live)) { this.retired = true; this.status('finishing', 'The broadcast ended. Finishing replay audio.'); }
    }
  }
}
