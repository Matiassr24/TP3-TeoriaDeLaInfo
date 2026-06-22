package com.pm3.backend.controller;

import com.pm3.backend.dto.PM3Response;
import com.pm3.backend.model.HuffmanNode;
import com.pm3.backend.service.HammingService;
import com.pm3.backend.service.HuffmanService;
import com.pm3.backend.core.PM3Header;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;

@RestController
@RequestMapping("/api/pm3")
@CrossOrigin(origins = "*")
public class PM3Controller {

    @Autowired
    private HuffmanService huffmanService;

    @Autowired
    private HammingService hammingService;

    @PostMapping("/huffman/compress")
    public ResponseEntity<PM3Response> huffmanCompress(@RequestParam("file") MultipartFile archivo) throws Exception {
        byte[] bytesArchivo = archivo.getBytes();
        System.out.println("[DEBUG] Compress request received. File: " + archivo.getOriginalFilename() + ", size: " + bytesArchivo.length + " bytes");
        if (bytesArchivo.length == 0) {
            return ResponseEntity.badRequest().build();
        }

        String vistaPreviaTexto = new String(bytesArchivo, StandardCharsets.UTF_8);

        Map<Character, Integer> frecuencias = huffmanService.calcularFrecuencias(bytesArchivo);
        HuffmanNode raiz = huffmanService.construirArbol(frecuencias);
        Map<Character, String> codigos = huffmanService.generarCodigos(raiz);

        byte[] binarioComprimido = huffmanService.comprimir(bytesArchivo, codigos, frecuencias);

        // Limitar cadena de bits en vista previa para evitar problemas de memoria
        StringBuilder vistaPreviaBits = new StringBuilder();
        int maxBitsPrevia = 10000;
        int bitsAnadidos = 0;
        for (byte b : bytesArchivo) {
            String codigo = codigos.get((char) (b & 0xFF));
            if (codigo != null) {
                if (bitsAnadidos + codigo.length() <= maxBitsPrevia) {
                    vistaPreviaBits.append(codigo);
                    bitsAnadidos += codigo.length();
                } else {
                    vistaPreviaBits.append("...");
                    break;
                }
            }
        }

        int totalSimbolos = bytesArchivo.length;
        double entropia = huffmanService.calcularEntropia(frecuencias, totalSimbolos);
        double longitudMedia = huffmanService.calcularLongitudMedia(frecuencias, codigos, totalSimbolos);
        double eficiencia = longitudMedia > 0 ? entropia / longitudMedia : 0;

        long tamanoOriginalBytes = archivo.getSize();
        long tamanoComprimidoBytes = binarioComprimido.length;
        double ratioCompresion = tamanoComprimidoBytes > 0 ? (double) tamanoOriginalBytes / tamanoComprimidoBytes : 0;

        String base64Comprimido = Base64.getEncoder().encodeToString(binarioComprimido);

        String baseName = archivo.getOriginalFilename();
        if (baseName != null && baseName.contains(".")) {
            baseName = baseName.substring(0, baseName.lastIndexOf("."));
        } else {
            baseName = "compressed";
        }

        PM3Response respuesta = PM3Response.builder()
                .textoOriginal(bytesArchivo.length < 50000 ? vistaPreviaTexto : "Archivo demasiado grande para vista previa")
                .frecuencias(frecuencias)
                .codigos(codigos)
                .entropia(entropia)
                .longitudMedia(longitudMedia)
                .eficiencia(eficiencia)
                .tamanoOriginalBytes(tamanoOriginalBytes)
                .tamanoComprimidoBytes(tamanoComprimidoBytes)
                .ratioCompresion(ratioCompresion)
                .cadenaBits(vistaPreviaBits.toString())
                .datosBinariosBase64(base64Comprimido)
                .nombreArchivoSugerido(baseName + ".huf")
                .build();

        return ResponseEntity.ok(respuesta);
    }

