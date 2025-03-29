const iconv = require('iconv-lite');
const NodeID3 = require('node-id3');
const fs = require('fs').promises;

async function decodeMP3Tags(filePath) {
    try {
        // Read both ID3v2 and ID3v1.1 tags
        const tags = {
            v2: NodeID3.read(filePath),
            v1: await readID3v1(filePath)
        };

        // Merge tags with priority to ID3v2
        const mergedTags = {
            title: tags.v2.title || tags.v1?.title,
            artist: tags.v2.artist || tags.v1?.artist,
            album: tags.v2.album || tags.v1?.album,
            year: tags.v2.year || tags.v1?.year,
            comment: tags.v2.comment?.text || tags.v1?.comment,
            trackNumber: tags.v2.trackNumber || tags.v1?.track
        };

        // Decode all fields
        const decodedTags = {};
        for (const [field, value] of Object.entries(mergedTags)) {
            if (value) decodedTags[field] = decodeCyrillic(value);
        }

        // Write back as ID3v2.4 tags with UTF-8 encoding
        NodeID3.update(decodedTags, filePath);

        // Remove ID3v1.1 tags if present
        await removeID3v1(filePath);

        console.log('Successfully updated tags:', decodedTags);
    } catch (error) {
        console.error('Error processing file:', error);
    }
}

// ID3v1.1 Reader (128 bytes at end of file)
async function readID3v1(filePath) {
    try {
        const buffer = Buffer.alloc(128);
        const handle = await fs.open(filePath, 'r');
        const stats = await handle.stat();

        if (stats.size < 128) return null;
        await handle.read(buffer, 0, 128, stats.size - 128);
        await handle.close();

        if (buffer.toString('ascii', 0, 3) !== 'TAG') return null;

        return {
            title: buffer.toString('binary', 3, 33),
            artist: buffer.toString('binary', 33, 63),
            album: buffer.toString('binary', 63, 93),
            year: buffer.toString('binary', 93, 97),
            comment: buffer.toString('binary', 97, 127),
            track: buffer[125]
        };
    } catch (e) {
        return null;
    }
}

// ID3v1.1 Remover
async function removeID3v1(filePath) {
    try {
        const handle = await fs.open(filePath, 'r+');
        const stats = await handle.stat();

        if (stats.size < 128) return;
        const endBuffer = Buffer.alloc(128);
        await handle.read(endBuffer, 0, 128, stats.size - 128);

        if (endBuffer.toString('ascii', 0, 3) === 'TAG') {
            await handle.truncate(stats.size - 128);
        }
        await handle.close();
    } catch (e) {
        console.error('Error removing ID3v1:', e);
    }
}

// Cyrillic decoding (same as previous)
function decodeCyrillic(text) {
    const bytes = Buffer.from(text, 'latin1');
    const encodings = ['windows-1251', 'koi8-r', 'iso-8859-5', 'cp866'];
    let best = { decoded: text, count: 0 };

    for (const encoding of encodings) {
        try {
            const decoded = iconv.decode(bytes, encoding);
            const count = [...decoded].filter(c => {
                const cp = c.codePointAt(0);
                return (cp >= 0x0400 && cp <= 0x04FF) || (cp >= 0x0500 && cp <= 0x052F);
            }).length;

            if (count > best.count) best = { decoded, count };
        } catch (e) {}
    }
    return best.decoded;
}

// Usage
const filePath = process.argv[2];
if (!filePath) {
    console.log('Usage: node decode-mp3.js path/to/file.mp3');
    process.exit(1);
}

decodeMP3Tags(filePath);