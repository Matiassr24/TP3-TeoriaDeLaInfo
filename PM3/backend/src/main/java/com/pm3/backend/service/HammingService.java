package com.pm3.backend.service;

import com.pm3.backend.core.PM3Header;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;

@Service
public class HammingService {

    public static class UnprotectResult {
        public byte[] data;
        public int totalBlocks;
        public int singleErrorsCorrected;
        public int doubleErrorsDetected;
        public boolean isHuffman;
        public long lockTimestamp;
        public int mPower;
    }

    public byte[] proteger(byte[] data, int mPower, boolean isHuffman, long lockTimestamp) {
        int n = 1 << mPower; // Block size (e.g. 8, 1024, 16384)
        int q = mPower;      // Number of parity bits
        int k = n - q - 1;   // Number of data bits

        List<Integer> bitsOriginales = bytesToBits(data);
        List<Integer> bitsProtegidos = new ArrayList<>();

        for (int i = 0; i < bitsOriginales.size(); i += k) {
            int[] block = new int[n + 1]; // 1-indexed

            // Asignar bits de datos a posiciones que no son potencias de 2
            int dataIndex = 0;
            for (int j = 1; j < n; j++) {
                if (!isPowerOfTwo(j)) {
                    if (i + dataIndex < bitsOriginales.size()) {
                        block[j] = bitsOriginales.get(i + dataIndex);
                    } else {
                        block[j] = 0; // Padding con ceros
                    }
                    dataIndex++;
                }
            }

            // Calcular bits de paridad Hamming
            for (int p = 0; p < q; p++) {
                int posParidad = 1 << p;
                int paridad = 0;
                for (int j = 1; j < n; j++) {
                    if ((j & posParidad) != 0 && j != posParidad) {
                        paridad ^= block[j];
                    }
                }
                block[posParidad] = paridad;
            }

            // Calcular bit de paridad global al final (posición n)
            int pGlobal = 0;
            for (int j = 1; j < n; j++) {
                pGlobal ^= block[j];
            }
            block[n] = pGlobal;

            // Añadir bloque al flujo protegido
            for (int j = 1; j <= n; j++) {
                bitsProtegidos.add(block[j]);
            }
        }

        byte[] protectedData = bitsToBytes(bitsProtegidos);

        // Prepend 16-byte PM3 Header
        PM3Header header = new PM3Header(mPower, isHuffman, data.length, lockTimestamp);
        byte[] headerBytes = header.toBytes();

        byte[] result = new byte[headerBytes.length + protectedData.length];
        System.arraycopy(headerBytes, 0, result, 0, headerBytes.length);
        System.arraycopy(protectedData, 0, result, headerBytes.length, protectedData.length);

        return result;
    }

    public UnprotectResult desproteger(byte[] dataConHeader, boolean corregir) {
        if (!PM3Header.hasValidHeader(dataConHeader)) {
            throw new IllegalArgumentException("El archivo no contiene un encabezado PM3 válido.");
        }

        PM3Header header = new PM3Header(dataConHeader);
        if (header.isLocked()) {
            UnprotectResult result = new UnprotectResult();
            result.isHuffman = header.isHuffman();
            result.lockTimestamp = header.getLockTimestamp();
            result.mPower = header.getMPower();
            result.data = null;
            return result;
        }

        int mPower = header.getMPower();
        int originalSize = header.getOriginalSize();
        int n = 1 << mPower;
        int q = mPower;

        byte[] rawData = new byte[dataConHeader.length - PM3Header.HEADER_SIZE];
        System.arraycopy(dataConHeader, PM3Header.HEADER_SIZE, rawData, 0, rawData.length);

        List<Integer> bitsRecibidos = bytesToBits(rawData);
        List<Integer> bitsRecuperados = new ArrayList<>();

        int totalBlocks = 0;
        int singleErrorsCorrected = 0;
        int doubleErrorsDetected = 0;

        for (int i = 0; i < bitsRecibidos.size(); i += n) {
            if (i + n > bitsRecibidos.size()) break;
            totalBlocks++;

            int[] block = new int[n + 1];
            for (int j = 1; j <= n; j++) {
                block[j] = bitsRecibidos.get(i + j - 1);
            }

            // Calcular síndrome
            int syndrome = 0;
            for (int p = 0; p < q; p++) {
                int posParidad = 1 << p;
                int paridad = 0;
                for (int j = 1; j < n; j++) {
                    if ((j & posParidad) != 0) {
                        paridad ^= block[j];
                    }
                }
                if (paridad != 0) {
                    syndrome += posParidad;
                }
            }

            // Calcular paridad global del bloque
            int globalParityCheck = 0;
            for (int j = 1; j <= n; j++) {
                globalParityCheck ^= block[j];
            }

            // SEC-DED: Análisis de error
            if (syndrome != 0) {
                if (globalParityCheck != 0) {
                    // Error simple: Corregible
                    singleErrorsCorrected++;
                    if (corregir && syndrome <= n) {
                        block[syndrome] ^= 1; // Corregir invirtiendo bit
                    }
                } else {
                    // Error doble: Detectable pero no corregible
                    doubleErrorsDetected++;
                }
            } else {
                if (globalParityCheck != 0) {
                    // Error en el bit de paridad global únicamente
                    singleErrorsCorrected++;
                    if (corregir) {
                        block[n] ^= 1; // Corregir bit de paridad global
                    }
                }
            }

            // Extraer bits de datos (posiciones que no son potencias de 2)
            for (int j = 1; j < n; j++) {
                if (!isPowerOfTwo(j)) {
                    bitsRecuperados.add(block[j]);
                }
            }
        }

        byte[] rawBytes = bitsToBytes(bitsRecuperados);

        // Truncar al tamaño original especificado en la cabecera
        byte[] trimmedBytes = new byte[originalSize];
        System.arraycopy(rawBytes, 0, trimmedBytes, 0, Math.min(originalSize, rawBytes.length));

        UnprotectResult result = new UnprotectResult();
        result.data = trimmedBytes;
        result.totalBlocks = totalBlocks;
        result.singleErrorsCorrected = singleErrorsCorrected;
        result.doubleErrorsDetected = doubleErrorsDetected;
        result.isHuffman = header.isHuffman();
        result.lockTimestamp = header.getLockTimestamp();
        result.mPower = mPower;

        return result;
    }

