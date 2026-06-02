interface EbmlElement {
    id: number;
    dataStart: number;
    dataEnd: number;
}

interface TrackInfo {
    number: number;
    codecId: string;
    channels: number;
    codecPrivate?: Uint8Array;
}

interface OpusPacket {
    bytes: Uint8Array;
    granulePosition: number;
}

interface WebmContext {
    timecodeScale: number;
    opusTrackNumber: number;
    channels: number;
    opusHead?: Uint8Array;
    lastGranule: number;
    packets: OpusPacket[];
}

const ID_SEGMENT = 0x18538067;
const ID_INFO = 0x1549a966;
const ID_TIMECODE_SCALE = 0x2ad7b1;
const ID_TRACKS = 0x1654ae6b;
const ID_TRACK_ENTRY = 0xae;
const ID_TRACK_NUMBER = 0xd7;
const ID_CODEC_ID = 0x86;
const ID_CODEC_PRIVATE = 0x63a2;
const ID_AUDIO = 0xe1;
const ID_CHANNELS = 0x9f;
const ID_CLUSTER = 0x1f43b675;
const ID_TIMECODE = 0xe7;
const ID_SIMPLE_BLOCK = 0xa3;
const ID_BLOCK_GROUP = 0xa0;
const ID_BLOCK = 0xa1;
const CRC_TABLE = buildCrcTable();

export async function remuxWebmOpusToOggFile(file: File): Promise<File> {
    if (!isWebmAudio(file)) {
        return file;
    }

    const oggBytes = remuxWebmOpusToOgg(new Uint8Array(await file.arrayBuffer()));
    const oggBuffer = oggBytes.buffer.slice(
        oggBytes.byteOffset,
        oggBytes.byteOffset + oggBytes.byteLength
    ) as ArrayBuffer;
    const fileName = `${file.name.replace(/\.[^/.]+$/, '')}.ogg`;

    return new File([oggBuffer], fileName, {
        type: 'audio/ogg',
        lastModified: file.lastModified,
    });
}

function isWebmAudio(file: File): boolean {
    const mimeType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();
    return mimeType.includes('webm') || fileName.endsWith('.webm');
}

function remuxWebmOpusToOgg(bytes: Uint8Array): Uint8Array {
    const context: WebmContext = {
        timecodeScale: 1000000,
        opusTrackNumber: 0,
        channels: 1,
        lastGranule: 0,
        packets: [],
    };

    parseSegment(bytes, context, false);
    parseSegment(bytes, context, true);

    if (!context.opusTrackNumber) {
        throw new Error('Faixa Opus nao encontrada no audio WEBM.');
    }

    if (!context.packets.length) {
        throw new Error('Pacotes Opus nao encontrados no audio WEBM.');
    }

    return buildOgg(context);
}

function parseSegment(bytes: Uint8Array, context: WebmContext, collectPackets: boolean): void {
    for (const element of readElements(bytes, 0, bytes.length)) {
        if (element.id !== ID_SEGMENT) {
            continue;
        }

        parseSegmentChildren(bytes, element.dataStart, element.dataEnd, context, collectPackets);
        return;
    }

    throw new Error('Segmento WEBM nao encontrado.');
}

function parseSegmentChildren(
    bytes: Uint8Array,
    start: number,
    end: number,
    context: WebmContext,
    collectPackets: boolean
): void {
    for (const element of readElements(bytes, start, end)) {
        if (!collectPackets && element.id === ID_INFO) {
            parseInfo(bytes, element, context);
        } else if (!collectPackets && element.id === ID_TRACKS) {
            parseTracks(bytes, element, context);
        } else if (collectPackets && element.id === ID_CLUSTER) {
            parseCluster(bytes, element, context);
        }
    }
}

function parseInfo(bytes: Uint8Array, info: EbmlElement, context: WebmContext): void {
    for (const element of readElements(bytes, info.dataStart, info.dataEnd)) {
        if (element.id === ID_TIMECODE_SCALE) {
            context.timecodeScale = readUnsigned(bytes, element);
        }
    }
}

function parseTracks(bytes: Uint8Array, tracks: EbmlElement, context: WebmContext): void {
    for (const trackEntry of readElements(bytes, tracks.dataStart, tracks.dataEnd)) {
        if (trackEntry.id !== ID_TRACK_ENTRY) {
            continue;
        }

        const track: TrackInfo = {
            number: 0,
            codecId: '',
            channels: 1,
        };

        parseTrackEntry(bytes, trackEntry, track);

        if (track.number > 0 && track.codecId.toUpperCase().includes('A_OPUS')) {
            context.opusTrackNumber = track.number;
            context.channels = track.channels || 1;
            context.opusHead = track.codecPrivate;
            return;
        }
    }
}