    @PostMapping("/huffman/decompress")
    public ResponseEntity<PM3Response> huffmanDecompress(@RequestParam("file") MultipartFile archivo) throws Exception {
        byte[] datosComprimidos = archivo.getBytes();
        System.out.println("[DEBUG] Decompress request received. File: " + archivo.getOriginalFilename() + ", size: " + datosComprimidos.length + " bytes");
        if (datosComprimidos.length == 0) {
            return ResponseEntity.badRequest().build();
        }

        byte[] bytesDescomprimidos = huffmanService.descomprimir(datosComprimidos);

        long tamanoComprimidoBytes = archivo.getSize();
        long tamanoDescomprimidoBytes = bytesDescomprimidos.length;

        // Calcular estadísticas sobre los bytes descomprimidos para mostrarlas en la pestaña de Estadísticas
        Map<Character, Integer> frecuencias = new HashMap<>();
        Map<Character, String> codigos = new HashMap<>();
        double entropia = 0;
        double longitudMedia = 0;
        double eficiencia = 0;
        double ratioCompresion = 0;

        if (bytesDescomprimidos.length > 0) {
            frecuencias = huffmanService.calcularFrecuencias(bytesDescomprimidos);
            HuffmanNode raiz = huffmanService.construirArbol(frecuencias);
            codigos = huffmanService.generarCodigos(raiz);

            int totalSimbolos = bytesDescomprimidos.length;
            entropia = huffmanService.calcularEntropia(frecuencias, totalSimbolos);
            longitudMedia = huffmanService.calcularLongitudMedia(frecuencias, codigos, totalSimbolos);
            eficiencia = longitudMedia > 0 ? entropia / longitudMedia : 0;
            ratioCompresion = tamanoComprimidoBytes > 0 ? (double) tamanoDescomprimidoBytes / tamanoComprimidoBytes : 0;
        }

        String textoDescomprimido = new String(bytesDescomprimidos, StandardCharsets.UTF_8);
        String base64Descomprimido = Base64.getEncoder().encodeToString(bytesDescomprimidos);

        String baseName = archivo.getOriginalFilename();
        if (baseName != null && baseName.contains(".")) {
            baseName = baseName.substring(0, baseName.lastIndexOf("."));
        } else {
            baseName = "decompressed";
        }

        PM3Response respuesta = PM3Response.builder()
                .textoOriginal(textoDescomprimido)
                .frecuencias(frecuencias)
                .codigos(codigos)
                .entropia(entropia)
                .longitudMedia(longitudMedia)
                .eficiencia(eficiencia)
                .tamanoOriginalBytes(tamanoDescomprimidoBytes)
                .tamanoComprimidoBytes(tamanoComprimidoBytes)
                .ratioCompresion(ratioCompresion)
                .datosBinariosBase64(base64Descomprimido)
                .nombreArchivoSugerido(baseName + ".dhu")
                .build();

        return ResponseEntity.ok(respuesta);
    }

    @PostMapping("/hamming/protect")
    public ResponseEntity<PM3Response> hammingProtect(
            @RequestParam("file") MultipartFile archivo,
            @RequestParam("mPower") int mPower,
            @RequestParam(value = "lockTimestamp", defaultValue = "0") long lockTimestamp) throws IOException {

        byte[] datos = archivo.getBytes();
        System.out.println("[DEBUG] Protect request received. File: " + archivo.getOriginalFilename() + ", size: " + datos.length + " bytes");
        String filename = archivo.getOriginalFilename() != null ? archivo.getOriginalFilename() : "";
        boolean isHuffman = filename.toLowerCase().endsWith(".huf");

        byte[] datosProtegidos = hammingService.proteger(datos, mPower, isHuffman, lockTimestamp);

        // Estadísticas de redundancia/sobrecarga
        long tamanoOriginalBytes = datos.length;
        long tamanoProtegidoBytes = datosProtegidos.length;
        double redundancia = tamanoOriginalBytes > 0 ? 
                ((double) (tamanoProtegidoBytes - tamanoOriginalBytes) / tamanoOriginalBytes) * 100 : 0;

        String base64Protegido = Base64.getEncoder().encodeToString(datosProtegidos);

        String ext = ".HA1";
        if (mPower == 10) ext = ".HA2";
        if (mPower == 14) ext = ".HA3";

        String baseName = filename;
        if (baseName.contains(".")) {
            baseName = baseName.substring(0, baseName.lastIndexOf("."));
        }

        PM3Response respuesta = PM3Response.builder()
                .mPower(mPower)
                .tamanoOriginalBytes(tamanoOriginalBytes)
                .tamanoComprimidoBytes(tamanoProtegidoBytes) // Guardamos el protegido aquí
                .redundancyPercentage(redundancia)
                .datosBinariosBase64(base64Protegido)
                .nombreArchivoSugerido(baseName + ext)
                .build();

        return ResponseEntity.ok(respuesta);
    }

