package com.pm3.backend;

import com.pm3.backend.service.HuffmanService;
import com.pm3.backend.model.HuffmanNode;
import java.util.Map;
import java.util.Arrays;

public class ScratchTest {
    public static void main(String[] args) {
        try {
            System.out.println("Starting Huffman Corrupted Test...");
            
            // 1. Generate text containing only 'a'
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 1000; i++) {
                sb.append('a');
            }
            byte[] originalBytes = sb.toString().getBytes("UTF-8");

            // 2. Huffman Compress
            HuffmanService huffmanService = new HuffmanService();
            Map<Character, Integer> frecuencias = huffmanService.calcularFrecuencias(originalBytes);
            HuffmanNode raiz = huffmanService.construirArbol(frecuencias);
            Map<Character, String> codigos = huffmanService.generarCodigos(raiz);
            byte[] compressedBytes = huffmanService.comprimir(originalBytes, codigos, frecuencias);
            System.out.println("Compressed size: " + compressedBytes.length + " bytes");

            // Case A1: Flip LSB of totalBits
            try {
                byte[] corruptedBytesHeader = compressedBytes.clone();
                corruptedBytesHeader[17] ^= 1;
                byte[] decompressedHeader = huffmanService.descomprimir(corruptedBytesHeader);
                System.out.println("Decompressed size after LSB header flip: " + decompressedHeader.length);
            } catch (Exception e) {
                System.out.println("LSB header flip threw exception: " + e.getClass().getName() + " - " + e.getMessage());
            }

            // Case A2: Flip sign bit of totalBits (byte 10, bit 7)
            try {
                byte[] corruptedBytesHeaderSign = compressedBytes.clone();
                corruptedBytesHeaderSign[10] ^= 0x80; // Flip sign bit
                byte[] decompressedHeaderSign = huffmanService.descomprimir(corruptedBytesHeaderSign);
                System.out.println("Decompressed size after Sign header flip: " + decompressedHeaderSign.length);
            } catch (Exception e) {
                System.out.println("Sign header flip threw exception: " + e.getClass().getName() + " - " + e.getMessage());
            }

            // Case B: Flipped bit in the compressed bits (byte 18)
            try {
                byte[] corruptedBytesPayload = compressedBytes.clone();
                corruptedBytesPayload[18] ^= 1; // Flip first bit of payload
                byte[] decompressedPayload = huffmanService.descomprimir(corruptedBytesPayload);
                System.out.println("Decompressed size after payload flip: " + decompressedPayload.length);
                System.out.println("First 10 decompressed characters code: " + 
                    Arrays.toString(Arrays.copyOf(decompressedPayload, Math.min(10, decompressedPayload.length))));
            } catch (Exception e) {
                System.out.println("Payload flip threw exception: " + e.getClass().getName() + " - " + e.getMessage());
            }

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
