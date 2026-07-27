import type { Archive } from '../core/types';

type ArchiveBoardProps = {
    archive: Archive;
};

export function ArchiveBoard({ archive }: ArchiveBoardProps) {
    return (
        <div>
            {archive.length} archived week{archive.length === 1 ? '' : 's'}
        </div>
    );
}