    @PostMapping("/hamming/inject-errors")
    public ResponseEntity<PM3Response> injectErrors(
            @RequestParam("file") MultipartFile archivo,
            @RequestParam("mode") String mode,
            @RequestParam(value = "errorPositions", required = false) String errorPositionsJson) throws IOException {

        byte[] data = archivo.getBytes();
        String filename = archivo.getOriginalFilename() != null ? archivo.getOriginalFilename() : "file.HA1";

        byte[] dataCorrupta;
        if ("random".equalsIgnoreCase(mode)) {
            dataCorrupta = hammingService.introducirErroresAleatorios(data);
        } else {
            // Programmed mode
            List<Map<String, Object>> errorPositions = new ArrayList<>();
            if (errorPositionsJson != null && !errorPositionsJson.isEmpty()) {
                try {
                    ObjectMapper mapper = new ObjectMapper();
                    errorPositions = mapper.readValue(errorPositionsJson, new TypeReference<List<Map<String, Object>>>() {});
                } catch (Exception e) {
                    System.err.println("Error parsing errorPositions: " + e.getMessage());
                }
            }
            dataCorrupta = hammingService.introducirErroresProgramados(data, errorPositions);
        }

        String base64Corrupta = Base64.getEncoder().encodeToString(dataCorrupta);

        // Determine extension for output based on block size in header
        String ext = ".HE1";
        if (PM3Header.hasValidHeader(data)) {
            PM3Header header = new PM3Header(data);
            if (header.getMPower() == 10) ext = ".HE2";
            if (header.getMPower() == 14) ext = ".HE3";
        }

        String baseName = filename;
        if (baseName.contains(".")) {
            baseName = baseName.substring(0, baseName.lastIndexOf("."));
        }

        PM3Response respuesta = PM3Response.builder()
                .datosBinariosBase64(base64Corrupta)
                .nombreArchivoSugerido(baseName + ext)
                .build();

        return ResponseEntity.ok(respuesta);
    }

    @PostMapping("/hamming/unprotect")
    public ResponseEntity<PM3Response> hammingUnprotect(
            @RequestParam("file") MultipartFile archivo,
            @RequestParam("corregir") boolean corregir) throws Exception {

        byte[] data = archivo.getBytes();
        System.out.println("[DEBUG] Unprotect request received. File: " + archivo.getOriginalFilename() + ", size: " + data.length + " bytes");
        String filename = archivo.getOriginalFilename() != null ? archivo.getOriginalFilename() : "file.HA1";

        if (!PM3Header.hasValidHeader(data)) {
            return ResponseEntity.badRequest().body(PM3Response.builder()
                    .textoOriginal("Error: El archivo no tiene un encabezado PM3 válido.")
                    .build());
        }

        HammingService.UnprotectResult unprotectResult = hammingService.desproteger(data, corregir);

        // Check if locked
        if (unprotectResult.data == null && unprotectResult.lockTimestamp > 0) {
            return ResponseEntity.ok(PM3Response.builder()
                    .isLocked(true)
                    .lockTimestamp(unprotectResult.lockTimestamp)
                    .nombreArchivoSugerido(filename)
                    .build());
        }

        byte[] bytesDesprotegidos = unprotectResult.data;
        byte[] bytesFinales = bytesDesprotegidos;
        String textoResultado = "";

        if (unprotectResult.isHuffman) {
            textoResultado = "Archivo desprotegido con éxito (Hamming removido).\n" +
                             "El archivo contiene un flujo compactado con Huffman.\n" +
                             "Descárgalo como archivo .huf, cárgalo en la zona de trabajo y presiona 'Descompactar (.huf)'.";
        } else {
            textoResultado = new String(bytesDesprotegidos, StandardCharsets.UTF_8);
        }

        String base64Final = Base64.getEncoder().encodeToString(bytesFinales);

        // Extension mapping
        String ext;
        if (unprotectResult.isHuffman) {
            ext = ".huf";
        } else {
            ext = corregir ? ".DC" : ".DE";
            if (unprotectResult.mPower == 10) ext += "2";
            else if (unprotectResult.mPower == 14) ext += "3";
            else ext += "1";
        }

        String baseName = filename;
        if (baseName.contains(".")) {
            baseName = baseName.substring(0, baseName.lastIndexOf("."));
        }

        PM3Response respuesta = PM3Response.builder()
                .textoOriginal(textoResultado)
                .mPower(unprotectResult.mPower)
                .totalBlocks(unprotectResult.totalBlocks)
                .singleErrorsCorrected(unprotectResult.singleErrorsCorrected)
                .doubleErrorsDetected(unprotectResult.doubleErrorsDetected)
                .tamanoOriginalBytes(data.length)
                .tamanoDescomprimidoBytes(bytesFinales.length)
                .datosBinariosBase64(base64Final)
                .nombreArchivoSugerido(baseName + ext)
                .build();

        return ResponseEntity.ok(respuesta);
    }
}