function parseTrackEntry(bytes: Uint8Array, trackEntry: EbmlElement, track: TrackInfo): void {
    for (const element of readElements(bytes, trackEntry.dataStart, trackEntry.dataEnd)) {
        if (element.id === ID_TRACK_NUMBER) {
            track.number = readUnsigned(bytes, element);
        } else if (element.id === ID_CODEC_ID) {
            track.codecId = readString(bytes, element);
        } else if (element.id === ID_CODEC_PRIVATE) {
            track.codecPrivate = bytes.slice(element.dataStart, element.dataEnd);
        } else if (element.id === ID_AUDIO) {
            parseAudio(bytes, element, track);
        }
    }
}

function parseAudio(bytes: Uint8Array, audio: EbmlElement, track: TrackInfo): void {
    for (const element of readElements(bytes, audio.dataStart, audio.dataEnd)) {
        if (element.id === ID_CHANNELS) {
            track.channels = readUnsigned(bytes, element);
        }
    }
}

function parseCluster(bytes: Uint8Array, cluster: EbmlElement, context: WebmContext): void {
    let clusterTimecode = 0;

    for (const element of readElements(bytes, cluster.dataStart, cluster.dataEnd)) {
        if (element.id === ID_TIMECODE) {
            clusterTimecode = readUnsigned(bytes, element);
        } else if (element.id === ID_SIMPLE_BLOCK) {
            addBlockPackets(bytes, element, clusterTimecode, context);
        } else if (element.id === ID_BLOCK_GROUP) {
            parseBlockGroup(bytes, element, clusterTimecode, context);
        }
    }
}

function parseBlockGroup(
    bytes: Uint8Array,
    group: EbmlElement,
    clusterTimecode: number,
    context: WebmContext
): void {
    for (const element of readElements(bytes, group.dataStart, group.dataEnd)) {
        if (element.id === ID_BLOCK) {
            addBlockPackets(bytes, element, clusterTimecode, context);
        }
    }
}

function addBlockPackets(
    bytes: Uint8Array,
    block: EbmlElement,
    clusterTimecode: number,
    context: WebmContext
): void {
    const trackNumber = readVintValueAt(bytes, block.dataStart, block.dataEnd);
    let offset = trackNumber.offset;

    if (trackNumber.value !== context.opusTrackNumber) {
        return;
    }

    if (offset + 3 > block.dataEnd) {
        throw new Error('Bloco WEBM invalido.');
    }

    const relativeTimecode = readSignedInt16(bytes, offset);
    offset += 2;

    const flags = bytes[offset++];
    const lacing = (flags & 0x06) >> 1;
    const startGranule = timecodeToGranule(clusterTimecode + relativeTimecode, context.timecodeScale);

    for (const packet of readBlockPackets(bytes, offset, block.dataEnd, lacing)) {
        addOpusPacket(context, packet, startGranule);
    }
}

function addOpusPacket(context: WebmContext, packet: Uint8Array, startGranule: number): void {
    const granulePosition = Math.max(context.lastGranule + 960, startGranule + 960);
    context.lastGranule = granulePosition;
    context.packets.push({ bytes: packet, granulePosition });
}

function readBlockPackets(
    bytes: Uint8Array,
    offset: number,
    end: number,
    lacing: number
): Uint8Array[] {
    if (lacing === 0) {
        return [bytes.slice(offset, end)];
    }

    if (offset >= end) {
        throw new Error('Lacing WEBM invalido.');
    }

    const frameCount = bytes[offset++] + 1;

    if (lacing === 1) {
        const sizes: number[] = [];
        let totalSize = 0;

        for (let i = 0; i < frameCount - 1; i += 1) {
            let size = 0;
            let value = 0;

            do {
                if (offset >= end) {
                    throw new Error('Tamanho Xiph WEBM invalido.');
                }

                value = bytes[offset++];
                size += value;
            } while (value === 255);

            sizes.push(size);
            totalSize += size;
        }

        const lastSize = end - offset - totalSize;

        if (lastSize < 0) {
            throw new Error('Tamanhos Xiph WEBM invalidos.');
        }

        sizes.push(lastSize);
        return copyFrames(bytes, offset, sizes);
    }

    if (lacing === 2) {
        const remaining = end - offset;

        if (remaining % frameCount !== 0) {
            throw new Error('Tamanho fixed lacing WEBM invalido.');
        }

        return copyFrames(bytes, offset, new Array(frameCount).fill(remaining / frameCount));
    }

    if (lacing === 3) {
        const sizes: number[] = [];
        const firstSize = readVintValueAt(bytes, offset, end);
        offset = firstSize.offset;
        sizes.push(firstSize.value);

        let previousSize = firstSize.value;
        let totalSize = firstSize.value;

        for (let i = 1; i < frameCount - 1; i += 1) {
            const delta = readSignedVintValueAt(bytes, offset, end);
            offset = delta.offset;
            previousSize += delta.value;

            if (previousSize < 0) {
                throw new Error('Delta EBML WEBM invalido.');
            }

            sizes.push(previousSize);
            totalSize += previousSize;
        }

        const lastSize = end - offset - totalSize;

        if (lastSize < 0) {
            throw new Error('Tamanhos EBML WEBM invalidos.');
        }

        sizes.push(lastSize);
        return copyFrames(bytes, offset, sizes);
    }

    throw new Error('Lacing WEBM nao suportado.');
}

