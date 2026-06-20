package com.pm3.backend.core;

import java.nio.ByteBuffer;

public class PM3Header {
    public static final int HEADER_SIZE = 16;
    public static final byte MAGIC_1 = 0x50; // 'P'
    public static final byte MAGIC_2 = 0x4D; // 'M'

    private final int mPower;
    private final boolean huffman;
    private final int originalSize;
    private final long lockTimestamp;

    public PM3Header(int mPower, boolean huffman, int originalSize, long lockTimestamp) {
        this.mPower = mPower;
        this.huffman = huffman;
        this.originalSize = originalSize;
        this.lockTimestamp = lockTimestamp;
    }

    public PM3Header(byte[] bytes) {
        if (bytes.length < HEADER_SIZE) {
            throw new IllegalArgumentException("Header bytes length must be at least " + HEADER_SIZE);
        }
        if (bytes[0] != MAGIC_1 || bytes[1] != MAGIC_2) {
            throw new IllegalArgumentException("Invalid magic number in header");
        }
        this.mPower = bytes[2] & 0xFF;
        this.huffman = bytes[3] == 1;
        
        // Read originalSize (bytes 4-7)
        this.originalSize = ByteBuffer.wrap(bytes, 4, 4).getInt();
        
        // Read lockTimestamp (bytes 8-15)
        this.lockTimestamp = ByteBuffer.wrap(bytes, 8, 8).getLong();
    }

    public byte[] toBytes() {
        byte[] bytes = new byte[HEADER_SIZE];
        bytes[0] = MAGIC_1;
        bytes[1] = MAGIC_2;
        bytes[2] = (byte) mPower;
        bytes[3] = (byte) (huffman ? 1 : 0);
        
        // Write originalSize
        ByteBuffer.wrap(bytes, 4, 4).putInt(originalSize);
        
        // Write lockTimestamp
        ByteBuffer.wrap(bytes, 8, 8).putLong(lockTimestamp);
        
        return bytes;
    }

    public int getMPower() {
        return mPower;
    }

    public boolean isHuffman() {
        return huffman;
    }

    public int getOriginalSize() {
        return originalSize;
    }

    public long getLockTimestamp() {
        return lockTimestamp;
    }

    public boolean isLocked() {
        return lockTimestamp > System.currentTimeMillis();
    }

    public static boolean hasValidHeader(byte[] data) {
        if (data.length < HEADER_SIZE) {
            return false;
        }
        return data[0] == MAGIC_1 && data[1] == MAGIC_2;
    }
}
