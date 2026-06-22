package com.pm3.backend.service;

import com.pm3.backend.model.HuffmanNode;
import org.springframework.stereotype.Service;

import java.io.*;
import java.util.*;

@Service
public class HuffmanService {

    public Map<Character, Integer> calcularFrecuencias(byte[] datos) {
        Map<Character, Integer> frecuencias = new HashMap<>();
        for (byte b : datos) {
            char c = (char) (b & 0xFF); // Convertir byte a char sin signo
            frecuencias.put(c, frecuencias.getOrDefault(c, 0) + 1);
        }
        return frecuencias;
    }

    public HuffmanNode construirArbol(Map<Character, Integer> frecuencias) {
        if (frecuencias.isEmpty()) return null;
        PriorityQueue<HuffmanNode> colaPrioridad = new PriorityQueue<>();
        for (Map.Entry<Character, Integer> entrada : frecuencias.entrySet()) {
            colaPrioridad.add(new HuffmanNode(entrada.getKey(), entrada.getValue()));
        }

        // Si solo hay un carácter único, añadimos un nodo ficticio para tener un árbol válido (2-árbol)
        if (colaPrioridad.size() == 1) {
            HuffmanNode unico = colaPrioridad.poll();
            HuffmanNode padre = new HuffmanNode(null, unico.getFrecuencia(), unico, new HuffmanNode('\0', 0));
            return padre;
        }

        while (colaPrioridad.size() > 1) {
            HuffmanNode izquierdo = colaPrioridad.poll();
            HuffmanNode derecho = colaPrioridad.poll();
            HuffmanNode padre = new HuffmanNode(null, izquierdo.getFrecuencia() + derecho.getFrecuencia(), izquierdo, derecho);
            colaPrioridad.add(padre);
        }

        return colaPrioridad.poll();
    }

    public Map<Character, String> generarCodigos(HuffmanNode raiz) {
        Map<Character, String> codigos = new HashMap<>();
        if (raiz != null) {
            if (raiz.esHoja()) {
                codigos.put(raiz.getCaracter(), "0");
            } else {
                generarCodigosRecursivo(raiz, "", codigos);
            }
        }
        return codigos;
    }

    private void generarCodigosRecursivo(HuffmanNode nodo, String codigo, Map<Character, String> codigos) {
        if (nodo == null) return;
        if (nodo.esHoja()) {
            codigos.put(nodo.getCaracter(), codigo);
            return;
        }
        generarCodigosRecursivo(nodo.getIzquierdo(), codigo + "0", codigos);
        generarCodigosRecursivo(nodo.getDerecho(), codigo + "1", codigos);
    }

    public byte[] comprimir(byte[] datos, Map<Character, String> codigos, Map<Character, Integer> frecuencias) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        DataOutputStream dos = new DataOutputStream(baos);

        // 1. Escribir tamaño de la tabla de frecuencias
        dos.writeInt(frecuencias.size());

        // 2. Escribir tabla de frecuencias
        for (Map.Entry<Character, Integer> entrada : frecuencias.entrySet()) {
            dos.writeChar(entrada.getKey());
            dos.writeInt(entrada.getValue());
        }

        // Calcular total de bits primero para escribir la cabecera
        long totalBits = 0;
        for (byte b : datos) {
            totalBits += codigos.get((char) (b & 0xFF)).length();
        }

        // 3. Escribir total de bits
        dos.writeLong(totalBits);

        // 4. Empaquetar bits en bytes y escribir
        int valorByte = 0;
        int contadorBits = 0;
        for (byte b : datos) {
            String codigo = codigos.get((char) (b & 0xFF));
            for (int i = 0; i < codigo.length(); i++) {
                valorByte = (valorByte << 1) | (codigo.charAt(i) == '1' ? 1 : 0);
                contadorBits++;
                if (contadorBits == 8) {
                    dos.writeByte(valorByte);
                    valorByte = 0;
                    contadorBits = 0;
                }
            }
        }
        
        if (contadorBits > 0) {
            valorByte <<= (8 - contadorBits);
            dos.writeByte(valorByte);
        }