function copyFrames(bytes: Uint8Array, offset: number, sizes: number[]): Uint8Array[] {
    return sizes.map((size) => {
        const frame = bytes.slice(offset, offset + size);
        offset += size;
        return frame;
    });
}

function buildOgg(context: WebmContext): Uint8Array {
    const pages: Uint8Array[] = [];
    const serial = Math.floor(Math.random() * 0xffffffff) | 0;
    let sequence = 0;

    pages.push(writeOggPage(buildOpusHead(context), 0, 0x02, serial, sequence++));
    pages.push(writeOggPage(buildOpusTags(), 0, 0x00, serial, sequence++));

    context.packets.forEach((packet, index) => {
        const headerType = index === context.packets.length - 1 ? 0x04 : 0x00;
        pages.push(writeOggPage(packet.bytes, packet.granulePosition, headerType, serial, sequence++));
    });

    return concatBytes(pages);
}

function buildOpusHead(context: WebmContext): Uint8Array {
    if (context.opusHead && startsWithAscii(context.opusHead, 'OpusHead')) {
        return context.opusHead;
    }

    const bytes = new Uint8Array(19);
    bytes.set(ascii('OpusHead'), 0);
    bytes[8] = 1;
    bytes[9] = Math.max(1, Math.min(255, context.channels));
    writeUInt16Le(bytes, 10, 312);
    writeUInt32Le(bytes, 12, 48000);
    writeUInt16Le(bytes, 16, 0);
    bytes[18] = 0;
    return bytes;
}

function buildOpusTags(): Uint8Array {
    const vendor = utf8('Riosoft XChannel');
    const bytes = new Uint8Array(8 + 4 + vendor.length + 4);
    let offset = 0;

    bytes.set(ascii('OpusTags'), offset);
    offset += 8;
    writeUInt32Le(bytes, offset, vendor.length);
    offset += 4;
    bytes.set(vendor, offset);
    offset += vendor.length;
    writeUInt32Le(bytes, offset, 0);

    return bytes;
}

function writeOggPage(
    packet: Uint8Array,
    granulePosition: number,
    headerType: number,
    serial: number,
    sequence: number
): Uint8Array {
    const segments = buildSegments(packet.length);

    if (segments.length > 255) {
        throw new Error('Pacote Opus muito grande para uma pagina OGG.');
    }

    const page = new Uint8Array(27 + segments.length + packet.length);
    let offset = 0;

    page.set(ascii('OggS'), offset);
    offset += 4;
    page[offset++] = 0;
    page[offset++] = headerType;
    writeInt64Le(page, offset, granulePosition);
    offset += 8;
    writeInt32Le(page, offset, serial);
    offset += 4;
    writeInt32Le(page, offset, sequence);
    offset += 4;
    writeUInt32Le(page, offset, 0);
    offset += 4;
    page[offset++] = segments.length;
    page.set(segments, offset);
    offset += segments.length;
    page.set(packet, offset);

    writeUInt32Le(page, 22, computeOggCrc(page));
    return page;
}

function buildSegments(packetLength: number): Uint8Array {
    const segments: number[] = [];
    let remaining = packetLength;

    while (remaining >= 255) {
        segments.push(255);
        remaining -= 255;
    }

    segments.push(remaining);
    return new Uint8Array(segments);
}

function readElements(bytes: Uint8Array, start: number, end: number): EbmlElement[] {
    const elements: EbmlElement[] = [];
    let offset = start;

    while (offset < end) {
        const id = readElementIdAt(bytes, offset, end);
        offset = id.offset;

        const size = readElementSizeAt(bytes, offset, end);
        offset = size.offset;

        const dataEnd = size.value < 0 || offset + size.value > end ? end : offset + size.value;

        elements.push({
            id: id.value,
            dataStart: offset,
            dataEnd,
        });

        offset = dataEnd;
    }

    return elements;
}

function readElementIdAt(bytes: Uint8Array, offset: number, end: number): { value: number; offset: number } {
    const length = getVintLength(bytes[offset]);

    if (length <= 0 || length > 4 || offset + length > end) {
        throw new Error('Id EBML invalido.');
    }

    let value = 0;

    for (let i = 0; i < length; i += 1) {
        value = (value << 8) | bytes[offset + i];
    }

    return { value, offset: offset + length };
}

