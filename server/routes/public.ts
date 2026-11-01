import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import { ARTWORK_EXTENSIONS, AUDIO_EXTENSIONS, INITIAL_STATUS, flattenIssues, releaseSubmissionSchema, type ReleaseRecord, type SubmitResponse } from '../../shared/schema.ts';
import { requireUser } from '../auth/middleware.ts';
import type { Deps } from '../app.ts';
import { sanitizeText } from '../../shared/schema.ts';
import { sniffAudio, sniffImage } from '../storage/fileSniff.ts';
import { config } from '../config.ts';

const fail = (res: Response, status: number, message: string, fieldErrors?: Record<string, string>) =>
  res.status(status).json({ success: false, message, ...(fieldErrors ? { fieldErrors } : {}) } satisfies SubmitResponse);

const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);

export function publicRoutes({ files, releases, sync }: Deps) {
  const router = Router();
  const memory = multer.memoryStorage();
  const uploadAudio = multer({ storage: memory, limits: { fileSize: config.maxAudioBytes, files: 1 } }).single('file');
  const uploadArtwork = multer({ storage: memory, limits: { fileSize: config.maxArtworkBytes, files: 1 } }).single('file');

  function runUpload(kind: 'audio' | 'artwork') {
    const exts: readonly string[] = kind === 'audio' ? AUDIO_EXTENSIONS : ARTWORK_EXTENSIONS;
    const limit = kind === 'audio' ? config.maxAudioBytes : config.maxArtworkBytes;
    const handler = kind === 'audio' ? uploadAudio : uploadArtwork;

    return (req: Request, res: Response) => {
      handler(req, res, async (err?: unknown) => {
        try {
          if (err instanceof multer.MulterError) {
            return err.code === 'LIMIT_FILE_SIZE'
              ? fail(res, 413, `File is too large. The maximum for ${kind === 'audio' ? 'audio' : 'artwork'} is ${mb(limit)} MB.`)
              : fail(res, 400, 'The upload could not be read. Please try again.');
          }
          if (err) throw err;
          const file = req.file;
          if (!file) return fail(res, 400, 'No file received. Choose a file and try again.');

          const originalName = sanitizeText(path.basename(file.originalname || 'upload')).slice(0, 180) || 'upload';
          const ext = path.extname(originalName).slice(1).toLowerCase();
          if (!exts.includes(ext)) {
            return fail(res, 415, `Unsupported file type. Accepted: ${exts.map((e) => e.toUpperCase()).join(', ')}.`);
          }
          const sniffed = kind === 'audio' ? sniffAudio(file.buffer) : sniffImage(file.buffer);
          if (!sniffed) {
            return fail(res, 415, `This file's contents don't match a valid ${exts.map((e) => e.toUpperCase()).join('/')} file.`);
          }
          const rec = await files.save(kind, file.buffer, { originalName, mimeType: sniffed.mime, width: sniffed.width, height: sniffed.height });
          res.status(201).json({
            success: true,
            file: { id: rec.id, originalName: rec.originalName, mimeType: rec.mimeType, size: rec.size, uploadedAt: rec.uploadedAt, width: rec.width, height: rec.height },
          });
        } catch (e) {
          console.error('[upload] failed', e);
          fail(res, 500, 'We could not save your file. Please try again.');
        }
      });
    };
  }

  router.post('/uploads/audio', requireUser, runUpload('audio'));
  router.post('/uploads/artwork', requireUser, runUpload('artwork'));

  router.post('/releases', requireUser, async (req, res) => {
    const parsed = releaseSubmissionSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'Some fields need your attention.', flattenIssues(parsed.error.issues));
    }
    const data = parsed.data;

    // Never trust client-supplied file metadata: look the files up in our own storage.
    const [audio, artwork] = await Promise.all([files.get(data.files.audioFileId), files.get(data.files.artworkFileId)]);
    if (!audio || audio.kind !== 'audio') return fail(res, 400, 'Your audio upload was not found. Please upload it again.', { 'files.audioFileId': 'Please upload your audio file again' });
    if (!artwork || artwork.kind !== 'artwork') return fail(res, 400, 'Your artwork upload was not found. Please upload it again.', { 'files.artworkFileId': 'Please upload your cover art again' });

    const dup = await releases.findDuplicate(data.artist.email, data.release.title, data.release.releaseType);
    if (dup) return fail(res, 409, `A ${dup.release.releaseType} titled "${dup.release.title}" has already been submitted for this email (${dup.id}).`);

    const now = new Date().toISOString();
    const strip = ({ id: _id, kind: _kind, ...rest }: typeof audio) => rest;
    const record = await releases.create((id): ReleaseRecord => ({
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
      status: INITIAL_STATUS,
      userId: req.user!.id, // from the session — never from the request body
      adminNote: '',
      googleSheetRow: null,
      googleSheetLastSyncedStatus: null,
      googleSheetLastSyncedNote: '',
      googleSheetSyncStatus: sync.enabled ? 'pending' : 'disabled',
      audio: strip(audio),
      artwork: strip(artwork),
      isDemoData: false,
    }));
    // Mirror into the Google Sheet. The submission is already safely stored; a Sheets outage only leaves it 'failed' → retried by the poller.
    await sync.push();
    res.status(201).json({ success: true, submissionId: record.id, status: record.status, message: 'Release submitted successfully' } satisfies SubmitResponse);
  });

  // The signed-in artist's own releases (what the user dashboard polls). Never includes other users' data.
  const view = (r: ReleaseRecord) => ({
    id: r.id, title: r.release.title, releaseType: r.release.releaseType, genre: r.release.genre, artist: r.artist.displayName,
    status: r.status, adminNote: r.adminNote, createdAt: r.createdAt, updatedAt: r.updatedAt, trackCount: r.tracks.length, stores: r.stores,
  });
  router.get('/my/releases', requireUser, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, releases: (await releases.listByUser(req.user!.id)).map(view) });
  });
  router.get('/my/releases/:id', requireUser, async (req, res) => {
    const r = await releases.get(String(req.params.id));
    if (!r || r.userId !== req.user!.id) return fail(res, 404, 'Submission not found.');
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, submission: view(r) });
  });

  return router;
}
