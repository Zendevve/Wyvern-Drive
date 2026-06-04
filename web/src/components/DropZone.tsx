import { useRef, useState, type DragEvent, type ReactNode } from 'react';

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  children: ReactNode;
}

export function DropZone({ onFiles, children }: DropZoneProps) {
  const counter = useRef(0);
  const [isOver, setIsOver] = useState(false);

  function hasFiles(event: DragEvent): boolean {
    const types = event.dataTransfer?.types;
    if (!types) return false;
    return Array.from(types).includes('Files');
  }

  function onDragEnter(event: DragEvent) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    counter.current += 1;
    if (counter.current === 1) setIsOver(true);
  }

  function onDragOver(event: DragEvent) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  function onDragLeave(event: DragEvent) {
    if (!hasFiles(event)) return;
    counter.current = Math.max(0, counter.current - 1);
    if (counter.current === 0) setIsOver(false);
  }

  function onDrop(event: DragEvent) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    counter.current = 0;
    setIsOver(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  }

  return (
    <div
      className={`dropzone${isOver ? ' is-over' : ''}`}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}
      {isOver ? <div className="dropzone-overlay" aria-hidden /> : null}
    </div>
  );
}