function readElementSizeAt(bytes: Uint8Array, offset: number, end: number): { value: number; offset: number } {
    const first = bytes[offset];
    const length = getVintLength(first);

    if (length <= 0 || length > 8 || offset + length > end) {
        throw new Error('Tamanho EBML invalido.');
    }

    let value = first & (0xff >> length);
    let unknownValue = 0xff >> length;

    for (let i = 1; i < length; i += 1) {
        value = value * 256 + bytes[offset + i];
        unknownValue = unknownValue * 256 + 0xff;
    }

    return { value: value === unknownValue ? -1 : value, offset: offset + length };
}

function readVintValueAt(bytes: Uint8Array, offset: number, end: number): { value: number; offset: number } {
    const first = bytes[offset];
    const length = getVintLength(first);

    if (length <= 0 || length > 8 || offset + length > end) {
        throw new Error('Valor WEBM invalido.');
    }

    let value = first & (0xff >> length);

    for (let i = 1; i < length; i += 1) {
        value = value * 256 + bytes[offset + i];
    }

    return { value, offset: offset + length };
}

function readSignedVintValueAt(bytes: Uint8Array, offset: number, end: number): { value: number; offset: number } {
    const first = bytes[offset];
    const length = getVintLength(first);

    if (length <= 0 || length > 8 || offset + length > end) {
        throw new Error('Valor EBML lacing invalido.');
    }

    let value = first & (0xff >> length);

    for (let i = 1; i < length; i += 1) {
        value = value * 256 + bytes[offset + i];
    }

    const bias = 2 ** (7 * length - 1) - 1;
    return { value: value - bias, offset: offset + length };
}

function getVintLength(first: number): number {
    for (let i = 0; i < 8; i += 1) {
        if ((first & (0x80 >> i)) !== 0) {
            return i + 1;
        }
    }

    return -1;
}

function readUnsigned(bytes: Uint8Array, element: EbmlElement): number {
    let value = 0;

    for (let i = element.dataStart; i < element.dataEnd; i += 1) {
        value = value * 256 + bytes[i];
    }

    return value;
}

function readString(bytes: Uint8Array, element: EbmlElement): string {
    return new TextDecoder().decode(bytes.slice(element.dataStart, element.dataEnd));
}

function readSignedInt16(bytes: Uint8Array, offset: number): number {
    const value = (bytes[offset] << 8) | bytes[offset + 1];
    return value & 0x8000 ? value - 0x10000 : value;
}

function timecodeToGranule(timecode: number, scale: number): number {
    return Math.max(0, Math.floor((timecode * scale * 48000) / 1000000000));
}

function startsWithAscii(bytes: Uint8Array, text: string): boolean {
    const pattern = ascii(text);

    if (bytes.length < pattern.length) {
        return false;
    }

    return pattern.every((value, index) => bytes[index] === value);
}

function buildCrcTable(): Uint32Array {
    const table = new Uint32Array(256);

    for (let i = 0; i < table.length; i += 1) {
        let crc = i << 24;

        for (let j = 0; j < 8; j += 1) {
            crc = (crc & 0x80000000) !== 0 ? ((crc << 1) ^ 0x04c11db7) : (crc << 1);
        }

        table[i] = crc >>> 0;
    }

    return table;
}

function computeOggCrc(bytes: Uint8Array): number {
    let crc = 0;

    for (let i = 0; i < bytes.length; i += 1) {
        crc = (((crc << 8) >>> 0) ^ CRC_TABLE[((crc >>> 24) ^ bytes[i]) & 0xff]) >>> 0;
    }

    return crc >>> 0;
}

function writeUInt16Le(bytes: Uint8Array, offset: number, value: number): void {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >>> 8) & 0xff;
}

function writeUInt32Le(bytes: Uint8Array, offset: number, value: number): void {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >>> 8) & 0xff;
    bytes[offset + 2] = (value >>> 16) & 0xff;
    bytes[offset + 3] = (value >>> 24) & 0xff;
}

function writeInt32Le(bytes: Uint8Array, offset: number, value: number): void {
    writeUInt32Le(bytes, offset, value >>> 0);
}

function writeInt64Le(bytes: Uint8Array, offset: number, value: number): void {
    let current = Math.max(0, Math.floor(value));

    for (let i = 0; i < 8; i += 1) {
        bytes[offset + i] = current % 256;
        current = Math.floor(current / 256);
    }
}

function ascii(text: string): Uint8Array {
    return Uint8Array.from(text, (char) => char.charCodeAt(0));
}

function utf8(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
    const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    chunks.forEach((chunk) => {
        result.set(chunk, offset);
        offset += chunk.length;
    });

    return result;
}