    public byte[] introducirErroresAleatorios(byte[] dataConHeader) {
        if (!PM3Header.hasValidHeader(dataConHeader)) {
            return dataConHeader;
        }

        PM3Header header = new PM3Header(dataConHeader);
        int mPower = header.getMPower();
        int n = 1 << mPower;

        byte[] protectedData = new byte[dataConHeader.length - PM3Header.HEADER_SIZE];
        System.arraycopy(dataConHeader, PM3Header.HEADER_SIZE, protectedData, 0, protectedData.length);

        List<Integer> bits = bytesToBits(protectedData);
        Random random = new Random();
        int erroresIntroducidos = 0;

        int totalBlocks = bits.size() / n;
        double errorProbability = 0.01; // 1% de probabilidad por bloque

        for (int b = 0; b < totalBlocks; b++) {
            if (random.nextDouble() < errorProbability) {
                int posError = random.nextInt(n); // 0 a n-1
                int bitIndex = b * n + posError;
                bits.set(bitIndex, bits.get(bitIndex) ^ 1);
                erroresIntroducidos++;
            }
        }

        // Si no se inyectó ningún error y hay bloques, forzar exactamente 1 error al azar
        if (erroresIntroducidos == 0 && totalBlocks > 0) {
            int randomBlock = random.nextInt(totalBlocks);
            int posError = random.nextInt(n);
            int bitIndex = randomBlock * n + posError;
            bits.set(bitIndex, bits.get(bitIndex) ^ 1);
            erroresIntroducidos++;
        }

        System.out.println("Inyectados " + erroresIntroducidos + " errores aleatorios (tasa de error 1% de bloques, min 1).");
        byte[] corruptedData = bitsToBytes(bits);

        byte[] result = new byte[dataConHeader.length];
        System.arraycopy(dataConHeader, 0, result, 0, PM3Header.HEADER_SIZE);
        System.arraycopy(corruptedData, 0, result, PM3Header.HEADER_SIZE, corruptedData.length);

        return result;
    }

    public byte[] introducirErroresProgramados(byte[] dataConHeader, List<Map<String, Object>> errorList) {
        if (!PM3Header.hasValidHeader(dataConHeader)) {
            return dataConHeader;
        }

        PM3Header header = new PM3Header(dataConHeader);
        int mPower = header.getMPower();
        int n = 1 << mPower;

        byte[] protectedData = new byte[dataConHeader.length - PM3Header.HEADER_SIZE];
        System.arraycopy(dataConHeader, PM3Header.HEADER_SIZE, protectedData, 0, protectedData.length);

        List<Integer> bits = bytesToBits(protectedData);

        for (Map<String, Object> err : errorList) {
            int blockIdx = ((Number) err.get("block")).intValue();
            int bitPos = ((Number) err.get("bit")).intValue(); // 1-indexed (1 to n)

            int bitIndex = blockIdx * n + (bitPos - 1);
            if (bitIndex >= 0 && bitIndex < bits.size()) {
                bits.set(bitIndex, bits.get(bitIndex) ^ 1);
            }
        }

        byte[] corruptedData = bitsToBytes(bits);
        byte[] result = new byte[dataConHeader.length];
        System.arraycopy(dataConHeader, 0, result, 0, PM3Header.HEADER_SIZE);
        System.arraycopy(corruptedData, 0, result, PM3Header.HEADER_SIZE, corruptedData.length);

        return result;
    }

    private boolean isPowerOfTwo(int n) {
        return (n > 0) && ((n & (n - 1)) == 0);
    }

    private List<Integer> bytesToBits(byte[] bytes) {
        List<Integer> bits = new ArrayList<>();
        for (byte b : bytes) {
            for (int i = 7; i >= 0; i--) {
                bits.add((b >> i) & 1);
            }
        }
        return bits;
    }

    private byte[] bitsToBytes(List<Integer> bits) {
        int size = (bits.size() + 7) / 8;
        byte[] bytes = new byte[size];
        for (int i = 0; i < bits.size(); i++) {
            if (bits.get(i) == 1) {
                bytes[i / 8] |= (1 << (7 - (i % 8)));
            }
        }
        return bytes;
    }
}