        return baos.toByteArray();
    }

    public byte[] descomprimir(byte[] datosComprimidos) throws IOException {
        ByteArrayInputStream bais = new ByteArrayInputStream(datosComprimidos);
        DataInputStream dis = new DataInputStream(bais);

        int tamanoTabla;
        try {
            tamanoTabla = dis.readInt();
        } catch (Exception e) {
            return new byte[0];
        }

        // Heurística de robustez para tamanoTabla corrupto
        if (tamanoTabla <= 0 || tamanoTabla > 256 || (4 + tamanoTabla * 6 + 8 > datosComprimidos.length)) {
            int sugerido = tamanoTabla & 0xFF;
            if (sugerido == 0) {
                sugerido = 256;
            }
            tamanoTabla = sugerido;
            
            // Si aún así excede el tamaño del archivo, lo limitamos al máximo físicamente posible
            if (4 + tamanoTabla * 6 + 8 > datosComprimidos.length) {
                tamanoTabla = Math.max(1, (datosComprimidos.length - 12) / 6);
            }
        }

        Map<Character, Integer> frecuencias = new HashMap<>();
        try {
            for (int i = 0; i < tamanoTabla; i++) {
                char c = dis.readChar();
                int freq = dis.readInt();
                frecuencias.put(c, freq);
            }
        } catch (Exception e) {
            return new byte[0];
        }

        // 3. Reconstruir árbol
        HuffmanNode raiz = construirArbol(frecuencias);
        if (raiz == null) {
            return new byte[0];
        }

        // 4. Leer total de bits
        long totalBits;
        try {
            totalBits = dis.readLong();
        } catch (Exception e) {
            return new byte[0];
        }

        // Si totalBits se corrompe y es negativo (por ejemplo, por el bit de signo)
        // o si es sospechosamente grande comparado con el tamaño del archivo restante
        if (totalBits < 0 || totalBits > (long) bais.available() * 8) {
            totalBits = (long) bais.available() * 8;
        }

        // 5. Leer bits y recorrer árbol
        ByteArrayOutputStream descomprimido = new ByteArrayOutputStream();
        HuffmanNode actual = raiz;
        long bitsLeidos = 0;

        try {
            while (bitsLeidos < totalBits) {
                int b;
                try {
                    b = dis.readUnsignedByte();
                } catch (EOFException e) {
                    break;
                }
                for (int i = 7; i >= 0 && bitsLeidos < totalBits; i--) {
                    int bit = (b >> i) & 1;
                    if (actual == null) {
                        actual = raiz;
                    }
                    if (bit == 0) {
                        actual = actual.getIzquierdo();
                    } else {
                        actual = actual.getDerecho();
                    }

                    if (actual == null) {
                        actual = raiz;
                    }

                    if (actual.esHoja()) {
                        descomprimido.write((byte) (actual.getCaracter() & 0xFF));
                        actual = raiz;
                    }
                    bitsLeidos++;
                }
            }
        } catch (Exception e) {
            // Capturar cualquier otra excepción interna de decodificación y devolver lo recuperado
        }

        return descomprimido.toByteArray();
    }

    public double calcularEntropia(Map<Character, Integer> frecuencias, int totalCaracteres) {
        if (totalCaracteres == 0) return 0;
        double entropia = 0;
        for (int freq : frecuencias.values()) {
            double p = (double) freq / totalCaracteres;
            entropia += p * (Math.log(1 / p) / Math.log(2));
        }
        return entropia;
    }

    public double calcularLongitudMedia(Map<Character, Integer> frecuencias, Map<Character, String> codigos, int totalCaracteres) {
        if (totalCaracteres == 0) return 0;
        double longitudMedia = 0;
        for (Map.Entry<Character, Integer> entrada : frecuencias.entrySet()) {
            double p = (double) entrada.getValue() / totalCaracteres;
            String codigo = codigos.get(entrada.getKey());
            if (codigo != null) {
                longitudMedia += p * codigo.length();
            }
        }
        return longitudMedia;
    }
}
