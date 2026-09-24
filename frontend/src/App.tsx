export default function App() {
  return (
    <main className="app-shell">
      <h1>Wyvern Drive</h1>
      <p className="status-line" role="status">
        Local database: ready
      </p>
      <p className="honesty-note">
        Metadata-only development vault — file storage and encryption are not
        implemented yet.
      </p>
    </main>
  );
}
