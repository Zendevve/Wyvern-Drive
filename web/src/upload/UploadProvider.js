import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import UploadQueue from '../components/UploadQueue';
import { uploadFile, uploadProgress } from '../api/client';

const UploadContext = createContext(null);

let nextJobId = 1;

// Client-generated resume token: a UUID when the platform provides one,
// otherwise a unique-enough timestamp/random fallback. Retrying an upload
// reuses the token so the server can resume the same entry.
function newUploadToken() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `u-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * App-level upload console. Owns the entire upload state machine so the
 * transfer queue survives page navigation: any page enqueues jobs through
 * useUploads() and the floating UploadQueue renders globally under the
 * provider, visible on every authenticated page. Jobs carry the parentId
 * resolved at enqueue time (folder-upload pairs from
 * materializeFolderPicker / collectDroppedFiles, or the page's current
 * folder), so the provider never depends on which page is mounted; a
 * null/undefined parentId means the drive root.
 *
 * Pages subscribe via subscribe() to hear when a job settles so they can
 * refresh their own view; the provider itself never touches page state.
 */
export default function UploadProvider({ children }) {
  const [uploads, setUploads] = useState([]);
  const pollTimersRef = useRef(new Map()); // jobId -> interval id
  const pollsInFlightRef = useRef(new Set()); // jobIds with a request in flight
  const listenersRef = useRef(new Set());

  // Server-side "storing to Discord" progress polling. Once the browser has
  // pushed 100% of the bytes the XHR is still pending while the server posts
  // chunks to Discord; poll the resume token and surface postedBytes so the
  // queue can show real storage progress. Display-only: failures are ignored
  // and the poll never blocks the upload promise.
  useEffect(() => {
    const timers = pollTimersRef.current;
    return () => {
      timers.forEach((timer) => clearInterval(timer));
      timers.clear();
    };
  }, []);

  const stopServerPoll = useCallback((jobId) => {
    const timer = pollTimersRef.current.get(jobId);
    if (timer) {
      clearInterval(timer);
      pollTimersRef.current.delete(jobId);
    }
    pollsInFlightRef.current.delete(jobId);
  }, []);

  const pollServerProgress = useCallback(async (jobId, uploadToken) => {
    if (pollsInFlightRef.current.has(jobId)) {
      return;
    }
    pollsInFlightRef.current.add(jobId);
    try {
      const data = await uploadProgress(uploadToken);
      const expected = data && data.expectedBytes;
      const posted = data && data.postedBytes;
      let pct = null;
      if (expected && expected > 0 && typeof posted === 'number') {
        pct = Math.max(0, Math.min(100, Math.round((posted / expected) * 100)));
      }
      setUploads((prev) =>
        prev.map((job) =>
          job.id === jobId
            ? { ...job, serverPhase: 'storing', serverProgress: pct }
            : job
        )
      );
    } catch {
      // Server progress is display-only; ignore poll failures.
    } finally {
      pollsInFlightRef.current.delete(jobId);
    }
  }, []);

  const startServerPoll = useCallback(
    (jobId, uploadToken) => {
      if (!uploadToken || pollTimersRef.current.has(jobId)) {
        return;
      }
      const timer = setInterval(
        () => pollServerProgress(jobId, uploadToken),
        1000
      );
      pollTimersRef.current.set(jobId, timer);
      pollServerProgress(jobId, uploadToken);
    },
    [pollServerProgress]
  );

  const subscribe = useCallback((listener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const notifySettled = useCallback((jobId, status) => {
    listenersRef.current.forEach((listener) => {
      try {
        listener({ type: 'settled', jobId, status });
      } catch {
        // A page listener must never corrupt the upload state machine.
      }
    });
  }, []);

  const runUpload = useCallback(
    async (job) => {
      const jobId = job.id;
      const uploadToken = job.uploadToken;
      // Jobs carry the parentId resolved at enqueue time; null/undefined
      // means the drive root. The provider is page-agnostic.
      const parentId = job.parentId == null ? null : job.parentId;
      try {
        const upload = uploadFile({
          parentId,
          file: job.file,
          uploadToken,
          fileSize: job.file.size,
          onProgress: (loaded, total) => {
            const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
            setUploads((prev) =>
              prev.map((j) =>
                j.id === jobId ? { ...j, progress: percent } : j
              )
            );
            if (total > 0 && loaded >= total) {
              startServerPoll(jobId, uploadToken);
            }
          },
        });
        // Expose the XHR abort handle on the queued job so the queue's
        // Cancel control can stop the request in flight.
        setUploads((prev) =>
          prev.map((j) =>
            j.id === jobId ? { ...j, abort: upload.abort } : j
          )
        );
        const entry = await upload;
        stopServerPoll(jobId);
        setUploads((prev) =>
          prev.map((j) =>
            j.id === jobId ? { ...j, status: 'done', progress: 100, entry } : j
          )
        );
        notifySettled(jobId, 'done');
      } catch (err) {
        stopServerPoll(jobId);
        setUploads((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? err && err.code === 'ABORTED'
                ? j // cancelled from the queue; the removal flow cleans up
                : { ...j, status: 'failed', error: err }
              : j
          )
        );
        if (!(err && err.code === 'ABORTED')) {
          notifySettled(jobId, 'failed');
        }
      }
    },
    [startServerPoll, stopServerPoll, notifySettled]
  );

  // `pairs` are { file, parentId } uploads; a null/undefined parentId means
  // "the drive root" to the provider.
  const enqueueJobPairs = useCallback(
    (pairs) => {
      if (!pairs || pairs.length === 0) {
        return;
      }
      const jobs = pairs.map(({ file, parentId }) => ({
        id: nextJobId++,
        file,
        parentId: parentId == null ? undefined : parentId,
        uploadToken: newUploadToken(),
        abort: null, // attached by runUpload once the XHR exists
        status: 'uploading',
        progress: 0,
        error: null,
        entry: null,
        serverPhase: null,
        serverProgress: null,
      }));
      setUploads((prev) => [...prev, ...jobs]);
      jobs.forEach((job) => {
        runUpload(job);
      });
    },
    [runUpload]
  );

  const enqueueFiles = useCallback(
    (files) => {
      if (!files || files.length === 0) {
        return;
      }
      enqueueJobPairs(
        Array.from(files).map((file) => ({ file, parentId: undefined }))
      );
    },
    [enqueueJobPairs]
  );

  const retryUpload = useCallback(
    (job) => {
      setUploads((prev) =>
        prev.map((j) =>
          j.id === job.id
            ? {
                ...j,
                status: 'uploading',
                progress: 0,
                error: null,
                serverPhase: null,
                serverProgress: null,
              }
            : j
        )
      );
      // Reuse the job's original token so the server resumes the same entry.
      runUpload(job);
    },
    [runUpload]
  );

  const removeUpload = useCallback(
    (jobId) => {
      stopServerPoll(jobId);
      setUploads((prev) => prev.filter((job) => job.id !== jobId));
    },
    [stopServerPoll]
  );

  const value = useMemo(
    () => ({
      uploads,
      enqueueFiles,
      enqueueJobPairs,
      retryUpload,
      removeUpload,
      subscribe,
    }),
    [uploads, enqueueFiles, enqueueJobPairs, retryUpload, removeUpload, subscribe]
  );

  return (
    <UploadContext.Provider value={value}>
      {children}
      <UploadQueue jobs={uploads} onRetry={retryUpload} onRemove={removeUpload} />
    </UploadContext.Provider>
  );
}

export function useUploads() {
  const ctx = useContext(UploadContext);
  if (!ctx) {
    throw new Error('useUploads must be used within an UploadProvider');
  }
  return ctx;
}
